# ConnectPlus — Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** 2026-02-23  
**Product Name:** ConnectPlus (CacheTask)  
**Platform:** Progressive Web App (Mobile-first)

---

## 1. Executive Summary

ConnectPlus is an enterprise-grade workforce management PWA designed for organizations to streamline employee productivity, attendance tracking, task management, leave workflows, and team collaboration — all from a single mobile-first interface.

---

## 2. Problem Statement

Organizations struggle with:
- Fragmented tools for attendance, tasks, leave, and performance tracking
- Lack of real-time visibility into team productivity
- Manual, error-prone HR processes (onboarding, role management)
- No unified mobile experience for field and office employees

---

## 3. Target Users & Roles

| Role | Description |
|------|-------------|
| **Employee** | Core user — marks attendance, manages tasks, applies for leave, logs timesheets |
| **Team Lead** | Supervises a team, reviews tasks and contributions |
| **Manager** | Assigns tasks, reviews performance, approves leave and contributions |
| **HR** | Manages onboarding, team structures, company-wide policies |
| **Admin** | Full system access — user management, role assignment, broadcasts, email settings |
| **Organization (Board)** | High-level reporting and analytics dashboard |

---

## 4. Core Features

### 4.1 Authentication & Authorization
- Email/password signup and login with email verification
- Password reset via recovery email
- Role-based access control (RBAC) with 6 roles
- Route guards: `ProtectedRoute`, `AdminRoute`, `OrganizationRoute`
- Branded splash screen and loading indicators

### 4.2 Attendance Management
- Daily check-in / check-out with timestamp recording
- Simulated face verification step (camera capture)
- Simulated GPS location verification
- Attendance history with calendar view
- Today's status card on dashboard

### 4.3 Task Management
- **Views:** List, Kanban board, Gantt timeline
- **Lifecycle:** pending → in_progress → review → blocked → completed → approved
- Task types: `project` and `adhoc`
- Subtasks (parent-child hierarchy)
- Task dependencies (finish-to-start)
- Evidence uploads (screenshots, files) for task completion
- Threaded comments per task
- Tags and labels
- Activity timeline with automatic logging of all changes
- Advanced filters: status, priority, date range, search
- Soft-delete with audit trail

### 4.4 Leave Management
- Leave balance cards (annual, sick, casual, etc.)
- Apply for leave with date range, type, and reason
- Leave history with status tracking
- Manager approval workflow

### 4.5 Timesheet & Work Logging
- Weekly view for logging hours per day
- Project-based time allocation
- Work update modal for daily summaries
- Dashboard with total hours and trends

### 4.6 Skills & Performance
- Self-reported skill proficiency with goal levels
- Performance metrics tied to metric categories
- Score visualization (circle charts, progress bars)
- Manager-evaluated performance reviews

### 4.7 Meeting Room Booking
- Room availability grid
- Book rooms with time slot, purpose, participants, and priority
- Conflict detection via database function (`check_booking_conflict`)
- Booking audit trail
- My meetings view
- Admin room management (CRUD)

### 4.8 Notifications
- In-app notification bell with unread count
- Notification panel with mark-as-read
- Browser push notifications (VAPID / Web Push API)
- Admin broadcast system (send to all users, specific roles, or teams)
- Scheduled notifications support

### 4.9 Admin Panel
- User role management (assign/revoke roles)
- Bulk employee onboarding via CSV upload
- Email notification settings
- System-wide notification broadcasts
- Team and department management

### 4.10 Organization / Board Dashboard
- Company-wide reports and analytics
- Aggregated metrics across teams
- Access restricted to `organization` role

### 4.11 Profile Management
- View/edit personal details (name, phone, department, job title, location)
- Avatar upload
- LinkedIn URL
- Work hours configuration

---

## 5. Non-Functional Requirements

| Requirement | Detail |
|-------------|--------|
| **Platform** | PWA — installable on mobile and desktop |
| **Responsiveness** | Mobile-first, scales to tablet and desktop |
| **Performance** | Branded loading indicators for perceived speed; skeleton loaders for dashboards |
| **Security** | Row-Level Security (RLS) on all tables; auth-gated routes; no anonymous access |
| **Offline** | Service worker for push notifications; basic caching via PWA |
| **Branding** | ConnectPlus "C" logo used throughout splash, loaders, and PWA icons |

---

## 6. Success Metrics

- **Adoption:** 80%+ daily active users within first month of deployment
- **Task completion rate:** Track improvement over baseline
- **Attendance compliance:** Reduction in missed check-ins
- **User satisfaction:** In-app feedback score ≥ 4.0/5.0
- **Load time:** Perceived loading < 2 seconds for any action

---

## 7. Out of Scope (v1)

- Native mobile apps (iOS/Android)
- Real biometric face recognition (currently simulated)
- Real GPS geofencing (currently simulated)
- Third-party calendar integrations (Google/Outlook)
- Payroll and compensation management
- AI-powered analytics or recommendations
