import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

async function resolveDobColumn() {
  const { rows } = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profiles'
       AND column_name IN ('date_of_birth', 'dob', 'birth_date')
     ORDER BY CASE column_name
       WHEN 'date_of_birth' THEN 1
       WHEN 'dob' THEN 2
       WHEN 'birth_date' THEN 3
       ELSE 4
     END
     LIMIT 1`
  );
  return rows[0]?.column_name || null;
}

router.get('/today', async (req, res) => {
  try {
    const requestingUserId = req.userId;
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const todayYear = today.getFullYear();
    const dobColumn = await resolveDobColumn();

    const dobSelect = dobColumn
      ? `p.${dobColumn} AS dob_date, EXTRACT(MONTH FROM p.${dobColumn}) AS dob_month, EXTRACT(DAY FROM p.${dobColumn}) AS dob_day`
      : 'NULL::date AS dob_date, NULL::numeric AS dob_month, NULL::numeric AS dob_day';
    const dobCondition = dobColumn
      ? `(EXTRACT(MONTH FROM p.${dobColumn}) = $2 AND EXTRACT(DAY FROM p.${dobColumn}) = $3)`
      : 'false';

    const profilesResult = await query(
      `SELECT
         p.user_id,
         p.full_name,
         p.job_title,
         p.department,
         p.avatar_url,
         ${dobSelect},
         p.joining_date,
         EXTRACT(MONTH FROM p.joining_date) AS doj_month,
         EXTRACT(DAY   FROM p.joining_date) AS doj_day,
         EXTRACT(YEAR  FROM p.joining_date) AS doj_year
       FROM profiles p
       WHERE p.user_id != $1
         AND p.user_id IS NOT NULL
         AND (
           ${dobCondition}
           OR (
             EXTRACT(MONTH FROM p.joining_date) = $2
             AND EXTRACT(DAY FROM p.joining_date) = $3
             AND EXTRACT(YEAR FROM p.joining_date) != $4
           )
         )`,
      [requestingUserId, todayMonth, todayDay, todayYear]
    );

    const celebrations = await Promise.all(
      profilesResult.rows.map(async (profile) => {
        const types = [];
        const isBirthday =
          Number(profile.dob_month) === todayMonth && Number(profile.dob_day) === todayDay;
        const isAnniversary =
          Number(profile.doj_month) === todayMonth
          && Number(profile.doj_day) === todayDay
          && Number(profile.doj_year) !== todayYear;

        if (isBirthday) {
          types.push({ type: 'birthday', label: 'Birthday', emoji: '🎂' });
        }
        if (isAnniversary) {
          const years = todayYear - Number(profile.doj_year);
          types.push({ type: 'anniversary', label: `${years} Year Work Anniversary`, emoji: '🎉' });
        }
        if (!types.length) return null;

        const birthdayWished = await query(
          `SELECT id FROM notifications
           WHERE user_id = $1
             AND type = 'wish'
             AND title LIKE $2
             AND link = $3
             AND created_at >= CURRENT_DATE
             AND created_at < CURRENT_DATE + INTERVAL '1 day'
           LIMIT 1`,
          [profile.user_id, `%[from:${requestingUserId}]%Birthday%`, `/profile/${profile.user_id}`]
        );

        const anniversaryWished = await query(
          `SELECT id FROM notifications
           WHERE user_id = $1
             AND type = 'wish'
             AND title LIKE $2
             AND link = $3
             AND created_at >= CURRENT_DATE
             AND created_at < CURRENT_DATE + INTERVAL '1 day'
           LIMIT 1`,
          [profile.user_id, `%[from:${requestingUserId}]%Anniversary%`, `/profile/${profile.user_id}`]
        );

        return {
          userId: profile.user_id,
          fullName: profile.full_name,
          jobTitle: profile.job_title || '',
          department: profile.department || '',
          avatarUrl: profile.avatar_url || null,
          types,
          alreadyWished: {
            birthday: birthdayWished.rows.length > 0,
            anniversary: anniversaryWished.rows.length > 0,
          },
        };
      })
    );

    return res.json({ data: { celebrations: celebrations.filter(Boolean) }, error: null });
  } catch (err) {
    console.error('Celebrations today error:', err.message);
    return res.status(500).json({ data: null, error: { message: 'Failed to fetch celebrations' } });
  }
});

router.post('/wish', async (req, res) => {
  try {
    const senderId = req.userId;
    const { targetUserId, message, celebrationType } = req.body || {};
    if (!targetUserId || !message?.trim() || !celebrationType) {
      return res.status(400).json({ data: null, error: { message: 'Missing required fields' } });
    }

    const senderResult = await query('SELECT full_name FROM profiles WHERE user_id = $1', [senderId]);
    const senderName = senderResult.rows[0]?.full_name || 'A colleague';
    const title = celebrationType === 'birthday'
      ? `[from:${senderId}] 🎂 Birthday Wish from ${senderName}`
      : `[from:${senderId}] 🎉 Anniversary Wish from ${senderName}`;

    await query(
      `INSERT INTO notifications
       (id, user_id, type, title, message, is_read, link, created_at)
       VALUES (gen_random_uuid(), $1, 'wish', $2, $3, false, $4, NOW())`,
      [targetUserId, title, message.trim(), `/profile/${targetUserId}`]
    );

    return res.json({ data: { success: true }, error: null });
  } catch (err) {
    console.error('Send wish error:', err.message);
    return res.status(500).json({ data: null, error: { message: 'Failed to send wish' } });
  }
});

export default router;
