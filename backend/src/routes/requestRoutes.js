import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as requestService from '../services/requestService.js';

const router = Router();
router.use(authenticate);

/** POST /api/requests - Create request (submitted_to = current user's manager) */
router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('request_type').optional().trim(),
    body('priority').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await requestService.createRequest(req.userId, req.body);
      if (result.error) return res.status(400).json(result);
      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** GET /api/requests/my - My submitted requests with trail */
router.get('/my', async (req, res, next) => {
  try {
    const result = await requestService.getMyRequests(req.userId);
    if (result.error) return res.status(400).json(result);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/requests/team - Team requests (submitted_to or current_handler = me), optional ?status= */
router.get('/team', async (req, res, next) => {
  try {
    const status = req.query.status;
    const result = await requestService.getTeamRequests(req.userId, status);
    if (result.error) return res.status(400).json(result);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/requests/pending-count - Count pending/forwarded for current handler */
router.get('/pending-count', async (req, res, next) => {
  try {
    const result = await requestService.getPendingCount(req.userId);
    if (result.error) return res.status(400).json(result);
    return res.json({ data: result.data, error: null });
  } catch (err) {
    next(err);
  }
});

/** GET /api/requests/:id - Single request (with trail) */
router.get('/:id', async (req, res, next) => {
  try {
    const result = await requestService.getRequestById(req.params.id, req.userId);
    if (result.error) {
      if (result.error.message === 'Request not found') return res.status(404).json(result);
      if (result.error.message === 'Not allowed to view this request') return res.status(403).json(result);
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/requests/:id/approve */
router.patch('/:id/approve', async (req, res, next) => {
  try {
    const result = await requestService.approveRequest(req.params.id, req.userId);
    if (result.error) {
      if (result.error.message === 'Request not found') return res.status(404).json(result);
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/requests/:id/reject - Body: { reason } */
router.patch(
  '/:id/reject',
  [body('reason').trim().notEmpty().withMessage('Reason is required')],
  validate,
  async (req, res, next) => {
    try {
      const result = await requestService.rejectRequest(req.params.id, req.userId, req.body.reason);
      if (result.error) {
        if (result.error.message === 'Request not found') return res.status(404).json(result);
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** PATCH /api/requests/:id/forward - Body: { note } */
router.patch(
  '/:id/forward',
  [body('note').trim().notEmpty().withMessage('Note is required')],
  validate,
  async (req, res, next) => {
    try {
      const result = await requestService.forwardRequest(req.params.id, req.userId, req.body.note);
      if (result.error) {
        if (result.error.message === 'Request not found') return res.status(404).json(result);
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** PATCH /api/requests/:id/cancel */
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const result = await requestService.cancelRequest(req.params.id, req.userId);
    if (result.error) {
      if (result.error.message === 'Request not found') return res.status(404).json(result);
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/requests/:id/edit - Body: { title?, description?, request_type?, priority? } */
router.patch(
  '/:id/edit',
  [
    body('title').optional().trim(),
    body('description').optional().trim(),
    body('request_type').optional().trim(),
    body('priority').optional().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await requestService.editRequest(req.params.id, req.userId, req.body);
      if (result.error) {
        if (result.error.message === 'Request not found') return res.status(404).json(result);
        return res.status(400).json(result);
      }
      return res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
