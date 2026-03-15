import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.signIn
);

router.post(
  '/microsoft',
  [body('id_token').notEmpty().withMessage('id_token is required')],
  validate,
  authController.signInWithMicrosoft
);

router.post(
  '/refresh',
  [body('refresh_token').notEmpty()],
  validate,
  authController.refresh
);

router.get('/session', authController.getSession);

router.post('/complete-onboarding', authenticate, authController.completeOnboarding);

router.post('/logout', authController.signOut);

router.post(
  '/reset-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  authController.resetPasswordRequest
);

router.put(
  '/password',
  authenticate,
  [body('password').isLength({ min: 6 })],
  validate,
  authController.updatePassword
);

router.post(
  '/setup-first-admin',
  authenticate,
  [body('setupCode').notEmpty()],
  validate,
  authController.setupFirstAdmin
);

export default router;
