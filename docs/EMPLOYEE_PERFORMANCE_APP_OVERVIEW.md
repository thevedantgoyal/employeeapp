# Employee Performance Management System

**Product & Technical Overview**
**Application Name:** CacheTask (ConnectPlus)
**Platform:** Progressive Web App (Mobile-first)
**Last Updated:** 2026-02-26

---

## 1. Project Overview

CacheTask is a workforce management platform built to give organizations a single, unified tool for tracking employee performance, managing tasks, recording attendance, and handling leave workflows.

It is designed for companies that need visibility into day-to-day employee output without relying on fragmented spreadsheets, disconnected apps, or manual reporting. The platform serves six distinct user roles — Employee, Team Lead, Manager, HR, Admin, and Organization (Board) — each with tailored dashboards and capabilities.

The application was built to replace the patchwork of tools most companies use to manage their workforce, offering a consistent mobile-first experience that works for both office and field employees.

---

## 2. Problem Statement

Most organizations struggle with a common set of challenges when it comes to employee performance:

### Fragmented Tooling
Companies typically use separate systems for attendance, task tracking, leave management, and performance reviews. This leads to data silos, inconsistent records, and wasted time switching between platforms.

### Manual Task Tracking
When tasks are tracked via email, chat, or spreadsheets, there is no reliable audit trail. Managers lose visibility into what was assigned, when it was completed, and whether evidence of completion exists.

### Attendance and Leave Gaps
Traditional attendance systems (punch cards, manual registers) are easy to manipulate and difficult to audit. Leave balances are often tracked in spreadsheets that fall out of sync with actual records.

### Lack of Transparency
Employees often have no clear picture of how their performance is being evaluated. Managers lack real-time data on team output. This disconnect leads to disputes during reviews and erodes trust between teams and leadership.

### No Unified Mobile Experience
Field employees and remote workers are often excluded from desktop-only systems. Organizations need a platform that works on any device, anywhere.

---

## 3. Solution Overview

CacheTask addresses each of these problems through a centralized, role-aware platform:

| Problem | Solution |
|---------|----------|
| Fragmented tools | Single platform for tasks, attendance, leave, performance, and room booking |
| Manual task tracking | Structured task lifecycle with status tracking, evidence uploads, comments, and activity logs |
| Attendance manipulation | Simulated face verification and GPS-based location checks during check-in/check-out |
| Leave tracking errors | Digital leave balance cards with application, approval, and history workflows |
| Lack of transparency | Role-based dashboards showing real-time metrics, contributions, and review history |
| No mobile access | Progressive Web App installable on any device with offline support |

### Key Differentiators

- **Role-Based Access Control (RBAC):** Six roles with distinct permissions enforced at both the UI and database level through Row-Level Security policies.
- **Evidence-Based Task Completion:** Employees attach screenshots, files, or other proof when marking tasks as complete.
- **Activity Audit Trail:** Every task change — status update, reassignment, comment — is automatically logged.
- **Manager Review Workflow:** Contributions submitted by employees go through a structured review process.

---

## 4. How the Application Works

### System Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Frontend   │────▶│  Auth Layer  │────▶│    Database      │
│  (React PWA) │◀────│  (JWT/RLS)   │◀────│  (PostgreSQL)    │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                                          │
       │         ┌──────────────────┐              │
       └────────▶│  Edge Functions  │──────────────┘
                 │  (Server Logic)  │
                 └──────────────────┘
```

### Step-by-Step Flow

#### Authentication
1. User signs up with email and password. Email verification is required.
2. On login, the auth system issues a JWT containing the user's unique ID.
3. The JWT is automatically attached to every database request via the client SDK.
4. Row-Level Security (RLS) policies on every table use this JWT to determine what data the user can see and modify.

#### Role Resolution
1. After authentication, the app queries the `user_roles` table to determine the user's assigned roles.
2. The `useUserRoles` hook exposes boolean flags (`isAdmin`, `isManager`, `isHR`, etc.) used throughout the UI.
3. Route guards (`ProtectedRoute`, `AdminRoute`, `OrganizationRoute`) prevent unauthorized access to restricted pages.
4. The navigation drawer dynamically shows or hides menu items based on the user's roles.

#### Manager Capabilities
- Assign tasks to team members with priority, due dates, and project association
- Review employee contributions and approve or reject them
- View team-wide performance metrics and attendance records
- Access the Kanban board and Gantt timeline for project oversight
- Approve or deny leave requests

#### Employee Capabilities
- View assigned tasks and update their status through the defined lifecycle
- Upload evidence (screenshots, documents) to prove task completion
- Mark daily attendance with face verification and location check
- Apply for leave and track balance and history
- Log daily work hours via the timesheet module
- Track personal skills and view performance scores

#### Data Flow (Task Fetch Example)
```
Employee opens Tasks page
  → useTasks hook fires
    → Supabase SDK sends GET request with JWT in Authorization header
      → PostgRES layer applies RLS policies
        → PostgreSQL returns only rows where assigned_to matches user's profile ID
          → Response mapped to frontend state
            → UI renders task list
```

---

## 5. Core Features

### 5.1 Authentication & Authorization
- Email/password signup with email verification
- Password reset via recovery email
- Six-role RBAC: Employee, Team Lead, Manager, HR, Admin, Organization
- JWT-based session management
- Three-tier route protection (authenticated → role-checked → organization-only)

### 5.2 Task Management
- **Views:** List, Kanban board, Gantt timeline
- **Lifecycle:** Pending → In Progress → Review → Blocked → Completed → Approved
- **Task Types:** Project tasks and ad-hoc tasks
- Subtask hierarchy (parent-child relationships)
- Task dependencies (finish-to-start)
- Evidence uploads for task completion proof
- Threaded comments per task
- Tags and labels for categorization
- Automatic activity logging for all changes
- Advanced filters by status, priority, date range, and search
- Soft-delete with full audit trail

### 5.3 Attendance Management
- Daily check-in and check-out with timestamp recording
- Simulated face verification via camera capture
- Simulated GPS location verification
- Attendance history with calendar view
- Today's status card on the dashboard

### 5.4 Leave Management
- Leave balance cards (annual, sick, casual, etc.)
- Leave application with date range, type, and reason
- Leave history with status tracking
- Manager approval workflow

### 5.5 Timesheet & Work Logging
- Weekly view for logging hours per day
- Project-based time allocation
- Daily work update summaries
- Dashboard with total hours and trends

### 5.6 Skills & Performance
- Self-reported skill proficiency with goal levels
- Performance metrics tied to evaluation categories
- Score visualization (circle charts, progress bars)
- Manager-evaluated performance reviews

### 5.7 Meeting Room Booking
- Room availability grid
- Booking with time slot, purpose, participants, and priority
- Conflict detection via database function
- Booking audit trail
- Admin room management (create, edit, delete rooms)

### 5.8 Notifications
- In-app notification bell with unread count
- Notification panel with mark-as-read
- Browser push notifications (Web Push API)
- Admin broadcast system (all users, specific roles, or teams)
- Scheduled notification support

### 5.9 Admin Panel
- User role assignment and revocation
- Bulk employee onboarding via CSV upload
- Email notification settings
- System-wide notification broadcasts
- Team and department management

### 5.10 Organization Dashboard
- Company-wide reports and analytics
- Aggregated metrics across teams
- Restricted to the Organization role

### 5.11 Profile Management
- View and edit personal details (name, phone, department, job title, location)
- Avatar upload
- LinkedIn URL
- Work hours configuration

---

## 6. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui, HSL design tokens |
| Animation | Framer Motion |
| State | React Context (Auth), TanStack React Query (server state) |
| Routing | React Router v6 |
| Backend | PostgreSQL, Auth, Edge Functions, Storage (Lovable Cloud) |
| Charts | Recharts |
| Gantt | frappe-gantt |
| Forms | React Hook Form + Zod |
| PWA | vite-plugin-pwa, custom service worker |

---

## 7. Database Architecture

### Identity Model

The system uses a two-layer identity model:

- **Auth UUID** (`auth.users.id`): Generated at signup. Used for authentication and JWT claims.
- **Profile UUID** (`profiles.id`): Application-level identity. All table references (task assignments, contributions, reviews) point to this ID.

A trigger automatically creates a profile record when a new user signs up, linking `profiles.user_id` to `auth.users.id`.

### Key Relationships

```
auth.users (1) ──── (1) profiles
profiles   (1) ──── (N) user_roles
profiles   (1) ──── (N) tasks (via assigned_to)
profiles   (1) ──── (N) tasks (via assigned_by)
profiles   (1) ──── (N) contributions
profiles   (1) ──── (1) profiles (via manager_id — self-referential)
teams      (1) ──── (N) profiles (via team_id)
projects   (1) ──── (N) tasks (via project_id)
tasks      (1) ──── (N) tasks (via parent_task_id — subtasks)
tasks      (1) ──── (N) task_comments
tasks      (1) ──── (N) task_evidence
tasks      (1) ──── (N) task_activity_logs
tasks      (N) ──── (N) task_tags (via task_tag_assignments)
meeting_rooms (1) ── (N) room_bookings
```

### Security Model

- **Row-Level Security (RLS)** is enabled on every public table.
- Policies enforce that users can only access their own data unless they hold a privileged role.
- Managers can access data for employees they supervise (via `is_manager_of()` database function).
- Admins have broader access for user and system management.
- Edge Functions handle server-side operations (bulk onboarding, email, push notifications) with elevated privileges.

---

## 8. Non-Functional Requirements

| Requirement | Implementation |
|-------------|----------------|
| Platform | PWA — installable on mobile and desktop |
| Responsiveness | Mobile-first design, scales to tablet and desktop |
| Performance | Branded loading indicators, skeleton loaders for dashboards |
| Security | RLS on all tables, auth-gated routes, no anonymous access |
| Offline | Service worker for push notifications, basic PWA caching |
| Branding | Custom splash screen, branded loaders, PWA icons |

---

## 9. Current Limitations (v1)

- Face recognition is simulated (camera capture without biometric matching)
- GPS geofencing is simulated (location capture without boundary enforcement)
- No third-party calendar integration (Google/Outlook)
- No payroll or compensation management
- No AI-powered analytics or recommendations
- No native mobile apps (iOS/Android) — PWA only

---

## 10. Success Metrics

| Metric | Target |
|--------|--------|
| Daily active user adoption | 80%+ within first month |
| Task completion rate | Measurable improvement over baseline |
| Attendance compliance | Reduction in missed check-ins |
| User satisfaction | In-app feedback score ≥ 4.0/5.0 |
| Perceived load time | Under 2 seconds for any action |
