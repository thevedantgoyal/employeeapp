-- Run ALL of these in Supabase SQL editor and log every result.
-- PHASE 1 — Workload modal debug: verify tasks, users, assignees, and column names.

-- QUERY 1 — What is in tasks table
SELECT
  t.id,
  t.title,
  t.status,
  t.assigned_to,
  t.assigned_by,
  u.email AS assigned_email,
  p.full_name AS assigned_name
FROM tasks t
LEFT JOIN profiles p ON p.id = t.assigned_to
LEFT JOIN users u ON u.id = p.user_id
ORDER BY t.created_at DESC
LIMIT 20;

-- QUERY 2 — Does assigned_to match profiles.id (then we get user via profiles.user_id)
SELECT
  t.assigned_to,
  p.id AS profiles_id,
  p.user_id,
  u.email,
  CASE WHEN t.assigned_to = p.id THEN 'MATCH' ELSE 'MISMATCH' END AS check_result
FROM tasks t
LEFT JOIN profiles p ON p.id = t.assigned_to
LEFT JOIN users u ON u.id = p.user_id
LIMIT 10;

-- QUERY 3 — What assignees endpoint returns (employees with user_id)
SELECT
  u.id AS user_id,
  p.id AS profile_id,
  p.full_name,
  p.department,
  p.job_title,
  u.external_role
FROM users u
JOIN profiles p ON p.user_id = u.id
WHERE LOWER(TRIM(COALESCE(u.external_role, ''))) = 'employee'
LIMIT 10;

-- QUERY 4 — Does workload-style query return data (by profile: assigned_to is profile id)
SELECT
  t.assigned_to AS profile_id,
  COUNT(*) FILTER (WHERE LOWER(TRIM(COALESCE(t.status, ''))) NOT IN ('completed','done','approved')) AS active_count
FROM tasks t
WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
GROUP BY t.assigned_to;

-- QUERY 5 — Check exact column names in tasks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
ORDER BY ordinal_position;
