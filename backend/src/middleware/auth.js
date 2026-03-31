import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { query } from '../config/database.js';
import { normalizeUUID } from '../utils/uuid.js';

function getUserTypeFromProfile(profile) {
  const externalRole = (profile?.external_role || '').toString().trim().toLowerCase();
  const hasSubRole = profile?.external_sub_role != null && String(profile.external_sub_role).trim() !== '';
  if (externalRole === 'subadmin' || hasSubRole) return 'SENIOR_MANAGER';
  if (externalRole === 'manager' && !hasSubRole) return 'MANAGER';
  return 'EMPLOYEE';
}

import { getAccessTokenFromRequest } from '../utils/authCookies.js';

/**
 * Verify JWT and attach user + profile to req.
 * Token from httpOnly cookie (connectplus_access_token) or Authorization: Bearer <access_token>
 */
export async function authenticate(req, res, next) {
  const fromCookie = getAccessTokenFromRequest(req);
  const authHeader = req.headers.authorization;
  const fromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = fromCookie || fromHeader;
  if (!token) {
    return res.status(401).json({ data: null, error: { message: 'Missing or invalid authorization' } });
  }
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return res.status(401).json({ data: null, error: { message: 'Invalid or expired token' } });
  }
  const cleanUserId = normalizeUUID(decoded.userId);
  const { rows: userRows } = await query(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [cleanUserId]
  );
  if (!userRows.length) {
    return res.status(401).json({ data: null, error: { message: 'Invalid or expired token' } });
  }
  const user = userRows[0];
  const userIdForQueries = normalizeUUID(user.id);
  const { rows: profileRows } = await query(
    'SELECT id AS profile_id, user_id, full_name, email, job_title, department, manager_id, team_id, avatar_url, resume_url, status, working_status, profile_completed, external_role, external_sub_role FROM profiles WHERE user_id = $1',
    [userIdForQueries]
  );
  const profile = profileRows[0] || null;
  const { rows: roleRows } = await query(
    'SELECT role FROM user_roles WHERE user_id = $1',
    [userIdForQueries]
  );
  const fromUserRoles = (roleRows || []).map((r) => String(r.role || '').trim().toLowerCase()).filter(Boolean);
  const fromProfile = profile?.external_role ? [String(profile.external_role).trim().toLowerCase()] : [];
  const roles = [...new Set([...fromUserRoles, ...fromProfile])];
  req.user = user;
  req.profile = profile;
  req.roles = roles;
  req.userId = userIdForQueries;
  req.profileId = profile?.profile_id ?? null;
  req.userType = getUserTypeFromProfile(profile);

  next();
}

/**
 * Optional auth: if token present and valid, set req.user/profile/roles; otherwise continue without.
 */
export async function optionalAuth(req, res, next) {
  const fromCookie = getAccessTokenFromRequest(req);
  const authHeader = req.headers.authorization;
  const fromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = fromCookie || fromHeader;
  if (!token) {
    return next();
  }
  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch {
    return next();
  }
  const cleanUserId = normalizeUUID(decoded.userId);
  const { rows: userRows } = await query(
    'SELECT id, email, full_name FROM users WHERE id = $1',
    [cleanUserId]
  );
  if (!userRows.length) return next();
  const user = userRows[0];
  const userIdForQueries = normalizeUUID(user.id);
  const { rows: profileRows } = await query(
    'SELECT id AS profile_id, user_id, full_name, email, job_title, department, manager_id, team_id, avatar_url, resume_url, status, working_status, profile_completed, external_role, external_sub_role FROM profiles WHERE user_id = $1',
    [userIdForQueries]
  );
  const profile = profileRows[0] || null;
  const { rows: roleRows } = await query('SELECT role FROM user_roles WHERE user_id = $1', [userIdForQueries]);
  const fromUserRoles = (roleRows || []).map((r) => String(r.role || '').trim().toLowerCase()).filter(Boolean);
  const fromProfile = profile?.external_role ? [String(profile.external_role).trim().toLowerCase()] : [];
  req.user = user;
  req.profile = profile;
  req.roles = [...new Set([...fromUserRoles, ...fromProfile])];
  req.userId = userIdForQueries;
  req.profileId = profile?.profile_id ?? null;
  req.userType = getUserTypeFromProfile(profile);
  next();
}
