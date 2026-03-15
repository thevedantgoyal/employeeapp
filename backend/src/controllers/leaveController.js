import * as leaveService from '../services/leaveService.js';

export async function getDashboard(req, res, next) {
  try {
    const data = await leaveService.getDashboard(req.userId);
    res.json({ data, error: null });
  } catch (err) {
    next(err);
  }
}

export async function approveLeave(req, res, next) {
  try {
    console.log('[Approve] userId:', req.userId, 'roles:', req.roles, 'profileId:', req.profileId);
    const { leaveId } = req.params;
    const { comment } = req.body || {};
    if (!req.profileId) {
      return res.status(400).json({ data: null, error: { message: 'Profile not found' } });
    }
    await leaveService.approveLeave(leaveId, req.userId, req.profileId, comment || null);
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
}

export async function rejectLeave(req, res, next) {
  try {
    console.log('[Reject] userId:', req.userId, 'roles:', req.roles, 'profileId:', req.profileId);
    const { leaveId } = req.params;
    const { comment } = req.body || {};
    if (!req.profileId) {
      return res.status(400).json({ data: null, error: { message: 'Profile not found' } });
    }
    await leaveService.rejectLeave(leaveId, req.userId, req.profileId, comment || null);
    res.json({ data: true, error: null });
  } catch (err) {
    next(err);
  }
}
