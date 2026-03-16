import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Strict rate limit for auth: 10 requests per 15 minutes per IP (login, reset-password, microsoft, refresh)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(authLimiter);

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
  [body('refresh_token').optional()],
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
