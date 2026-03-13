/**
 * Timesheet validation layer & DTOs.
 * No business logic; pure validation and request shaping.
 */

export const WORK_TYPES = Object.freeze([
  'Project Work',
  'Internal Meeting',
  'Learning / Training',
  'Support',
  'Leave',
  'Other',
]);

const MAX_DAILY_HOURS = 24;
const MAX_HOURS_PER_ENTRY = 24;
const MIN_HOURS = 0.25;

/**
 * Normalize and validate create payload. Returns { success: true, data } or { success: false, error: { message, code? } }.
 * Does NOT check task-belongs-to-project or daily total (handled in service).
 */
export function validateCreatePayload(body) {
  if (!body || typeof body !== 'object') {
    return { success: false, error: { message: 'Request body is required.', code: 'VALIDATION_ERROR' } };
  }

  const workType = body.work_type != null ? String(body.work_type).trim() : null;
  if (!workType || !WORK_TYPES.includes(workType)) {
    return {
      success: false,
      error: {
        message: `work_type must be one of: ${WORK_TYPES.join(', ')}.`,
        code: 'INVALID_WORK_TYPE',
      },
    };
  }

  const date = body.date;
  if (date == null || date === '') {
    return { success: false, error: { message: 'date is required.', code: 'MISSING_DATE' } };
  }
  // Timesheet date must be calendar date only (no time/timezone). Accept only YYYY-MM-DD string.
  // Do NOT use toISOString() — it converts to UTC and can shift the date (e.g. IST midnight → previous day in UTC).
  if (typeof date !== 'string') {
    return { success: false, error: { message: 'date must be a string in YYYY-MM-DD format (calendar date only).', code: 'INVALID_DATE' } };
  }
  const dateStr = date.trim();
  if (dateStr.includes('T') || dateStr.includes('Z') || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: { message: 'date must be YYYY-MM-DD only (no time or timezone).', code: 'INVALID_DATE' } };
  }

  const hoursRaw = body.hours;
  const hours = typeof hoursRaw === 'number' ? hoursRaw : parseFloat(hoursRaw);
  if (!Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS_PER_ENTRY) {
    return {
      success: false,
      error: {
        message: `hours must be a number between ${MIN_HOURS} and ${MAX_HOURS_PER_ENTRY}.`,
        code: 'INVALID_HOURS',
      },
    };
  }

  if (workType === 'Project Work') {
    const projectId = body.project_id ?? null;
    const taskId = body.task_id ?? null;
    if (!projectId || !taskId) {
      return {
        success: false,
        error: {
          message: 'For Project Work, project_id and task_id are required.',
          code: 'MISSING_PROJECT_OR_TASK',
        },
      };
    }
    if (body.activity_title != null && String(body.activity_title).trim() !== '') {
      return {
        success: false,
        error: {
          message: 'For Project Work, activity_title must be empty or null.',
          code: 'INVALID_ACTIVITY_TITLE',
        },
      };
    }
    return {
      success: true,
      data: {
        work_type: workType,
        date: dateStr,
        hours: Number(hours.toFixed(2)),
        project_id: projectId,
        task_id: taskId,
        activity_title: null,
        description: body.description != null ? String(body.description).trim() || null : null,
        attachment_url: body.attachment_url ?? null,
      },
    };
  }

  const activityTitle = body.activity_title != null ? String(body.activity_title).trim() : '';
  if (!activityTitle) {
    return {
      success: false,
      error: {
        message: 'For this work type, activity_title is required.',
        code: 'MISSING_ACTIVITY_TITLE',
      },
    };
  }
  if (body.project_id != null || body.task_id != null) {
    return {
      success: false,
      error: {
        message: 'For non-project work types, project_id and task_id must not be provided.',
        code: 'INVALID_PROJECT_OR_TASK',
      },
    };
  }

  return {
    success: true,
    data: {
      work_type: workType,
      date: dateStr,
      hours: Number(hours.toFixed(2)),
      project_id: null,
      task_id: null,
      activity_title: activityTitle,
      description: body.description != null ? String(body.description).trim() || null : null,
      attachment_url: body.attachment_url ?? null,
    },
  };
}

/**
 * Validate update payload (partial). Merged with existing row must satisfy same rules.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateUpdatePayload(body, existing) {
  if (!body || typeof body !== 'object') {
    return { success: false, error: { message: 'Request body is required.', code: 'VALIDATION_ERROR' } };
  }
  const merged = { ...existing, ...body };
  const workType = merged.work_type != null ? String(merged.work_type).trim() : (existing.work_type || null);
  if (workType && !WORK_TYPES.includes(workType)) {
    return {
      success: false,
      error: { message: `work_type must be one of: ${WORK_TYPES.join(', ')}.`, code: 'INVALID_WORK_TYPE' },
    };
  }
  if (body.date !== undefined) {
    const date = body.date;
    if (typeof date !== 'string' || date.trim().includes('T') || date.trim().includes('Z') || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return { success: false, error: { message: 'date must be YYYY-MM-DD only (no time or timezone).', code: 'INVALID_DATE' } };
    }
  }
  if (body.hours !== undefined) {
    const hours = typeof body.hours === 'number' ? body.hours : parseFloat(body.hours);
    if (!Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS_PER_ENTRY) {
      return {
        success: false,
        error: {
          message: `hours must be between ${MIN_HOURS} and ${MAX_HOURS_PER_ENTRY}.`,
          code: 'INVALID_HOURS',
        },
      };
    }
  }
  const wt = workType || existing.work_type || 'Project Work';
  if (wt === 'Project Work') {
    const projectId = merged.project_id ?? existing.project_id;
    const taskId = merged.task_id ?? existing.task_id;
    if (!projectId || !taskId) {
      return {
        success: false,
        error: { message: 'For Project Work, project_id and task_id are required.', code: 'MISSING_PROJECT_OR_TASK' },
      };
    }
    if (merged.activity_title != null && String(merged.activity_title).trim() !== '') {
      return {
        success: false,
        error: { message: 'For Project Work, activity_title must be empty or null.', code: 'INVALID_ACTIVITY_TITLE' },
      };
    }
    return {
      success: true,
      data: {
        ...body,
        work_type: wt,
        project_id: projectId,
        task_id: taskId,
        activity_title: null,
      },
    };
  }
  const activityTitle = merged.activity_title != null ? String(merged.activity_title).trim() : (existing.activity_title || '');
  if (!activityTitle) {
    return {
      success: false,
      error: { message: 'For this work type, activity_title is required.', code: 'MISSING_ACTIVITY_TITLE' },
    };
  }
  return {
    success: true,
    data: {
      ...body,
      work_type: wt,
      project_id: null,
      task_id: null,
      activity_title: activityTitle,
    },
  };
}

export { MAX_DAILY_HOURS, MIN_HOURS, MAX_HOURS_PER_ENTRY };
