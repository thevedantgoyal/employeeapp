/**
 * Require admin role. Use after authenticate.
 */
export function requireAdmin(req, res, next) {
  if (!req.roles?.includes('admin')) {
    return res.status(403).json({ data: null, error: { message: 'Admin access required' } });
  }
  next();
}
