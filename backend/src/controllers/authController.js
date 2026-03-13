import * as authService from '../services/authService.js';

/**
 * POST /auth/signup
 * Body: { email, password, fullName }
 * Response: { data: { user, session }, error: null } (Supabase-like)
 */
export async function signUp(req, res, next) {
  try {
    const { email, password, fullName } = req.body;
    const { user, session } = await authService.signUp(email, password, fullName);
    res.status(201).json({ data: { user, session }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Body: { email, password }
 * Response: { data: { user, session }, error: null }
 */
export async function signIn(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, session } = await authService.signIn(email, password);
    res.json({ data: { user, session }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/microsoft
 * Body: { id_token } — Microsoft Azure AD id_token from MSAL
 * Matches email to existing user, returns app JWT. No new user creation.
 */
export async function signInWithMicrosoft(req, res, next) {
  try {
    const { id_token } = req.body || {};
    const { user, session } = await authService.signInWithMicrosoft(id_token);
    res.json({ data: { user, session }, error: null });
  } catch (err) {
    const status = err.statusCode || 401;
    res.status(status).json({ data: null, error: { message: err.message || 'Microsoft sign-in failed' } });
  }
}

/**
 * POST /auth/refresh
 * Body: { refresh_token }
 * Response: { data: { session }, error: null }
 */
export async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    const session = await authService.refreshSession(refresh_token);
    res.json({ data: { session }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/session
 * Header: Authorization: Bearer <access_token>
 * Response: { data: { user, profile }, error: null } or 401
 */
export async function getSession(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ data: null, error: { message: 'Not authenticated' } });
    }
    const session = await authService.getSession(token);
    if (!session) {
      return res.status(401).json({ data: null, error: { message: 'Invalid or expired session' } });
    }
    res.json({ data: session, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/complete-onboarding
 * Requires Bearer token. Sets first_login = false for current user.
 */
export async function completeOnboarding(req, res, next) {
  try {
    await authService.setFirstLoginComplete(req.userId);
    res.json({ data: { message: 'Onboarding complete' }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 * No body. Client should discard tokens.
 */
export async function signOut(req, res, next) {
  try {
    res.json({ data: { message: 'Signed out' }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/reset-password
 * Body: { email }
 * In production: send email with reset link. Here we just return success for same UX.
 */
export async function resetPasswordRequest(req, res, next) {
  try {
    const { email } = req.body;
    // In production: validate email exists, create reset token, send email.
    // For parity we return success without leaking existence.
    res.json({ data: { message: 'If an account exists, you will receive a reset link.' }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /auth/password
 * Body: { password } — requires Bearer token (user updating own password after reset flow).
 */
export async function updatePassword(req, res, next) {
  try {
    const { password } = req.body;
    await authService.updatePassword(req.userId, password);
    res.json({ data: { message: 'Password updated' }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/setup-first-admin
 * Body: { setupCode } — requires Bearer token. Promotes current user to admin if no admins exist.
 */
export async function setupFirstAdmin(req, res, next) {
  try {
    const { setupCode } = req.body;
    const { config } = await import('../config/index.js');
    if (setupCode !== config.firstAdminSetupCode) {
      return res.status(400).json({ data: null, error: { message: 'Invalid setup code' } });
    }
    await authService.setupFirstAdmin(req.userId, setupCode);
    res.json({ data: { message: 'Admin setup complete' }, error: null });
  } catch (err) {
    next(err);
  }
}
