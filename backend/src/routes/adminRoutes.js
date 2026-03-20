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

router.get('/employees/:userId/projects', adminController.getEmployeeProjects);
router.get('/employees/:userId/stats', adminController.getEmployeeStats);

router.get('/task-templates', adminController.getTaskTemplates);
router.get('/task-templates/job-titles', adminController.getTaskTemplateJobTitles);
router.post('/task-templates', adminController.createTaskTemplate);
router.patch('/task-templates/:id', adminController.updateTaskTemplate);
router.delete('/task-templates/:id', adminController.deleteTaskTemplate);

export default router;
