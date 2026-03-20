# Full Backend + Frontend Audit — Bugs & Glitches

**Date:** 2026-03-06  
**Scope:** CacheTask codebase — API routes, DB queries, auth, frontend API usage, React Query, useEffect, null-safety, cross-cutting mismatches.

---

## BUG FIX APPLIED (Workload modal)

**Issue:** Assigned tasks not appearing in Workload View & Calendar View after assigning a task and reopening the Department Workload modal.

**Root cause:** Workload data could be served from HTTP/proxy cache when the same URL was requested again (same `userIds` and `month`).

**Fixes applied:**
1. **Frontend (`src/components/tasks/WorkloadModal.tsx`):** Added cache-busting query param `_=Date.now()` to the workload GET request so each time the modal opens and the effect runs, the URL is unique and no cached response is used.
2. **Backend (`backend/src/routes/taskRoutes.js`):** Set `Cache-Control: no-store, no-cache, must-revalidate` on the GET `/tasks/workload` response so intermediaries do not cache it.

No UI/layout/colors or other functionality was changed.

---

## PRIORITIZED BUG LIST (Report only — no changes made)

### P0 — High (data correctness / security / 400s)

| # | File | Line(s) | One-line fix |
|---|------|--------|---------------|
| 1 | `backend/src/controllers/adminController.js` | 22, 113, 223, 283, 301, 304, 311, 328, 339, 341, 349, 351, 354, 391, 436, 442, 445, 521, 557, 849, 886 | **Inconsistent API shape:** Many 400/403/404 responses return `{ error: '...' }` without `data: null`. Rest of app expects `{ data: null, error: { message: string } }`. Fix: return `res.status(400).json({ data: null, error: { message: 'Missing action' } });` (and same pattern for all listed) so clients parse errors consistently. |
| 2 | `src/pages/ReportsPage.tsx` | 116 | **Wrong id used for role lookup:** `roles.find((r) => r.user_id === p.id)` compares `user_roles.user_id` (user id) with `p.id` (profile id). Fix: resolve profile’s `user_id` (e.g. from a map or by joining profiles to user_roles by user_id) and use that when finding role, or fetch roles keyed by profile’s user_id. |
| 3 | `backend/src/routes/taskRoutes.js` (check-overlap) | 264 | **Overlap response shape:** Returns `res.json({ data: { conflicts }, error: null })` but frontend may expect `data` to be the array. Verify frontend reads `data.conflicts` (DeptTaskForm/ TaskManagement do); if any consumer expects `data` to be the array, fix backend or that consumer. |

### P1 — Medium (stale UI / cache / refetch)

| # | File | Line(s) | One-line fix |
|---|------|--------|---------------|
| 4 | Workload modal (see above) | — | **Fixed:** Cache-busting + Cache-Control added so workload and calendar always show up-to-date data when modal opens. |
| 5 | `src/components/tasks/DeptTaskForm.tsx` | — | **No React Query for workload:** Workload is fetched in useEffect with api.get; there is no query key to invalidate after creating a task. Already mitigated by refetch-on-open (cache buster). Optional: add a global “workload version” or query key and invalidate it after dept-task create so any future use of workload data stays in sync. |
| 6 | `src/hooks/useTaskManagement.ts` (useCreateTask) | 364–369 | **createTask success:** Already invalidates `["managed-tasks"]`, `["tasks"]`, `["home-stats"]`. Workload modal does not use React Query; no change needed for workload. (Included for completeness.) |

### P2 — Medium (validation / edge cases)

| # | File | Line(s) | One-line fix |
|---|------|--------|---------------|
| 7 | `backend/src/routes/dataRoutes.js` (PATCH) | 434 | **PATCH without id:** Returns 400 "Need id or user_id". Frontend db.ts now guards tasks PATCH with id. Ensure all other PATCH callers (e.g. profiles, notifications) pass id/user_id. |
| 8 | `backend/src/routes/taskRoutes.js` (workload) | 201–213 | **tasks_this_month filter:** Uses `due_date` for month range. Tasks with only `task_date` set and no `due_date` won’t appear in tasks_this_month. Fix: include task in month list if `(due_date >= monthStart && due_date <= monthEnd) OR (task_date >= monthStart && task_date <= monthEnd)`. |
| 9 | `src/components/attendance/LocationVerification.tsx` | 24–29 | **useEffect deps:** Effect runs once (`[]`) and calls `onVerify()` when `status === 'pending'`. Missing deps: `status`, `onVerify`. Fix: add `[status, onVerify]` and ensure parent memoizes `onVerify` to avoid unnecessary reruns. |
| 10 | `src/components/rooms/RescheduleModal.tsx` | 72–76 | **useEffect deps:** Effect uses `startTime`, `endTime`, `startMins`, `filteredEndSlots` but dependency array is `[startTime]`. Fix: add all used values to deps or document why filteredEndSlots is intentionally omitted. |

### P3 — Lower (null-safety / defensive)

| # | File | Line(s) | One-line fix |
|---|------|--------|---------------|
| 11 | `src/hooks/useTaskEvidence.ts` | 30 | **data?.map:** Safe (optional chaining). No change. |
| 12 | `src/hooks/useTaskActivityLogs.ts` | 31 | **data?.map:** Safe. No change. |
| 13 | `src/hooks/useTaskComments.ts` | 33 | **data?.map:** Safe. No change. |
| 14 | `src/hooks/useTaskDependencies.ts` | 28 | **data?.map:** Safe. No change. |
| 15 | Various list renders | — | **.map on state arrays:** ReportsPage and others use `allTasks.filter(...)` etc. with state initialized to `[]`; safe. |

### P4 — Cross-cutting / consistency

| # | Area | Detail | One-line fix |
|---|------|--------|---------------|
| 16 | Admin API response shape | adminController returns `{ error: '...' }` in many places; data routes return `{ data: null, error: { message: '...' } }`. | Standardize admin routes to `{ data: null, error: { message: string } }` (or document that admin uses `error` string only) and update any frontend that parses admin errors. |
| 17 | Auth user id | JWT decoded as `userId`; middleware sets `req.userId` and `req.profileId`. | No bug found; ensure all task/assignee queries use profile id where schema uses `profiles.id`. |
| 18 | Workload query filters | GET /tasks/workload uses `is_deleted = false`, assigned_to + task_assignees; includes all non-completed statuses for counts. | No bug found; status filter is only for completed/done/approved in overlap and hours. |

### P5 — Modals / fetch-once

| # | File | Note | One-line fix |
|---|------|------|---------------|
| 19 | WorkloadModal | Fetches when `open` and `userIds`/`month`; now with cache buster. | Done. |
| 20 | Other modals (e.g. EditTaskModal, RescheduleModal) | EditTaskModal receives task from parent; RescheduleModal receives booking. No “fetch once on mount” issue. | N/A. |

---

## Summary

- **Workload modal bug:** Fixed by cache-busting the workload request and setting Cache-Control on the workload endpoint.
- **P0:** 3 items (admin response shape, Reports role lookup, check-overlap response shape).
- **P1:** 2 items (workload refetch already addressed; create-task invalidation noted).
- **P2:** 4 items (PATCH id, tasks_this_month by task_date, useEffect deps in LocationVerification and RescheduleModal).
- **P3/P4/P5:** Null-safety and cross-cutting checks; no critical bugs; one optional improvement (tasks_this_month including task_date).

No other code changes were made; this file is the audit report only.
