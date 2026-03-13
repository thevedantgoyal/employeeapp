# ConnectPlus — Complete API Routes & Database Interactions Checklist

**Version:** 1.0  
**Last Updated:** 2026-02-23

---

## 1. Authentication Routes (`supabase.auth`)

| # | Operation | Method | Location | Description |
|---|-----------|--------|----------|-------------|
| 1 | Sign Up | `auth.signUp()` | `AuthContext.tsx` | Register new user with email/password |
| 2 | Sign In | `auth.signInWithPassword()` | `AuthContext.tsx` | Login with email/password |
| 3 | Sign Out | `auth.signOut()` | `AuthContext.tsx`, `ResetPasswordPage.tsx` | End user session |
| 4 | Get Session | `auth.getSession()` | `AuthContext.tsx` | Retrieve existing session on app load |
| 5 | Auth State Listener | `auth.onAuthStateChange()` | `AuthContext.tsx`, `ResetPasswordPage.tsx` | Listen for auth events (login, logout, password recovery) |
| 6 | Reset Password Email | `auth.resetPasswordForEmail()` | `AuthContext.tsx` | Send password reset link via email |
| 7 | Update User Password | `auth.updateUser()` | `ResetPasswordPage.tsx` | Set new password during recovery flow |

---

## 2. Database CRUD Operations (`supabase.from()`)

### 2.1 `profiles` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read own profile | SELECT | `useHomeData.ts`, `useContributions.ts`, `useSkills.ts`, `useTaskManagement.ts`, `useTaskComments.ts`, `useTaskEvidence.ts`, `useTaskActivityLogs.ts`, `useRoomBooking.ts`, `useTimesheetManagement.ts`, `useLeaveManagement.ts`, `useAttendance.ts`, `useManagerReview.ts` | Fetch current user's profile by `user_id` |
| 2 | Read all profiles | SELECT | `ReportsPage.tsx`, `useTeams.ts` | Admin/HR: fetch all employee profiles |
| 3 | Update own profile | UPDATE | `ProfilePage.tsx` | User updates their own profile info |
| 4 | Update profile (admin) | UPDATE | `useTeams.ts` | Admin unassigns team members (`team_id = null`) |

### 2.2 `user_roles` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read own roles | SELECT | `useUserRoles.ts` | Fetch current user's roles for RBAC |
| 2 | Read all roles | SELECT | `ReportsPage.tsx` | Admin: fetch all user roles for reports |

### 2.3 `tasks` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read assigned tasks | SELECT | `useTasks.ts` | Fetch tasks assigned to current user |
| 2 | Read all tasks | SELECT | `useTaskManagement.ts`, `ReportsPage.tsx` | Manager/Admin: fetch all/team tasks |
| 3 | Create task | INSERT | `useTaskManagement.ts` | Manager: create and assign a new task |
| 4 | Update task status | UPDATE | `useTaskManagement.ts`, `useTasks.ts` | Update status, priority, description, etc. |
| 5 | Soft delete task | UPDATE | `useTaskManagement.ts` | Set `is_deleted = true` (soft delete) |
| 6 | Reassign task | UPDATE | `useTaskManagement.ts` | Change `assigned_to`, increment `reassignment_count` |

### 2.4 `task_activity_logs` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read logs | SELECT | `useTaskActivityLogs.ts` | Fetch activity history for a task |
| 2 | Insert log | INSERT | `useTaskActivityLogs.ts`, `useTaskManagement.ts`, `useTaskEvidence.ts`, `useTaskComments.ts` | Log task changes (status, reassignment, comments, evidence) |

### 2.5 `task_comments` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read comments | SELECT | `useTaskComments.ts` | Fetch all comments for a task |
| 2 | Add comment | INSERT | `useTaskComments.ts` | Post a new comment on a task |
| 3 | Delete comment | DELETE | `useTaskComments.ts` | Author deletes their own comment |

### 2.6 `task_evidence` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read evidence | SELECT | `useTaskEvidence.ts` | Fetch evidence files for a task |
| 2 | Upload evidence | INSERT | `useTaskEvidence.ts` | Attach evidence file to a task |

### 2.7 `task_tags` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read tags | SELECT | `useTaskTags.ts` | Fetch all available tags |
| 2 | Create tag | INSERT | `useTaskTags.ts` | Manager: create a new tag |
| 3 | Delete tag | DELETE | `useTaskTags.ts` | Manager: remove a tag |

### 2.8 `task_tag_assignments` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read assignments | SELECT | `useTaskTags.ts` | Fetch tag assignments for a task |
| 2 | Assign tag | INSERT | `useTaskTags.ts` | Assign a tag to a task |
| 3 | Remove tag | DELETE | `useTaskTags.ts` | Remove a tag from a task |

### 2.9 `task_dependencies` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read dependencies | SELECT | `useTaskDependencies.ts` | Fetch dependencies for a task |
| 2 | Add dependency | INSERT | `useTaskDependencies.ts` | Link two tasks as dependent |
| 3 | Remove dependency | DELETE | `useTaskDependencies.ts` | Remove a task dependency |

### 2.10 `contributions` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read own contributions | SELECT | `useContributions.ts` | Fetch user's work contributions |
| 2 | Read all contributions | SELECT | `useManagerReview.ts`, `ReportsPage.tsx` | Manager: fetch team contributions for review |
| 3 | Create contribution | INSERT | `useContributions.ts` | Submit a new work update/contribution |
| 4 | Update contribution | UPDATE | `useContributions.ts`, `useManagerReview.ts` | Edit pending contribution or review (approve/reject) |

### 2.11 `skills` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read own skills | SELECT | `useSkills.ts` | Fetch user's skill entries |
| 2 | Create skill | INSERT | `useSkills.ts` | Add a new skill record |
| 3 | Update skill | UPDATE | `useSkills.ts` | Update proficiency/goal level |
| 4 | Delete skill | DELETE | `useSkills.ts` | Remove a skill entry |

### 2.12 `performance_metrics` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read own metrics | SELECT | `useHomeData.ts` | Fetch user's performance scores |
| 2 | Read all metrics | SELECT | `ReportsPage.tsx` | Admin: fetch all metrics for reports |
| 3 | Create metric | INSERT | `useManagerReview.ts` | Manager: evaluate employee performance |
| 4 | Update metric | UPDATE | `useManagerReview.ts` | Manager: update performance score |

### 2.13 `metric_categories` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read categories | SELECT | `useHomeData.ts`, `useManagerReview.ts` | Fetch performance metric categories |

### 2.14 `teams` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read teams | SELECT | `useTeams.ts` | Fetch all teams |
| 2 | Create team | INSERT | `useTeams.ts` | Admin: create a new team |
| 3 | Update team | UPDATE | `useTeams.ts` | Admin: update team name/lead/description |
| 4 | Delete team | DELETE | `useTeams.ts` | Admin: delete a team |

### 2.15 `projects` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read projects | SELECT | `useTaskManagement.ts` | Fetch all projects |
| 2 | Create project | INSERT | `useTaskManagement.ts` | Manager: create a new project |

### 2.16 `meeting_rooms` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read rooms | SELECT | `useRoomBooking.ts` | Fetch all active meeting rooms |
| 2 | Create room | INSERT | `useRoomBooking.ts` | Admin: add a new meeting room |
| 3 | Update room | UPDATE | `useRoomBooking.ts` | Admin: update room details/status |

### 2.17 `room_bookings` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read bookings | SELECT | `useRoomBooking.ts` | Fetch bookings (own or all) |
| 2 | Create booking | INSERT | `useRoomBooking.ts` | Book a meeting room |
| 3 | Cancel booking | UPDATE | `useRoomBooking.ts` | Cancel a booking (set status + reason) |

### 2.18 `booking_audit_log` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read audit log | SELECT | `useRoomBooking.ts` | Fetch audit trail for a booking |
| 2 | Insert audit entry | INSERT | `useRoomBooking.ts` | Log booking creation/cancellation |

### 2.19 `notifications` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read notifications | SELECT | `useNotifications.ts` | Fetch user's notifications |
| 2 | Create notification | INSERT | `useNotifications.ts` | Create an in-app notification |
| 3 | Mark as read | UPDATE | `useNotifications.ts` | Mark notification(s) as read |
| 4 | Delete notification | DELETE | `useNotifications.ts` | Remove a notification |

### 2.20 `scheduled_notifications` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Read scheduled | SELECT | `NotificationBroadcast.tsx` | Admin: fetch scheduled broadcasts |
| 2 | Create scheduled | INSERT | `NotificationBroadcast.tsx` | Admin: schedule a broadcast notification |

### 2.21 `push_subscriptions` Table

| # | Operation | Type | Location | Description |
|---|-----------|------|----------|-------------|
| 1 | Upsert subscription | UPSERT | `usePushNotifications.ts` | Save/update browser push subscription |
| 2 | Delete subscription | DELETE | `usePushNotifications.ts` | Remove push subscription on unsubscribe |

---

## 3. Database RPC Functions (`supabase.rpc()`)

| # | Function | Location | Description |
|---|----------|----------|-------------|
| 1 | `check_booking_conflict()` | `useRoomBooking.ts` | Detect overlapping room bookings |
| 2 | `create_notification()` | `useTaskManagement.ts` | Create notification via server-side function |
| 3 | `setup_first_admin()` | `AdminDashboard.tsx` | Bootstrap first admin user |
| 4 | `has_role()` | RLS policies (server-side) | Check user role in security policies |
| 5 | `is_manager_of()` | RLS policies (server-side) | Validate manager-employee relationship |
| 6 | `get_user_profile_id()` | RLS policies (server-side) | Resolve auth user_id → profile id |

---

## 4. Edge Functions (`supabase.functions.invoke()`)

| # | Function | Location | Actions | Description |
|---|----------|----------|---------|-------------|
| 1 | `admin-manage` | `AdminDashboard.tsx`, `TeamManagement.tsx` | `get-all-employees`, `get-managers`, `update-employee`, `assign-role` | Admin user & role management |
| 2 | `bulk-onboard` | `AdminDashboard.tsx` | Single + CSV bulk upload | Batch create users with profiles and roles |
| 3 | `send-broadcast` | `NotificationBroadcast.tsx` | Send/schedule broadcasts | Send notifications to groups of users |
| 4 | `send-email` | `EmailSettings.tsx`, `useEmailNotifications.ts` | Send email | Transactional email delivery |
| 5 | `send-push` | `usePushNotifications.ts` | Send push notification | Browser push via VAPID |

---

## 5. Storage Operations (`supabase.storage`)

| # | Bucket | Operation | Location | Description |
|---|--------|-----------|----------|-------------|
| 1 | `evidence` | Upload file | `useFileUpload.ts`, `useTaskEvidence.ts` | Upload evidence/work files |
| 2 | `evidence` | Get public URL | `useFileUpload.ts`, `useTaskEvidence.ts` | Generate public URL for uploaded file |
| 3 | `evidence` | Delete file | `useFileUpload.ts` | Remove uploaded file from storage |

---

## 6. Database Triggers (Server-Side)

| # | Trigger | Table | Function | Description |
|---|---------|-------|----------|-------------|
| 1 | New user signup | `auth.users` | `handle_new_user()` | Auto-create profile + default `employee` role |
| 2 | Task assignment | `tasks` | `notify_task_assigned()` | Send notification when task is assigned |
| 3 | Team assignment | `profiles` | `notify_team_assigned()` | Send notification when added to a team |
| 4 | Updated at | Multiple tables | `update_updated_at_column()` | Auto-update `updated_at` timestamp |

---

## 7. Summary Statistics

| Category | Count |
|----------|-------|
| **Auth operations** | 7 |
| **Tables with CRUD** | 21 |
| **Total DB operations** | ~55 |
| **RPC functions** | 6 |
| **Edge functions** | 5 |
| **Storage operations** | 3 |
| **Database triggers** | 4 |
| **Total API routes** | **~80** |
