-- =============================================================================
-- Timesheet Work Type system: enum, activity_title, conditional constraints
-- Run after 01_schema.sql. Safe to run on existing data (backfill then constrain).
-- =============================================================================

BEGIN;

-- 1. Work type enum
DO $$ BEGIN
  CREATE TYPE public.work_type_enum AS ENUM (
    'Project Work',
    'Internal Meeting',
    'Learning / Training',
    'Support',
    'Leave',
    'Other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already exists
END $$;

-- 2. Add columns (nullable first for backfill)
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS activity_title TEXT;

-- 3. Backfill existing rows: treat as Project Work if they have project+task; else Other with placeholder
UPDATE public.timesheets
SET
  work_type = CASE
    WHEN project_id IS NOT NULL AND task_id IS NOT NULL THEN 'Project Work'
    ELSE 'Other'
  END,
  activity_title = CASE
    WHEN project_id IS NOT NULL AND task_id IS NOT NULL THEN NULL
    ELSE COALESCE(description, 'Legacy entry')
  END
WHERE work_type IS NULL;

-- 4. Make work_type NOT NULL and use enum (only alter type if still text)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timesheets' AND column_name = 'work_type'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.timesheets
      ALTER COLUMN work_type TYPE public.work_type_enum USING (work_type::public.work_type_enum);
  END IF;
END $$;

ALTER TABLE public.timesheets
  ALTER COLUMN work_type SET NOT NULL,
  ALTER COLUMN work_type SET DEFAULT 'Project Work'::public.work_type_enum;

-- 5. Make description nullable (activity_title used for non-project work)
ALTER TABLE public.timesheets
  ALTER COLUMN description DROP NOT NULL;

-- 6. Conditional constraint: Project Work => project_id + task_id required, activity_title NULL; else opposite
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS timesheets_work_type_rules;

ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_work_type_rules CHECK (
    (
      work_type = 'Project Work'
      AND project_id IS NOT NULL
      AND task_id IS NOT NULL
      AND activity_title IS NULL
    )
    OR
    (
      work_type IS DISTINCT FROM 'Project Work'
      AND project_id IS NULL
      AND task_id IS NULL
      AND activity_title IS NOT NULL
      AND length(trim(activity_title)) > 0
    )
  );

-- 7. Task must belong to the selected project: enforced in application layer (repositories/timesheetRepository.taskBelongsToProject,
--    services/timesheetService create/update). PostgreSQL CHECK cannot use subqueries.

-- 8. Indexes for filtering and reporting (idempotent: create if not exists)
CREATE INDEX IF NOT EXISTS idx_timesheets_user_date ON public.timesheets(user_id, date);
CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON public.timesheets(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_work_type ON public.timesheets(work_type);

COMMIT;
