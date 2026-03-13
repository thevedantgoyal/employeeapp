import { Router } from 'express';
import * as leaveController from '../controllers/leaveController.js';
import { authenticate } from '../middleware/auth.js';
import { requireManagerOrAdmin } from '../middleware/rbac.js';

const router = Router();

router.post('/:leaveId/approve', authenticate, requireManagerOrAdmin, leaveController.approveLeave);
router.post('/:leaveId/reject', authenticate, requireManagerOrAdmin, leaveController.rejectLeave);

export default router;
