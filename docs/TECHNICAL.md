# ConnectPlus — Technical Specification

**Version:** 1.0  
**Last Updated:** 2026-02-23

---

## 1. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui, CSS custom properties (HSL design tokens) |
| **Animation** | Framer Motion |
| **State Management** | React Context (Auth), TanStack React Query (server state) |
| **Routing** | React Router v6 |
| **Backend** | Supabase (Lovable Cloud) — PostgreSQL, Auth, Edge Functions, Storage |
| **Charts** | Recharts |
| **Gantt** | frappe-gantt |
| **Forms** | React Hook Form + Zod validation |
| **PWA** | vite-plugin-pwa, custom service worker for push |
| **Notifications** | Web Push API (VAPID), Supabase Edge Functions |

---

## 2. Project Structure

```
src/
├── components/
│   ├── admin/          # Admin panel components
│   ├── attendance/     # Check-in/out, verification, history
│   ├── auth/           # ProtectedRoute, AdminRoute, OrganizationRoute
│   ├── cards/          # Reusable card components
│   ├── kanban/         # Kanban board, cards, swim lanes
│   ├── layout/         # AppLayout, BottomNav, NavigationDrawer, RoleBasedNav
│   ├── leave/          # Leave forms, balances, history
│   ├── manager/        # Task management, edit modals
│   ├── modals/         # Work update modal
│   ├── notifications/  # Bell, panel, items, push toggle
│   ├── rooms/          # Room booking, availability, management
│   ├── tasks/          # Detail drawer, filters, Gantt, subtasks, comments, evidence
│   ├── timesheet/      # Log time, weekly view, dashboard
│   └── ui/             # shadcn components, ConnectPlusLoader, ScoreCircle, ProgressBar
├── contexts/
│   └── AuthContext.tsx  # Session management, sign-in/up/out
├── hooks/              # Custom hooks for all features
├── integrations/
│   └── api/            # API client and db client (replaces former Supabase client)
├── pages/              # Route-level page components
├── lib/
│   └── utils.ts        # cn() utility
└── main.tsx            # App entry point

( Supabase removed; backend is Node.js + PostgreSQL only. )
├── config.toml         # Supabase project config (auto-managed)
└── functions/          # Edge Functions
    ├── admin-manage/
    ├── bulk-onboard/
    ├── send-broadcast/
    ├── send-email/
    └── send-push/
```

---

## 3. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `profiles` | User profile data | user_id, full_name, email, department, team_id, manager_id |
| `user_roles` | RBAC role assignments | user_id, role (enum: employee/team_lead/manager/hr/admin/organization) |
| `teams` | Team/department grouping | name, lead_id, description |
| `projects` | Project containers for tasks | name, status, team_id |
| `tasks` | Task records | title, status, priority, assigned_to, assigned_by, project_id, due_date, task_type, parent_task_id |
| `task_activity_logs` | Audit trail for task changes | task_id, action_type, old_value, new_value, performed_by |
| `task_comments` | Threaded discussion on tasks | task_id, author_id, content |
| `task_evidence` | File uploads proving task completion | task_id, file_url, evidence_type, uploaded_by |
| `task_dependencies` | Inter-task dependencies | task_id, depends_on, dependency_type |
| `task_tags` / `task_tag_assignments` | Labels/tags for tasks | name, color / task_id, tag_id |
| `contributions` | Employee work contributions for review | user_id, title, status, task_id, evidence_url |
| `skills` | Self-reported skill tracking | user_id, name, proficiency_level, goal_level |
| `performance_metrics` | Evaluated performance scores | user_id, category_id, score, period |
| `metric_categories` | Categories for performance evaluation | name, weight, icon |
| `meeting_rooms` | Room inventory | name, location, capacity, amenities |
| `room_bookings` | Room reservations | room_id, booked_by, booking_date, start_time, end_time, status |
| `booking_audit_log` | Audit trail for bookings | booking_id, action, performed_by |
| `notifications` | In-app notifications | user_id, title, message, type, read |
| `scheduled_notifications` | Deferred/broadcast notifications | title, message, target_type, scheduled_at, status |
| `push_subscriptions` | Browser push subscription data | user_id, endpoint, p256dh, auth |

### Database Functions

| Function | Purpose |
|----------|---------|
| `check_booking_conflict()` | Detects overlapping room bookings |
| `has_role()` | Checks if a user has a specific role |
| `is_manager_of()` | Validates manager-employee relationship |
| `get_user_profile_id()` | Resolves auth user_id to profile id |
| `create_notification()` | Inserts a notification record |
| `setup_first_admin()` | One-time admin bootstrap with setup code |

---

## 4. Authentication Flow

```
User → AuthPage (email/password)
  → Auth API (signUp/signIn) via Node backend
  → onAuthStateChange listener updates AuthContext
  → ProtectedRoute checks user !== null
  → RoleBasedNav / AdminRoute / OrganizationRoute check useUserRoles()
  → Render appropriate UI
```

**Password Reset:**
```
User → "Forgot Password" → resetPasswordForEmail()
  → Email with recovery link → /reset-password
  → updateUser({ password }) with recovery session
```

---

## 5. Security Model

- **Row-Level Security (RLS):** Enabled on all public tables
- **Policies:** Users can only read/write their own data; managers can access team data; admins have broader access
- **Route Guards:** Three-tier protection (authenticated → role-checked → organization-only)
- **Edge Functions:** Server-side operations for admin tasks, email sending, push notifications
- **No anonymous access:** All signups require email verification (unless explicitly disabled)

---

## 6. Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `admin-manage` | Admin panel actions | Role assignment, user management |
| `bulk-onboard` | CSV upload in admin | Batch create users with profiles and roles |
| `send-broadcast` | Admin broadcast form | Send notifications to groups of users |
| `send-email` | System events | Transactional email delivery |
| `send-push` | Notification creation | Deliver browser push notifications via VAPID |

---

## 7. State Management

| Concern | Solution |
|---------|----------|
| Auth session | `AuthContext` (React Context + Supabase listener) |
| Server data | TanStack React Query (caching, refetching, optimistic updates) |
| UI state | Local `useState` / `useReducer` per component |
| Form state | React Hook Form with Zod schemas |

---

## 8. PWA Configuration

- **Manifest:** Icons at 192px and 512px (`public/pwa-*.png`)
- **Service Worker:** Custom `public/sw-push.js` for push notification handling
- **Install Page:** Dedicated `/install` route with platform-specific instructions
- **Offline:** Basic caching via Vite PWA plugin

---

## 9. Design System

- **Tokens:** HSL-based CSS custom properties in `index.css`
- **Theming:** Light/dark mode via `next-themes`
- **Components:** shadcn/ui as base, customized with design tokens
- **Layout:** `AppLayout` wraps all authenticated pages with `PageHeader` + `RoleBasedNav`
- **Branding:** `SplashScreen` on boot, `ConnectPlusLoader` for all loading states
- **Animation:** Framer Motion for page transitions, list animations, and loader effects
