/**
 * Timesheet repository: database access only. No validation or business logic.
 */

import { query } from '../config/database.js';

/**
 * @param {string} taskId
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function taskBelongsToProject(taskId, projectId) {
  if (!taskId || !projectId) return true;
  const { rows } = await query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!rows.length) return false;
  return rows[0].project_id === projectId;
}

/**
 * Sum of hours for user on date (optionally excluding a timesheet id for updates).
 * @param {string} userId
 * @param {string} date YYYY-MM-DD
 * @param {string} [excludeId] timesheet id to exclude from sum
 * @returns {Promise<number>}
 */
export async function getTotalHoursForUserDate(userId, date, excludeId = null) {
  let sql = 'SELECT COALESCE(SUM(hours), 0) AS total FROM timesheets WHERE user_id = $1 AND date = $2';
  const params = [userId, date];
  if (excludeId) {
    params.push(excludeId);
    sql += ' AND id != $3';
  }
  const { rows } = await query(sql, params);
  return Number(rows[0]?.total ?? 0);
}

/**
 * @param {object} row { user_id, work_type, date, hours, project_id?, task_id?, activity_title?, description?, attachment_url? }
 * @returns {Promise<{ rows: object[] }>}
 */
export async function insert(row) {
  const cols = ['user_id', 'work_type', 'date', 'hours', 'project_id', 'task_id', 'activity_title', 'description', 'attachment_url'];
  const values = [
    row.user_id,
    row.work_type,
    row.date,
    row.hours,
    row.project_id ?? null,
    row.task_id ?? null,
    row.activity_title ?? null,
    row.description ?? null,
    row.attachment_url ?? null,
  ];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO timesheets (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await query(sql, values);
  return { rows };
}

/**
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function findByIdAndUser(id, userId) {
  const { rows } = await query(
    `SELECT t.id, t.user_id, t.project_id, t.task_id,
      to_char(t.date, 'YYYY-MM-DD') AS date,
      t.hours, t.work_type, t.activity_title, t.description, t.attachment_url,
      t.created_at, t.updated_at,
      json_build_object('name', p.name) AS projects,
      json_build_object('title', tk.title) AS tasks
     FROM timesheets t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN tasks tk ON tk.id = t.task_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * @param {string} id
 * @returns {Promise<object|null>} raw row without joins (for ownership and merge)
 */
export async function findById(id) {
  const { rows } = await query('SELECT * FROM timesheets WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * @param {string} id
 * @param {string} userId
 * @param {object} updates
 * @returns {Promise<{ rows: object[] }>}
 */
export async function update(id, userId, updates) {
  const allowed = ['work_type', 'date', 'hours', 'project_id', 'task_id', 'activity_title', 'description', 'attachment_url'];
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (updates[key] === undefined) continue;
    setClauses.push(`${key} = $${i}`);
    values.push(updates[key]);
    i++;
  }
  if (setClauses.length === 0) return { rows: [] };
  setClauses.push('updated_at = now()');
  values.push(id, userId);
  const sql = `UPDATE timesheets SET ${setClauses.join(', ')} WHERE id = $${i} AND user_id = $${i + 1} RETURNING *`;
  const { rows } = await query(sql, values);
  return { rows };
}

/**
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function deleteByIdAndUser(id, userId) {
  const { rowCount } = await query('DELETE FROM timesheets WHERE id = $1 AND user_id = $2', [id, userId]);
  return rowCount > 0;
}

/**
 * List timesheet entries for user in date range (inclusive), with project and task names.
 * @param {string} userId
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export async function listByDateRange(userId, fromDate, toDate) {
  const { rows } = await query(
    `SELECT t.id, t.user_id, t.project_id, t.task_id,
      to_char(t.date, 'YYYY-MM-DD') AS date,
      t.hours, t.work_type, t.activity_title, t.description, t.attachment_url,
      t.created_at, t.updated_at,
      json_build_object('name', p.name) AS projects,
      json_build_object('title', tk.title) AS tasks
     FROM timesheets t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN tasks tk ON tk.id = t.task_id
     WHERE t.user_id = $1 AND t.date >= $2 AND t.date <= $3
     ORDER BY t.date ASC, t.created_at ASC`,
    [userId, fromDate, toDate]
  );
  return rows;
}

/**
 * List timesheet entries for user in a calendar month.
 * @param {string} userId
 * @param {number} month 1-12
 * @param {number} year
 * @returns {Promise<object[]>}
 */
export async function listByMonth(userId, month, year) {
  const { rows } = await query(
    `SELECT t.id, t.user_id, t.project_id, t.task_id,
      to_char(t.date, 'YYYY-MM-DD') AS date,
      t.hours, t.work_type, t.activity_title, t.description, t.attachment_url,
      t.created_at, t.updated_at,
      json_build_object('name', p.name) AS projects,
      json_build_object('title', tk.title) AS tasks
     FROM timesheets t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN tasks tk ON tk.id = t.task_id
     WHERE t.user_id = $1 AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
     ORDER BY t.date ASC, t.created_at ASC`,
    [userId, month, year]
  );
  return rows;
}
