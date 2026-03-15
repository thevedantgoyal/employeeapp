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
 * Returns profiles that can be assigned tasks: employees + regular managers (no subadmin, no external_sub_role).
 * Excludes current user. Used for standalone task assignee list.
 * Parameter: current user id from auth. Returns: id (profile id), user_id, full_name, job_title, avatar_url, employee_code, department, external_role.
 */
router.get('/assignable', async (req, res, next) => {
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
