# Attendance Module – Feature Documentation

This document describes how the **Attendance** section works in the ConnectPlus project, including face verification, check-in, check-out, tools, libraries, dependencies, and modules used.

---

## 1. Overview

The Attendance module provides:

- **Face verification** – Capture live face and compare with the user’s profile photo (backend-enforced).
- **Location verification** – Ensure the user is within a configured office geo-fence (radius).
- **Check-in** – Record attendance for the day (once per day, after face + location pass).
- **Check-out** – Record end time for the same day (only if check-in exists).
- **Attendance history** – List past records with check-in/check-out times and duration.

Check-in is **only allowed after** successful face verification and location verification. The backend never trusts a client-sent “verified” flag; it uses a short-lived **verification token** issued after a successful face check.

---

## 2. End-to-End Flow

### 2.1 Check-in flow

1. User opens **Attendance** → **Today** tab.
2. User reads **Secure Attendance Verification** (disclaimer) and taps **Mark Attendance**.
3. **Face verification**
   - Camera opens; user taps **Capture & Verify**.
   - Frontend sends captured image (base64) to `POST /api/attendance/verify-face`.
   - Backend loads profile avatar from storage, runs face comparison (Node ML or Python).
   - If match: backend returns `faceVerified: true` and a **verification token** (JWT, 2 min).
   - If no match: 403 with message (e.g. “Face Not Verified. Please Retry.”); user can retry.
4. **Location verification**
   - Browser geolocation is used; distance to office is computed.
   - If within radius (e.g. 70 m): user proceeds to confirmation.
   - If outside: error message and retry.
5. **Confirmation**
   - User taps **Confirm Check-In**.
   - Frontend calls `POST /api/attendance/check-in` with **verification token** and optional `location_lat`, `location_lng`.
   - Backend validates token (must be recent and for same user), then in a **transaction**:
     - Checks if a row already exists for today for this user.
     - If already checked in → 409 “Already checked in for today.”
     - Otherwise **INSERT**s one row with `check_in_time`, `status`, `face_verified`, location.
   - UI updates (today marked, history refreshed).

### 2.2 Check-out flow

1. User opens **Attendance** → **Today** tab (after having checked in).
2. “Checked In” card is shown with **Mark Check-Out**.
3. User taps **Mark Check-Out** → optional face/location step → confirmation.
4. Frontend calls `POST /api/attendance/check-out` (no body required).
5. Backend runs:  
   `UPDATE attendance SET check_out_time = now(), updated_at = now()  
    WHERE user_id = $1 AND date = CURRENT_DATE AND check_out_time IS NULL  
    RETURNING *`  
   - If no row updated → 404 “Check-in not found. You must check in before checking out.”
6. UI updates (today checked out, history refreshed).

### 2.3 History

- **GET** attendance list is done via the generic data API:  
  `GET /api/data/attendance?user_id=<id>&order=date&ascending=false&limit=30`
- Backend filters by `user_id` (and manager access if applicable).
- Frontend maps rows to `AttendanceRecord` and shows **Today** vs **History** (list with date, check-in, check-out, duration).

---

## 3. Backend – API & Logic

### 3.1 Routes (Express)

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/api/attendance/verify-face` | Face verification: body `{ capturedImage, timestamp }`. Returns `{ faceVerified, message, verificationToken? }`. |
| POST   | `/api/attendance/check-in`    | Check-in: body `{ verificationToken, location_lat?, location_lng? }`. Requires valid token. Inserts one row per day (transaction). |
| POST   | `/api/attendance/check-out`   | Check-out: no body. Updates today’s row (sets `check_out_time`). |

All routes use **authenticate** middleware (JWT).  
Generic `POST /api/data/attendance` is **blocked** (400) so that check-in can only happen via the dedicated check-in endpoint with face verification.

### 3.2 Face verification (backend)

- **Input:** Captured image (base64; data URL prefix is stripped before decode).
- **Reference:** Profile avatar from `profiles.avatar_url` → resolved to storage path → `storageService.getFile('avatars', objectPath)`.
- **Comparison:**
  - **Primary:** `@vladmandic/face-api` + `@tensorflow/tfjs-node` (loads models from `backend/models`), computes 128-d face descriptors, compares with Euclidean distance and configurable threshold.
  - **Fallback:** Python script `backend/scripts/compare_faces.py` using `face_recognition` (pip). Writes temp JPEGs, spawns script, parses JSON `{ "match": true|false, "error": ... }` from stdout.
- **Output:** `{ verified: true|false, message }`. On success, route also returns a **verification token** (JWT, purpose `attendance_face`, 2 min expiry).
- **Security:** Replay protection (timestamp tolerance), attempt limit per user, no trust of client “faceVerified” flag.

### 3.3 Check-in (backend)

- Validates **verification token** (JWT, purpose, expiry, `userId` matches `req.userId`). If invalid → 403 “Face Not Verified. Please Retry.”
- Uses DB **transaction**: SELECT for today → if row exists with `check_in_time` → 409; else INSERT with `user_id`, `date = CURRENT_DATE`, `check_in_time`, `status`, `location_lat`, `location_lng`, `face_verified = true` (or omit if column missing). On unique violation (23505) → 409.

### 3.4 Check-out (backend)

- Single **UPDATE** by `user_id` and `CURRENT_DATE` and `check_out_time IS NULL`. No INSERT. If no row updated → 404.

---

## 4. Database

### 4.1 Table: `attendance`

| Column           | Type        | Description                    |
|------------------|------------|--------------------------------|
| id               | UUID       | Primary key                    |
| user_id          | UUID       | FK to `users(id)`              |
| date             | DATE       | Attendance date                |
| check_in_time    | TIMESTAMPTZ| Check-in time                  |
| check_out_time   | TIMESTAMPTZ| Check-out time (nullable)     |
| status           | TEXT       | `present`, `late`, `half_day`, `absent` |
| location_lat     | NUMERIC    | Latitude at check-in          |
| location_lng     | NUMERIC    | Longitude at check-in          |
| notes            | TEXT       | Optional                       |
| created_at       | TIMESTAMPTZ|                                |
| updated_at       | TIMESTAMPTZ|                                |
| face_verified    | BOOLEAN    | Optional (migration 03); default false |

- **Unique constraint:** `(user_id, date)` – one row per user per day.
- **Indexes:** `user_id`, `date`, `(user_id, date)`.

Migration `backend/scripts/03_attendance_face_verified.sql` adds `face_verified` if not present.

---

## 5. Frontend – Modules & Components

### 5.1 Pages

- **`src/pages/AttendancePage.tsx`**  
  Main attendance UI: Today / History tabs, orchestrates verification flow (disclaimer → face → location → confirmation) and shows Today status and history list.

### 5.2 Hooks

- **`src/hooks/useAttendance.ts`**  
  - State: steps, face/location status, todayMarked, todayCheckedOut, attendanceHistory, errorMessage, workingDurationSeconds.  
  - Fetches history via `db.from("attendance").select(...).eq("user_id", user.id).order("date", { ascending: false }).limit(30)`.  
  - `verifyFaceWithBackend(capturedImageBase64)` → POST verify-face, stores `verificationToken` on success.  
  - `confirmAttendance()` → POST check-in with token and location.  
  - `confirmCheckOut()` → POST check-out.  
  - Helpers: `getTodayAttendance()`, `formattedWorkingDuration()`, distance/duration math, `dbRowToRecord()`.

### 5.3 Attendance components

| Component                    | Path                                      | Role |
|-----------------------------|-------------------------------------------|------|
| TodayStatus                 | `src/components/attendance/TodayStatus.tsx` | Today card: “Not marked” / “Checked In” (with Mark Check-Out) / “Session Complete”. |
| AttendanceDisclaimer        | `src/components/attendance/AttendanceDisclaimer.tsx` | Disclaimer text and “Mark Attendance” to start flow. |
| FaceVerification            | `src/components/attendance/FaceVerification.tsx` | Camera stream, capture button, call to `verifyFaceWithBackend`, retry on failure. |
| LocationVerification        | `src/components/attendance/LocationVerification.tsx` | Geolocation, distance to office, within/outside radius. |
| AttendanceConfirmation      | `src/components/attendance/AttendanceConfirmation.tsx` | Check-in confirmation and “Confirm Check-In”. |
| CheckOutConfirmation        | `src/components/attendance/CheckOutConfirmation.tsx` | Check-out confirmation and “Confirm Check-Out”. |
| AttendanceHistory           | `src/components/attendance/AttendanceHistory.tsx` | List of past attendance records. |

### 5.4 UI building blocks

- **Tabs** (Today / History), **Card**, **Button**, **Badge**, **Loader** (e.g. from `@/components/ui/*`).
- **Framer Motion** for transitions (`motion.div`, `AnimatePresence`).
- **Lucide React** for icons (e.g. Camera, MapPin, CheckCircle, Clock, LogOut).
- **Sonner** for toasts (success/error messages).

---

## 6. Tools, Libraries & Dependencies

### 6.1 Backend (Node.js)

**Core (package.json):**

- **express** – HTTP server and routes.
- **jsonwebtoken** – Sign/verify verification token and auth JWT.
- **pg** – PostgreSQL client for attendance and storage.
- **dotenv** – Environment variables.
- **multer** – File upload (e.g. storage).

**Face verification:**

- **Optional (optionalDependencies):**
  - **@tensorflow/tfjs-node** – TensorFlow.js backend for Node; used to decode image and run face detection.
  - **@vladmandic/face-api** – Face detection and 128-d descriptors (SSD MobileNet, FaceLandmark68, FaceRecognitionNet).
- **Fallback:** Python 3 script `compare_faces.py`:
  - **face_recognition** (pip) – `face_recognition.load_image_file`, `face_encodings`, `compare_faces` with tolerance (env `FACE_VERIFICATION_THRESHOLD`, default 0.6).

**Internal modules:**

- **`backend/src/services/faceVerificationService.js`** – Loads TF/face-api or calls Python; returns `{ verified, message }`.
- **`backend/src/services/storageService.js`** – Fetches profile avatar buffer from DB storage by bucket/path.
- **`backend/src/routes/attendanceRoutes.js`** – verify-face, check-in, check-out; JWT verification token; transaction and INSERT/UPDATE logic.
- **`backend/src/config/database.js`** – `query()`, `getPool()` for transactions.
- **`backend/src/config/index.js`** – `config.jwt.secret` for token signing.
- **`backend/src/middleware/auth.js`** – JWT auth, attaches `req.userId`, `req.profile` (for avatar_url).

### 6.2 Frontend (React + Vite)

**Core:**

- **react**, **react-dom** – UI.
- **react-router-dom** – Routing (e.g. `/attendance`).
- **@tanstack/react-query** – Not used directly in useAttendance for the dedicated endpoints; used elsewhere. Attendance uses `fetch` for verify-face, check-in, check-out and `db.from("attendance").select(...)` for history.

**UI & UX:**

- **framer-motion** – Animations on attendance page and components.
- **lucide-react** – Icons.
- **sonner** – Toasts.
- **date-fns** – `format()` for dates and times in history and duration.

**Data & auth:**

- **`@/integrations/api/db`** – API client: `db.from("attendance").select|insert|update`, `db.auth.getSession()` for access token.
- **`@/contexts/AuthContext`** – `useAuth()` for current `user`.

**Components:**

- Radix-based UI (e.g. Tabs, Card, Button, Badge) and Tailwind CSS.

### 6.3 Database

- **PostgreSQL** – `attendance` table, unique on `(user_id, date)`, indexes, optional `face_verified` column (migration 03).
- **file_storage** (or equivalent) – Stores avatar files for profile photos; referenced by `profiles.avatar_url`.

---

## 7. Environment & Configuration

**Backend (.env / env):**

- **JWT_SECRET** – Signing verification token and auth tokens.
- **DATABASE_URL** – PostgreSQL connection.
- **FACE_VERIFICATION_THRESHOLD** – Distance threshold for match (default 0.6).
- **FACE_VERIFICATION_MAX_RETRIES** – Max failed attempts per window (default 3).
- **FACE_VERIFICATION_WINDOW_MS** – Window for attempt limit (e.g. 15 min).
- **FACE_VERIFICATION_PYTHON** – Optional Python path (default `python3` or `venv/bin/python`).
- **FACE_VERIFICATION_ALLOW_SKIP** – If `true`, when ML/Python are unavailable, verification is skipped (dev only; not for production).

**Frontend:**

- **VITE_API_URL** – Base API URL (e.g. `http://localhost:4000/api`) for verify-face, check-in, check-out.

---

## 8. File Reference (attendance-related)

| Layer   | File / path |
|--------|-----------------------------------------------|
| Backend routes | `backend/src/routes/attendanceRoutes.js` |
| Backend routes mount | `backend/src/routes/index.js` (e.g. `/attendance`) |
| Face service | `backend/src/services/faceVerificationService.js` |
| Storage service | `backend/src/services/storageService.js` |
| Auth middleware | `backend/src/middleware/auth.js` |
| Python script | `backend/scripts/compare_faces.py` |
| Schema | `backend/scripts/01_schema.sql` (attendance table) |
| Migration | `backend/scripts/03_attendance_face_verified.sql` |
| Page | `src/pages/AttendancePage.tsx` |
| Hook | `src/hooks/useAttendance.ts` |
| Components | `src/components/attendance/*` (TodayStatus, FaceVerification, LocationVerification, AttendanceConfirmation, CheckOutConfirmation, AttendanceHistory, AttendanceDisclaimer) |
| Data API (history, block POST) | `backend/src/routes/dataRoutes.js` (attendance filters, POST blocked) |

---

## 9. Summary

- **Face verification** is done on the backend (Node with TensorFlow.js + face-api, or Python `face_recognition`). The frontend only sends the captured image; the backend returns a time-limited **verification token** used for check-in.
- **Check-in** is a single INSERT per user per day, guarded by the verification token and a DB transaction; duplicate check-in returns 409.
- **Check-out** is an UPDATE on today’s row with null `check_out_time`; no INSERT.
- **Libraries:** Backend uses Express, JWT, pg, and optionally TensorFlow.js + face-api or Python face_recognition; frontend uses React, Framer Motion, date-fns, Sonner, and the shared API/db and auth context.
- **Modules:** Attendance is implemented by the routes and face/storage services on the backend, and by `AttendancePage`, `useAttendance`, and the attendance components on the frontend, with the `attendance` table and optional `face_verified` column in PostgreSQL.
