-- Add department and template_id to tasks (for department-based task creation).
-- Run if 11_dept_task_templates.sql was not run or columns are missing.
-- Usage: psql $DATABASE_URL -f backend/scripts/12_tasks_department_template_id.sql

BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS department TEXT;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS template_id UUID;

-- Add FK only if dept_task_templates exists and constraint not already present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dept_task_templates'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'tasks'
      AND constraint_name = 'fk_tasks_template'
    ) THEN
      ALTER TABLE public.tasks
        ADD CONSTRAINT fk_tasks_template
        FOREIGN KEY (template_id)
        REFERENCES public.dept_task_templates(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMIT;
