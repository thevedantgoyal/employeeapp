import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query, getPool } from '../config/database.js';
import { selectTable, buildAccessFilter } from '../services/dataService.js';
import { isManagerOf } from '../middleware/rbac.js';
import { normalizeUUID, normalizeUUIDArray } from '../utils/uuid.js';

const router = Router();
router.use(authenticate);

const WORK_TYPES = ['Project Work', 'Internal Meeting', 'Learning / Training', 'Support', 'Leave', 'Other'];

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Format date for API response: YYYY-MM-DD only (no ISO timestamp). */
function toDateOnlyString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

/**
 * Timesheet date must be calendar date only (YYYY-MM-DD). No time, no timezone, no toISOString().
 * Returns { ok: true, value: string } or { ok: false, message: string }.
 */
function normalizeTimesheetDate(value) {
  if (value == null || value === '') return { ok: true, value: undefined };
  if (typeof value !== 'string') return { ok: false, message: 'date must be a string in YYYY-MM-DD format.' };
  const s = value.trim();
  if (s.includes('T') || s.includes('Z')) return { ok: false, message: 'date must be YYYY-MM-DD only (no time or timezone).' };
  if (!DATE_ONLY_REGEX.test(s)) return { ok: false, message: 'date must be YYYY-MM-DD.' };
  return { ok: true, value: s };
}

/**
 * Validate timesheet row for Work Type rules. Returns { valid: true } or { valid: false, message }.
 * If work_type is Project Work: project_id and task_id required, activity_title must be null.
 * Otherwise: project_id and task_id must be null, activity_title required (non-empty).
 */
function validateTimesheetRow(row) {
  const workType = row.work_type != null ? String(row.work_type).trim() : null;
  if (!workType || !WORK_TYPES.includes(workType)) {
    return { valid: false, message: 'work_type must be one of: ' + WORK_TYPES.join(', ') };
  }
  const projectId = row.project_id ?? null;
  const taskId = row.task_id ?? null;
  const activityTitle = row.activity_title != null ? String(row.activity_title).trim() : null;

  if (workType === 'Project Work') {
    if (!projectId || !taskId) {
      return { valid: false, message: 'For Project Work, project_id and task_id are required.' };
    }
    if (activityTitle !== null && activityTitle !== '') {
      return { valid: false, message: 'For Project Work, activity_title must be empty or null.' };
    }
    return { valid: true };
  }

  if (projectId != null || taskId != null) {
    return { valid: false, message: 'For non-project work types, project_id and task_id must be null.' };
  }
  if (!activityTitle || activityTitle.length === 0) {
    return { valid: false, message: 'For this work type, activity_title is required.' };
  }
  return { valid: true };
}

/**
 * Ensure task belongs to the given project (for Project Work). Returns true if valid.
 */
async function taskBelongsToProject(taskId, projectId) {
  if (!taskId || !projectId) return true;
  const { rows } = await query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!rows.length) return false;
  return rows[0].project_id === projectId;
}

const ALLOWED_TABLES = [
  'profiles', 'user_roles', 'teams', 'projects', 'tasks', 'contributions', 'skills',
  'performance_metrics', 'metric_categories', 'notifications', 'push_subscriptions',
  'scheduled_notifications', 'meeting_rooms', 'room_bookings', 'booking_audit_log',
  'attendance', 'leave_types', 'leave_balances', 'leaves', 'timesheets',
  'task_activity_logs', 'task_comments', 'task_evidence', 'task_dependencies',
  'task_tags', 'task_tag_assignments', 'project_members',
];

/** Tables that have an updated_at column (PATCH adds updated_at = now() only for these). skills uses last_updated. */
const TABLES_WITH_UPDATED_AT = new Set([
  'profiles', 'user_roles', 'teams', 'projects', 'tasks', 'contributions',
  'performance_metrics', 'metric_categories', 'push_subscriptions',
  'meeting_rooms', 'room_bookings', 'attendance', 'leave_balances', 'leaves', 'timesheets',
  'task_activity_logs', 'task_comments', 'task_evidence', 'task_dependencies',
  'task_tags', 'task_tag_assignments', 'project_members',
]);

/**
 * GET /data/:table
 * Query params become filters (e.g. user_id, team_id, assigned_to).
 * Returns { data: rows, error: null } to match Supabase shape.
 */
router.get('/:table', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ data: null, error: { message: 'Table not allowed' } });
    }
    const filters = { ...req.query };
    if (filters.user_id !== undefined) {
      const raw = Array.isArray(filters.user_id) ? filters.user_id : (typeof filters.user_id === 'string' && filters.user_id.includes(',') ? filters.user_id.split(',') : [filters.user_id]);
      filters.user_id = normalizeUUIDArray(raw);
    }
    if (filters.id !== undefined) {
      const raw = Array.isArray(filters.id) ? filters.id : (typeof filters.id === 'string' && filters.id.includes(',') ? filters.id.split(',') : [filters.id]);
      filters.id = normalizeUUIDArray(raw);
    }
    if (filters.task_id !== undefined) {
      const raw = Array.isArray(filters.task_id) ? filters.task_id : (typeof filters.task_id === 'string' && filters.task_id.includes(',') ? filters.task_id.split(',') : [filters.task_id]);
      filters.task_id = normalizeUUIDArray(raw);
    }
    const order = filters.order || 'created_at';
    const ascending = filters.ascending !== 'false' && filters.ascending !== '0';
    const limit = Math.min(parseInt(filters.limit, 10) || 1000, 5000);
    delete filters.order;
    delete filters.ascending;
    delete filters.limit;

    if (table === 'tasks') {
      console.log('[AdminTasks] Current user id:', req.userId);
      console.log('[AdminTasks] Current user role:', req.roles);
      console.log('[GET /data/tasks] Request context:', {
        table,
        reqUserId: req.userId,
        reqProfileId: req.profileId,
        normalizedUserId: normalizeUUID(req.userId),
        normalizedProfileId: normalizeUUID(req.profileId),
        roles: req.roles,
        filters,
        order: `${order} ${ascending ? 'ASC' : 'DESC'}`,
        limit,
      });
    }

    const result = await selectTable(
      table,
      normalizeUUID(req.userId),
      normalizeUUID(req.profileId),
      req.roles,
      filters,
      `${order} ${ascending ? 'ASC' : 'DESC'}`,
      limit
    );

    if (table === 'tasks') {
      const { rows: recentRows } = await query(
        'SELECT id, title, status, assigned_by, assigned_to, project_id, created_at FROM tasks ORDER BY created_at DESC LIMIT 10'
      );
      console.log('[Tasks] all recent tasks (DB):', recentRows);
      console.log('[Tasks] currentManagerProfileId:', normalizeUUID(req.profileId));
      console.log('[Tasks] query result count:', result.data ? result.data.length : 0);
      if (result.data && result.data.length > 0) {
        console.log('[Tasks] first returned task:', { id: result.data[0].id, title: result.data[0].title, assigned_by: result.data[0].assigned_by, assigned_to: result.data[0].assigned_to });
      }
    }
    if (table === 'profiles' && result.data) {
      console.log('[DirectReports] query result count:', result.data.length);
    }

    if (result.error) return res.status(400).json(result);
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /data/:table/single
 * Same as GET but returns single row (first). Query param eq=column:value for .eq(column, value).
 */
router.get('/:table/single', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ data: null, error: { message: 'Table not allowed' } });
    }
    const filters = { ...req.query };
    const eq = filters.eq;
    delete filters.eq;
    if (eq && typeof eq === 'string') {
      const [col, val] = eq.split(':');
      if (col && val !== undefined) filters[col] = val;
    }
    const result = await selectTable(
      table,
      normalizeUUID(req.userId),
      normalizeUUID(req.profileId),
      req.roles,
      filters,
      'created_at DESC',
      1
    );
    if (result.error) return res.status(400).json(result);
    const single = result.data && result.data[0] ? result.data[0] : null;
    res.setHeader('Cache-Control', 'no-store');
    res.json({ data: single, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /data/:table — INSERT
 * Body = row object. Access checked via buildAccessFilter for insert (e.g. user_id must be self for leaves).
 */
router.post('/:table', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ data: null, error: { message: 'Table not allowed' } });
    }
    if (table === 'attendance') {
      return res.status(400).json({
        data: null,
        error: { message: 'Use POST /api/attendance/check-in with face verification. Do not use this endpoint for attendance.' },
      });
    }
    const row = req.body || {};
    const cleanReqUserId = normalizeUUID(req.userId);
    if (['leaves', 'attendance', 'timesheets', 'contributions', 'notifications', 'push_subscriptions', 'skills'].includes(table) && normalizeUUID(row.user_id) !== cleanReqUserId) {
      row.user_id = cleanReqUserId;
    }
    if (['room_bookings'].includes(table) && normalizeUUID(row.booked_by) !== cleanReqUserId) {
      row.booked_by = cleanReqUserId;
    }
    // Store booking_date as date-only (YYYY-MM-DD). No UTC conversion so query by date matches.
    if (table === 'room_bookings' && row.booking_date != null) {
      const v = row.booking_date;
      if (typeof v === 'string' && v.length >= 10) {
        row.booking_date = v.slice(0, 10);
      } else {
        row.booking_date = toDateOnlyString(v);
      }
    }

    if (table === 'timesheets') {
      if (row.date != null && row.date !== '') {
        const norm = normalizeTimesheetDate(row.date);
        if (!norm.ok) {
          return res.status(400).json({ data: null, error: { message: norm.message } });
        }
        row.date = norm.value;
      }
      const workType = row.work_type != null ? String(row.work_type).trim() : 'Project Work';
      row.work_type = workType;
      if (workType === 'Project Work') {
        row.activity_title = null;
        if (!row.project_id || !row.task_id) {
          return res.status(400).json({
            data: null,
            error: { message: 'For Project Work, project and task are required.' },
          });
        }
        const ok = await taskBelongsToProject(row.task_id, row.project_id);
        if (!ok) {
          return res.status(400).json({
            data: null,
            error: { message: 'Selected task does not belong to the selected project.' },
          });
        }
      } else {
        row.project_id = null;
        row.task_id = null;
        const title = row.activity_title != null ? String(row.activity_title).trim() : '';
        if (!title) {
          return res.status(400).json({
            data: null,
            error: { message: 'For this work type, activity title is required.' },
          });
        }
        row.activity_title = title;
      }
      const validation = validateTimesheetRow(row);
      if (!validation.valid) {
        return res.status(400).json({ data: null, error: { message: validation.message } });
      }
    }

    if (table === 'tasks') {
      const canCreateTask = (req.roles && (req.roles.includes('manager') || req.roles.includes('team_lead') || req.roles.includes('admin'))) || req.userType === 'SENIOR_MANAGER';
      if (!canCreateTask) {
        return res.status(403).json({ data: null, error: { message: 'Only managers can create tasks.' } });
      }
      const taskType = row.task_type === 'separate_task' ? 'separate_task' : 'project_task';
      row.task_type = taskType;
      if (taskType === 'separate_task') row.project_id = null;
      if (!row.assigned_by) {
        let creatorProfileId = normalizeUUID(req.profileId);
        if (!creatorProfileId && req.userId) {
          const { rows: pr } = await query('SELECT id FROM profiles WHERE user_id = $1 LIMIT 1', [req.userId]);
          creatorProfileId = pr[0]?.id ? normalizeUUID(pr[0].id) : null;
        }
        if (creatorProfileId) row.assigned_by = creatorProfileId;
        console.log('[CreateTask] assigned_by (creator profile id):', row.assigned_by, 'assigned_to:', row.assigned_to);
      }

      const assigneeIds = Array.isArray(row.assigned_to)
        ? normalizeUUIDArray(row.assigned_to).filter(Boolean)
        : row.assigned_to != null && row.assigned_to !== ''
          ? [normalizeUUID(row.assigned_to)]
          : [];

      const isStandalone = row.task_type === 'separate_task' || row.project_id == null;
      if (assigneeIds.length > 0 && !isStandalone) {
        if (req.userType !== 'SENIOR_MANAGER') {
          for (const assigneeProfileId of assigneeIds) {
            const { rows: assigneeRows } = await query('SELECT user_id FROM profiles WHERE id = $1', [assigneeProfileId]);
            const employeeUserId = assigneeRows[0]?.user_id;
            if (!employeeUserId || !(await isManagerOf(cleanReqUserId, employeeUserId))) {
              return res.status(403).json({ data: null, error: { message: 'You can only assign tasks to your direct reports.' } });
            }
          }
        }
      }

      const assignMode = row.assignMode === 'shared' ? 'shared' : 'individual';
      delete row.assignMode;
      const isSharedMulti = assigneeIds.length > 1 && assignMode === 'shared';

      if (assigneeIds.length > 1 && !isSharedMulti) {
        const now = new Date().toISOString();
        const baseRow = { ...row, assigned_at: now };
        delete baseRow.assigned_to;
        const client = await getPool().connect();
        const createdRows = [];
        try {
          await client.query('BEGIN');
          for (const assigneeId of assigneeIds) {
            const taskRow = { ...baseRow, assigned_to: assigneeId };
            const cols = Object.keys(taskRow).filter((k) => taskRow[k] !== undefined);
            const values = cols.map((c) => taskRow[c]);
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const columns = cols.join(', ');
            const sql = `INSERT INTO tasks (${columns}) VALUES (${placeholders}) RETURNING *`;
            const { rows: inserted } = await client.query(sql, values);
            if (inserted[0]) createdRows.push(inserted[0]);
          }
          await client.query('COMMIT');
          return res.status(201).json({ data: createdRows, error: null });
        } catch (bulkErr) {
          await client.query('ROLLBACK').catch(() => {});
          throw bulkErr;
        } finally {
          client.release();
        }
      }

      if (isSharedMulti) {
        row.assigned_to = assigneeIds[0];
        row.assigned_at = row.assigned_at || new Date().toISOString();
      }
      if (assigneeIds.length === 1) {
        row.assigned_to = assigneeIds[0];
        row.assigned_at = row.assigned_at || new Date().toISOString();
      } else if (assigneeIds.length === 0) {
        row.assigned_to = null;
      } else if (row.assigned_to && !Array.isArray(row.assigned_to)) {
        row.assigned_at = row.assigned_at || new Date().toISOString();
      }
    }

    const cols = Object.keys(row).filter((k) => row[k] !== undefined);
    const values = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const columns = cols.join(', ');
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const { rows } = await query(sql, values);
    let responseData = rows[0];
    if (table === 'timesheets' && responseData && responseData.date != null) {
      responseData = { ...responseData, date: toDateOnlyString(responseData.date) };
    }
    res.status(201).json({ data: responseData, error: null });
  } catch (err) {
    if (err.code === '23505' && err.table === 'attendance') {
      return res.status(409).json({
        data: null,
        error: { message: 'Already checked in for today.' },
      });
    }
    next(err);
  }
});

/**
 * PATCH /data/:table
 * Query: id=... or user_id=... (for profiles). Body = updates.
 * For room_bookings cancel: validates owner and rejects if meeting already ended (expired).
 */
router.patch('/:table', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ data: null, error: { message: 'Table not allowed' } });
    }
    const updates = req.body || {};
    const id = normalizeUUID(req.query.id);
    const userId = normalizeUUID(req.query.user_id);
    if (!id && !userId) {
      return res.status(400).json({ data: null, error: { message: 'Need id or user_id' } });
    }
    // Attendance check-out only via POST /api/attendance/check-out (no PATCH bypass)
    if (table === 'attendance') {
      return res.status(400).json({
        data: null,
        error: { message: 'Use POST /api/attendance/check-out for check-out. Do not use this endpoint for attendance.' },
      });
    }

    if (table === 'room_bookings' && id && updates.status === 'cancelled') {
      const { rows: existing } = await query(
        'SELECT id, booked_by, booking_date, end_time FROM room_bookings WHERE id = $1',
        [id]
      );
      if (!existing.length) {
        return res.status(404).json({ data: null, error: { message: 'Not found' } });
      }
      const row = existing[0];
      if (normalizeUUID(row.booked_by) !== normalizeUUID(req.userId)) {
        return res.status(403).json({ data: null, error: { message: 'Only the person who made the booking can cancel it.' } });
      }
      const endAt = new Date(`${String(row.booking_date)}T${row.end_time}`);
      if (endAt < new Date()) {
        return res.status(403).json({ data: null, error: { message: 'Cannot cancel a meeting that has already ended.' } });
      }
    }

    if (table === 'skills' && id) {
      const { rows: skillRow } = await query('SELECT user_id FROM skills WHERE id = $1', [id]);
      if (!skillRow.length) {
        return res.status(404).json({ data: null, error: { message: 'Not found' } });
      }
      if (normalizeUUID(skillRow[0].user_id) !== normalizeUUID(req.userId)) {
        return res.status(403).json({ data: null, error: { message: 'You can only update your own skills.' } });
      }
      if (updates.proficiency_level != null && updates.goal_level != null && Number(updates.proficiency_level) > Number(updates.goal_level)) {
        updates.goal_level = updates.proficiency_level;
      }
    }

    if (table === 'tasks' && id) {
      const { rows: taskRows } = await query(
        'SELECT assigned_to, assigned_by FROM tasks WHERE id = $1 AND is_deleted = false',
        [id]
      );
      if (!taskRows.length) {
        return res.status(404).json({ data: null, error: { message: 'Task not found.' } });
      }
      const task = taskRows[0];
      const myProfileId = normalizeUUID(req.profileId);
      const isAdmin = req.roles && (req.roles.includes('admin') || req.roles.includes('hr'));
      const isManagerRole = req.roles && (req.roles.includes('manager') || req.roles.includes('team_lead'));
      const isAssignee = myProfileId && normalizeUUID(task.assigned_to) === myProfileId;
      let canEdit = isAdmin || isAssignee || req.userType === 'SENIOR_MANAGER';
      if (!canEdit && isManagerRole && task.assigned_to) {
        const { rows: assigneeRows } = await query('SELECT user_id FROM profiles WHERE id = $1', [normalizeUUID(task.assigned_to)]);
        const empUserId = assigneeRows[0]?.user_id;
        if (empUserId && await isManagerOf(normalizeUUID(req.userId), empUserId)) canEdit = true;
      }
      if (!canEdit) {
        return res.status(403).json({ data: null, error: { message: 'You can only edit tasks assigned to you or to your direct reports.' } });
      }
      if (updates.assigned_to !== undefined && updates.assigned_to !== null) {
        const newAssigneeProfileId = normalizeUUID(updates.assigned_to);
        const { rows: newAssigneeRows } = await query('SELECT user_id FROM profiles WHERE id = $1', [newAssigneeProfileId]);
        const newEmpUserId = newAssigneeRows[0]?.user_id;
        if (req.userType !== 'SENIOR_MANAGER') {
          if (!newEmpUserId || !(await isManagerOf(normalizeUUID(req.userId), newEmpUserId))) {
            return res.status(403).json({ data: null, error: { message: 'You can only reassign to your direct reports.' } });
          }
        }
        if (!updates.assigned_at) updates.assigned_at = new Date().toISOString();
      }
      if (updates.task_type === 'separate_task') updates.project_id = null;
    }

    if (table === 'timesheets' && id) {
      if (updates.date != null && updates.date !== '') {
        const norm = normalizeTimesheetDate(updates.date);
        if (!norm.ok) {
          return res.status(400).json({ data: null, error: { message: norm.message } });
        }
        updates.date = norm.value;
      }
      const { rows: existingRows } = await query(
        'SELECT work_type, project_id, task_id, activity_title FROM timesheets WHERE id = $1',
        [id]
      );
      if (!existingRows.length) {
        return res.status(404).json({ data: null, error: { message: 'Not found' } });
      }
      const merged = { ...existingRows[0], ...updates };
      const validation = validateTimesheetRow(merged);
      if (!validation.valid) {
        return res.status(400).json({ data: null, error: { message: validation.message } });
      }
      const workType = merged.work_type != null ? String(merged.work_type).trim() : 'Project Work';
      if (workType === 'Project Work') {
        if (!merged.project_id || !merged.task_id) {
          return res.status(400).json({ data: null, error: { message: 'For Project Work, project and task are required.' } });
        }
        const ok = await taskBelongsToProject(merged.task_id, merged.project_id);
        if (!ok) {
          return res.status(400).json({ data: null, error: { message: 'Selected task does not belong to the selected project.' } });
        }
        updates.activity_title = null;
      } else {
        updates.project_id = null;
        updates.task_id = null;
        const title = merged.activity_title != null ? String(merged.activity_title).trim() : '';
        if (!title) {
          return res.status(400).json({ data: null, error: { message: 'For this work type, activity title is required.' } });
        }
        updates.activity_title = title;
      }
    }

    const setClauses = [];
    const values = [];
    let i = 1;
    const allowed = Object.keys(updates);
    for (const key of allowed) {
      if (updates[key] === undefined) continue;
      setClauses.push(`${key} = $${i}`);
      values.push(updates[key]);
      i++;
    }
    if (setClauses.length === 0) {
      return res.status(400).json({ data: null, error: { message: 'No updates' } });
    }
    if (TABLES_WITH_UPDATED_AT.has(table)) {
      setClauses.push('updated_at = now()');
    }
    values.push(id || userId);
    const where = id ? 'id = $' + i : 'user_id = $' + i;
    const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${where} RETURNING *`;
    const { rows } = await query(sql, values);
    if (!rows.length) {
      return res.status(404).json({ data: null, error: { message: 'Not found' } });
    }
    res.json({ data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /data/:table
 * Query: id=...
 */
router.delete('/:table', async (req, res, next) => {
  try {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ data: null, error: { message: 'Table not allowed' } });
    }
    const id = normalizeUUID(req.query.id);
    if (!id) return res.status(400).json({ data: null, error: { message: 'Need id' } });
    if (table === 'skills') {
      const { rows: skillRow } = await query('SELECT user_id FROM skills WHERE id = $1', [id]);
      if (!skillRow.length) {
        return res.status(404).json({ data: null, error: { message: 'Not found' } });
      }
      if (normalizeUUID(skillRow[0].user_id) !== normalizeUUID(req.userId)) {
        return res.status(403).json({ data: null, error: { message: 'You can only delete your own skills.' } });
      }
    }
    if (table === 'tasks') {
      const { rows: taskRows } = await query('SELECT assigned_to FROM tasks WHERE id = $1', [id]);
      if (!taskRows.length) return res.status(404).json({ data: null, error: { message: 'Not found' } });
      const task = taskRows[0];
      const isAdmin = req.roles && (req.roles.includes('admin') || req.roles.includes('hr'));
      const isManagerRole = req.roles && (req.roles.includes('manager') || req.roles.includes('team_lead'));
      const myProfileId = normalizeUUID(req.profileId);
      const isAssignee = myProfileId && normalizeUUID(task.assigned_to) === myProfileId;
      let canDelete = isAdmin || isAssignee || req.userType === 'SENIOR_MANAGER';
      if (!canDelete && isManagerRole && task.assigned_to) {
        const { rows: assigneeRows } = await query('SELECT user_id FROM profiles WHERE id = $1', [normalizeUUID(task.assigned_to)]);
        const empUserId = assigneeRows[0]?.user_id;
        if (empUserId && await isManagerOf(normalizeUUID(req.userId), empUserId)) canDelete = true;
      }
      if (!canDelete) {
        return res.status(403).json({ data: null, error: { message: 'You can only delete tasks assigned to you or to your direct reports.' } });
      }
    }
    const { rowCount } = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ data: null, error: { message: 'Not found' } });
    res.json({ data: { id }, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
