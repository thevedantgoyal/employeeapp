import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query } from '../config/database.js';

const router = Router();

/**
 * POST /rpc/check_booking_conflict
 * Body: { _room_id, _booking_date, _start_time, _end_time, _exclude_id? }
 * Returns { data: rows, error: null }
 */
router.post(
  '/check_booking_conflict',
  authenticate,
  [
    body('_room_id').isUUID(),
    body('_booking_date').isISO8601().withMessage('_booking_date must be ISO date (YYYY-MM-DD)'),
    body('_start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('_start_time must be HH:MM or HH:MM:SS'),
    body('_end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('_end_time must be HH:MM or HH:MM:SS'),
    body('_exclude_id').optional({ nullable: true }).isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { _room_id, _booking_date, _start_time, _end_time, _exclude_id } = req.body;
      const { rows } = await query(
        'SELECT * FROM check_booking_conflict($1, $2, $3::time, $4::time, $5)',
        [_room_id, _booking_date, _start_time, _end_time, _exclude_id || null]
      );
      res.json({ data: rows, error: null });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /rpc/check_leave_overlap
 * Body: { _user_id, _from_date, _to_date, _exclude_id? }
 * Returns { data: { overlap: boolean }, error: null }
 */
router.post(
  '/check_leave_overlap',
  authenticate,
  [
    body('_user_id').isUUID(),
    body('_from_date').isDate(),
    body('_to_date').isDate(),
    body('_exclude_id').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { _user_id, _from_date, _to_date, _exclude_id } = req.body;
      if (_user_id !== req.userId && !req.roles?.includes('admin') && !req.roles?.includes('hr')) {
        return res.status(403).json({ data: null, error: { message: 'Can only check own overlap' } });
      }
      const { rows } = await query(
        'SELECT check_leave_overlap($1, $2, $3, $4) AS overlap',
        [_user_id, _from_date, _to_date, _exclude_id || null]
      );
      res.json({ data: { overlap: rows[0]?.overlap ?? false }, error: null });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /rpc/create_notification
 * Body: { _user_id, _type, _title, _message, _metadata? }
 * Returns { data: { id }, error: null }
 */
router.post(
  '/create_notification',
  authenticate,
  [
    body('_user_id').isUUID(),
    body('_type').isString(),
    body('_title').isString(),
    body('_message').isString(),
    body('_metadata').optional().isObject(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { _user_id, _type, _title, _message, _metadata } = req.body;
      const allowed = req.userId === _user_id || req.roles?.includes('admin') || req.roles?.includes('manager') || req.roles?.includes('team_lead') || req.roles?.includes('hr');
      if (!allowed) {
        return res.status(403).json({ data: null, error: { message: 'Cannot create notification for this user' } });
      }
      const { rows } = await query(
        `INSERT INTO notifications (user_id, type, title, message, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [_user_id, _type, _title, _message, JSON.stringify(_metadata || {})]
      );
      res.status(201).json({ data: { id: rows[0].id }, error: null });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
