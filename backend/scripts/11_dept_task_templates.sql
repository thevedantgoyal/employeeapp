-- Department-based task templates and task_assignees for shared tasks
-- Run after 01_schema.sql (e.g. psql $DATABASE_URL -f backend/scripts/11_dept_task_templates.sql)

BEGIN;

-- TABLE: dept_task_templates
CREATE TABLE IF NOT EXISTS public.dept_task_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department TEXT NOT NULL,
  task_title TEXT NOT NULL,
  description_hint TEXT,
  required_job_titles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_templates_dept ON public.dept_task_templates(department);
CREATE INDEX IF NOT EXISTS idx_dept_templates_active ON public.dept_task_templates(is_active);

-- Add columns to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.dept_task_templates(id) ON DELETE SET NULL;

-- Table for shared-task assignees (one task, multiple assignees)
CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_profile_id ON public.task_assignees(profile_id);

COMMIT;
