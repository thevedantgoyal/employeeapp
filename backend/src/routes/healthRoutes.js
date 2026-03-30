import { Router } from 'express';
import pool from '../config/database.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await Promise.race([
      pool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ]);
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

export default router;
