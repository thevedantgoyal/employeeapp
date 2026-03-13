/**
 * Timesheet controller: HTTP only. No business logic; delegates to service.
 */

import * as timesheetService from '../services/timesheetService.js';
import { selectTable } from '../services/dataService.js';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

/**
 * POST /timesheets — create entry
 */
export async function create(req, res, next) {
  try {
    const userId = req.userId;
    const result = await timesheetService.createTimesheet(userId, req.body || {});
    if (!result.success) {
      const status = result.error.code === 'FORBIDDEN' ? HTTP_FORBIDDEN
        : result.error.code === 'NOT_FOUND' ? HTTP_NOT_FOUND
          : HTTP_UNPROCESSABLE;
      return res.status(status).json({ data: null, error: { message: result.error.message, code: result.error.code } });
    }
    return res.status(201).json({ data: result.data, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /timesheets/:id — update entry
 */
export async function update(req, res, next) {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const result = await timesheetService.updateTimesheet(userId, id, req.body || {});
    if (!result.success) {
      const status = result.error.code === 'FORBIDDEN' ? HTTP_FORBIDDEN
        : result.error.code === 'NOT_FOUND' ? HTTP_NOT_FOUND
          : HTTP_UNPROCESSABLE;
      return res.status(status).json({ data: null, error: { message: result.error.message, code: result.error.code } });
    }
    return res.json({ data: result.data, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /timesheets/:id — get one entry (same user only)
 */
export async function getById(req, res, next) {
  try {
    const userId = req.userId;
    const id = req.params.id;
    const row = await timesheetService.getTimesheetById(userId, id);
    if (!row) {
      return res.status(HTTP_NOT_FOUND).json({ data: null, error: { message: 'Timesheet entry not found.', code: 'NOT_FOUND' } });
    }
    return res.json({ data: row, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /timesheets/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD — entries in range + totalsByDate (for Weekly View)
 */
export async function weekly(req, res, next) {
  try {
    const userId = req.userId;
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) {
      return res.status(400).json({
        data: null,
        error: { message: 'Query params from and to (YYYY-MM-DD) are required.', code: 'VALIDATION_ERROR' },
      });
    }
    const fromDate = String(from).slice(0, 10);
    const toDate = String(to).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return res.status(400).json({
        data: null,
        error: { message: 'from and to must be YYYY-MM-DD.', code: 'INVALID_DATE' },
      });
    }
    const summary = await timesheetService.getWeeklySummary(userId, fromDate, toDate);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ data: summary, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /timesheets/monthly?month=1&year=2026 — entries in month + totalsByDate (for Monthly View)
 */
export async function monthly(req, res, next) {
  try {
    const userId = req.userId;
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({
        data: null,
        error: { message: 'Query params month (1-12) and year are required.', code: 'VALIDATION_ERROR' },
      });
    }
    const summary = await timesheetService.getMonthlySummary(userId, month, year);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ data: summary, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /timesheets — list entries (respects RLS via dataService)
 */
export async function list(req, res, next) {
  try {
    const filters = { ...req.query };
    const order = filters.order || 'date';
    const ascending = filters.ascending !== 'false' && filters.ascending !== '0';
    const limit = Math.min(parseInt(filters.limit, 10) || 500, 2000);
    delete filters.order;
    delete filters.ascending;
    delete filters.limit;
    if (filters.user_id !== req.userId && !(req.roles && (req.roles.includes('admin') || req.roles.includes('hr')))) {
      filters.user_id = req.userId;
    }
    const result = await selectTable(
      'timesheets',
      req.userId,
      req.profileId,
      req.roles || [],
      filters,
      `${order} ${ascending ? 'ASC' : 'DESC'}`,
      limit
    );
    if (result.error) return res.status(400).json(result);
    res.setHeader('Cache-Control', 'no-store');
    return res.json(result);
  } catch (err) {
    next(err);
  }
}
