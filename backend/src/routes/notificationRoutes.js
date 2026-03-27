import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = Router();
router.use(authenticate);

let cachedColumns = null;

async function getNotificationColumns() {
  if (cachedColumns) return cachedColumns;
  const { rows } = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'notifications'`
  );
  const columns = new Set(rows.map((r) => r.column_name));
  cachedColumns = {
    hasIsRead: columns.has('is_read'),
    hasRead: columns.has('read'),
    hasLink: columns.has('link'),
    hasUpdatedAt: columns.has('updated_at'),
  };
  return cachedColumns;
}

router.get('/', async (req, res) => {
  try {
    const userId = req.userId;
    const cols = await getNotificationColumns();
    const readExpr = cols.hasIsRead ? 'n.is_read' : cols.hasRead ? 'n.read' : 'false';
    const linkExpr = cols.hasLink ? 'n.link' : "NULL::text";
    const { rows } = await query(
      `SELECT
         n.id,
         n.type,
         n.title,
         n.message,
         ${readExpr} AS is_read,
         ${linkExpr} AS link,
         n.created_at
       FROM notifications n
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );
    return res.json({ data: rows, error: null });
  } catch (err) {
    return res.status(500).json({ data: null, error: { message: 'Failed to fetch notifications' } });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.userId;
    const cols = await getNotificationColumns();
    const readCol = cols.hasIsRead ? 'is_read' : cols.hasRead ? 'read' : null;
    if (!readCol) return res.json({ data: { count: 0 }, error: null });
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND ${readCol} = false`,
      [userId]
    );
    return res.json({ data: { count: rows[0]?.count ?? 0 }, error: null });
  } catch {
    return res.status(500).json({ data: null, error: { message: 'Failed to fetch unread count' } });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.userId;
    const cols = await getNotificationColumns();
    const readCol = cols.hasIsRead ? 'is_read' : cols.hasRead ? 'read' : null;
    if (!readCol) return res.json({ data: { success: true }, error: null });
    const setClause = cols.hasUpdatedAt ? `${readCol} = true, updated_at = NOW()` : `${readCol} = true`;
    await query(
      `UPDATE notifications
       SET ${setClause}
       WHERE user_id = $1 AND ${readCol} = false`,
      [userId]
    );
    return res.json({ data: { success: true }, error: null });
  } catch {
    return res.status(500).json({ data: null, error: { message: 'Failed to mark notifications as read' } });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const cols = await getNotificationColumns();
    const readCol = cols.hasIsRead ? 'is_read' : cols.hasRead ? 'read' : null;
    if (!readCol) return res.json({ data: { success: true }, error: null });
    const setClause = cols.hasUpdatedAt ? `${readCol} = true, updated_at = NOW()` : `${readCol} = true`;
    await query(
      `UPDATE notifications
       SET ${setClause}
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return res.json({ data: { success: true }, error: null });
  } catch {
    return res.status(500).json({ data: null, error: { message: 'Failed to mark notification as read' } });
  }
});

export default router;
