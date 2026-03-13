import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { query } from '../config/database.js';
import { normalizeUUID } from '../utils/uuid.js';

const router = Router();
router.use(authenticate);

/**
 * PATCH /room_bookings/:id/reschedule
 * Body: { room_id, booking_date, start_time, end_time }
 * Checks room availability (excludes current booking), then updates and writes audit log.
 */
router.patch(
  '/:id/reschedule',
  [
    body('room_id').isUUID(),
    body('booking_date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('booking_date must be YYYY-MM-DD'),
    body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be HH:MM or HH:MM:SS'),
    body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time must be HH:MM or HH:MM:SS'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const bookingId = normalizeUUID(req.params.id);
      const userId = normalizeUUID(req.userId);
      const { room_id: newRoomId, booking_date: newDate, start_time: newStartTime, end_time: newEndTime } = req.body;

      const { rows: existing } = await query(
        'SELECT id, booked_by, room_id, booking_date, start_time, end_time FROM room_bookings WHERE id = $1',
        [bookingId]
      );
      if (!existing.length) {
        return res.status(404).json({ data: null, error: { message: 'Booking not found.' } });
      }
      const row = existing[0];
      if (normalizeUUID(row.booked_by) !== userId) {
        return res.status(403).json({ data: null, error: { message: 'Only the person who made the booking can reschedule it.' } });
      }

      const conflictResult = await query(
        `SELECT id FROM room_bookings
         WHERE room_id = $1 AND booking_date = $2 AND status != 'cancelled' AND id != $3
         AND start_time < $4::time AND end_time > $5::time`,
        [normalizeUUID(newRoomId), newDate, bookingId, newEndTime, newStartTime]
      );
      if (conflictResult.rows.length > 0) {
        return res.status(409).json({
          data: null,
          error: { message: 'Room not available at selected time. Please choose another room or time.' },
        });
      }

      await query(
        `UPDATE room_bookings SET room_id = $1, booking_date = $2, start_time = $3::time, end_time = $4::time, updated_at = now() WHERE id = $5`,
        [normalizeUUID(newRoomId), newDate, newStartTime, newEndTime, bookingId]
      );

      await query(
        `INSERT INTO booking_audit_log (booking_id, action, performed_by, details)
         VALUES ($1, 'rescheduled', $2, $3::jsonb)`,
        [
          bookingId,
          userId,
          JSON.stringify({
            from: {
              room_id: row.room_id,
              booking_date: row.booking_date,
              start_time: row.start_time,
              end_time: row.end_time,
            },
            to: {
              room_id: newRoomId,
              booking_date: newDate,
              start_time: newStartTime,
              end_time: newEndTime,
            },
          }),
        ]
      );

      return res.status(200).json({ data: { id: bookingId }, error: null });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /room_bookings/audit-unseen-count
 * Returns { data: number } — count of bookings where user is participant and has not viewed.
 */
router.get('/audit-unseen-count', async (req, res, next) => {
  try {
    const userId = normalizeUUID(req.userId);
    const { rows } = await query(
      `SELECT COUNT(*)::int AS c FROM room_bookings rb
       WHERE $1::text = ANY(rb.participants)
       AND rb.status != 'cancelled'
       AND rb.id NOT IN (SELECT booking_id FROM audit_views WHERE user_id = $2)`,
      [userId, userId]
    );
    const count = rows[0]?.c ?? 0;
    res.json({ data: count, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /room_bookings/audit-mark-seen
 * Marks all unseen participant bookings as viewed for the current user.
 */
router.post('/audit-mark-seen', async (req, res, next) => {
  try {
    const userId = normalizeUUID(req.userId);
    const { rows: unseen } = await query(
      `SELECT rb.id AS booking_id FROM room_bookings rb
       WHERE $1::text = ANY(rb.participants)
       AND rb.status != 'cancelled'
       AND rb.id NOT IN (SELECT booking_id FROM audit_views WHERE user_id = $2)`,
      [userId, userId]
    );
    for (const row of unseen) {
      await query(
        'INSERT INTO audit_views (user_id, booking_id) VALUES ($1, $2) ON CONFLICT (user_id, booking_id) DO NOTHING',
        [userId, row.booking_id]
      );
    }
    res.json({ data: { marked: unseen.length }, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
