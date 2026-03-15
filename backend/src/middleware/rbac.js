import { query } from '../config/database.js';
import { normalizeUUID } from '../utils/uuid.js';

const ROLE_HIERARCHY = ['employee', 'team_lead', 'hr', 'manager', 'admin', 'organization'];

function hasRole(roles, requiredRole) {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.includes(requiredRole);
}

function hasAnyRole(roles, allowedRoles) {
  if (!roles || !Array.isArray(roles)) return false;
  const normalized = roles.map((r) => String(r || '').trim().toLowerCase()).filter(Boolean);
  return allowedRoles.some((r) => normalized.includes(String(r || '').trim().toLowerCase()));
}

/**
 * Require at least one of the given roles.
 * Use after authenticate middleware.
 */
export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.roles) {
      return res.status(401).json({ data: null, error: { message: 'Authentication required' } });
    }
    if (!hasAnyRole(req.roles, allowedRoles)) {
      return res.status(403).json({ data: null, error: { message: 'Insufficient permissions' } });
    }
    next();
  };
}

/**
 * Require admin only.
 */
export const requireAdmin = requireRoles('admin');

/**
 * Require admin or manager or team_lead or subadmin (for leave approve/reject, team/task/project management).
 */
export const requireManagerOrAdmin = requireRoles('admin', 'manager', 'team_lead', 'subadmin');

/**
 * Require admin or HR (for leave balances, reports).
 */
export const requireHrOrAdmin = requireRoles('admin', 'hr');

/**
 * Check if the current user is the manager of the given employee (by user_id).
 */
export async function isManagerOf(managerUserId, employeeUserId) {
  const cleanManagerId = normalizeUUID(managerUserId);
  const cleanEmployeeId = normalizeUUID(employeeUserId);
  if (cleanManagerId === cleanEmployeeId) return false;
  const { rows } = await query(
    `SELECT 1 FROM profiles p
     WHERE p.user_id = $2 AND p.manager_id = (SELECT id FROM profiles WHERE user_id = $1 LIMIT 1)
     LIMIT 1`,
    [cleanManagerId, cleanEmployeeId]
  );
  return rows.length > 0;
}

/**
 * Middleware: ensure current user is the manager of the user identified by req.params.userId
 * or has admin/hr role.
 */
export function requireManagerOfOrAdmin(paramName = 'userId') {
  return async (req, res, next) => {
    if (hasAnyRole(req.roles, ['admin', 'hr'])) return next();
    const targetUserId = req.params[paramName];
    if (!targetUserId) return next();
    const allowed = await isManagerOf(req.userId, targetUserId);
    if (!allowed) {
      return res.status(403).json({ data: null, error: { message: 'Not the manager of this employee' } });
    }
    next();
  };
}

/**
 * Ensure the resource belongs to the current user (userId match) or user has higher role.
 */
export function requireOwnResourceOrRole(userIdField = 'user_id', allowedRoles = ['admin', 'hr', 'manager']) {
  return (req, res, next) => {
    if (hasAnyRole(req.roles, allowedRoles)) return next();
    const resourceUserId = req.body?.[userIdField] ?? req.params?.userId ?? req.query?.userId;
    if (resourceUserId && resourceUserId !== req.userId) {
      return res.status(403).json({ data: null, error: { message: 'Access denied to this resource' } });
    }
    next();
  };
}
