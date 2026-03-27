import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/vapid-public-key', authenticate, (req, res) => {
  res.json({ data: { publicKey: process.env.VAPID_PUBLIC_KEY || '' }, error: null });
});

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    const { p256dh, auth } = keys || {};
    const userId = req.userId || req.user?.id;
    const userAgent = req.headers['user-agent'] || null;

    if (!endpoint || !p256dh || !auth || !userId) {
      return res.status(400).json({ data: null, error: { message: 'Invalid subscription object' } });
    }

    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint)
       DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         updated_at = NOW()`,
      [userId, endpoint, p256dh, auth, userAgent]
    );

    return res.status(201).json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('Subscribe error:', err.message);
    return res.status(500).json({ data: null, error: { message: 'Failed to save subscription' } });
  }
});

router.delete('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ data: null, error: { message: 'Endpoint is required' } });
    }
    await query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, req.userId]
    );
    return res.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('Unsubscribe error:', err.message);
    return res.status(500).json({ data: null, error: { message: 'Failed to remove subscription' } });
  }
});

export default router;
