-- One-time fix: ensure users who assign tasks have manager role and assignees have manager_id set.
-- Run after 01_schema.sql. Safe to run multiple times (idempotent).

-- 1. Grant 'manager' role to any user whose profile id appears as assigned_by in tasks,
--    if they don't already have a manager-type role.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT p.user_id, 'manager'::public.app_role
FROM public.tasks t
JOIN public.profiles p ON p.id = t.assigned_by
WHERE t.is_deleted = false
  AND t.assigned_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role IN ('manager', 'team_lead', 'admin', 'hr')
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Set manager_id on assignee profiles to the assigner (assigned_by) when manager_id is currently NULL,
--    so "direct reports" check works for manager task list.
UPDATE public.profiles pr
SET manager_id = sub.assigned_by
FROM (
  SELECT DISTINCT ON (t.assigned_to) t.assigned_to, t.assigned_by
  FROM public.tasks t
  WHERE t.is_deleted = false
    AND t.assigned_to IS NOT NULL
    AND t.assigned_by IS NOT NULL
  ORDER BY t.assigned_to, t.assigned_at DESC NULLS LAST, t.created_at DESC
) sub
WHERE pr.id = sub.assigned_to
  AND pr.manager_id IS NULL;
