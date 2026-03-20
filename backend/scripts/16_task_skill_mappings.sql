-- Skill matching metadata for department task titles.
-- This enables assignee ranking by fit score without changing existing task routes.
CREATE TABLE IF NOT EXISTS task_skill_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  task_title TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  weight NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsm_dept_title
  ON task_skill_mappings (department, task_title);

CREATE INDEX IF NOT EXISTS idx_tsm_skill_name
  ON task_skill_mappings (skill_name);

