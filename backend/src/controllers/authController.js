import * as authService from '../services/authService.js';
import { setAuthCookies, clearAuthCookies, getAccessTokenFromRequest, getRefreshTokenFromRequest } from '../utils/authCookies.js';

/**
 * POST /auth/login
 * Body: { email, password }
 * Response: { data: { user, session }, error: null }
 * Sets httpOnly cookies for access_token and refresh_token.
 */
export async function signIn(req, res, next) {
  try {
    const { email, password } = req.body;
    const { user, session } = await authService.signIn(email, password);
    setAuthCookies(res, session.access_token, session.refresh_token);
    res.json({ data: { user, session }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/microsoft
 * Body: { id_token } — Microsoft Azure AD id_token from MSAL
 * Matches email to existing user, returns app JWT. No new user creation.
 * Sets httpOnly cookies for access_token and refresh_token.
 */
export async function signInWithMicrosoft(req, res, next) {
  try {
    const { id_token } = req.body || {};
    const { user, session } = await authService.signInWithMicrosoft(id_token);
    setAuthCookies(res, session.access_token, session.refresh_token);
    res.json({ data: { user, session }, error: null });
  } catch (err) {
    const status = err.statusCode || 401;
    res.status(status).json({ data: null, error: { message: err.message || 'Microsoft sign-in failed' } });
  }
}

/**
 * POST /auth/refresh
 * Body: { refresh_token } (optional when refresh_token is in httpOnly cookie)
 * Response: { data: { session }, error: null }
 * Sets new httpOnly cookies.
 */
export async function refresh(req, res, next) {
  try {
    const refresh_token = getRefreshTokenFromRequest(req) || req.body?.refresh_token;
    if (!refresh_token) {
      return res.status(400).json({ data: null, error: { message: 'Refresh token required (cookie or body)' } });
    }
    const session = await authService.refreshSession(refresh_token);
    setAuthCookies(res, session.access_token, session.refresh_token);
    res.json({ data: { session }, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/session
 * Token from httpOnly cookie or Authorization: Bearer <access_token>
 * Response: { data: { user, profile }, error: null } on success.
 * No access token: 200 + { data: null, error } so browsers/clients do not treat it as 401
 * (avoids noisy refresh attempts when no refresh cookie exists).
 * Invalid/expired token: 401 so the client can refresh and retry.
 */
export async function getSession(req, res, next) {
  try {
    const token = getAccessTokenFromRequest(req) || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) {
      return res.status(200).json({ data: null, error: { message: 'Not authenticated' } });
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
 * No body. Clears httpOnly auth cookies; client should clear local state.
 */
export async function signOut(req, res, next) {
  try {
    clearAuthCookies(res);
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
