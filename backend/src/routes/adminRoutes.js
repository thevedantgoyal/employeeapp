import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import * as adminController from '../controllers/adminController.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.post('/action', adminController.action);
router.post('/bulk-onboard', adminController.bulkOnboard);
router.post('/api-fetch', adminController.apiFetch);
router.post('/import-employees-from-api', adminController.importEmployeesFromApi);
router.post('/reset-database', adminController.resetDatabase);

export default router;
