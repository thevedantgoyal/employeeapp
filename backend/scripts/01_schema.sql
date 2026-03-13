-- =============================================================================
-- ConnectPlus — Full PostgreSQL Schema Migration (Supabase → Self-Managed)
-- Run this on a fresh PostgreSQL 14+ database. No RLS (enforced in backend).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'employee',
  'team_lead',
  'manager',
  'hr',
  'admin',
  'organization'
);

-- -----------------------------------------------------------------------------
-- 2. USERS TABLE (replaces auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON public.users(email);

-- -----------------------------------------------------------------------------
-- 3. PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
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
  bio TEXT,
  resume_url TEXT,
  joining_date DATE,
  other_social_links JSONB DEFAULT '{}',
  working_status TEXT NOT NULL DEFAULT 'available',
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_manager_id ON public.profiles(manager_id);
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX idx_profiles_working_status ON public.profiles(working_status);
CREATE INDEX idx_profiles_profile_completed ON public.profiles(profile_completed);

-- -----------------------------------------------------------------------------
-- 4. USER ROLES
-- -----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'employee',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- -----------------------------------------------------------------------------
-- 5. TEAMS
-- -----------------------------------------------------------------------------
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  lead_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_team
  FOREIGN KEY (team_id) REFERENCES public.teams(id);

-- -----------------------------------------------------------------------------
-- 6. PROJECTS
-- -----------------------------------------------------------------------------
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  team_id UUID REFERENCES public.teams(id),
  project_type TEXT NOT NULL DEFAULT 'inhouse',
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_created_by ON public.projects(created_by);

-- -----------------------------------------------------------------------------
-- 7. PROJECT MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, employee_id)
);

CREATE INDEX idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX idx_project_members_employee_id ON public.project_members(employee_id);

-- -----------------------------------------------------------------------------
-- 8. TASKS
-- -----------------------------------------------------------------------------
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
  task_type TEXT NOT NULL DEFAULT 'project_task',
  blocked_reason TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  reassigned_from UUID REFERENCES public.profiles(id),
  reassignment_reason TEXT,
  reassignment_count INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  is_seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX idx_tasks_is_deleted ON public.tasks(is_deleted);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_is_seen ON public.tasks(is_seen);
CREATE INDEX idx_tasks_task_type ON public.tasks(task_type);
CREATE INDEX idx_tasks_assigned_to_status ON public.tasks(assigned_to, status) WHERE is_deleted = false;

-- -----------------------------------------------------------------------------
-- 9. CONTRIBUTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX idx_contributions_task_id ON public.contributions(task_id);
CREATE INDEX idx_contributions_status ON public.contributions(status);

-- -----------------------------------------------------------------------------
-- 10. METRIC CATEGORIES
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 11. PERFORMANCE METRICS
-- -----------------------------------------------------------------------------
CREATE TABLE public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.metric_categories(id),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  notes TEXT,
  evaluated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, period_start, period_end)
);

CREATE INDEX idx_performance_metrics_user_id ON public.performance_metrics(user_id);

-- -----------------------------------------------------------------------------
-- 12. SKILLS
-- -----------------------------------------------------------------------------
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 50 CHECK (proficiency_level >= 0 AND proficiency_level <= 100),
  goal_level INTEGER DEFAULT 100 CHECK (goal_level >= 0 AND goal_level <= 100),
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_skills_user_id ON public.skills(user_id);

-- -----------------------------------------------------------------------------
-- 13. NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'task_assigned', 'contribution_approved', 'contribution_rejected',
    'role_changed', 'team_assigned', 'general', 'leave_request'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- -----------------------------------------------------------------------------
-- 14. PUSH SUBSCRIPTIONS
-- -----------------------------------------------------------------------------
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- -----------------------------------------------------------------------------
-- 15. SCHEDULED NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE public.scheduled_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all', 'role', 'user')),
  target_value TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled')),
  send_push BOOLEAN NOT NULL DEFAULT true,
  send_email BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 16. MEETING ROOMS
-- -----------------------------------------------------------------------------
CREATE TABLE public.meeting_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  floor TEXT,
  capacity INTEGER NOT NULL DEFAULT 10,
  has_projector BOOLEAN NOT NULL DEFAULT false,
  has_video_conferencing BOOLEAN NOT NULL DEFAULT false,
  has_whiteboard BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 17. ROOM BOOKINGS
-- -----------------------------------------------------------------------------
CREATE TABLE public.room_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.meeting_rooms(id) ON DELETE CASCADE,
  booked_by UUID NOT NULL REFERENCES public.users(id),
  title TEXT NOT NULL,
  purpose TEXT,
  project_id UUID REFERENCES public.projects(id),
  meeting_type TEXT NOT NULL DEFAULT 'internal' CHECK (meeting_type IN ('internal', 'client', 'leadership')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'leadership')),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  participants TEXT[],
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled', 'rescheduled')),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_bookings_room_id ON public.room_bookings(room_id);
CREATE INDEX idx_room_bookings_booked_by ON public.room_bookings(booked_by);
CREATE INDEX idx_room_bookings_conflict ON public.room_bookings (room_id, booking_date, start_time, end_time)
  WHERE status NOT IN ('cancelled');

-- -----------------------------------------------------------------------------
-- 18. BOOKING AUDIT LOG
-- -----------------------------------------------------------------------------
CREATE TABLE public.booking_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.room_bookings(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.users(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 18b. AUDIT VIEWS (track which participant bookings user has viewed, for badge)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.room_bookings(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, booking_id)
);
CREATE INDEX IF NOT EXISTS idx_audit_views_user_id ON public.audit_views(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_views_booking_id ON public.audit_views(booking_id);

-- -----------------------------------------------------------------------------
-- 19. ATTENDANCE
-- -----------------------------------------------------------------------------
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  location_lat NUMERIC,
  location_lng NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT attendance_user_date_unique UNIQUE (user_id, date),
  CONSTRAINT attendance_status_check CHECK (status IN ('present', 'late', 'half_day', 'absent'))
);

CREATE INDEX idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_user_date ON public.attendance(user_id, date);

-- -----------------------------------------------------------------------------
-- 20. LEAVE TYPES
-- -----------------------------------------------------------------------------
CREATE TABLE public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  default_days INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'hsl(var(--primary))',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.leave_types (code, name, default_days, color) VALUES
  ('CL', 'Casual Leave', 12, 'hsl(var(--primary))'),
  ('SL', 'Sick Leave', 10, 'hsl(142 76% 36%)'),
  ('EL', 'Earned Leave', 15, 'hsl(38 92% 50%)');

-- -----------------------------------------------------------------------------
-- 21. LEAVE BALANCES
-- -----------------------------------------------------------------------------
CREATE TABLE public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  total INTEGER NOT NULL DEFAULT 0,
  used NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_unique UNIQUE (user_id, leave_type_id, year),
  CONSTRAINT leave_balances_used_check CHECK (used >= 0)
);

CREATE INDEX idx_leave_balances_user ON public.leave_balances(user_id);
CREATE INDEX idx_leave_balances_year ON public.leave_balances(year);

-- -----------------------------------------------------------------------------
-- 22. LEAVES
-- -----------------------------------------------------------------------------
CREATE TABLE public.leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  half_day BOOLEAN NOT NULL DEFAULT false,
  days_count NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approver_id UUID REFERENCES public.profiles(id),
  approver_comment TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leaves_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT leaves_dates_check CHECK (to_date >= from_date),
  CONSTRAINT leaves_days_check CHECK (days_count > 0)
);

CREATE INDEX idx_leaves_user ON public.leaves(user_id);
CREATE INDEX idx_leaves_status ON public.leaves(status);
CREATE INDEX idx_leaves_dates ON public.leaves(from_date, to_date);
CREATE INDEX idx_leaves_approver ON public.leaves(approver_id);

-- -----------------------------------------------------------------------------
-- 23. TIMESHEETS
-- -----------------------------------------------------------------------------
CREATE TABLE public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id),
  task_id UUID REFERENCES public.tasks(id),
  date DATE NOT NULL,
  hours NUMERIC NOT NULL,
  description TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT timesheets_hours_check CHECK (hours > 0 AND hours <= 24)
);

CREATE INDEX idx_timesheets_user ON public.timesheets(user_id);
CREATE INDEX idx_timesheets_date ON public.timesheets(date);
CREATE INDEX idx_timesheets_user_date ON public.timesheets(user_id, date);
CREATE INDEX idx_timesheets_project ON public.timesheets(project_id);

-- -----------------------------------------------------------------------------
-- 24. TASK ACTIVITY LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_logs_task_id ON public.task_activity_logs(task_id);

-- -----------------------------------------------------------------------------
-- 25. TASK EVIDENCE
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_url TEXT NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'other',
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_evidence_task_id ON public.task_evidence(task_id);

-- -----------------------------------------------------------------------------
-- 26. TASK COMMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);

-- -----------------------------------------------------------------------------
-- 27. TASK DEPENDENCIES
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(task_id, depends_on),
  CHECK (task_id != depends_on)
);

CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies(task_id);

-- -----------------------------------------------------------------------------
-- 28. TASK TAGS
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- -----------------------------------------------------------------------------
-- 29. TASK TAG ASSIGNMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE public.task_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.task_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  UNIQUE(task_id, tag_id)
);

CREATE INDEX idx_task_tag_assignments_task_id ON public.task_tag_assignments(task_id);

-- -----------------------------------------------------------------------------
-- 30. FILE STORAGE (replaces Supabase Storage - files stored in Postgres)
-- -----------------------------------------------------------------------------
CREATE TABLE public.file_storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(bucket, object_path)
);

CREATE INDEX idx_file_storage_bucket_path ON public.file_storage(bucket, object_path);
CREATE INDEX idx_file_storage_user_id ON public.file_storage(user_id);

-- -----------------------------------------------------------------------------
-- HELPER FUNCTIONS (no auth.uid - used from backend with explicit params)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_profile_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(_manager_user_id UUID, _employee_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _employee_user_id
      AND p.manager_id = public.get_user_profile_id(_manager_user_id)
  )
$$;

-- -----------------------------------------------------------------------------
-- CHECK BOOKING CONFLICT (called from backend)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_booking_conflict(
  _room_id UUID,
  _booking_date DATE,
  _start_time TIME,
  _end_time TIME,
  _exclude_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, title TEXT, priority TEXT, booked_by UUID, start_time TIME, end_time TIME)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT rb.id, rb.title, rb.priority, rb.booked_by, rb.start_time, rb.end_time
  FROM public.room_bookings rb
  WHERE rb.room_id = _room_id
    AND rb.booking_date = _booking_date
    AND rb.status NOT IN ('cancelled')
    AND rb.start_time < _end_time
    AND rb.end_time > _start_time
    AND (_exclude_id IS NULL OR rb.id != _exclude_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- CHECK LEAVE OVERLAP (called from backend)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_leave_overlap(
  _user_id UUID,
  _from_date DATE,
  _to_date DATE,
  _exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaves
    WHERE user_id = _user_id
      AND status IN ('pending', 'approved')
      AND from_date <= _to_date
      AND to_date >= _from_date
      AND (_exclude_id IS NULL OR id != _exclude_id)
  )
$$;

-- -----------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
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

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_performance_metrics_updated_at BEFORE UPDATE ON public.performance_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON public.leaves FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_timesheets_updated_at BEFORE UPDATE ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meeting_rooms_updated_at BEFORE UPDATE ON public.meeting_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_room_bookings_updated_at BEFORE UPDATE ON public.room_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_task_comments_updated_at BEFORE UPDATE ON public.task_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- PROVISION LEAVE BALANCES ON PROFILE COMPLETE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_leave_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_completed = true AND (OLD.profile_completed IS NULL OR OLD.profile_completed = false) THEN
    INSERT INTO public.leave_balances (user_id, leave_type_id, total, year)
    SELECT NEW.user_id, lt.id, lt.default_days, EXTRACT(YEAR FROM now())::integer
    FROM public.leave_types lt
    ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provision_leave_on_profile_complete
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_leave_balances();

-- -----------------------------------------------------------------------------
-- NOTIFY ON LEAVE APPLIED
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_leave_applied()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _employee_name TEXT;
  _manager_user_id UUID;
  _leave_type_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT full_name INTO _employee_name FROM public.profiles WHERE user_id = NEW.user_id;
    SELECT p2.user_id INTO _manager_user_id
    FROM public.profiles emp
    JOIN public.profiles p2 ON p2.id = emp.manager_id
    WHERE emp.user_id = NEW.user_id;
    SELECT name INTO _leave_type_name FROM public.leave_types WHERE id = NEW.leave_type_id;

    IF _manager_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        _manager_user_id,
        'leave_request',
        'Leave Request from ' || COALESCE(_employee_name, 'Employee'),
        COALESCE(_employee_name, 'An employee') || ' has requested ' || COALESCE(_leave_type_name, 'leave') ||
          ' from ' || NEW.from_date::text || ' to ' || NEW.to_date::text || ' (' || NEW.days_count || ' day(s))',
        jsonb_build_object(
          'leave_id', NEW.id,
          'employee_user_id', NEW.user_id,
          'leave_type', _leave_type_name,
          'from_date', NEW.from_date,
          'to_date', NEW.to_date,
          'days_count', NEW.days_count
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_leave_applied
  AFTER INSERT ON public.leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_leave_applied();

-- -----------------------------------------------------------------------------
-- NOTIFY ON TASK ASSIGNED
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignee_user_id UUID;
  assigner_name TEXT;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    SELECT user_id INTO assignee_user_id FROM public.profiles WHERE id = NEW.assigned_to;
    IF NEW.assigned_by IS NOT NULL THEN
      SELECT full_name INTO assigner_name FROM public.profiles WHERE id = NEW.assigned_by;
    END IF;
    IF assignee_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        assignee_user_id,
        'task_assigned',
        'New Task Assigned',
        'You have been assigned a new task: "' || NEW.title || '"' ||
          CASE WHEN assigner_name IS NOT NULL THEN ' by ' || assigner_name ELSE '' END,
        jsonb_build_object('task_id', NEW.id, 'task_title', NEW.title)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- -----------------------------------------------------------------------------
-- NOTIFY ON TEAM ASSIGNED
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_team_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_name TEXT;
BEGIN
  IF NEW.team_id IS NOT NULL AND (OLD.team_id IS NULL OR OLD.team_id != NEW.team_id) THEN
    SELECT name INTO team_name FROM public.teams WHERE id = NEW.team_id;
    IF NEW.user_id IS NOT NULL AND team_name IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        NEW.user_id,
        'team_assigned',
        'Added to Team',
        'You have been added to the team: "' || team_name || '"',
        jsonb_build_object('team_id', NEW.team_id, 'team_name', team_name)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_team_assigned
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_team_assigned();

COMMIT;
