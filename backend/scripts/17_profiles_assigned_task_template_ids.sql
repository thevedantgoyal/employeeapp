-- Per-employee allowed rows in dept_task_templates (task-creation UI).
-- Empty array {} means "all templates for that employee's department" (backward compatible).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_task_template_ids UUID[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_assigned_task_template_ids
  ON public.profiles USING GIN (assigned_task_template_ids);
