import webpush from 'web-push';
import { query } from '../config/database.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('[pushService] VAPID env vars are missing; push notifications are disabled.');
}

/**
 * Send a push notification to all subscriptions of a user.
 * @param {string} userId
 * @param {{title:string, body:string, link?:string, icon?:string}} payload
 */
export async function sendPushToUser(userId, payload) {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return;
  try {
    const result = await query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    const subscriptions = result.rows;
    if (!subscriptions.length) return;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link || '/',
      icon: payload.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      timestamp: Date.now(),
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(subscription, pushPayload);
      } catch (err) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
        } else {
          console.error('Push send error for', sub.id, err?.message || err);
        }
      }
    });

    await Promise.allSettled(sendPromises);
  } catch (err) {
    console.error('sendPushToUser error:', err?.message || err);
  }
}
