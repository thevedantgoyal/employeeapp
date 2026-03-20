-- Add time slot columns to tasks (optional; safe to run multiple times).
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS duration_hours numeric(4,2);

COMMENT ON COLUMN tasks.task_date IS 'Optional date for the task time slot';
COMMENT ON COLUMN tasks.start_time IS 'Optional start time (e.g. 09:00)';
COMMENT ON COLUMN tasks.end_time IS 'Optional end time (e.g. 11:00)';
COMMENT ON COLUMN tasks.duration_hours IS 'Auto-calculated: (end_time - start_time) in hours';
