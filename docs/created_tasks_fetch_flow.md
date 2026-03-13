# ConnectPlus — Created Tasks Fetch Flow (GET)

**Version:** 1.0  
**Generated:** 2026-02-25  
**Focus:** How Admin/Manager-created tasks are fetched via the Supabase SDK

---

## Table of Contents

1. [Overview](#1-overview)
2. [Table & Columns Used](#2-table--columns-used)
3. [Authentication Flow](#3-authentication-flow)
4. [Frontend Fetch Code](#4-frontend-fetch-code)
5. [Step-by-Step Query Execution](#5-step-by-step-query-execution)
6. [Example SQL Queries](#6-example-sql-queries)
7. [Response Format](#7-response-format)
8. [Full Data Flow Trace](#8-full-data-flow-trace)
9. [Why Tasks Might Not Appear](#9-why-tasks-might-not-appear)
10. [Manager ID Mismatch Analysis](#10-manager-id-mismatch-analysis)
11. [Debugging Steps](#11-debugging-steps)
12. [Best Practice Improvements](#12-best-practice-improvements)

---

## 1. Overview

This project does **NOT** use a traditional REST API with Express/Fastify routes. Instead, the frontend directly queries the database via the **Supabase JavaScript SDK** (`@supabase/supabase-js`). Row Level Security (RLS) policies act as the "API authorization layer."

There are **two distinct GET flows** for tasks:

| Flow | Hook | Who Uses It | Purpose |
|---|---|---|---|
| **Employee Tasks** | `useTasks()` | Employee role | Fetch tasks assigned TO the current user |
| **Manager Tasks** | `useManagedTasks()` | Manager/Admin/HR | Fetch tasks assigned BY the current user (or all tasks for admin/HR) |

---

## 2. Table & Columns Used

### Primary Table: `tasks`

**Columns used for filtering:**

| Column | Type | Filter Purpose |
|---|---|---|
| `assigned_to` | UUID (FK → `profiles.id`) | Employee view: matches logged-in user's profile ID |
| `assigned_by` | UUID (FK → `profiles.id`) | NOT directly filtered — manager view uses `profiles.manager_id` instead |
| `is_deleted` | BOOLEAN | Excludes soft-deleted tasks (`.eq("is_deleted", false)`) |
| `status` | TEXT | Employee view excludes `"approved"` tasks |

**Columns selected in query:**

```
id, title, description, due_date, status, priority, task_type,
blocked_reason, reassignment_count, is_deleted, assigned_to,
projects(name)
```

### Supporting Table: `profiles`

| Column | Purpose |
|---|---|
| `id` | Profile UUID — matched against `tasks.assigned_to` |
| `user_id` | Auth UUID — resolved from `auth.uid()` via session |
| `manager_id` | FK to `profiles.id` — determines who manages whom |
| `full_name` | Displayed as assignee name in manager view |

### Supporting Table: `user_roles`

| Column | Purpose |
|---|---|
| `user_id` | Auth UUID |
| `role` | Determines access level: `manager`, `team_lead`, `admin`, `hr` |

---

## 3. Authentication Flow

```
┌──────────────────────────────────────────────────────────┐
│ 1. User logs in via AuthPage.tsx                         │
│    → supabase.auth.signInWithPassword({ email, password})│
│                                                          │
│ 2. Supabase returns JWT access_token                     │
│    → Contains: sub (user UUID), role, exp                │
│                                                          │
│ 3. AuthContext stores session in React state              │
│    → onAuthStateChange listener keeps it in sync         │
│                                                          │
│ 4. supabase-js client auto-attaches JWT to every request │
│    → Authorization: Bearer <access_token>                │
│                                                          │
│ 5. PostgreSQL RLS reads auth.uid() from JWT              │
│    → Policies filter rows based on user identity         │
└──────────────────────────────────────────────────────────┘
```

**How JWT attaches the user ID:**
- The Supabase client (`src/integrations/supabase/client.ts`) is initialized once
- After login, the client stores the session (access token + refresh token)
- Every `supabase.from("tasks").select(...)` call automatically includes `Authorization: Bearer <JWT>` in the HTTP header
- On the database side, `auth.uid()` extracts the user UUID from the JWT's `sub` claim
- **No manual header management is needed** — the SDK handles it transparently

---

## 4. Frontend Fetch Code

### Flow 1: Employee Tasks (`useTasks` hook)

**File:** `src/hooks/useTasks.ts`

```typescript
export const useTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Step 1: Resolve auth UUID → profile UUID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return [];

      // Step 2: Fetch tasks assigned to this profile
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, title, description, due_date, status, priority,
          task_type, blocked_reason, reassignment_count, is_deleted,
          projects (name)
        `)
        .eq("assigned_to", profile.id)
        .eq("is_deleted", false)
        .neq("status", "approved")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        project_name: task.projects?.name || "No Project",
        due_date: task.due_date,
        status: task.status,
        priority: task.priority,
        task_type: task.task_type || "project_task",
        blocked_reason: task.blocked_reason || null,
        reassignment_count: task.reassignment_count || 0,
      }));
    },
    enabled: !!user,
  });
};
```

### Flow 2: Manager/Admin Tasks (`useManagedTasks` hook)

**File:** `src/hooks/useTaskManagement.ts`

```typescript
export const useManagedTasks = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["managed-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Step 1: Get manager's profile ID
      const { data: managerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!managerProfile) return [];

      // Step 2: Check user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const userRoles = roles?.map((r) => r.role) || [];
      const canViewAll = userRoles.includes("hr") || userRoles.includes("admin");
      const isManager = userRoles.includes("manager") || userRoles.includes("team_lead");

      if (!canViewAll && !isManager) return [];

      // Step 3: Fetch ALL non-deleted tasks (RLS further filters)
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select(`
          id, title, description, status, priority, due_date,
          created_at, assigned_to, task_type, blocked_reason,
          reassignment_count, is_deleted,
          projects (name)
        `)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Step 4: Resolve assignee names
      const assignedToIds = [...new Set(
        tasks?.map((t) => t.assigned_to).filter(Boolean)
      )] as string[];

      let profileMap = new Map();
      if (assignedToIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, manager_id")
          .in("id", assignedToIds);
        profileMap = new Map(
          profiles?.map((p) => [p.id, { full_name: p.full_name, manager_id: p.manager_id }])
        );
      }

      // Step 5: CLIENT-SIDE filtering for managers (not admin/HR)
      const filteredTasks = tasks?.filter((task) => {
        if (canViewAll) return true;
        if (!task.assigned_to) return true; // Unassigned tasks visible
        const assignee = profileMap.get(task.assigned_to);
        return assignee?.manager_id === managerProfile.id;
      });

      return (filteredTasks || []).map((task: any) => ({
        id: task.id,
        title: task.title,
        // ... mapped fields
        assigned_to_name: task.assigned_to
          ? profileMap.get(task.assigned_to)?.full_name || null
          : null,
      }));
    },
    enabled: !!user,
  });
};
```

---

## 5. Step-by-Step Query Execution

### Employee Flow (useTasks)

```
1. supabase.from("profiles").select("id").eq("user_id", auth.uid())
   → RLS: "Users can view their own profile" allows this
   → Returns: { id: "profile-uuid-123" }

2. supabase.from("tasks").select(...).eq("assigned_to", "profile-uuid-123")
     .eq("is_deleted", false).neq("status", "approved")
   → RLS: "Users can view their assigned tasks" passes because
     assigned_to = get_user_profile_id(auth.uid())
   → Returns: Array of task objects
```

### Manager Flow (useManagedTasks)

```
1. supabase.from("profiles").select("id").eq("user_id", auth.uid())
   → Returns: { id: "manager-profile-uuid" }

2. supabase.from("user_roles").select("role").eq("user_id", auth.uid())
   → Returns: [{ role: "manager" }]

3. supabase.from("tasks").select(...).eq("is_deleted", false)
   → RLS: "Managers can manage tasks" policy allows ALL operations
     for users with manager/team_lead/admin role
   → Returns: ALL non-deleted tasks (RLS-filtered by role)

4. supabase.from("profiles").select("id, full_name, manager_id")
     .in("id", [assignee-uuid-1, assignee-uuid-2, ...])
   → Returns: Assignee profiles with their manager_id

5. CLIENT-SIDE FILTER:
   → For each task, check if assignee's manager_id === manager's profile id
   → Admin/HR skip this filter (canViewAll = true)
```

---

## 6. Example SQL Queries

### What the SDK generates (Employee):

```sql
SELECT id, title, description, due_date, status, priority, task_type,
       blocked_reason, reassignment_count, is_deleted,
       projects.name
FROM tasks
LEFT JOIN projects ON tasks.project_id = projects.id
WHERE assigned_to = 'profile-uuid-123'
  AND is_deleted = false
  AND status != 'approved'
ORDER BY due_date ASC NULLS LAST;
```

### What the SDK generates (Manager):

```sql
-- Query 1: Get all tasks
SELECT id, title, description, status, priority, due_date, created_at,
       assigned_to, task_type, blocked_reason, reassignment_count, is_deleted,
       projects.name
FROM tasks
LEFT JOIN projects ON tasks.project_id = projects.id
WHERE is_deleted = false
ORDER BY created_at DESC;

-- Query 2: Get assignee profiles
SELECT id, full_name, manager_id
FROM profiles
WHERE id IN ('uuid-1', 'uuid-2', 'uuid-3');
```

### RLS policy SQL (evaluated server-side):

```sql
-- "Managers can manage tasks" policy:
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('manager', 'team_lead', 'admin')
);
```

---

## 7. Response Format

### Employee Tasks Response (from `useTasks`):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Implement user dashboard",
    "description": "Build the main dashboard with KPIs",
    "project_name": "ConnectPlus v2",
    "due_date": "2026-03-01T00:00:00.000Z",
    "status": "in_progress",
    "priority": "high",
    "task_type": "project_task",
    "blocked_reason": null,
    "reassignment_count": 0
  }
]
```

### Manager Tasks Response (from `useManagedTasks`):

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Implement user dashboard",
    "description": "Build the main dashboard with KPIs",
    "status": "in_progress",
    "priority": "high",
    "due_date": "2026-03-01T00:00:00.000Z",
    "created_at": "2026-02-20T10:00:00.000Z",
    "assigned_to_id": "profile-uuid-of-employee",
    "assigned_to_name": "John Smith",
    "project_name": "ConnectPlus v2",
    "task_type": "project_task",
    "blocked_reason": null,
    "reassignment_count": 0
  }
]
```

---

## 8. Full Data Flow Trace

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                     │
│                                                                     │
│  ManagerDashboard.tsx                                                │
│    └── useManagedTasks() hook (TanStack React Query)                │
│          │                                                          │
│          ├── queryKey: ["managed-tasks", user.id]                   │
│          ├── enabled: !!user (waits for auth)                       │
│          │                                                          │
│          └── queryFn: async () => { ... }                           │
│                │                                                    │
│                │  ① supabase.from("profiles")                      │
│                │     .select("id").eq("user_id", user.id)          │
│                │                                                    │
│                │  ② supabase.from("user_roles")                    │
│                │     .select("role").eq("user_id", user.id)        │
│                │                                                    │
│                │  ③ supabase.from("tasks")                         │
│                │     .select("...").eq("is_deleted", false)        │
│                │                                                    │
│                │  ④ supabase.from("profiles")                      │
│                │     .select("id,full_name,manager_id")            │
│                │     .in("id", assignedToIds)                      │
│                │                                                    │
│                │  ⑤ Client-side filter:                            │
│                │     assignee.manager_id === managerProfile.id     │
│                │                                                    │
│                ▼                                                    │
│          Returns: ManagedTask[]                                     │
│            │                                                        │
│            ▼                                                        │
│  React component renders task list / kanban / etc.                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        NETWORK                                      │
│                                                                     │
│  Each supabase.from() call generates:                               │
│    POST https://<project>.supabase.co/rest/v1/rpc/...              │
│    or GET https://<project>.supabase.co/rest/v1/tasks?...          │
│                                                                     │
│  Headers (auto-attached by SDK):                                    │
│    Authorization: Bearer <JWT access_token>                         │
│    apikey: <SUPABASE_ANON_KEY>                                     │
│    Content-Type: application/json                                   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        BACKEND (Supabase/PostgreSQL)                │
│                                                                     │
│  1. PostgREST receives request                                     │
│  2. Extracts JWT → sets auth.uid() = user's UUID                   │
│  3. Evaluates RLS policies on each table                           │
│  4. "Managers can manage tasks" policy:                             │
│     → has_role(auth.uid(), 'manager') → true                      │
│     → All non-deleted tasks returned                               │
│  5. Response sent as JSON array                                     │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        FRONTEND (continued)                         │
│                                                                     │
│  6. SDK parses JSON response                                        │
│  7. queryFn maps data to ManagedTask[]                              │
│  8. React Query caches result under key ["managed-tasks", userId]  │
│  9. Component re-renders with data                                  │
│ 10. Cache invalidated on mutations (create/update/delete/reassign) │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Why Tasks Might Not Appear

### For Employee View (`useTasks`)

| # | Cause | How to Verify |
|---|---|---|
| 1 | **Profile not created** — `handle_new_user` trigger failed | Query `profiles` for the user's `user_id` |
| 2 | **`assigned_to` uses wrong UUID type** — auth UUID vs profile UUID | Check if `tasks.assigned_to` matches `profiles.id` (not `profiles.user_id`) |
| 3 | **Task is soft-deleted** — `is_deleted = true` | Query tasks without the `is_deleted` filter |
| 4 | **Task status is 'approved'** — excluded by `.neq("status", "approved")` | Check task status in database |
| 5 | **RLS policy blocks access** — `assigned_to != get_user_profile_id(auth.uid())` | Run query as service role to compare |

### For Manager View (`useManagedTasks`)

| # | Cause | How to Verify |
|---|---|---|
| 1 | **User lacks manager/admin role** — `user_roles` doesn't have the role | Query `user_roles` for the user |
| 2 | **`manager_id` not set on employee profile** — client-side filter fails | Check `profiles.manager_id` for the assignee |
| 3 | **`manager_id` points to wrong profile** — UUID mismatch | Compare `profiles.manager_id` with the manager's `profiles.id` |
| 4 | **RLS blocks the tasks query** — manager role not recognized | Check that `has_role()` function returns true |
| 5 | **1000-row limit hit** — Supabase default limit | Add `.limit()` or pagination |
| 6 | **Client-side filter bug** — `profileMap.get()` returns undefined | Log the profileMap contents |

---

## 10. Manager ID Mismatch Analysis

The most common reason managers can't see their team's tasks is a **UUID mismatch** in the manager relationship:

### The Two-UUID Problem

```
auth.users table:
  id: "auth-uuid-AAA"  ← This is auth.uid()

profiles table:
  id: "profile-uuid-BBB"  ← This is the profile ID
  user_id: "auth-uuid-AAA"  ← Links to auth.users

tasks table:
  assigned_to: "profile-uuid-CCC"  ← Employee's PROFILE ID

profiles table (employee):
  id: "profile-uuid-CCC"
  manager_id: "profile-uuid-BBB"  ← Must match manager's PROFILE ID
```

### Where Mismatch Can Occur

1. **`profiles.manager_id` was set to auth UUID instead of profile UUID:**
   ```sql
   -- WRONG: Using auth.users.id
   UPDATE profiles SET manager_id = 'auth-uuid-AAA' WHERE ...
   
   -- CORRECT: Using profiles.id
   UPDATE profiles SET manager_id = 'profile-uuid-BBB' WHERE ...
   ```

2. **Admin panel sets `manager_id` incorrectly** — The `admin-manage` edge function or admin UI must resolve auth UUID → profile UUID before setting `manager_id`.

3. **Bulk onboard sets wrong `manager_id`** — The `bulk-onboard` edge function must map manager email → profile ID.

### Verification Query

```sql
-- Check if manager relationship is correct
SELECT 
  e.full_name AS employee,
  e.manager_id AS stored_manager_profile_id,
  m.id AS actual_manager_profile_id,
  m.full_name AS manager_name,
  e.manager_id = m.id AS match
FROM profiles e
LEFT JOIN profiles m ON m.user_id = (
  SELECT user_id FROM profiles WHERE id = e.manager_id
)
WHERE e.manager_id IS NOT NULL;
```

---

## 11. Debugging Steps

### Step 1: Verify User Profile Exists

```typescript
// Add to useManagedTasks queryFn
console.log("[DEBUG] Auth user ID:", user.id);

const { data: profile } = await supabase
  .from("profiles")
  .select("id, manager_id")
  .eq("user_id", user.id)
  .maybeSingle();

console.log("[DEBUG] Manager profile:", profile);
```

### Step 2: Verify User Roles

```typescript
const { data: roles } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", user.id);

console.log("[DEBUG] User roles:", roles);
```

### Step 3: Check RLS Is Not Blocking

```sql
-- Run in database console as service role:
SELECT id, title, assigned_to, is_deleted, status
FROM tasks
WHERE is_deleted = false
LIMIT 20;
```

### Step 4: Verify Manager-Employee Relationship

```sql
-- Check if employees have correct manager_id
SELECT 
  p.full_name,
  p.manager_id,
  m.full_name AS manager_name
FROM profiles p
LEFT JOIN profiles m ON m.id = p.manager_id
WHERE p.manager_id IS NOT NULL;
```

### Step 5: Check Client-Side Filter

```typescript
// Add before the filter in useManagedTasks
console.log("[DEBUG] Total tasks from DB:", tasks?.length);
console.log("[DEBUG] Profile map entries:", Array.from(profileMap.entries()));
console.log("[DEBUG] Manager profile ID for filter:", managerProfile.id);

const filteredTasks = tasks?.filter((task) => {
  const assignee = profileMap.get(task.assigned_to);
  const passes = canViewAll || !task.assigned_to || assignee?.manager_id === managerProfile.id;
  if (!passes) {
    console.log("[DEBUG] Filtered out task:", task.id, 
      "assignee manager_id:", assignee?.manager_id,
      "expected:", managerProfile.id);
  }
  return passes;
});

console.log("[DEBUG] Tasks after client filter:", filteredTasks?.length);
```

### Step 6: Network Request Inspection

Open browser DevTools → Network tab → filter by `rest/v1`:
- Check that `Authorization` header contains a valid JWT
- Check response status is 200 (not 403 or empty)
- Check response body contains expected task data

---

## 12. Best Practice Improvements

### 1. Eliminate Client-Side Filtering

**Current:** Manager view fetches ALL tasks, then filters client-side by `manager_id`.  
**Problem:** Fetches unnecessary data; hits 1000-row limit on large deployments.  
**Fix:** Add `assigned_by` filter or use an RPC function:

```sql
CREATE OR REPLACE FUNCTION get_managed_tasks(_manager_profile_id UUID)
RETURNS SETOF tasks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.*
  FROM tasks t
  JOIN profiles p ON p.id = t.assigned_to
  WHERE t.is_deleted = false
    AND p.manager_id = _manager_profile_id;
$$;
```

### 2. Add Pagination

```typescript
const PAGE_SIZE = 50;
const { data } = await supabase
  .from("tasks")
  .select("...", { count: "exact" })
  .eq("is_deleted", false)
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

### 3. Reduce Query Count

**Current:** 4 sequential queries per fetch (profile, roles, tasks, assignee profiles).  
**Fix:** Combine into fewer queries or use a database function.

### 4. Add Index for Common Queries

```sql
CREATE INDEX idx_tasks_assigned_to_active
  ON tasks(assigned_to)
  WHERE is_deleted = false AND status != 'approved';

CREATE INDEX idx_profiles_manager_id
  ON profiles(manager_id)
  WHERE manager_id IS NOT NULL;
```

### 5. Use `assigned_by` for Manager Filtering

The `tasks.assigned_by` column already stores who created the task. The manager view could filter by this instead of the indirect `profiles.manager_id` lookup:

```typescript
// Simpler approach:
const { data: tasks } = await supabase
  .from("tasks")
  .select("...")
  .eq("assigned_by", managerProfile.id)
  .eq("is_deleted", false);
```

This eliminates the need for the extra profiles query and client-side filtering entirely. However, it would miss tasks assigned by other managers to the current manager's direct reports. Choose based on business requirements.
