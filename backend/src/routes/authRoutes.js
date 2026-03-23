import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

/** Login, Microsoft SSO, password reset — stricter cap */
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Token refresh + session reads — higher cap */
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  authController.signIn
);

router.post(
  '/microsoft',
  authLimiter,
  [body('id_token').notEmpty().withMessage('id_token is required')],
  validate,
  authController.signInWithMicrosoft
);

router.post(
  '/refresh',
  refreshLimiter,
  [body('refresh_token').optional()],
  validate,
  authController.refresh
);

router.get('/session', refreshLimiter, authController.getSession);

router.post('/complete-onboarding', authenticate, authController.completeOnboarding);

router.post('/logout', authController.signOut);

router.post(
  '/reset-password',
  authLimiter,
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
