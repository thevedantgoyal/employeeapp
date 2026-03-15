import { query } from '../config/database.js';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Get leave dashboard: leave_types and balances for user. Auto-provisions leave_balances if empty.
 */
export async function getDashboard(userId) {
  const { rows: countRows } = await query(
    'SELECT COUNT(*) AS count FROM leave_balances WHERE user_id = $1 AND year = $2',
    [userId, CURRENT_YEAR]
  );
  const count = parseInt(countRows[0]?.count ?? '0', 10);
  if (count === 0) {
    await query(
      `INSERT INTO leave_balances (user_id, leave_type_id, total, year)
       SELECT $1, lt.id, lt.default_days, $2
       FROM leave_types lt
       ON CONFLICT (user_id, leave_type_id, year) DO NOTHING`,
      [userId, CURRENT_YEAR]
    );
  }

  const { rows: leaveTypes } = await query(
    'SELECT id, name, code, default_days, color FROM leave_types ORDER BY name ASC'
  );
  const { rows: balances } = await query(
    `SELECT lb.id, lb.user_id, lb.leave_type_id, lb.total, lb.used, lb.year,
            lt.code, lt.name, lt.color
     FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.user_id = $1 AND lb.year = $2
     ORDER BY lt.name ASC`,
    [userId, CURRENT_YEAR]
  );

  return {
    leave_types: leaveTypes,
    balances: balances.map((b) => ({
      id: b.id,
      user_id: b.user_id,
      leave_type_id: b.leave_type_id,
      total: Number(b.total),
      used: Number(b.used),
      year: b.year,
      leave_types: { code: b.code, name: b.name, color: b.color },
    })),
    fiscal_year: `${CURRENT_YEAR}-${String(CURRENT_YEAR + 1).slice(-2)}`,
  };
}

export async function checkLeaveOverlap(userId, fromDate, toDate, excludeId = null) {
  const { rows } = await query(
    'SELECT public.check_leave_overlap($1, $2, $3, $4) AS overlap',
    [userId, fromDate, toDate, excludeId]
  );
  return rows[0]?.overlap ?? false;
}

/**
 * Approve leave: hierarchy check, balance check, deduct balance, set approver_id (profile id), notify.
 */
export async function approveLeave(leaveId, approverUserId, approverProfileId, comment = null) {
  const client = await (await import('../config/database.js')).default.connect();
  try {
    await client.query('BEGIN');
    const { rows: leaveRows } = await client.query(
      'SELECT * FROM leaves WHERE id = $1 AND status = $2',
      [leaveId, 'pending']
    );
    if (!leaveRows.length) {
      const err = new Error('Leave request not found or not pending');
      err.statusCode = 400;
      throw err;
    }
    const leave = leaveRows[0];
    const employeeUserId = leave.user_id;

    const { rows: profileRows } = await client.query(
      'SELECT manager_id FROM profiles WHERE user_id = $1',
      [employeeUserId]
    );
    const employeeManagerId = profileRows[0]?.manager_id ?? null;
    const isAdmin = await hasRole(client, approverUserId, 'admin');
    const { rows: approverProfileRows } = await client.query(
      'SELECT external_role FROM profiles WHERE id = $1',
      [approverProfileId]
    );
    const approverExternalRole = (approverProfileRows[0]?.external_role || '').toString().trim().toLowerCase();
    const isAdminOrSubadmin = isAdmin || approverExternalRole === 'admin' || approverExternalRole === 'subadmin';
    const isReportingManager = employeeManagerId != null && approverProfileId === employeeManagerId;
    if (employeeManagerId != null) {
      if (!isReportingManager && !isAdminOrSubadmin) {
        const err = new Error('Only the reporting manager, admin, or subadmin can approve this leave request');
        err.statusCode = 403;
        throw err;
      }
    } else {
      if (!isAdminOrSubadmin) {
        const err = new Error('Only admin or subadmin can approve leave for employees without a reporting manager');
        err.statusCode = 403;
        throw err;
      }
    }

    const { rows: balanceRows } = await client.query(
      `SELECT * FROM leave_balances
       WHERE user_id = $1 AND leave_type_id = $2 AND year = EXTRACT(YEAR FROM $3::date)::integer`,
      [leave.user_id, leave.leave_type_id, leave.from_date]
    );
    if (!balanceRows.length) {
      const err = new Error('Insufficient leave balance');
      err.statusCode = 400;
      throw err;
    }
    const balance = balanceRows[0];
    const remaining = Number(balance.total) - Number(balance.used);
    if (remaining < Number(leave.days_count)) {
      const err = new Error('Insufficient leave balance');
      err.statusCode = 400;
      throw err;
    }

    await client.query(
      `UPDATE leaves SET status = 'approved', approver_id = $1, approver_comment = $2, approved_at = now(), updated_at = now() WHERE id = $3`,
      [approverProfileId, comment, leaveId]
    );
    await client.query(
      'UPDATE leave_balances SET used = used + $1, updated_at = now() WHERE id = $2',
      [leave.days_count, balance.id]
    );

    const { rows: approverNameRow } = await client.query(
      'SELECT full_name FROM profiles WHERE id = $1',
      [approverProfileId]
    );
    const { rows: typeRow } = await client.query('SELECT name FROM leave_types WHERE id = $1', [leave.leave_type_id]);
    const approverName = approverNameRow[0]?.full_name || 'your manager';
    const leaveTypeName = typeRow[0]?.name || 'leave';
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, 'leave_request', 'Leave Approved', $2, $3)`,
      [
        leave.user_id,
        `Your ${leaveTypeName} request from ${leave.from_date} to ${leave.to_date} has been approved by ${approverName}`,
        JSON.stringify({
          leave_id: leaveId,
          status: 'approved',
          approver_name: approverName,
          leave_type: leaveTypeName,
          from_date: leave.from_date,
          to_date: leave.to_date,
        }),
      ]
    );
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function hasRole(client, userId, role) {
  const { rows } = await client.query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 LIMIT 1',
    [userId, role]
  );
  return rows.length > 0;
}

/**
 * Reject leave: hierarchy check, update status, notify.
 */
export async function rejectLeave(leaveId, approverUserId, approverProfileId, comment = null) {
  const { rows: leaveRows } = await query(
    'SELECT * FROM leaves WHERE id = $1 AND status = $2',
    [leaveId, 'pending']
  );
  if (!leaveRows.length) {
    const err = new Error('Leave request not found or not pending');
    err.statusCode = 400;
    throw err;
  }
  const leave = leaveRows[0];
  const { rows: profileRows } = await query(
    'SELECT manager_id FROM profiles WHERE user_id = $1',
    [leave.user_id]
  );
  const employeeManagerId = profileRows[0]?.manager_id ?? null;
  const { rows: adminRows } = await query(
    'SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2 LIMIT 1',
    [approverUserId, 'admin']
  );
  const isAdmin = adminRows.length > 0;
  const { rows: approverProfileRows } = await query(
    'SELECT external_role FROM profiles WHERE id = $1',
    [approverProfileId]
  );
  const approverExternalRole = (approverProfileRows[0]?.external_role || '').toString().trim().toLowerCase();
  const isAdminOrSubadmin = isAdmin || approverExternalRole === 'admin' || approverExternalRole === 'subadmin';
  const isReportingManager = employeeManagerId != null && approverProfileId === employeeManagerId;
  if (employeeManagerId != null) {
    if (!isReportingManager && !isAdminOrSubadmin) {
      const err = new Error('Only the reporting manager, admin, or subadmin can reject this leave request');
      err.statusCode = 403;
      throw err;
    }
  } else {
    if (!isAdminOrSubadmin) {
      const err = new Error('Only admin or subadmin can reject leave for employees without a reporting manager');
      err.statusCode = 403;
      throw err;
    }
  }

  await query(
    `UPDATE leaves SET status = 'rejected', approver_id = $1, approver_comment = $2, approved_at = now(), updated_at = now() WHERE id = $3`,
    [approverProfileId, comment, leaveId]
  );
  const { rows: approverNameRow } = await query(
    'SELECT full_name FROM profiles WHERE id = $1',
    [approverProfileId]
  );
  const { rows: typeRow } = await query('SELECT name FROM leave_types WHERE id = $1', [leave.leave_type_id]);
  const approverName = approverNameRow[0]?.full_name || 'your manager';
  const leaveTypeName = typeRow[0]?.name || 'leave';
  let msg = `Your ${leaveTypeName} request from ${leave.from_date} to ${leave.to_date} has been rejected by ${approverName}`;
  if (comment) msg += '. Reason: ' + comment;
  await query(
    `INSERT INTO notifications (user_id, type, title, message, metadata)
     VALUES ($1, 'leave_request', 'Leave Rejected', $2, $3)`,
    [
      leave.user_id,
      msg,
      JSON.stringify({
        leave_id: leaveId,
        status: 'rejected',
        approver_name: approverName,
        leave_type: leaveTypeName,
        from_date: leave.from_date,
        to_date: leave.to_date,
        comment,
      }),
    ]
  );
  return true;
}
