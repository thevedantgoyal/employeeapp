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
