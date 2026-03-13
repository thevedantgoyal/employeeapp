import { query } from '../config/database.js';
import { normalizeUUID } from '../utils/uuid.js';

/**
 * Get manager's user_id for a given user_id (from their profile.manager_id).
 * Returns null if no manager (top-level).
 */
export async function getManagerUserId(userId) {
  const uid = normalizeUUID(userId);
  const { rows: profileRows } = await query(
    'SELECT manager_id FROM profiles WHERE user_id = $1',
    [uid]
  );
  const managerProfileId = profileRows[0]?.manager_id;
  if (!managerProfileId) return null;
  const { rows: managerRows } = await query(
    'SELECT user_id FROM profiles WHERE id = $1',
    [normalizeUUID(managerProfileId)]
  );
  return managerRows[0]?.user_id ?? null;
}

/**
 * Get full name for a user_id.
 */
export async function getUserName(userId) {
  const { rows } = await query(
    'SELECT full_name FROM profiles WHERE user_id = $1 LIMIT 1',
    [normalizeUUID(userId)]
  );
  return rows[0]?.full_name ?? 'Unknown';
}

function insertNotification(userId, title, message, metadata = {}) {
  return query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, 'general', $2, $3, $4)`,
    [normalizeUUID(userId), title, message, JSON.stringify(metadata)]
  );
}

export async function createRequest(userId, body) {
  const managerUserId = await getManagerUserId(userId);
  if (!managerUserId) {
    return { data: null, error: { message: 'You have no manager to submit requests to.' } };
  }
  const { title, description, request_type, priority } = body;
  const type = ['resource', 'task_deadline', 'task_reassignment', 'general'].includes(request_type) ? request_type : 'general';
  const prio = ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal';

  const { rows: insertRows } = await query(
    `INSERT INTO requests (title, description, request_type, priority, status, submitted_by, submitted_to, current_handler)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $6)
     RETURNING *`,
    [title || '', description || null, type, prio, normalizeUUID(userId), managerUserId]
  );
  const request = insertRows[0];
  const submitterName = await getUserName(userId);

  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note)
     VALUES ($1, 'submitted', $2, $3, null)`,
    [request.id, normalizeUUID(userId), submitterName]
  );

  await insertNotification(
    managerUserId,
    'New Request',
    `${submitterName} submitted a request: "${request.title}"`,
    { request_id: request.id, url: `/requests/${request.id}` }
  );

  return { data: request, error: null };
}

export async function getMyRequests(userId) {
  const { rows } = await query(
    `SELECT r.*,
      (SELECT json_agg(json_build_object('id', t.id, 'action', t.action, 'action_by', t.action_by, 'action_by_name', t.action_by_name, 'note', t.note, 'created_at', t.created_at) ORDER BY t.created_at ASC)
       FROM request_trail t WHERE t.request_id = r.id) AS trail
     FROM requests r
     WHERE r.submitted_by = $1
     ORDER BY r.created_at DESC`,
    [normalizeUUID(userId)]
  );
  return { data: rows, error: null };
}

export async function getTeamRequests(userId, statusFilter) {
  const uid = normalizeUUID(userId);
  let sql = `
    SELECT r.*,
      sub.full_name AS submitted_by_name,
      (SELECT json_agg(json_build_object('id', t.id, 'action', t.action, 'action_by', t.action_by, 'action_by_name', t.action_by_name, 'note', t.note, 'created_at', t.created_at) ORDER BY t.created_at ASC)
       FROM request_trail t WHERE t.request_id = r.id) AS trail
    FROM requests r
    JOIN profiles sub ON sub.user_id = r.submitted_by
    WHERE (r.submitted_to = $1 OR r.current_handler = $1)
  `;
  const params = [uid];
  if (statusFilter && ['pending', 'forwarded', 'approved', 'rejected'].includes(statusFilter)) {
    params.push(statusFilter);
    sql += ` AND r.status = $2`;
  }
  sql += ` ORDER BY r.created_at DESC`;
  const { rows } = await query(sql, params);
  return { data: rows, error: null };
}

export async function getRequestById(requestId, userId) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const { rows } = await query(
    `SELECT r.*,
      sub.full_name AS submitted_by_name,
      (SELECT json_agg(json_build_object('id', t.id, 'action', t.action, 'action_by', t.action_by, 'action_by_name', t.action_by_name, 'note', t.note, 'created_at', t.created_at) ORDER BY t.created_at ASC)
       FROM request_trail t WHERE t.request_id = r.id) AS trail
    FROM requests r
    LEFT JOIN profiles sub ON sub.user_id = r.submitted_by
    WHERE r.id = $1`,
    [rid]
  );
  const request = rows[0];
  if (!request) return { data: null, error: { message: 'Request not found' } };
  const isSubmitter = request.submitted_by === uid;
  const isHandler = request.current_handler === uid;
  const canView = isSubmitter || request.submitted_to === uid || isHandler || request.forwarded_to === uid;
  if (!canView) return { data: null, error: { message: 'Not allowed to view this request' } };
  return { data: request, error: null };
}

export async function approveRequest(requestId, userId) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const { rows: existing } = await query(
    'SELECT * FROM requests WHERE id = $1',
    [rid]
  );
  if (!existing.length) return { data: null, error: { message: 'Request not found' } };
  const req = existing[0];
  if (req.current_handler !== uid) return { data: null, error: { message: 'You are not the current handler' } };
  if (req.status !== 'pending' && req.status !== 'forwarded') {
    return { data: null, error: { message: 'Request is no longer actionable' } };
  }

  const now = new Date();
  await query(
    `UPDATE requests SET status = 'approved', actioned_at = $1, updated_at = $1 WHERE id = $2`,
    [now, rid]
  );
  const actorName = await getUserName(userId);
  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note) VALUES ($1, 'approved', $2, $3, null)`,
    [rid, uid, actorName]
  );

  await insertNotification(
    req.submitted_by,
    'Request Approved',
    `Your request "${req.title}" has been approved.`,
    { request_id: rid, url: `/requests/${rid}` }
  );
  if (req.forwarded_by && req.forwarded_by !== uid && req.forwarded_by !== req.submitted_by) {
    await insertNotification(
      req.forwarded_by,
      'Request Approved',
      `A request you forwarded "${req.title}" has been approved.`,
      { request_id: rid, url: `/requests/${rid}` }
    );
  }

  const { rows: updated } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  return { data: updated[0], error: null };
}

export async function rejectRequest(requestId, userId, reason) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const { rows: existing } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  if (!existing.length) return { data: null, error: { message: 'Request not found' } };
  const req = existing[0];
  if (req.current_handler !== uid) return { data: null, error: { message: 'You are not the current handler' } };
  if (req.status !== 'pending' && req.status !== 'forwarded') {
    return { data: null, error: { message: 'Request is no longer actionable' } };
  }

  const now = new Date();
  await query(
    `UPDATE requests SET status = 'rejected', rejection_reason = $1, actioned_at = $2, updated_at = $2 WHERE id = $3`,
    [reason || 'No reason provided', now, rid]
  );
  const actorName = await getUserName(userId);
  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note) VALUES ($1, 'rejected', $2, $3, $4)`,
    [rid, uid, actorName, reason || null]
  );

  await insertNotification(
    req.submitted_by,
    'Request Rejected',
    `Your request "${req.title}" has been rejected.`,
    { request_id: rid, url: `/requests/${rid}` }
  );
  if (req.forwarded_by && req.forwarded_by !== uid && req.forwarded_by !== req.submitted_by) {
    await insertNotification(
      req.forwarded_by,
      'Request Rejected',
      `A request you forwarded "${req.title}" has been rejected.`,
      { request_id: rid, url: `/requests/${rid}` }
    );
  }

  const { rows: updated } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  return { data: updated[0], error: null };
}

export async function forwardRequest(requestId, userId, note) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const managerUserId = await getManagerUserId(userId);
  if (!managerUserId) return { data: null, error: { message: 'You have no manager to forward to.' } };

  const { rows: existing } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  if (!existing.length) return { data: null, error: { message: 'Request not found' } };
  const req = existing[0];
  if (req.current_handler !== uid) return { data: null, error: { message: 'You are not the current handler' } };
  if (req.status !== 'pending' && req.status !== 'forwarded') {
    return { data: null, error: { message: 'Request is no longer actionable' } };
  }

  const now = new Date();
  await query(
    `UPDATE requests SET status = 'forwarded', forwarded_to = $1, forwarded_by = $2, current_handler = $1, forward_note = $3, updated_at = $4 WHERE id = $5`,
    [managerUserId, uid, note || null, now, rid]
  );
  const actorName = await getUserName(userId);
  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note) VALUES ($1, 'forwarded', $2, $3, $4)`,
    [rid, uid, actorName, note || null]
  );

  await insertNotification(
    managerUserId,
    'Request Forwarded to You',
    `${actorName} forwarded a request to you: "${req.title}"`,
    { request_id: rid, url: `/requests/${rid}` }
  );
  await insertNotification(
    req.submitted_by,
    'Request Forwarded',
    `Your request "${req.title}" has been forwarded to a higher-level manager.`,
    { request_id: rid, url: `/requests/${rid}` }
  );

  const { rows: updated } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  return { data: updated[0], error: null };
}

export async function cancelRequest(requestId, userId) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const { rows: existing } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  if (!existing.length) return { data: null, error: { message: 'Request not found' } };
  const req = existing[0];
  if (req.submitted_by !== uid) return { data: null, error: { message: 'Only the submitter can cancel' } };
  if (req.status !== 'pending') return { data: null, error: { message: 'Only pending requests can be cancelled' } };

  const now = new Date();
  await query(`UPDATE requests SET status = 'cancelled', updated_at = $1 WHERE id = $2`, [now, rid]);
  const actorName = await getUserName(userId);
  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note) VALUES ($1, 'cancelled', $2, $3, null)`,
    [rid, uid, actorName]
  );

  await insertNotification(
    req.current_handler,
    'Request Cancelled',
    `Request "${req.title}" was cancelled by the submitter.`,
    { request_id: rid, url: `/requests/${rid}` }
  );

  const { rows: updated } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  return { data: updated[0], error: null };
}

export async function editRequest(requestId, userId, body) {
  const rid = normalizeUUID(requestId);
  const uid = normalizeUUID(userId);
  const { rows: existing } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  if (!existing.length) return { data: null, error: { message: 'Request not found' } };
  const req = existing[0];
  if (req.submitted_by !== uid) return { data: null, error: { message: 'Only the submitter can edit' } };
  if (req.status !== 'pending') return { data: null, error: { message: 'Only pending requests can be edited' } };

  const { title, description, request_type, priority } = body;
  const updates = [];
  const params = [];
  let pi = 1;
  if (title !== undefined) { updates.push(`title = $${pi}`); params.push(title); pi++; }
  if (description !== undefined) { updates.push(`description = $${pi}`); params.push(description); pi++; }
  if (request_type !== undefined && ['resource', 'task_deadline', 'task_reassignment', 'general'].includes(request_type)) {
    updates.push(`request_type = $${pi}`); params.push(request_type); pi++;
  }
  if (priority !== undefined && ['low', 'normal', 'high', 'urgent'].includes(priority)) {
    updates.push(`priority = $${pi}`); params.push(priority); pi++;
  }
  if (updates.length === 0) return { data: req, error: null };

  updates.push(`updated_at = $${pi}`);
  params.push(new Date(), rid);
  await query(
    `UPDATE requests SET ${updates.join(', ')} WHERE id = $${pi + 1}`,
    params
  );
  const actorName = await getUserName(userId);
  await query(
    `INSERT INTO request_trail (request_id, action, action_by, action_by_name, note) VALUES ($1, 'edited', $2, $3, null)`,
    [rid, uid, actorName]
  );

  const { rows: updated } = await query('SELECT * FROM requests WHERE id = $1', [rid]);
  return { data: updated[0], error: null };
}

export async function getPendingCount(userId) {
  const uid = normalizeUUID(userId);
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM requests
     WHERE current_handler = $1 AND status IN ('pending', 'forwarded')`,
    [uid]
  );
  return { data: rows[0]?.count ?? 0, error: null };
}
