import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = Router();
router.use(authenticate);

/**
 * GET /users/me/details
 * Returns current user's employee details for onboarding (read-only).
 * reporting_manager_name from profiles.manager_id → profiles.full_name.
 */
router.get('/me/details', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { rows } = await query(
      `SELECT p.full_name AS name, p.job_title, p.department, p.id AS profile_id, p.manager_id,
       p.employee_code,
       m.full_name AS reporting_manager_name
       FROM profiles p
       LEFT JOIN profiles m ON m.id = p.manager_id
       WHERE p.user_id = $1`,
      [userId]
    );
    if (!rows.length) {
      return res.status(404).json({ data: null, error: { message: 'Profile not found' } });
    }
    const row = rows[0];
    const data = {
      name: row.name || '',
      job_title: row.job_title || null,
      employee_code: row.employee_code != null && String(row.employee_code).trim() !== '' ? String(row.employee_code).trim() : null,
      department: row.department || null,
      reporting_manager_name: row.reporting_manager_name || null,
    };
    res.json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/assignable
 * Manager standalone task: assignee list for "Separate Task". Returns managers and employees only.
 * Excludes self, subadmins, and anyone with external_sub_role set. Uses users + profiles; role from profile or user_roles.
 * Returns: id (profile id for assignment), user_id, full_name, job_title, avatar_url, employee_code, external_role.
 */
router.get('/assignable', async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    const { rows } = await query(
      `SELECT
         p.id,
         u.id AS user_id,
         COALESCE(
           NULLIF(LOWER(TRIM(p.external_role)), ''),
           (SELECT LOWER(ur.role::text) FROM user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('manager', 'employee') LIMIT 1),
           'employee'
         ) AS external_role,
         p.full_name,
         p.job_title,
         p.avatar_url,
         p.employee_code,
         p.department
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id != $1
         AND (
           LOWER(TRIM(COALESCE(p.external_role, ''))) IN ('manager', 'employee')
           OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('manager', 'employee'))
         )
         AND LOWER(TRIM(COALESCE(p.external_role, ''))) != 'subadmin'
         AND (p.external_sub_role IS NULL OR TRIM(COALESCE(p.external_sub_role, '')) = '')
       ORDER BY
         CASE WHEN COALESCE(NULLIF(LOWER(TRIM(p.external_role)), ''), (SELECT LOWER(ur.role::text) FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'manager' LIMIT 1)) = 'manager' THEN 1 ELSE 2 END,
         p.full_name ASC`,
      [currentUserId]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/assignable/project
 * Subadmin project creation: employees + managers (with manager_id). Excludes self, subadmins.
 */
router.get('/assignable/project', async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    const { rows } = await query(
      `SELECT p.id, p.user_id, p.full_name, p.job_title, p.avatar_url, p.employee_code, p.department,
              COALESCE(LOWER(TRIM(p.external_role)), 'employee') AS external_role
       FROM profiles p
       WHERE p.user_id != $1
         AND (
           LOWER(TRIM(COALESCE(p.external_role, ''))) = 'employee'
           OR (
             LOWER(TRIM(COALESCE(p.external_role, ''))) = 'manager'
             AND (p.external_sub_role IS NULL OR TRIM(COALESCE(p.external_sub_role, '')) = '')
             AND p.manager_id IS NOT NULL
           )
         )
         AND LOWER(TRIM(COALESCE(p.external_role, ''))) != 'subadmin'
       ORDER BY CASE WHEN LOWER(TRIM(COALESCE(p.external_role, ''))) = 'manager' THEN 0 ELSE 1 END ASC,
                p.full_name ASC`,
      [currentUserId]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/assignable/all
 * Subadmin standalone task: employees + managers + other subadmins. Excludes self, admin role.
 */
router.get('/assignable/all', async (req, res, next) => {
  try {
    const currentUserId = req.userId;
    if (!currentUserId) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    const { rows } = await query(
      `SELECT p.id, p.user_id, p.full_name, p.job_title, p.avatar_url, p.employee_code, p.department,
              COALESCE(LOWER(TRIM(p.external_role)), 'employee') AS external_role,
              p.external_sub_role
       FROM profiles p
       WHERE p.user_id != $1
         AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'admin')
       ORDER BY
         CASE
           WHEN LOWER(TRIM(COALESCE(p.external_role, ''))) = 'subadmin' OR (p.external_sub_role IS NOT NULL AND TRIM(COALESCE(p.external_sub_role, '')) != '') THEN 1
           WHEN LOWER(TRIM(COALESCE(p.external_role, ''))) = 'manager' THEN 2
           ELSE 3
         END,
         p.full_name ASC`,
      [currentUserId]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users?search=keyword
 * Returns users (id, email, full_name) for autocomplete. Search matches full_name and email.
 * Limit 20. Parameterized query. No IDOR (returns only non-sensitive fields).
 */
router.get('/', async (req, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    if (!search || search.length < 2) {
      return res.json({ data: [], error: null });
    }
    const pattern = `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name
       FROM users u
       WHERE u.full_name ILIKE $1 OR u.email ILIKE $1
       ORDER BY u.full_name
       LIMIT $2`,
      [pattern, limit]
    );
    res.json({ data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
