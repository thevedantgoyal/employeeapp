import { query } from '../config/database.js';
import { isManagerOf } from '../middleware/rbac.js';
import { normalizeUUID, normalizeUUIDArray } from '../utils/uuid.js';

/**
 * Apply RLS-equivalent filters for a table. Returns { whereClause, params, paramIndex } or throws.
 * Tables supported: teams, projects, tasks, contributions, skills, performance_metrics, metric_categories,
 * notifications, push_subscriptions, scheduled_notifications, meeting_rooms, room_bookings, booking_audit_log,
 * attendance, leave_types, leave_balances, leaves, timesheets, task_activity_logs, task_comments, task_evidence,
 * task_dependencies, task_tags, task_tag_assignments, user_roles, project_members.
 */
export async function buildAccessFilter(tableName, userId, profileId, roles, filters = {}) {
  const cleanUserId = normalizeUUID(userId);
  let cleanProfileId = normalizeUUID(profileId);
  const canViewAll = roles && (roles.includes('admin') || roles.includes('hr') || roles.includes('organization'));
  const isManager = roles && (roles.includes('manager') || roles.includes('team_lead') || roles.includes('admin'));
  let userType = null;

  if (tableName === 'tasks') {
    console.log('[buildAccessFilter tasks] Input:', { userId, profileId, cleanUserId, cleanProfileId, roles, canViewAll, isManager, filtersKeys: Object.keys(filters) });
  }

  if (!cleanProfileId && cleanUserId && (tableName === 'profiles' || tableName === 'tasks')) {
    const { rows: profileRows } = await query('SELECT id FROM profiles WHERE user_id = $1 LIMIT 1', [cleanUserId]);
    cleanProfileId = profileRows[0]?.id ?? null;
    if (tableName === 'tasks') {
      console.log('[buildAccessFilter tasks] Profile resolved from user_id:', { cleanProfileId, profileRowsLength: profileRows.length });
    }
  }

  // Compute userType from profile.external_role + external_sub_role.
  if (cleanProfileId && (tableName === 'profiles' || tableName === 'tasks')) {
    try {
      const { rows } = await query('SELECT external_role, external_sub_role, manager_id FROM profiles WHERE id = $1', [cleanProfileId]);
      const p = rows[0] || null;
      const externalRole = (p?.external_role || '').toString().trim().toLowerCase();
      const hasSubRole = p?.external_sub_role != null && String(p.external_sub_role).trim() !== '';
      if (externalRole === 'subadmin' || hasSubRole) userType = 'SENIOR_MANAGER';
      else if (externalRole === 'manager' && !hasSubRole) userType = 'MANAGER';
      else userType = 'EMPLOYEE';
    } catch (_) {
      userType = null;
    }
  }

  switch (tableName) {
    case 'profiles': {
      // Lookup profiles by id first — allow any authenticated user to resolve a profile by id (e.g. reporting manager).
      // This must run before role-based filters so employees can fetch their manager's profile.
      const profileIds = filters.id != null ? (Array.isArray(filters.id) ? normalizeUUIDArray(filters.id) : [normalizeUUID(filters.id)].filter(Boolean)) : [];
      if (profileIds.length > 0) {
        return { where: 'id = ANY($1::uuid[])', params: [profileIds], paramIndex: 1 };
      }
      // external_role-based RBAC (works alongside users.role/user_roles)
      if (userType === 'SENIOR_MANAGER') return { where: '1=1', params: [], paramIndex: 0 };
      if (userType === 'MANAGER' && cleanProfileId) {
        console.log('[DirectReports] currentManagerProfileId:', cleanProfileId, 'userId:', cleanUserId, 'branch: userType MANAGER');
        return { where: 'manager_id = $1', params: [cleanProfileId], paramIndex: 1 };
      }
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      if (isManager && filters.team_id) return { where: 'team_id = $1', params: [filters.team_id], paramIndex: 1 };
      // Manager requesting their direct reports: ?manager_id=<their profile id> → return profiles where manager_id = that
      const filterManagerId = normalizeUUID(filters.manager_id);
      if (isManager && filterManagerId && filterManagerId === cleanProfileId) {
        console.log('[DirectReports] currentManagerProfileId:', cleanProfileId, 'userId:', cleanUserId, 'branch: isManager');
        return { where: 'manager_id = $1', params: [cleanProfileId], paramIndex: 1 };
      }
      // Allow direct reports when request has manager_id = current user's profile and they have at least one reportee (fixes managers with only external_role, no user_roles)
      if (filterManagerId && cleanProfileId && filterManagerId === cleanProfileId) {
        const { rows: hasReports } = await query('SELECT 1 FROM profiles WHERE manager_id = $1 LIMIT 1', [cleanProfileId]);
        if (hasReports.length > 0) {
          console.log('[DirectReports] currentManagerProfileId:', cleanProfileId, 'userId:', cleanUserId, 'branch: has direct reports');
          return { where: 'manager_id = $1', params: [cleanProfileId], paramIndex: 1 };
        }
      }
      // Batch fetch by user_id (e.g. manager fetching reportee profiles for leave requests)
      const userIdsFilter = filters.user_id != null ? (Array.isArray(filters.user_id) ? normalizeUUIDArray(filters.user_id) : [normalizeUUID(filters.user_id)].filter(Boolean)) : [];
      if (userIdsFilter.length > 0) {
        if (canViewAll) {
          return { where: 'user_id = ANY($1::uuid[])', params: [userIdsFilter], paramIndex: 1 };
        }
        if (isManager && cleanProfileId) {
          const { rows: reportees } = await query('SELECT user_id FROM profiles WHERE manager_id = $1', [cleanProfileId]);
          const allowedIds = reportees.map((r) => r.user_id).filter((uid) => userIdsFilter.includes(uid));
          if (allowedIds.length > 0) {
            return { where: 'user_id = ANY($1::uuid[])', params: [allowedIds], paramIndex: 1 };
          }
        }
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    }
    case 'user_roles': {
      if (roles && roles.includes('admin')) return { where: '1=1', params: [], paramIndex: 0 };
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    }
    case 'teams':
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'projects':
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'tasks': {
      const assignedTo = normalizeUUID(filters.assigned_to);
      const hasDirectReports = cleanProfileId
        ? (await query('SELECT 1 FROM profiles WHERE manager_id = $1 LIMIT 1', [cleanProfileId])).rows.length > 0
        : false;
      const isManagerOrHasReports = isManager || (!!cleanUserId && hasDirectReports);

      // Dashboard list (no assigned_to filter): scope to current user's own tasks only — created by me OR assigned to me OR in task_assignees.
      if (!assignedTo && cleanProfileId) {
        return {
          where: '(assigned_to = $1 OR assigned_by = $1 OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = id AND ta.profile_id = $1)) AND (is_deleted = false OR is_deleted IS NULL)',
          params: [cleanProfileId],
          paramIndex: 1,
        };
      }

      // Admin with assigned_to filter: still scope to own tasks when filtering by assignee (include shared tasks via task_assignees).
      if (roles && roles.includes('admin') && cleanProfileId && assignedTo === cleanProfileId) {
        return {
          where: '(assigned_to = $1 OR assigned_by = $1 OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = id AND ta.profile_id = $1)) AND (is_deleted = false OR is_deleted IS NULL)',
          params: [cleanProfileId],
          paramIndex: 1,
        };
      }

      // Manager's To-Do list: tasks assigned TO me or in task_assignees (exclude tasks I created so they don't duplicate).
      if (isManagerOrHasReports && assignedTo && cleanProfileId && assignedTo === cleanProfileId) {
        console.log('[buildAccessFilter tasks] Branch: manager To-Do (assigned_to=me)');
        return {
          where: '(assigned_to = $1 OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = id AND ta.profile_id = $1)) AND (is_deleted = false OR is_deleted IS NULL) AND (assigned_by IS NULL OR assigned_by <> $2)',
          params: [cleanProfileId, cleanProfileId],
          paramIndex: 2,
        };
      }
      // Employee (or any user) fetching own task list: include direct assignee AND shared tasks (task_assignees).
      // Match when filter is current profile id OR when frontend mistakenly sent user id (assignedTo === cleanUserId).
      const isOwnTaskList = assignedTo && cleanProfileId && (assignedTo === cleanProfileId || assignedTo === cleanUserId);
      if (isOwnTaskList) {
        return {
          where: '(assigned_to = $1 OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = id AND ta.profile_id = $1)) AND (is_deleted = false OR is_deleted IS NULL)',
          params: [cleanProfileId],
          paramIndex: 1,
        };
      }
      if (isManagerOrHasReports && assignedTo) {
        const { rows: assigneeRows } = await query('SELECT user_id FROM profiles WHERE id = $1', [assignedTo]);
        const employeeUserId = assigneeRows[0]?.user_id;
        const ok = employeeUserId && await isManagerOf(cleanUserId, employeeUserId);
        if (ok) return { where: 'assigned_to = $1 AND is_deleted = false', params: [assignedTo], paramIndex: 1 };
        return { where: '1=0', params: [], paramIndex: 0 };
      }
      if (cleanProfileId) {
        return { where: 'assigned_to = $1 AND (is_deleted = false OR is_deleted IS NULL)', params: [cleanProfileId], paramIndex: 1 };
      }
      console.log('[buildAccessFilter tasks] Branch: 1=0 (no profile)');
      return { where: '1=0', params: [], paramIndex: 0 };
    }
    case 'contributions':
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const contribUserId = normalizeUUID(filters.user_id);
      if (contribUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, contribUserId);
        if (ok) return { where: 'user_id = $1', params: [contribUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'skills':
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const skillsUserId = normalizeUUID(filters.user_id);
      if (skillsUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, skillsUserId);
        if (ok) return { where: 'user_id = $1', params: [skillsUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'performance_metrics':
    case 'metric_categories':
      if (tableName === 'metric_categories') return { where: '1=1', params: [], paramIndex: 0 };
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const perfUserId = normalizeUUID(filters.user_id);
      if (perfUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, perfUserId);
        if (ok) return { where: 'user_id = $1', params: [perfUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'notifications':
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'push_subscriptions':
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'scheduled_notifications':
      if (!roles || !roles.includes('admin')) return { where: '1=0', params: [], paramIndex: 0 };
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'meeting_rooms':
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'room_bookings': {
      if (filters.invited === 'true' || filters.invited === true) {
        return { where: '$1::text = ANY(rb.participants)', params: [cleanUserId], paramIndex: 1 };
      }
      // Room Availability: all authenticated users can list all bookings so the grid shows status/priority to everyone
      return { where: '1=1', params: [], paramIndex: 0 };
    }
    case 'booking_audit_log':
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'attendance':
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const attUserId = normalizeUUID(filters.user_id);
      if (attUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, attUserId);
        if (ok) return { where: 'user_id = $1', params: [attUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'leave_types':
      return { where: '1=1', params: [], paramIndex: 0 };
    case 'leave_balances':
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const lbUserId = normalizeUUID(filters.user_id);
      if (lbUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, lbUserId);
        if (ok) return { where: 'user_id = $1', params: [lbUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'leaves': {
      if (roles && roles.includes('admin')) return { where: '1=1', params: [], paramIndex: 0 };
      const uids = Array.isArray(filters.user_id) ? filters.user_id : (filters.user_id ? [filters.user_id] : null);
      const cleanUids = uids && uids.length ? normalizeUUIDArray(uids) : null;
      if (cleanUids && cleanUids.length && isManager) {
        const checks = await Promise.all(cleanUids.map((uid) => isManagerOf(cleanUserId, uid)));
        if (checks.every(Boolean)) return { where: 'user_id = ANY($1::uuid[])', params: [cleanUids], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    }
    case 'timesheets':
      if (canViewAll) return { where: '1=1', params: [], paramIndex: 0 };
      const tsUserId = normalizeUUID(filters.user_id);
      if (tsUserId && isManager) {
        const ok = await isManagerOf(cleanUserId, tsUserId);
        if (ok) return { where: 'user_id = $1', params: [tsUserId], paramIndex: 1 };
      }
      return { where: 'user_id = $1', params: [cleanUserId], paramIndex: 1 };
    case 'task_activity_logs':
    case 'task_comments':
    case 'task_evidence':
    case 'task_dependencies':
    case 'task_tags':
    case 'task_tag_assignments':
    case 'project_members':
      return { where: '1=1', params: [], paramIndex: 0 };
    default:
      return null;
  }
}

export async function selectTable(tableName, userId, profileId, roles, filters = {}, orderBy = null, limit = 1000) {
  const access = await buildAccessFilter(tableName, userId, profileId, roles, filters);
  if (!access) return { data: null, error: { message: 'Table not supported' } };

  if (tableName === 'tasks') {
    console.log('[selectTable tasks] Access filter:', { where: access.where, params: access.params, paramIndex: access.paramIndex });
  }

  const reservedKeys = ['assigned_to', 'order', 'ascending', 'limit', 'month', 'year', 'invited', 'is_deleted'];
  const safeCol = (k) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : null;
  let where = access.where;
  const params = [...access.params];
  let pi = access.paramIndex;
  const tableAlias = tableName === 'room_bookings' ? 'rb.' : '';
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;
    if (reservedKeys.includes(key)) continue;
    if (key.endsWith('_neq')) {
      const col = safeCol(key.slice(0, -4));
      if (col) {
        pi++;
        where += (where ? ' AND ' : '') + `${tableAlias}${col} != $${pi}`;
        params.push(Array.isArray(value) ? normalizeUUIDArray(value) : normalizeUUID(value));
      }
      continue;
    }
    if (!safeCol(key)) continue;
    pi++;
    if (Array.isArray(value)) {
      where += (where ? ' AND ' : '') + `${tableAlias}${key} = ANY($${pi}::uuid[])`;
      params.push(normalizeUUIDArray(value));
    } else {
      where += (where ? ' AND ' : '') + `${tableAlias}${key} = $${pi}`;
      params.push(normalizeUUID(value));
    }
  }
  // Timesheets: optional month/year filter (EXTRACT on date)
  if (tableName === 'timesheets' && filters.month != null && filters.year != null) {
    const monthNum = parseInt(String(filters.month), 10);
    const yearNum = parseInt(String(filters.year), 10);
    if (Number.isFinite(monthNum) && Number.isFinite(yearNum) && monthNum >= 1 && monthNum <= 12 && yearNum >= 2000 && yearNum <= 2100) {
      pi += 1;
      where += (where ? ' AND ' : '') + `EXTRACT(MONTH FROM date) = $${pi}`;
      params.push(monthNum);
      pi += 1;
      where += ' AND ' + `EXTRACT(YEAR FROM date) = $${pi}`;
      params.push(yearNum);
    }
  }

  const order = orderBy || 'created_at DESC';
  let safeOrder = order.replace(/[^a-z0-9_,\s]/gi, '');
  // task_tag_assignments has assigned_at, not created_at
  if (tableName === 'task_tag_assignments' && /created_at/i.test(safeOrder)) {
    safeOrder = safeOrder.replace(/\bcreated_at\b/gi, 'assigned_at');
  }
  params.push(limit);

  if (tableName === 'tasks') {
    console.log('[selectTable tasks] After filters:', { where, params, limit });
  }

  let sql;
  if (tableName === 'leave_balances') {
    const orderCol = safeOrder.replace(/^(\w+)/, 'lb.$1');
    sql = `SELECT lb.*, json_build_object('code', lt.code, 'name', lt.name, 'color', lt.color) AS leave_types
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE ${where} ORDER BY ${orderCol} LIMIT $${pi + 1}`;
  } else if (tableName === 'leaves') {
    const orderCol = safeOrder.replace(/^(\w+)/, 'l.$1');
    sql = `SELECT l.*, json_build_object('code', lt.code, 'name', lt.name) AS leave_types
      FROM leaves l
      JOIN leave_types lt ON lt.id = l.leave_type_id
      WHERE ${where} ORDER BY ${orderCol} LIMIT $${pi + 1}`;
  } else if (tableName === 'timesheets') {
    const orderCol = safeOrder.replace(/^(\w+)/, 't.$1');
    sql = `SELECT t.*,
      json_build_object('name', p.name) AS projects,
      json_build_object('title', tk.title) AS tasks
      FROM timesheets t
      LEFT JOIN projects p ON p.id = t.project_id
      LEFT JOIN tasks tk ON tk.id = t.task_id
      WHERE ${where} ORDER BY ${orderCol} LIMIT $${pi + 1}`;
  } else if (tableName === 'project_members') {
    sql = `SELECT pm.*, json_build_object('id', p.id, 'name', p.name) AS projects
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      WHERE ${where} ORDER BY ${safeOrder} LIMIT $${pi + 1}`;
  } else if (tableName === 'room_bookings') {
    const orderCol = safeOrder.replace(/^(\w+)/, 'rb.$1');
    sql = `SELECT rb.*, p.full_name AS booked_by_name
      FROM room_bookings rb
      LEFT JOIN profiles p ON p.user_id = rb.booked_by
      WHERE ${where} ORDER BY ${orderCol} LIMIT $${pi + 1}`;
  } else if (tableName === 'tasks') {
    const orderCol = safeOrder.replace(/^(\w+)/, 't.$1');
    const taskColRegex = /\b(assigned_to|assigned_by|is_deleted|is_seen|status|priority|due_date|task_type|project_id|id)\b/g;
    const whereTasks = where.replace(taskColRegex, (match, _group, offset, fullString) => {
      const str = typeof fullString === 'string' ? fullString : where;
      const idx = typeof offset === 'number' ? offset : 0;
      const before = str.substring(0, idx);
      if (/\bSELECT\s+$/i.test(before)) return match;
      const beforeShort = str.substring(Math.max(0, idx - 2), idx);
      return beforeShort === 't.' ? match : `t.${match}`;
    });
    sql = `SELECT t.*, json_build_object('name', p.name) AS projects
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE ${whereTasks} ORDER BY ${orderCol} LIMIT $${pi + 1}`;
    console.log('[selectTable tasks] SQL:', sql);
    console.log('[selectTable tasks] Params:', params);
  } else {
    sql = `SELECT * FROM ${tableName} WHERE ${where} ORDER BY ${safeOrder} LIMIT $${pi + 1}`;
  }

  try {
    const { rows } = await query(sql, params);
    if (tableName === 'tasks') {
      console.log('[selectTable tasks] Query result:', { rowCount: rows.length, firstId: rows[0]?.id });
      console.log('[EmployeeTasks] query:', sql);
      console.log('[EmployeeTasks] params:', params);
      console.log('[EmployeeTasks] result count:', rows.length);
      console.log('[EmployeeTasks] raw rows:', JSON.stringify(rows.slice(0, 3), null, 2));
    }
    return { data: rows, error: null };
  } catch (e) {
    if (tableName === 'tasks') {
      console.log('[selectTable tasks] Query error:', e.message);
    }
    return { data: null, error: { message: e.message } };
  }
}
