import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { calculatePerformance } from '../services/performanceService.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const mode = req.query.mode === 'team' ? 'team' : 'me';
    if (mode === 'me') {
      const data = await calculatePerformance(req.userId, req.profileId);
      return res.json({ data, error: null });
    }
    const { rows: reports } = await query(
      'SELECT user_id FROM profiles WHERE manager_id = $1',
      [req.profileId]
    );
    const results = [];
    for (const r of reports) {
      const { rows: prof } = await query('SELECT id FROM profiles WHERE user_id = $1', [r.user_id]);
      const data = await calculatePerformance(r.user_id, prof[0]?.id);
      results.push(data);
    }
    res.json({ data: results, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
