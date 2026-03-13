/**
 * Timesheet service: business logic only. No HTTP, no raw validation details.
 * Orchestrates validator + repository; enforces daily 24h and task-belongs-to-project.
 */

import {
  validateCreatePayload,
  validateUpdatePayload,
  MAX_DAILY_HOURS,
} from '../validators/timesheetValidator.js';
import * as repo from '../repositories/timesheetRepository.js';

/** Format date for API response: always YYYY-MM-DD. Avoids sending ISO string (which can show wrong day in other TZ). */
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

/** Map a timesheet row so date is YYYY-MM-DD string in the response. */
function mapEntryForResponse(row) {
  const { date, ...rest } = row;
  return { ...rest, date: toDateOnlyString(date) };
}

/**
 * Create a timesheet entry. Enforces work type rules, task-project match, and max 24h per user per day.
 * @param {string} userId
 * @param {object} body raw request body
 * @returns {Promise<{ success: true, data: object } | { success: false, error: { message, code? } }>}
 */
export async function createTimesheet(userId, body) {
  const validation = validateCreatePayload(body);
  if (!validation.success) return validation;

  const data = validation.data;
  if (data.work_type === 'Project Work') {
    const ok = await repo.taskBelongsToProject(data.task_id, data.project_id);
    if (!ok) {
      return {
        success: false,
        error: {
          message: 'Selected task does not belong to the selected project.',
          code: 'TASK_PROJECT_MISMATCH',
        },
      };
    }
  }

  const totalForDay = await repo.getTotalHoursForUserDate(userId, data.date);
  const newTotal = totalForDay + data.hours;
  if (newTotal > MAX_DAILY_HOURS) {
    return {
      success: false,
      error: {
        message: `Total hours for this day would exceed ${MAX_DAILY_HOURS}h. Currently logged: ${totalForDay}h.`,
        code: 'DAILY_HOURS_EXCEEDED',
      },
    };
  }

  try {
    const { rows } = await repo.insert({ ...data, user_id: userId });
    return { success: true, data: rows[0] };
  } catch (err) {
    if (err.code === '23503') {
      return { success: false, error: { message: 'Invalid project or task reference.', code: 'FOREIGN_KEY_VIOLATION' } };
    }
    if (err.code === '23514') {
      return { success: false, error: { message: 'Data does not satisfy timesheet rules.', code: 'CHECK_VIOLATION' } };
    }
    throw err;
  }
}

/**
 * Update a timesheet entry. Validates merged row, task-project, and daily 24h (excluding this entry).
 * @param {string} userId
 * @param {string} id
 * @param {object} body raw request body (partial)
 * @returns {Promise<{ success: true, data: object } | { success: false, error: { message, code? } }>}
 */
export async function updateTimesheet(userId, id, body) {
  const existing = await repo.findById(id);
  if (!existing) {
    return { success: false, error: { message: 'Timesheet entry not found.', code: 'NOT_FOUND' } };
  }
  if (existing.user_id !== userId) {
    return { success: false, error: { message: 'You can only update your own timesheet entries.', code: 'FORBIDDEN' } };
  }

  const validation = validateUpdatePayload(body, existing);
  if (!validation.success) return validation;

  const updates = validation.data;
  const merged = { ...existing, ...updates };

  if (merged.work_type === 'Project Work') {
    const ok = await repo.taskBelongsToProject(merged.task_id, merged.project_id);
    if (!ok) {
      return {
        success: false,
        error: {
          message: 'Selected task does not belong to the selected project.',
          code: 'TASK_PROJECT_MISMATCH',
        },
      };
    }
  }

  const dateToCheck = updates.date ?? existing.date;
  const hoursToCheck = updates.hours ?? existing.hours;
  const totalForDay = await repo.getTotalHoursForUserDate(userId, dateToCheck, id);
  const newTotal = totalForDay + hoursToCheck;
  if (newTotal > MAX_DAILY_HOURS) {
    return {
      success: false,
      error: {
        message: `Total hours for this day would exceed ${MAX_DAILY_HOURS}h. Currently logged (excluding this entry): ${totalForDay}h.`,
        code: 'DAILY_HOURS_EXCEEDED',
      },
    };
  }

  try {
    const { rows } = await repo.update(id, userId, updates);
    if (!rows.length) return { success: false, error: { message: 'Timesheet entry not found.', code: 'NOT_FOUND' } };
    return { success: true, data: rows[0] };
  } catch (err) {
    if (err.code === '23503') {
      return { success: false, error: { message: 'Invalid project or task reference.', code: 'FOREIGN_KEY_VIOLATION' } };
    }
    if (err.code === '23514') {
      return { success: false, error: { message: 'Data does not satisfy timesheet rules.', code: 'CHECK_VIOLATION' } };
    }
    throw err;
  }
}

/**
 * Get one timesheet by id for the given user.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getTimesheetById(userId, id) {
  return repo.findByIdAndUser(id, userId);
}

/**
 * Get weekly summary: entries in date range plus total hours per date.
 * @param {string} userId
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate YYYY-MM-DD
 * @returns {Promise<{ entries: object[], totalsByDate: Record<string, number> }>}
 */
export async function getWeeklySummary(userId, fromDate, toDate) {
  const rows = await repo.listByDateRange(userId, fromDate, toDate);
  const totalsByDate = {};
  const entries = rows.map((row) => {
    const d = toDateOnlyString(row.date);
    if (d) totalsByDate[d] = (totalsByDate[d] || 0) + Number(row.hours || 0);
    return mapEntryForResponse(row);
  });
  return { entries, totalsByDate };
}

/**
 * Get monthly summary: entries in month plus total hours per date.
 * @param {string} userId
 * @param {number} month 1-12
 * @param {number} year
 * @returns {Promise<{ entries: object[], totalsByDate: Record<string, number> }>}
 */
export async function getMonthlySummary(userId, month, year) {
  const rows = await repo.listByMonth(userId, month, year);
  const totalsByDate = {};
  const entries = rows.map((row) => {
    const d = toDateOnlyString(row.date);
    if (d) totalsByDate[d] = (totalsByDate[d] || 0) + Number(row.hours || 0);
    return mapEntryForResponse(row);
  });
  return { entries, totalsByDate };
}
