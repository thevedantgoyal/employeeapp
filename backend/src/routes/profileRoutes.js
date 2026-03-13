import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin, requireHrOrAdmin } from '../middleware/rbac.js';

const router = Router();

router.get('/me', authenticate, profileController.getMyProfile);
router.patch('/me', authenticate, profileController.updateMyProfile);
router.get('/', authenticate, requireHrOrAdmin, profileController.getAllProfiles);
router.get('/team/:teamId', authenticate, profileController.getProfilesByTeam);

export default router;
