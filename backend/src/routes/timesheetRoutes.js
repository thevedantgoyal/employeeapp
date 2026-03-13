/**
 * Timesheet API: POST /timesheets, PUT /timesheets/:id, GET /timesheets, GET /timesheets/:id
 * Validation and business logic in service layer; controller is thin.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as timesheetController from '../controllers/timesheetController.js';

const router = Router();
router.use(authenticate);

router.post('/', timesheetController.create);
router.put('/:id', timesheetController.update);
router.get('/weekly', timesheetController.weekly);
router.get('/monthly', timesheetController.monthly);
router.get('/', timesheetController.list);
router.get('/:id', timesheetController.getById);

export default router;
