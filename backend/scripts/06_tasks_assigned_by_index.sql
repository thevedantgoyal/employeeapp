-- Optional: index for manager lookups by assigned_by (e.g. "tasks I assigned").
-- Run after 01_schema.sql.
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks(assigned_by);
