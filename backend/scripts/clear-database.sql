-- ================================
-- CacheTask DB Reset Script
-- Clears all data, keeps super admin user
-- Run in Supabase SQL editor or pgAdmin
-- ================================

-- Step 1: Save super admin (first user with role='admin')
-- Use temp tables (in pg_temp) so they survive TRUNCATE of public tables
CREATE TEMP TABLE IF NOT EXISTS _admin_users (LIKE public.users INCLUDING DEFAULTS);
CREATE TEMP TABLE IF NOT EXISTS _admin_profiles (LIKE public.profiles INCLUDING DEFAULTS);
CREATE TEMP TABLE IF NOT EXISTS _admin_user_roles (LIKE public.user_roles INCLUDING DEFAULTS);

DELETE FROM _admin_users;
DELETE FROM _admin_profiles;
DELETE FROM _admin_user_roles;

INSERT INTO _admin_users
SELECT u.* FROM public.users u
INNER JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
LIMIT 1;

INSERT INTO _admin_profiles
SELECT p.* FROM public.profiles p
WHERE p.user_id IN (SELECT id FROM _admin_users);

INSERT INTO _admin_user_roles
SELECT ur.* FROM public.user_roles ur
WHERE ur.user_id IN (SELECT id FROM _admin_users);

-- Step 2: Disable FK checks for truncation
SET session_replication_role = 'replica';

-- Step 3: Truncate ALL public tables (order: children first to avoid FK issues, then parents)
-- CASCADE will truncate any dependent tables we might have missed
TRUNCATE TABLE
  public.file_storage,
  public.task_tag_assignments,
  public.task_tags,
  public.task_dependencies,
  public.task_comments,
  public.task_evidence,
  public.task_activity_logs,
  public.timesheets,
  public.leaves,
  public.leave_balances,
  public.leave_types,
  public.attendance,
  public.audit_views,
  public.booking_audit_log,
  public.room_bookings,
  public.meeting_rooms,
  public.scheduled_notifications,
  public.push_subscriptions,
  public.notifications,
  public.skills,
  public.performance_metrics,
  public.metric_categories,
  public.contributions,
  public.tasks,
  public.project_members,
  public.projects,
  public.request_trail,
  public.requests,
  public.user_roles,
  public.profiles,
  public.users
RESTART IDENTITY CASCADE;

-- Step 4: Re-enable FK checks
SET session_replication_role = 'origin';

-- Step 5: Restore super admin (set manager_id and team_id to NULL since referenced rows are gone)
INSERT INTO public.users SELECT * FROM _admin_users;

-- Restore profile with manager_id/team_id NULL (referenced rows are gone)
INSERT INTO public.profiles
SELECT
  p.id, p.user_id, p.full_name, p.email, p.job_title, p.department, p.location, p.phone, p.avatar_url,
  p.status, p.work_hours, p.linkedin_url, NULL::uuid, NULL::uuid, p.bio, p.resume_url, p.joining_date,
  p.other_social_links, p.working_status, p.profile_completed, p.created_at, p.updated_at
FROM _admin_profiles p;

INSERT INTO public.user_roles SELECT * FROM _admin_user_roles;

-- Done
SELECT 'Database cleared. Super admin preserved.' AS message;
