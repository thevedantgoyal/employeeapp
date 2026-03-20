-- Remove task clock columns; duration + due_date / task_date only.
ALTER TABLE tasks DROP COLUMN IF EXISTS start_time;
ALTER TABLE tasks DROP COLUMN IF EXISTS end_time;
