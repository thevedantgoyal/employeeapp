# Task Management — End-to-End Audit Report

## 1. Issues Found

### PART 1 — Task Creation (Manager)

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 1 | `task_type` was not sent on create; all tasks defaulted to `project_task` | High | **Fixed** — Frontend now sends `taskType`; backend enforces `task_type` and `project_id = null` for separate_task |
| 2 | `assigned_at` was not set on creation | Medium | **Fixed** — Set to current timestamp when `assigned_to` is present |
| 3 | No backend validation: any user could POST to `/data/tasks` (IDOR) | High | **Fixed** — Only manager/team_lead/admin can create; `assigned_to` must be direct report |
| 4 | Manager could assign to any profile (cross-team) | High | **Fixed** — Backend validates via `isManagerOf(creatorUserId, assigneeUserId)` |

### PART 2 — Employee Task View

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 5 | Backend returned tasks without project join; `project_name` could be missing | Medium | **Fixed** — `selectTable` for tasks now uses `LEFT JOIN projects` and returns `projects` JSON |
| 6 | Employee visibility already correct (assigned_to = profile id) | — | No change |

### PART 3 — Manager Task/Project View

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 7 | Manager GET /data/tasks returned only tasks assigned *to the manager* (assigned_to = manager profile) | High | **Fixed** — When manager requests tasks with no `assigned_to` filter, backend returns tasks where `assigned_to IN (SELECT id FROM profiles WHERE manager_id = $1)` |
| 8 | Manager filtering by specific assignee: no check that assignee is their report | High | **Fixed** — If manager passes `assigned_to`, backend verifies via `isManagerOf`; otherwise no access |

### PART 4 — Task Features & Security

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 9 | PATCH /data/tasks allowed any authenticated user to update any task (IDOR) | High | **Fixed** — Only assignee, or manager of assignee, or admin can update; reassignment validated to direct report only |
| 10 | DELETE /data/tasks had no auth check | High | **Fixed** — Only assignee, or manager of assignee, or admin can delete |
| 11 | Reassign: new assignee must be manager's direct report | — | **Fixed** — Enforced in PATCH validation |
| 12 | task_type = separate_task ⇒ project_id forced to null on update | — | **Fixed** — In PATCH block for tasks |

### PART 5 — Database

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 13 | No `task_members` table in schema; design is single-assignee (`assigned_to`) | Info | **No change** — Current design is one assignee per task; documented |
| 14 | Index on `tasks(assigned_by)` missing for manager lookups | Low | **Optional** — Added in migration below if desired |
| 15 | FKs and existing indexes (assigned_to, project_id, task_type, status, is_deleted) | — | Already correct |

### PART 6–8 — Security, Performance, UI

| # | Issue | Severity | Status |
|---|--------|----------|--------|
| 16 | Backend now enforces all task visibility and mutation checks | — | **Done** |
| 17 | Removed temporary debug logs from `isManagerOf` | Low | **Done** |
| 18 | N+1: useManagedTasks no longer overfetches; backend returns correct set in one query | — | **Done** |

---

## 2. Fixes Applied

### Backend

**`backend/src/services/dataService.js`**

- **Tasks access filter**
  - **Manager, no assignee filter:** `where = assigned_to IN (SELECT id FROM profiles WHERE manager_id = $1) AND is_deleted = false` so managers see only their team’s tasks.
  - **Manager, with assignee filter:** Allowed only if `isManagerOf(currentUserId, assigneeUserId)`; otherwise `1=0`.
  - **Employee:** Unchanged: `assigned_to = $1` (current user’s profile id).
- **Tasks SELECT:** Custom SQL for table `tasks`: `LEFT JOIN projects p ON p.id = t.project_id`, return `t.*` and `json_build_object('name', p.name) AS projects`. Where clause uses `t.assigned_to` and `t.is_deleted` for alias consistency.

**`backend/src/routes/dataRoutes.js`**

- **POST /data/tasks**
  - Only roles `manager`, `team_lead`, or `admin` can create tasks.
  - `task_type` normalized to `project_task` or `separate_task`; if `separate_task`, `project_id` forced to `null`.
  - `assigned_by` set to current user’s profile id when not provided.
  - If `assigned_to` is set: resolve profile → user_id and call `isManagerOf(req.userId, assigneeUserId)`; reject with 403 if not direct report.
  - Set `assigned_at` when `assigned_to` is set.
- **PATCH /data/tasks**
  - Load task; ensure not deleted.
  - Allow update only if: current user is admin/hr, or assignee (profile id), or manager of assignee (`isManagerOf`).
  - If updating `assigned_to`: new assignee must be current user’s direct report; set `assigned_at` if not provided.
  - If `task_type === 'separate_task'`, set `project_id = null`.
- **DELETE /data/tasks**
  - Same authorization as PATCH: only assignee, manager of assignee, or admin can delete.

**`backend/src/middleware/rbac.js`**

- Removed `console.log` debug statements from `isManagerOf`.

### Frontend

**`src/hooks/useTaskManagement.ts`**

- **useCreateTask**
  - Added `taskType?: "project_task" | "separate_task"` to mutation params.
  - Insert now includes `task_type: taskType === "separate_task" ? "separate_task" : "project_task"` and `assigned_at: assignedTo ? now : null`.

**`src/components/manager/TaskManagement.tsx`**

- `createTask.mutateAsync` now passes `taskType` in addition to existing fields.

---

## 3. Updated Backend Queries

- **Tasks list (manager, no filter):**  
  `SELECT t.*, json_build_object('name', p.name) AS projects FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE t.assigned_to IN (SELECT id FROM profiles WHERE manager_id = $1) AND t.is_deleted = false ORDER BY t.<order> LIMIT $2`

- **Tasks list (employee):**  
  Same FROM/JOIN, `WHERE t.assigned_to = $1 AND t.is_deleted = false`.

- **Tasks list (manager, filter by assignee):**  
  Same FROM/JOIN, `WHERE t.assigned_to = $1 AND t.is_deleted = false` only after `isManagerOf(managerUserId, assigneeUserId)`.

---

## 4. Security Improvements

- Task creation restricted to manager/team_lead/admin; assignee must be creator’s direct report.
- Task update/delete restricted to assignee, manager of assignee, or admin/hr.
- Reassignment only to current user’s direct reports.
- No IDOR via task id or project id for task create/update/delete; all checks use JWT `userId` and profile/manager hierarchy.

---

## 5. Performance

- Manager task list: one query with `IN (SELECT id FROM profiles WHERE manager_id = $1)` instead of returning all tasks and filtering client-side.
- Tasks list always returns project name via one `LEFT JOIN projects` (no N+1).

---

## 6. Database Schema (No Breaking Changes)

- **Existing:** `tasks` has `assigned_to`, `assigned_by`, `project_id`, `task_type`, `assigned_at`; FKs and indexes as in `01_schema.sql`.
- **Optional migration** (e.g. `06_tasks_assigned_by_index.sql`):  
  `CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);`  
  for queries that filter or join by `assigned_by`.

---

## 7. Final Verification Checklist

- [x] Manager can create Project Task with project and assignee; `task_type` and `project_id` stored correctly.
- [x] Manager can create Separate Task; `project_id` null, `task_type` = `separate_task`.
- [x] `assigned_by` and `assigned_at` set on create when assignee present.
- [x] Only direct reports can be assigned (backend).
- [x] Employee sees only tasks where `assigned_to` = their profile id.
- [x] Manager sees only tasks assigned to profiles with `manager_id` = manager’s profile id.
- [x] Task list returns project name via join.
- [x] Only assignee or manager of assignee (or admin) can update/delete task.
- [x] Reassign restricted to direct reports and `assigned_at` set.
- [x] No IDOR on task create/update/delete.
- [x] Debug logs removed from RBAC.

---

## 8. Notes

- **task_members / multiple assignees:** Current schema uses a single `assigned_to` per task. The audit assumed possible “task_members” and “multiple employees”; the implementation keeps the existing single-assignee model and secures it. Adding a `task_members` table would require a separate design and migration.
- **created_by:** Tasks use `assigned_by` (profile id of who assigned the task). A separate `created_by` column was not added; `assigned_by` is set on create to the current user’s profile id.
