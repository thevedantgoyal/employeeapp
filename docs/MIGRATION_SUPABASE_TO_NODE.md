# Migration: Supabase → Node.js + PostgreSQL

This document describes the migration from Supabase (Database, Auth, Storage, Functions) to a self-hosted Node.js (Express) backend and PostgreSQL database. **No UI or frontend behavior changes are required** when using the provided API client adapter.

---

## 1. Schema Migration

### 1.1 Run the SQL migration

On your PostgreSQL 14+ server:

```bash
cd backend
export DATABASE_URL="postgresql://user:password@localhost:5432/connectplus"
npm run migrate
```

Or manually:

```bash
psql "$DATABASE_URL" -f backend/scripts/01_schema.sql
```

### 1.2 What the schema includes

- **`users`** table replaces `auth.users`: `id`, `email`, `password_hash`, `full_name`, `created_at`, `updated_at`.
- All former `REFERENCES auth.users(id)` now reference `public.users(id)`.
- **`profiles`**: unchanged structure; `user_id` → `users(id)`.
- **`user_roles`**: same; `user_id` → `users(id)`.
- **`leaves.approver_id`**: references `profiles(id)` (profile of approver).
- **`meeting_rooms.created_by`**, **`room_bookings.booked_by`**, **`booking_audit_log.performed_by`**: reference `users(id)`.
- **`file_storage`**: new table for storing files in PostgreSQL (replaces Supabase Storage); columns: `bucket`, `object_path`, `user_id`, `content_type`, `file_data` (BYTEA).
- All **RLS policies are removed**; access control is enforced in the backend (middleware + services).
- **Triggers kept**: `update_updated_at_column`, `provision_leave_balances`, `notify_leave_applied`, `notify_task_assigned`, `notify_team_assigned`.
- **Functions kept**: `get_user_profile_id`, `has_role`, `is_manager_of`, `check_booking_conflict`, `check_leave_overlap` (called from backend with explicit user context).

---

## 2. Auth Migration

Supabase Auth is replaced with:

- **JWT access tokens** (short-lived) and **refresh tokens** (long-lived).
- **bcrypt** for password hashing (no plaintext).
- **Same role system**: `employee`, `team_lead`, `manager`, `hr`, `admin`, `organization`.

### Endpoints

| Old (Supabase)              | New (Node API)                    |
|----------------------------|-----------------------------------|
| `auth.signUp()`             | `POST /api/auth/signup`           |
| `auth.signInWithPassword()`| `POST /api/auth/login`            |
| `auth.getSession()`        | `GET /api/auth/session` (Bearer)  |
| `auth.signOut()`            | `POST /api/auth/logout`           |
| `auth.resetPasswordForEmail()` | `POST /api/auth/reset-password` |
| `auth.updateUser({ password })` | `PUT /api/auth/password` (Bearer) |
| —                          | `POST /api/auth/refresh` (body: `refresh_token`) |
| —                          | `POST /api/auth/setup-first-admin` (Bearer + `setupCode`) |

### Response shape (unchanged for frontend)

- **Signup / Login**: `{ data: { user, session }, error: null }`.  
  `session`: `{ access_token, refresh_token, expires_in, user }`.  
  `user`: `{ id, email, user_metadata: { full_name } }`.
- **Session**: `{ data: { user, profile }, error: null }`.
- **Errors**: `{ data: null, error: { message } }`.

---

## 3. Storage Migration

Files are stored **in PostgreSQL** in the `file_storage` table.

- **Upload**: `POST /api/storage/upload` (multipart: `bucket`, `path`, `file`).  
  Returns `{ data: { url, path }, error: null }`.
- **Download**: `GET /api/storage/:bucket/*` (path after bucket).  
  Auth: owner, or admin, or (for `resumes`) manager of owner.
- Frontend previously used `supabase.storage.from('avatars').upload(...)` and `getPublicUrl()`.  
  Replace with the upload endpoint and use the returned `url` (or same path under your API origin) for `avatar_url` / `resume_url` / evidence URLs.

---

## 4. API Layer (Replace Supabase Client)

Backend exposes:

- **Auth**: `/api/auth/*` (see above).
- **Profiles**: `GET /api/profiles/me`, `PATCH /api/profiles/me`, `GET /api/profiles` (HR/Admin), `GET /api/profiles/team/:teamId`.
- **Leaves**: `POST /api/leaves/:leaveId/approve`, `POST /api/leaves/:leaveId/reject` (body: `{ comment? }`).
- **Data (generic)**:  
  - `GET /api/data/:table` — query params as filters (e.g. `user_id`, `team_id`, `assigned_to`).  
  - `GET /api/data/:table/single?eq=user_id:uuid` — single row.  
  - `POST /api/data/:table` — insert (body = row).  
  - `PATCH /api/data/:table?id=...` or `?user_id=...` — update.  
  - `DELETE /api/data/:table?id=...` — delete.
- **RPC**:  
  - `POST /api/rpc/check_booking_conflict` — body: `_room_id`, `_booking_date`, `_start_time`, `_end_time`, `_exclude_id?`.  
  - `POST /api/rpc/check_leave_overlap` — body: `_user_id`, `_from_date`, `_to_date`, `_exclude_id?`.  
  - `POST /api/rpc/create_notification` — body: `_user_id`, `_type`, `_title`, `_message`, `_metadata?`.

All responses use **same shape**: `{ data, error }` (Supabase-like). Access control is enforced in the backend (RLS logic in middleware + data service).

---

## 5. Security (RLS → Backend)

- **Authentication**: `Authorization: Bearer <access_token>` on protected routes.
- **RBAC**: Middleware `requireRoles('admin')`, `requireManagerOrAdmin`, `requireHrOrAdmin`, etc.
- **Hierarchy**: Leave approve/reject checks that the approver is the employee’s reporting manager (or admin if no manager).
- **Ownership**: Data service and routes restrict rows by `user_id` / `profile_id` so users only see/edit their own or (for managers) their reportees’ data.
- **IDOR**: All mutations validate that the resource belongs to the user or that the user has the required role.

---

## 6. Backward Compatibility

- **Response structure**: Every success is `{ data, error: null }`, every error `{ data: null, error: { message } }`.
- **Auth**: Same `user` / `session` shape so the existing AuthContext can be wired to the new API (see below).
- **No UI changes**: Use the provided API client (or switch AuthContext to call the new endpoints); all existing features continue to work.

---

## 7. Frontend Switch to Custom Backend

### 7.1 Environment

Add to `.env`:

```env
VITE_API_URL=http://localhost:4000/api
VITE_USE_CUSTOM_BACKEND=true
```

### 7.2 API client

Create `src/integrations/api/client.ts` that:

- Uses `VITE_API_URL` for base URL.
- Sends `Authorization: Bearer <access_token>` from localStorage (or your session store).
- On 401, optionally tries refresh token then retries.
- Exposes methods that return `{ data, error }` in the same shape as Supabase.

### 7.3 AuthContext

In `src/App.tsx`, switch the provider when using the custom backend:

```tsx
// Use custom backend auth when env is set
const useCustomBackend = import.meta.env.VITE_USE_CUSTOM_BACKEND === 'true';
import { AuthProvider as SupabaseAuthProvider } from '@/contexts/AuthContext';
import { AuthProvider as CustomAuthProvider } from '@/contexts/AuthContextCustomBackend';
const AuthProvider = useCustomBackend ? CustomAuthProvider : SupabaseAuthProvider;

// Then use <AuthProvider> as usual.
```

When `VITE_USE_CUSTOM_BACKEND=true`:

- **Initial load**: Call `GET /api/auth/session` with the stored access token; if 200, set `user`/`session` from response.
- **signUp**: `POST /api/auth/signup` with `{ email, password, fullName }`; store `session.access_token` and `session.refresh_token`; set user/session from response.
- **signIn**: `POST /api/auth/login`; same storage and state.
- **signOut**: Clear tokens and set user/session to null; optionally call `POST /api/auth/logout`.
- **resetPassword**: `POST /api/auth/reset-password` with `{ email }`.
- **Password update (reset flow)**: `PUT /api/auth/password` with `{ password }` and Bearer token.

Keep the same `User` and `Session` types (or minimal interface: `user.id`, `user.email`, `session.access_token`) so the rest of the app does not change.

### 7.4 Data hooks

Replace `supabase.from('table').select(...).eq(...)` with:

- `api.get('/data/table', { params: { user_id: user.id } })` for list.
- `api.get('/data/table/single', { params: { eq: `user_id:${user.id}` } })` for single.
- `api.patch('/data/table', { params: { user_id: user.id }, data: updates })` for update.
- `api.post('/data/table', data)` for insert.
- `api.delete('/data/table', { params: { id } })` for delete.

Replace `supabase.rpc('approve_leave', { _leave_id })` with `api.post('/leaves/' + leaveId + '/approve', { comment })`, and similarly for `reject_leave`, `check_booking_conflict`, `check_leave_overlap`, `create_notification`.

Replace storage uploads with `POST /api/storage/upload` (multipart) and use the returned URL for `avatar_url`, `resume_url`, or evidence links.

---

## 8. Migration Steps (Summary)

1. **Database**: Create PostgreSQL database; run `backend/scripts/01_schema.sql`.
2. **Backend**: Copy `backend/.env.example` to `backend/.env`; set `DATABASE_URL`, `JWT_SECRET`, `PORT`, etc. Run `npm install` and `npm start` in `backend`.
3. **Data export (Supabase)**: Use Supabase dashboard or `pg_dump` to export data from Supabase (excluding `auth.*`). Map `auth.users` to `public.users`: create `users` rows with `id`, `email`, `password_hash` (you must generate hashes with bcrypt from existing passwords or force reset), `full_name` from metadata.
4. **Data import**: Import into your PostgreSQL (profiles, user_roles, teams, projects, tasks, etc.). Ensure `users.id` matches `profiles.user_id` and all FKs.
5. **Storage**: Export files from Supabase Storage; re-upload via `POST /api/storage/upload` or bulk-insert into `file_storage` (with correct `bucket`, `object_path`, `user_id`, `content_type`, `file_data`).
6. **Frontend**: Point env to `VITE_API_URL` and `VITE_USE_CUSTOM_BACKEND=true`; use the new API client and AuthContext as above.
7. **Rollback**: Keep Supabase project and env until you verify the new backend; switch `VITE_USE_CUSTOM_BACKEND` back to use Supabase.

---

## 9. Deployment

- **Node**: Run with `node src/index.js` or a process manager (PM2, systemd). Use `NODE_ENV=production` and a strong `JWT_SECRET`.
- **PostgreSQL**: Connection pooling is enabled in `backend/src/config/database.js` (max 20). Use a managed DB or your own server with backups.
- **Reverse proxy**: Put the API behind nginx/Cloudflare; use HTTPS and same origin or CORS for the frontend.

---

## 10. Confirmation

- **Schema**: All tables, FKs, indexes, enums, and triggers from the Supabase migrations are reflected in `01_schema.sql` (with `users` replacing `auth.users` and RLS removed).
- **Auth**: JWT + bcrypt; same roles; same signup/login/session/reset flow and response shape.
- **Storage**: Same logical behavior (upload, download, access by owner/manager/admin) with files stored in PostgreSQL.
- **APIs**: All features (attendance, leave, room booking, timesheets, tasks, projects, performance, profile, skills, employee management) are covered by the data API + profiles + leaves + RPC endpoints; response format is unchanged.
- **Security**: RLS replaced by backend middleware and service-layer checks; no breaking change for the frontend when using the adapter.
