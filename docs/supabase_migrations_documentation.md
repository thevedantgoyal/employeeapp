# ConnectPlus — Supabase Migrations Documentation

**Version:** 1.0  
**Generated:** 2026-02-25  
**Total Migrations:** 15

---

## Table of Contents

1. [Enum Types](#1-enum-types)
2. [Migration Files (Chronological)](#2-migration-files-chronological)
3. [Database Schema Summary](#3-database-schema-summary)
4. [Tasks Table Deep Dive](#4-tasks-table-deep-dive)
5. [Identity & Relationship Model](#5-identity--relationship-model)
6. [Functions & Triggers](#6-functions--triggers)
7. [Potential Improvements](#7-potential-improvements)

---

## 1. Enum Types

### `app_role`

```sql
CREATE TYPE public.app_role AS ENUM (
  'employee',
  'team_lead',
  'manager',
  'hr',
  'admin',
  'organization'  -- Added in migration #9
);
```

Used in `user_roles.role` column to enforce valid role assignments.

---

## 2. Migration Files (Chronological)

---

### Migration 1: `20260120111807_a4a9f689-f9a6-4543-b008-aed72e0ed2af.sql`

**Purpose:** Foundation schema — creates all core tables, functions, triggers, and RLS policies.

**Tables Created:**

| Table | Purpose |
|---|---|
| `profiles` | User profile data linked to `auth.users` |
| `user_roles` | RBAC role assignments (separate from profiles) |
| `teams` | Team/department grouping |
| `projects` | Project containers |
| `tasks` | Task records |
| `contributions` | Employee work updates with evidence |
| `metric_categories` | Performance evaluation category definitions |
| `performance_metrics` | Scored evaluations per user/category/period |
| `skills` | Self-reported skill proficiency tracking |

**SQL:**

```sql
-- Enum
CREATE TYPE public.app_role AS ENUM ('employee', 'team_lead', 'manager', 'hr', 'admin');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  location TEXT,
  phone TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'available',
  work_hours TEXT DEFAULT '9:00 AM - 6:00 PM',
  linkedin_url TEXT,
  manager_id UUID REFERENCES public.profiles(id),
  team_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles (CRITICAL: separate from profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK: profiles.team_id -> teams.id
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_team
  FOREIGN KEY (team_id) REFERENCES public.teams(id);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id),
  assigned_to UUID REFERENCES public.profiles(id),
  assigned_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contributions
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT,
  evidence_url TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metric Categories (with seed data)
CREATE TABLE public.metric_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.metric_categories (name, description, icon) VALUES
  ('Collaboration', 'Ability to work effectively with team members', 'users'),
  ('Communication', 'Clear and effective communication skills', 'message-square'),
  ('Problem Solving', 'Analytical and creative problem resolution', 'lightbulb'),
  ('Time Management', 'Efficient use of time and meeting deadlines', 'clock'),
  ('Project Management', 'Planning and executing projects effectively', 'folder-kanban');

-- Performance Metrics
CREATE TABLE public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.metric_categories(id) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  evaluated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period_start, period_end)
);

-- Skills
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 50 CHECK (proficiency_level >= 0 AND proficiency_level <= 100),
  goal_level INTEGER DEFAULT 100 CHECK (goal_level >= 0 AND goal_level <= 100),
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Functions Created:**

| Function | Purpose |
|---|---|
| `has_role(_user_id, _role)` | Security definer — checks if user has a role |
| `get_user_profile_id(_user_id)` | Security definer — resolves auth UUID → profile UUID |
| `is_manager_of(_manager_user_id, _employee_user_id)` | Security definer — validates manager relationship |
| `handle_new_user()` | Trigger function — auto-creates profile + default 'employee' role on signup |
| `update_updated_at_column()` | Trigger function — auto-updates `updated_at` timestamp |

**Triggers Created:**

| Trigger | Table | Event |
|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT |
| `update_profiles_updated_at` | `profiles` | BEFORE UPDATE |
| `update_teams_updated_at` | `teams` | BEFORE UPDATE |
| `update_projects_updated_at` | `projects` | BEFORE UPDATE |
| `update_tasks_updated_at` | `tasks` | BEFORE UPDATE |
| `update_contributions_updated_at` | `contributions` | BEFORE UPDATE |
| `update_performance_metrics_updated_at` | `performance_metrics` | BEFORE UPDATE |

**RLS Policies:** Enabled on all 9 tables with role-based SELECT/INSERT/UPDATE/ALL policies.

---

### Migration 2: `20260120111824_16605b13-6121-41e7-9df7-a8819f2ac3e7.sql`

**Purpose:** Fix `update_updated_at_column` function to include `search_path`.

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

---

### Migration 3: `20260120112731_1bd3eb26-9820-4074-9504-7f16a3d173c5.sql`

**Purpose:** Create `setup_first_admin` function for initial admin bootstrapping.

```sql
CREATE OR REPLACE FUNCTION public.setup_first_admin(_user_id UUID, _setup_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN
    IF _setup_code != 'FIRST_ADMIN_SETUP_2024' THEN
      RAISE EXCEPTION 'Invalid setup code or admins already exist';
    END IF;
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin');
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_first_admin(UUID, TEXT) TO authenticated;
```

---

### Migration 4: `20260120113648_65557b02-ff87-4a83-8c72-a468db47c875.sql`

**Purpose:** Create storage bucket `evidence` with RLS policies for file uploads.

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;
```

**Storage Policies:**
- Users can upload/view/delete their own evidence (folder = `auth.uid()`)
- HR/Admin can view all evidence
- Managers can view their team's evidence

---

### Migration 5: `20260123065104_b5230344-31ba-425f-bdc7-91f330283cf6.sql`

**Purpose:** Create `notifications` table with realtime enabled.

```sql
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_assigned', 'contribution_approved',
    'contribution_rejected', 'role_changed', 'team_assigned', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Indexes:**
- `idx_notifications_user_id` on `(user_id)`
- `idx_notifications_read` on `(user_id, read)`

**Function:** `create_notification()` — security definer helper for inserting notifications.

**Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;`

---

### Migration 6: `20260123065114_ad36cd41-bd79-4659-b3f3-54834eee5239.sql`

**Purpose:** Fix overly permissive notification INSERT policy.

```sql
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

CREATE POLICY "Admins and managers can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'team_lead', 'hr')
  )
  OR auth.uid() = user_id
);
```

---

### Migration 7: `20260123065458_e7bc8b04-6590-426e-83c4-6c81189a1708.sql`

**Purpose:** Create notification triggers for task assignments and team assignments.

**Functions:**
- `notify_task_assigned()` — fires on task INSERT/UPDATE when `assigned_to` changes
- `notify_team_assigned()` — fires on profile UPDATE when `team_id` changes

**Triggers:**
- `on_task_assigned` → `tasks` AFTER INSERT OR UPDATE
- `on_team_assigned` → `profiles` AFTER UPDATE

---

### Migration 8: `20260123082919_8c4fbb6c-6280-4009-a36b-244db603e924.sql`

**Purpose:** Add `organization` value to `app_role` enum.

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organization';
```

---

### Migration 9: `20260123082930_4e857ba0-e394-4aea-ba5b-cfa61c073ad9.sql`

**Purpose:** Add read-only RLS policies for `organization` role across all major tables.

Tables updated: `profiles`, `tasks`, `contributions`, `performance_metrics`, `skills`, `user_roles`.

---

### Migration 10: `20260123084732_1b4a25a8-8dc8-4f06-8ec1-5ea756ffb637.sql`

**Purpose:** Tighten authentication requirements on `profiles` and `teams`.

```sql
CREATE POLICY "Require authentication for profiles"
  ON public.profiles FOR ALL TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Require authentication for teams"
  ON public.teams FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;
```

---

### Migration 11: `20260123101951_0e4b8426-14de-4a6b-b965-8b394fe1c8fb.sql`

**Purpose:** Create `push_subscriptions` table for Web Push notifications.

```sql
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

**Realtime:** Enabled.

---

### Migration 12: `20260123102451_6293ac0b-ca91-4192-920a-3ad0ed58d137.sql`

**Purpose:** Create `scheduled_notifications` table for admin broadcast system.

```sql
CREATE TABLE public.scheduled_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'role', 'user')),
  target_value TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  send_push BOOLEAN NOT NULL DEFAULT true,
  send_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Access:** Admin-only (all CRUD operations).

---

### Migration 13: `20260216112757_c6be7594-2576-4b2c-ab52-25a792f2295b.sql`

**Purpose:** Create meeting rooms, room bookings, and booking audit log tables.

**Tables Created:**

| Table | Purpose |
|---|---|
| `meeting_rooms` | Room inventory with amenities |
| `room_bookings` | Reservation records with conflict detection |
| `booking_audit_log` | Audit trail for booking actions |

**Function:** `check_booking_conflict()` — detects overlapping bookings for a given room/date/time.

**Index:** `idx_room_bookings_conflict` on `(room_id, booking_date, start_time, end_time)` WHERE status != 'cancelled'.

---

### Migration 14: `20260217060709_c18541d9-b714-40e1-9abf-bb1c8e5521f0.sql`

**Purpose:** Enterprise task management upgrade — adds activity logs, evidence, comments.

**Tasks Table Alterations:**

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'project_task',
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reassigned_from uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reassignment_reason text,
  ADD COLUMN IF NOT EXISTS reassignment_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
```

**New Tables:**

| Table | Purpose |
|---|---|
| `task_activity_logs` | Audit trail for all task changes |
| `task_evidence` | File uploads proving task completion |
| `task_comments` | Threaded discussion on tasks |

---

### Migration 15: `20260217063834_65110af3-b526-4e50-a32e-43ab3519487a.sql`

**Purpose:** Add subtasks, dependencies, and tags to the task system.

**Tasks Table Alteration:**

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
```

**New Tables:**

| Table | Purpose |
|---|---|
| `task_dependencies` | Inter-task blocking/related relationships |
| `task_tags` | Label definitions with color |
| `task_tag_assignments` | Many-to-many task ↔ tag mapping |

---

## 3. Database Schema Summary

### All Tables (21)

| # | Table | Columns | Key Relationships |
|---|---|---|---|
| 1 | `profiles` | 16 cols | `user_id` → `auth.users`, `manager_id` → self, `team_id` → `teams` |
| 2 | `user_roles` | 4 cols | `user_id` → `auth.users` |
| 3 | `teams` | 6 cols | `lead_id` → `profiles` |
| 4 | `projects` | 7 cols | `team_id` → `teams` |
| 5 | `tasks` | 21 cols | `assigned_to`, `assigned_by`, `deleted_by`, `reassigned_from` → `profiles`; `project_id` → `projects`; `parent_task_id` → self |
| 6 | `contributions` | 13 cols | `user_id` → `auth.users`, `task_id` → `tasks`, `reviewed_by` → `profiles` |
| 7 | `metric_categories` | 6 cols | None |
| 8 | `performance_metrics` | 10 cols | `user_id` → `auth.users`, `category_id` → `metric_categories`, `evaluated_by` → `profiles` |
| 9 | `skills` | 7 cols | `user_id` → `auth.users` |
| 10 | `notifications` | 8 cols | `user_id` → `auth.users` |
| 11 | `push_subscriptions` | 7 cols | `user_id` → `auth.users` |
| 12 | `scheduled_notifications` | 12 cols | `created_by` → `auth.users` |
| 13 | `meeting_rooms` | 12 cols | None |
| 14 | `room_bookings` | 16 cols | `room_id` → `meeting_rooms`, `project_id` → `projects` |
| 15 | `booking_audit_log` | 6 cols | `booking_id` → `room_bookings` |
| 16 | `task_activity_logs` | 7 cols | `task_id` → `tasks`, `performed_by` → `profiles` |
| 17 | `task_evidence` | 7 cols | `task_id` → `tasks`, `uploaded_by` → `profiles` |
| 18 | `task_comments` | 6 cols | `task_id` → `tasks`, `author_id` → `profiles` |
| 19 | `task_dependencies` | 6 cols | `task_id` → `tasks`, `depends_on` → `tasks`, `created_by` → `profiles` |
| 20 | `task_tags` | 5 cols | `created_by` → `profiles` |
| 21 | `task_tag_assignments` | 5 cols | `task_id` → `tasks`, `tag_id` → `task_tags`, `assigned_by` → `profiles` |

---

## 4. Tasks Table Deep Dive

The `tasks` table is the most complex table in the schema with **21 columns**:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `title` | TEXT | — | Task title (required) |
| `description` | TEXT | NULL | Optional detailed description |
| `project_id` | UUID (FK) | NULL | Links to `projects.id` |
| `assigned_to` | UUID (FK) | NULL | **Profile ID** of assignee → `profiles.id` |
| `assigned_by` | UUID (FK) | NULL | **Profile ID** of creator/assigner → `profiles.id` |
| `status` | TEXT | `'pending'` | One of: pending, in_progress, review, blocked, completed, approved |
| `priority` | TEXT | `'medium'` | One of: low, medium, high, critical |
| `due_date` | TIMESTAMPTZ | NULL | Deadline |
| `completed_at` | TIMESTAMPTZ | NULL | When status changed to completed |
| `task_type` | TEXT | `'project_task'` | Categorization (project_task, etc.) |
| `blocked_reason` | TEXT | NULL | Why task is blocked |
| `is_deleted` | BOOLEAN | `false` | Soft delete flag |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete timestamp |
| `deleted_by` | UUID (FK) | NULL | Who deleted → `profiles.id` |
| `reassigned_from` | UUID (FK) | NULL | Previous assignee → `profiles.id` |
| `reassignment_reason` | TEXT | NULL | Why task was reassigned |
| `reassignment_count` | INTEGER | `0` | Number of reassignments |
| `assigned_at` | TIMESTAMPTZ | NULL | When last assigned |
| `parent_task_id` | UUID (FK) | NULL | Self-reference for subtasks → `tasks.id` |
| `created_at` | TIMESTAMPTZ | `now()` | Record creation time |
| `updated_at` | TIMESTAMPTZ | `now()` | Auto-updated via trigger |

**Key Design Decisions:**
- Uses **soft delete** (`is_deleted` + `deleted_at` + `deleted_by`) instead of hard DELETE
- Tracks full **reassignment history** (from, reason, count)
- Supports **subtasks** via `parent_task_id` self-reference
- `assigned_to` and `assigned_by` reference `profiles.id` (NOT `auth.users.id`)

---

## 5. Identity & Relationship Model

### How `createdBy` / `managerId` / `adminId` is Stored

```
auth.users (Supabase Auth)
    │
    ├── user_id (UUID) ──────────────────┐
    │                                     ▼
    │                              profiles.user_id
    │                              profiles.id (profile UUID)
    │                                     │
    │                                     ├── profiles.manager_id → profiles.id
    │                                     │   (Self-referential FK for manager hierarchy)
    │                                     │
    │                                     ├── tasks.assigned_by → profiles.id
    │                                     │   (Who created/assigned the task)
    │                                     │
    │                                     └── tasks.assigned_to → profiles.id
    │                                         (Who the task is assigned to)
    │
    └── user_roles.user_id → auth.users.id
        user_roles.role = 'admin' | 'manager' | etc.
        (Role determines permissions, NOT stored on profiles)
```

**Critical Points:**

1. **`manager_id`** is stored on `profiles.manager_id` as a **profile UUID** (not auth user UUID). It's a self-referential FK pointing to `profiles.id`.

2. **Admin identity** is determined by querying `user_roles` table where `role = 'admin'`. There is no `adminId` column anywhere.

3. **`assigned_by`** (task creator) stores the **profile UUID** of the manager/admin who created the task — resolved at insert time via `profiles.id` lookup.

4. **Two UUID systems exist:**
   - `auth.users.id` — Supabase Auth UUID (used in `auth.uid()`)
   - `profiles.id` — Application profile UUID (used in all FK relationships)
   - The `get_user_profile_id()` function bridges between them.

---

## 6. Functions & Triggers

### Security Definer Functions

| Function | Signature | Purpose |
|---|---|---|
| `has_role` | `(UUID, app_role) → BOOLEAN` | Check if user has a specific role |
| `get_user_profile_id` | `(UUID) → UUID` | Resolve auth UUID → profile UUID |
| `is_manager_of` | `(UUID, UUID) → BOOLEAN` | Validate manager-employee relationship |
| `handle_new_user` | `() → TRIGGER` | Auto-create profile + employee role on signup |
| `setup_first_admin` | `(UUID, TEXT) → BOOLEAN` | Bootstrap first admin user |
| `create_notification` | `(UUID, TEXT, TEXT, TEXT, JSONB) → UUID` | Insert notification record |
| `check_booking_conflict` | `(UUID, DATE, TIME, TIME, UUID?) → TABLE` | Detect overlapping room bookings |
| `notify_task_assigned` | `() → TRIGGER` | Create notification when task is assigned |
| `notify_team_assigned` | `() → TRIGGER` | Create notification when user joins team |
| `update_updated_at_column` | `() → TRIGGER` | Auto-set `updated_at = now()` |

### Active Triggers

| Trigger | Table | Event | Function |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `on_task_assigned` | `tasks` | AFTER INSERT OR UPDATE | `notify_task_assigned()` |
| `on_team_assigned` | `profiles` | AFTER UPDATE | `notify_team_assigned()` |
| `update_*_updated_at` | Multiple tables | BEFORE UPDATE | `update_updated_at_column()` |

---

## 7. Potential Improvements

### Security

1. **`setup_first_admin` hardcoded code** — The setup code `FIRST_ADMIN_SETUP_2024` is hardcoded in the function. Should use an environment variable/secret instead.

2. **`push_subscriptions` SELECT policy** — The `"Service role can read all subscriptions"` policy uses `USING (true)` which allows any authenticated user to read all push subscriptions. Should restrict to service role only.

3. **`notifications` type CHECK constraint** — The CHECK constraint limits notification types. Adding new types requires a migration. Consider removing the constraint or using an enum.

### Schema

4. **`room_bookings.booked_by`** references `auth.users.id` directly (no FK constraint defined), while tasks use `profiles.id`. Should be consistent — either all use profile IDs or all use auth user IDs.

5. **Missing indexes** on frequently queried columns:
   - `tasks.assigned_to`
   - `tasks.status`
   - `tasks.is_deleted`
   - `contributions.user_id` + `contributions.status`

6. **`task_type` column** has no CHECK constraint — values are enforced only at the application level. Consider adding a constraint or enum.

7. **No `timesheets` or `attendance` tables** exist in the database despite the app having Timesheet and Attendance pages — these features appear to use mock/local data only.

### Performance

8. **`is_manager_of` function** calls `get_user_profile_id` internally, resulting in two sequential queries per RLS check. For tables with many rows, this can be slow. Consider a materialized view or denormalized `manager_user_id` column.

9. **Missing composite indexes** for RLS policy subqueries (e.g., `tasks(assigned_to, is_deleted, status)`).
