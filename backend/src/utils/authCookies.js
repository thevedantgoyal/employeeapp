/**
 * HttpOnly auth cookies to avoid XSS token theft.
 * Access token: 7 days. Refresh token: 30 days.
 */

const ACCESS_COOKIE = 'connectplus_access_token';
const REFRESH_COOKIE = 'connectplus_refresh_token';
const ACCESS_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', path: '/api' };

function secure() {
  return (process.env.NODE_ENV || '').toLowerCase() === 'production';
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const base = { ...COOKIE_OPTS, secure: secure() };
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_MAX_AGE * 1000 });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_MAX_AGE * 1000 });
}

export function clearAuthCookies(res) {
  const base = { ...COOKIE_OPTS, maxAge: 0 };
  res.cookie(ACCESS_COOKIE, '', base);
  res.cookie(REFRESH_COOKIE, '', base);
}

export function getAccessTokenFromRequest(req) {
  return req.cookies?.[ACCESS_COOKIE] || null;
}

export function getRefreshTokenFromRequest(req) {
  return req.cookies?.[REFRESH_COOKIE] || null;
}
