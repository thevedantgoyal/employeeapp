import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query, getPool } from '../config/database.js';
import { normalizeUUID, normalizeUUIDArray } from '../utils/uuid.js';

const router = Router();
router.use(authenticate);

/**
 * POST /projects
 * Create project and insert ALL assigned members (managers + employees) in a transaction.
 * Body: { name, description?, project_type, due_date, employeeIds: string[] } (employeeIds = profile ids).
 */
router.post('/', async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    const creatorProfileId = normalizeUUID(req.profileId);
    if (!creatorProfileId || !currentUserId) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    const { name, description, project_type, due_date, employeeIds } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ data: null, error: { message: 'Project name is required' } });
    }
    const assignedIds = Array.isArray(employeeIds)
      ? normalizeUUIDArray(employeeIds).filter(Boolean)
      : [];
    const projectType = project_type === 'client' ? 'client' : 'inhouse';
    const dueDate = due_date && String(due_date).trim() !== '' ? String(due_date).trim() : null;

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows: projectRows } = await client.query(
        `INSERT INTO projects (name, description, project_type, due_date, created_by, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4::date, $5, 'active', NOW(), NOW())
         RETURNING id, name, description, project_type, due_date, status, created_at, created_by`,
        [name.trim(), description && String(description).trim() || null, projectType, dueDate, creatorProfileId]
      );
      const project = projectRows[0];
      if (!project) {
        await client.query('ROLLBACK');
        return res.status(500).json({ data: null, error: { message: 'Failed to create project' } });
      }
      const newProjectId = project.id;

      for (const profileId of assignedIds) {
        await client.query(
          `INSERT INTO project_members (project_id, employee_id, created_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (project_id, employee_id) DO NOTHING`,
          [newProjectId, profileId]
        );
        console.log('[CreateProject] inserting member:', profileId);
      }

      await client.query('COMMIT');
      res.status(201).json({ data: project, error: null });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /projects
 * Project list for current user: projects they created OR projects they are a member of.
 * Returns each project with member_count and members_preview (ALL members — no role filter).
 * Uses a CTE so we first get visible project IDs, then join ALL project_members for those projects.
 */
router.get('/', async (req, res, next) => {
  try {
    const myProfileId = normalizeUUID(req.profileId);
    if (!myProfileId) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    const { rows } = await query(
      `WITH my_projects AS (
         SELECT id FROM projects WHERE created_by = $1
         UNION
         SELECT project_id AS id FROM project_members WHERE employee_id = $1
       )
       SELECT
         p.id,
         p.name,
         p.description,
         p.project_type,
         p.due_date,
         p.status,
         p.created_at,
         p.created_by,
         COUNT(DISTINCT pm.employee_id)::int AS member_count,
         COALESCE(
           JSON_AGG(
             JSON_BUILD_OBJECT(
               'id', pr.id,
               'employee_id', pm.employee_id,
               'full_name', pr.full_name,
               'external_role', COALESCE(LOWER(TRIM(pr.external_role)), 'employee'),
               'avatar_url', pr.avatar_url
             )
             ORDER BY CASE WHEN LOWER(TRIM(COALESCE(pr.external_role, ''))) IN ('manager', 'subadmin') THEN 1 ELSE 2 END, pr.full_name ASC
           ) FILTER (WHERE pr.id IS NOT NULL),
           '[]'
         ) AS members_preview
       FROM projects p
       INNER JOIN my_projects mp ON mp.id = p.id
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN profiles pr ON pr.id = pm.employee_id
       GROUP BY p.id, p.name, p.description, p.project_type, p.due_date, p.status, p.created_at, p.created_by
       ORDER BY p.created_at DESC`,
      [myProfileId]
    );

    console.log('[Projects] list result:', rows.map((p) => ({ id: p.id, name: p.name, member_count: p.member_count, preview_len: (p.members_preview && Array.isArray(p.members_preview) ? p.members_preview.length : 0) })));

    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /projects/:projectId
 * Project details. Allowed if current user is project creator OR a project member.
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const projectId = normalizeUUID(req.params.projectId);
    const currentUserId = req.userId;
    const myProfileId = normalizeUUID(req.profileId);
    if (!projectId || !currentUserId) {
      return res.status(400).json({ data: null, error: { message: 'Project ID and authentication required' } });
    }
    const { rows: projectRows } = await query(
      'SELECT id, name, description, project_type, due_date, status, created_at, created_by FROM projects WHERE id = $1 LIMIT 1',
      [projectId]
    );
    if (!projectRows.length) {
      return res.status(404).json({ data: null, error: { message: 'Project not found' } });
    }
    const project = projectRows[0];
    const isCreator = project.created_by && myProfileId && normalizeUUID(project.created_by) === myProfileId;
    const { rows: memberRows } = await query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND employee_id = $2 LIMIT 1',
      [projectId, myProfileId]
    );
    if (!isCreator && !memberRows.length) {
      return res.status(403).json({ data: null, error: { message: 'Not a project member' } });
    }
    res.json({ data: project, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /projects/:projectId/members/details
 * Full member list for project details view (all members, including self). No exclude.
 * Allowed only if current user is a project member.
 * Returns: id, user_id, full_name, job_title, avatar_url, employee_code, external_role, external_sub_role, added_to_project_at.
 */
router.get('/:projectId/members/details', async (req, res, next) => {
  try {
    const projectId = normalizeUUID(req.params.projectId);
    const myProfileId = normalizeUUID(req.profileId);
    if (!projectId) {
      return res.status(400).json({ data: null, error: { message: 'Project ID required' } });
    }
    const { rows: projectRows } = await query('SELECT created_by FROM projects WHERE id = $1 LIMIT 1', [projectId]);
    if (!projectRows.length) {
      return res.status(404).json({ data: null, error: { message: 'Project not found' } });
    }
    const isCreator = projectRows[0].created_by && myProfileId && normalizeUUID(projectRows[0].created_by) === myProfileId;
    const { rows: memberCheck } = await query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND employee_id = $2 LIMIT 1',
      [projectId, myProfileId]
    );
    if (!isCreator && !memberCheck.length) {
      return res.status(403).json({ data: null, error: { message: 'Not a project member' } });
    }

    const { rows } = await query(
      `SELECT p.id, p.user_id, p.full_name, p.job_title, p.avatar_url, p.employee_code,
              COALESCE(LOWER(TRIM(p.external_role)), 'employee') AS external_role,
              p.external_sub_role,
              pm.created_at AS added_to_project_at
       FROM project_members pm
       JOIN profiles p ON p.id = pm.employee_id
       WHERE pm.project_id = $1
       ORDER BY
         CASE
           WHEN LOWER(TRIM(COALESCE(p.external_role, ''))) IN ('manager', 'subadmin') THEN 1
           ELSE 2
         END,
         p.full_name ASC`,
      [projectId]
    );

    console.log('[ProjectDetails] projectId:', projectId);
    console.log('[ProjectDetails] all members raw:', JSON.stringify(rows, null, 2));
    console.log('[ProjectDetails] managers:', rows.filter((m) => m.external_role === 'manager').length);
    console.log('[ProjectDetails] employees:', rows.filter((m) => m.external_role === 'employee').length);

    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /projects/:projectId/members
 * Assignee list for project task: only members of this project. Excludes self.
 * Returns: id (profile id), user_id, full_name, job_title, avatar_url, employee_code, external_role, joined_at.
 */
router.get('/:projectId/members', async (req, res, next) => {
  try {
    const projectId = normalizeUUID(req.params.projectId);
    const currentUserId = req.userId;
    if (!projectId || !currentUserId) {
      return res.status(400).json({ data: null, error: { message: 'Project ID and authentication required' } });
    }
    const { rows } = await query(
      `SELECT p.id, p.user_id, p.full_name, p.job_title, p.avatar_url, p.employee_code,
              COALESCE(LOWER(TRIM(p.external_role)), 'employee') AS external_role,
              pm.created_at AS joined_at
       FROM project_members pm
       JOIN profiles p ON p.id = pm.employee_id
       WHERE pm.project_id = $1 AND p.user_id != $2
       ORDER BY CASE WHEN LOWER(TRIM(COALESCE(p.external_role, ''))) = 'manager' THEN 1 ELSE 2 END,
                p.full_name ASC`,
      [projectId, currentUserId]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /projects/:projectId/members/:profileId
 * Remove a member from the project. Only project creator can remove. Cannot remove self.
 */
router.delete('/:projectId/members/:profileId', async (req, res, next) => {
  try {
    const projectId = normalizeUUID(req.params.projectId);
    const profileIdToRemove = normalizeUUID(req.params.profileId);
    const currentUserId = req.userId;
    if (!projectId || !profileIdToRemove || !currentUserId) {
      return res.status(400).json({ data: null, error: { message: 'Project ID, member ID and authentication required' } });
    }
    const { rows: projectRows } = await query(
      'SELECT created_by FROM projects WHERE id = $1 LIMIT 1',
      [projectId]
    );
    if (!projectRows.length) {
      return res.status(404).json({ data: null, error: { message: 'Project not found' } });
    }
    const createdByProfileId = projectRows[0].created_by;
    const { rows: myProfile } = await query('SELECT id FROM profiles WHERE user_id = $1 LIMIT 1', [currentUserId]);
    const myProfileId = myProfile[0]?.id;
    if (myProfileId !== createdByProfileId) {
      return res.status(403).json({ data: null, error: { message: 'Only the project creator can remove members' } });
    }
    if (profileIdToRemove === myProfileId) {
      return res.status(400).json({ data: null, error: { message: 'You cannot remove yourself from the project' } });
    }
    const { rowCount } = await query(
      'DELETE FROM project_members WHERE project_id = $1 AND employee_id = $2',
      [projectId, profileIdToRemove]
    );
    if (rowCount === 0) {
      return res.status(404).json({ data: null, error: { message: 'Member not found in this project' } });
    }
    res.json({ data: { removed: true }, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
