import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import * as storageService from '../services/storageService.js';
import * as faceVerificationService from '../services/faceVerificationService.js';
import { getPool } from '../config/database.js';
import { config } from '../config/index.js';

const router = Router();
router.use(authenticate);

const FACE_VERIFICATION_TOKEN_EXPIRY = '2m';
const FACE_VERIFICATION_TOKEN_PURPOSE = 'attendance_face';

function signAttendanceFaceToken(userId) {
  return jwt.sign(
    { userId, purpose: FACE_VERIFICATION_TOKEN_PURPOSE },
    config.jwt.secret,
    { expiresIn: FACE_VERIFICATION_TOKEN_EXPIRY }
  );
}

function verifyAttendanceFaceToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.purpose !== FACE_VERIFICATION_TOKEN_PURPOSE) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

const TIMESTAMP_TOLERANCE_MS = 30 * 1000; // ±30 seconds anti-replay per security requirements
const MAX_VERIFY_ATTEMPTS = parseInt(process.env.FACE_VERIFICATION_MAX_RETRIES || '3', 10);
const ATTEMPTS_WINDOW_MS = parseInt(process.env.FACE_VERIFICATION_WINDOW_MS || '900000', 10); // 15 min

const attemptCounts = new Map(); // userId -> { count, resetAt }

function getAttemptKey(userId) {
  return String(userId);
}

/** Check if user has exceeded the failed-attempt limit (only failed verifications count). */
function checkAttemptLimit(userId) {
  const key = getAttemptKey(userId);
  const now = Date.now();
  const rec = attemptCounts.get(key);
  if (!rec) return { allowed: true };
  if (now > rec.resetAt) return { allowed: true };
  if (rec.count >= MAX_VERIFY_ATTEMPTS) {
    return { allowed: false, message: 'Too many attempts. Please try again later.' };
  }
  return { allowed: true };
}

/** Record a failed verification attempt (called only when faceVerified is false). */
function recordFailedAttempt(userId) {
  const key = getAttemptKey(userId);
  const now = Date.now();
  let rec = attemptCounts.get(key);
  if (!rec) {
    rec = { count: 0, resetAt: now + ATTEMPTS_WINDOW_MS };
    attemptCounts.set(key, rec);
  }
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + ATTEMPTS_WINDOW_MS;
  }
  rec.count += 1;
}

/**
 * Parse avatar_url to get storage objectPath for avatars bucket.
 * Handles: full URL, relative /api/storage/avatars/..., or path-only "userId/file.jpg".
 */
function getAvatarObjectPath(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;
  try {
    const idx = trimmed.indexOf('/avatars/');
    if (idx !== -1) {
      const pathPart = trimmed.slice(idx + '/avatars/'.length);
      const decoded = decodeURIComponent(pathPart.replace(/\+/g, ' '));
      return decoded || null;
    }
    // Path-only (e.g. "userId/filename.jpg" or "userId%2Ffile.jpg") — no protocol, safe for storage lookup
    if (!trimmed.startsWith('http') && !trimmed.startsWith('/') && trimmed.indexOf('..') === -1) {
      return decodeURIComponent(trimmed.replace(/\+/g, ' '));
    }
    if (trimmed.startsWith('/api/storage/avatars/')) {
      const pathPart = trimmed.slice('/api/storage/avatars/'.length);
      return decodeURIComponent(pathPart.replace(/\+/g, ' '));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /attendance/verify-face
 * Body: { capturedImage: base64 string, timestamp: number }
 * - Validates timestamp (replay protection).
 * - Ensures user can only verify own face (profile avatar for req.userId).
 * - Fetches stored profile image from storage (no public exposure).
 * - Runs face comparison; returns faceVerified and message.
 * - Enforces retry limit and logs failures.
 */
router.post('/verify-face', async (req, res) => {
  try {
    const userId = req.userId;
    const { capturedImage, timestamp } = req.body || {};

    if (!capturedImage || typeof capturedImage !== 'string') {
      return res.status(400).json({
        faceVerified: false,
        message: 'Face Not Verified',
      });
    }

    const now = Date.now();
    const ts = timestamp != null ? Number(timestamp) : NaN;
    if (!Number.isFinite(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_MS) {
      return res.status(400).json({
        faceVerified: false,
        message: 'Invalid or expired request. Please try again.',
      });
    }

    const attempt = checkAttemptLimit(userId);
    if (!attempt.allowed) {
      return res.status(429).json({
        faceVerified: false,
        message: attempt.message,
      });
    }

    const profile = req.profile;
    if (!profile || !profile.avatar_url) {
      return res.status(403).json({
        faceVerified: false,
        message: 'Profile photo required. Please upload a profile photo first.',
      });
    }

    const objectPath = getAvatarObjectPath(profile.avatar_url);
    if (!objectPath) {
      return res.status(403).json({
        faceVerified: false,
        message: 'Profile photo not found.',
      });
    }

    const referenceFile = await storageService.getFile('avatars', objectPath);
    if (!referenceFile || !referenceFile.file_data) {
      return res.status(403).json({
        faceVerified: false,
        message: 'Profile photo not found.',
      });
    }

    // Frontend may send raw base64 or data URL (e.g. "data:image/jpeg;base64,...") — strip prefix so decode yields valid image
    let base64Data = capturedImage;
    if (typeof base64Data === 'string' && base64Data.includes(',')) {
      base64Data = base64Data.slice(base64Data.indexOf(',') + 1);
    }
    let capturedBuffer;
    try {
      capturedBuffer = Buffer.from(base64Data, 'base64');
    } catch {
      return res.status(400).json({
        faceVerified: false,
        message: 'Face Not Verified',
      });
    }

    if (capturedBuffer.length === 0) {
      return res.status(400).json({
        faceVerified: false,
        message: 'Face Not Verified',
      });
    }

    const result = await faceVerificationService.verify(
      capturedBuffer,
      referenceFile.file_data
    );

    if (!result.verified) {
      recordFailedAttempt(userId);
      console.warn(`[attendance] Face verification failed for user ${userId}: ${result.message}`);
      return res.status(403).json({
        faceVerified: false,
        message: result.message || 'Face Not Verified. Please Retry.',
        ...(result.confidence != null && { confidence: result.confidence }),
      });
    }

    const verificationToken = signAttendanceFaceToken(userId);
    return res.status(200).json({
      faceVerified: true,
      message: result.message,
      verificationToken,
      ...(result.confidence != null && { confidence: result.confidence }),
    });
  } catch (err) {
    const rawMsg = err?.message ? String(err.message) : '';
    const msg = rawMsg.length > 0 && rawMsg.length <= 280 ? rawMsg : 'Face verification failed. Please try again.';
    console.error('[attendance] verify-face error:', rawMsg || err);
    console.error('[attendance] verify-face 503 response message:', msg);
    return res.status(503).json({
      faceVerified: false,
      message: msg,
    });
  }
});

/**
 * POST /attendance/check-in
 * Body: { verificationToken: string, location_lat?: number, location_lng?: number }
 * - Backend enforces: face must have been verified (valid verificationToken only).
 * - Client-sent faceVerified is NEVER trusted; only server-issued token after verify-face.
 * - If already checked in for today → 409.
 * - Else INSERT one row (transaction).
 */
router.post('/check-in', async (req, res) => {
  const userId = req.userId;
  const { verificationToken, location_lat, location_lng } = req.body || {};
  // Never trust body.faceVerified or any client flag; enforce server-side token only
  const tokenUserId = verifyAttendanceFaceToken(verificationToken);
  if (!tokenUserId || tokenUserId !== userId) {
    return res.status(403).json({
      data: null,
      error: { message: 'Face Not Verified. Please Retry.' },
    });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      `SELECT id, check_in_time FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    if (existing.length > 0) {
      if (existing[0].check_in_time != null) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          data: null,
          error: { message: 'Already checked in for today.' },
        });
      }
    }

    const now = new Date();
    const status = now.getHours() >= 10 ? 'late' : 'present';
    let inserted;
    try {
      const resInsert = await client.query(
        `INSERT INTO attendance (user_id, date, check_in_time, status, location_lat, location_lng, face_verified)
         VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, true)
         RETURNING *`,
        [userId, now, status, location_lat ?? null, location_lng ?? null]
      );
      inserted = resInsert.rows;
    } catch (insertErr) {
      if (insertErr.code === '42703') {
        const resInsert = await client.query(
          `INSERT INTO attendance (user_id, date, check_in_time, status, location_lat, location_lng)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)
           RETURNING *`,
          [userId, now, status, location_lat ?? null, location_lng ?? null]
        );
        inserted = resInsert.rows;
      } else {
        throw insertErr;
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ data: inserted[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({
        data: null,
        error: { message: 'Already checked in for today.' },
      });
    }
    console.error('[attendance] check-in error:', err);
    return res.status(500).json({
      data: null,
      error: { message: 'Check-in failed. Please try again.' },
    });
  } finally {
    client.release();
  }
});

/**
 * POST /attendance/check-out
 * - Updates today's row: SET check_out_time = NOW() WHERE user_id AND date = CURRENT_DATE AND check_out_time IS NULL.
 * - If no row updated → 404 "Check-in not found".
 */
router.post('/check-out', async (req, res) => {
  const userId = req.userId;

  const pool = getPool();
  try {
    const result = await pool.query(
      `UPDATE attendance
       SET check_out_time = now(), updated_at = now()
       WHERE user_id = $1 AND date = CURRENT_DATE AND check_out_time IS NULL
       RETURNING *`,
      [userId]
    );

    if (result.rowCount === 0 || !result.rows || result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        error: { message: 'Check-in not found. You must check in before checking out.' },
      });
    }

    return res.status(200).json({ data: result.rows[0], error: null });
  } catch (err) {
    console.error('[attendance] check-out error:', err);
    return res.status(500).json({
      data: null,
      error: { message: 'Check-out failed. Please try again.' },
    });
  }
});

export default router;
