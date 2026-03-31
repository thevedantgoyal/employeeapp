import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { normalizeUUID } from '../utils/uuid.js';
import { sendPushToUser } from '../services/pushService.js';

const router = Router();
router.use(authenticate);

function isSubadmin(req) {
  const role = (req.profile?.external_role || '').toString().trim().toLowerCase();
  const subRole = req.profile?.external_sub_role != null && String(req.profile.external_sub_role).trim() !== '';
  return role === 'subadmin' || subRole;
}

function parseDurationHours(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeDepartmentName(department) {
  const raw = String(department || '').trim();
  if (!raw) return raw;
  if (['data&ai', 'data & ai', 'data and ai', 'ai'].includes(raw.toLowerCase())) {
    return 'Data&Ai';
  }
  if (['it help desk', 'it helpdesk', 'it support'].includes(raw.toLowerCase())) {
    return 'IT Help Desk';
  }
  if (['hr', 'human resource', 'human resources'].includes(raw.toLowerCase())) {
    return 'HR';
  }
  if (['security', 'cybersecurity', 'cyber security'].includes(raw.toLowerCase())) {
    return 'Cybersecurity';
  }
  return raw;
}

function getDepartmentAliases(department) {
  const normalized = normalizeDepartmentName(department);
  if (normalized === 'Data&Ai') {
    return ['Data&Ai', 'Data & AI', 'Data and AI', 'AI'];
  }
  if (normalized === 'IT Help Desk') {
    return ['IT Help Desk', 'IT Helpdesk', 'IT Support'];
  }
  if (normalized === 'HR') {
    return ['HR', 'Human Resource', 'Human Resources'];
  }
  if (normalized === 'Cybersecurity') {
    return ['Cybersecurity', 'Cyber Security', 'Security'];
  }
  return [normalized];
}

/**
 * GET /tasks/departments
 * Returns distinct departments from dept_task_templates (all template departments).
 */
router.get('/departments', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT department FROM dept_task_templates
       WHERE is_active = true
       ORDER BY department ASC`
    );
    const list = [...new Set(rows.map((r) => normalizeDepartmentName(r.department)))].sort((a, b) => a.localeCompare(b));
    res.json({ data: list, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tasks/templates/:department
 * Returns active templates for the department.
 */
router.get('/templates/:department', async (req, res, next) => {
  try {
    const department = decodeURIComponent(req.params.department || '').trim();
    if (!department) {
      return res.status(400).json({ data: null, error: { message: 'Department required' } });
    }
    const aliases = getDepartmentAliases(department);
    const { rows } = await query(
      `SELECT id, task_title, description_hint, required_job_titles
       FROM dept_task_templates
       WHERE department = ANY($1::text[]) AND is_active = true
       ORDER BY task_title ASC`,
      [aliases]
    );
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        task_title: r.task_title,
        description_hint: r.description_hint || null,
        required_job_titles: r.required_job_titles || [],
      })),
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /tasks/workload?userIds=uuid1,uuid2,...&month=YYYY-MM
 * Returns per-user task counts and workload level for assignable employees.
 */
router.get('/workload', async (req, res, next) => {
  try {
    console.log('=== WORKLOAD DEBUG ===');
    // Parse userIds: may arrive as string "uuid1,uuid2", single string "uuid", or array (e.g. from ?userIds=a&userIds=b)
    const rawParam = req.query.userIds;
    const rawStr =
      Array.isArray(rawParam)
        ? rawParam.join(',')
        : rawParam != null && rawParam !== ''
          ? String(rawParam).trim()
          : '';
    const userIds = rawStr ? rawStr.split(',').map((id) => String(id).trim()).filter(Boolean) : [];
    const cleanUserIds = userIds
      .map((id) => normalizeUUID(id))
      .filter((id) => id && id !== 'undefined' && id !== 'null' && id.length === 36);
    console.log('[Workload] 1. Raw userIds param:', rawParam);
    console.log('[Workload] 2. Parsed userIds:', userIds);
    console.log('[Workload] 3. Clean userIds (valid UUIDs):', cleanUserIds);
    console.log('[Workload] 4. Count:', cleanUserIds.length);
    if (cleanUserIds.length === 0) {
      console.log('[Workload] 5. EMPTY userIds - returning empty array');
      return res.json({ data: [], error: null });
    }

    const monthParam = (req.query.month ?? '').toString().trim();
    let monthStr =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    console.log('[Workload] 6. month param:', req.query.month, '->', monthStr);
    const [y, m] = monthStr.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { rows: profileRows } = await query(
      `SELECT id, user_id FROM profiles WHERE user_id = ANY($1::uuid[])`,
      [cleanUserIds]
    );
    const profileByUserId = new Map(profileRows.map((r) => [r.user_id, r.id]));
    const profileIds = profileRows.map((r) => r.id);
    console.log('[Workload] 7. Profiles found:', profileRows.map((r) => ({ user_id: r.user_id, profile_id: r.id })));
    console.log('[Workload] 8. Users NOT found (no profile):', cleanUserIds.filter((id) => !profileByUserId.get(id)));
    if (profileIds.length === 0) {
      console.log('[Workload] 9. No profiles - returning zeros for all requested users');
      return res.json({
        data: cleanUserIds.map((uid) => ({
          user_id: uid,
          profile_id: null,
          pending_count: 0,
          in_progress_count: 0,
          overdue_count: 0,
          due_this_week_count: 0,
          active_count: 0,
          workload_level: 'light',
          tasks_this_month: [],
          hours_booked_today: 0,
          hours_booked_this_week: 0,
        })),
        error: null,
      });
    }

    const taskAssignees = await query(
      `SELECT ta.task_id, ta.profile_id, p.user_id
       FROM task_assignees ta
       JOIN profiles p ON p.id = ta.profile_id
       WHERE ta.profile_id = ANY($1::uuid[])`,
      [profileIds]
    );

    // tasks.assigned_to = profile.id (not user id); use profileIds for both conditions
    const allTasksResult = await query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.task_date, t.duration_hours, t.assigned_to, t.created_at
       FROM tasks t
       WHERE (t.is_deleted = false OR t.is_deleted IS NULL)
       AND (
         t.assigned_to = ANY($1::uuid[])
         OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.profile_id = ANY($1::uuid[]))
       )`,
      [profileIds]
    );
    const allTasksForProfiles = allTasksResult.rows;
    console.log('[Workload] 10. RAW tasks found:', allTasksForProfiles.length);
    console.log('[Workload] 11. RAW tasks sample:', JSON.stringify(allTasksForProfiles.slice(0, 3).map((t) => ({ id: t.id, title: t.title, status: t.status, assigned_to: t.assigned_to })), null, 2));
    console.log('[Workload] 12. Distinct statuses:', [...new Set(allTasksForProfiles.map((t) => (t.status || '').toLowerCase()))]);

    const tasksByProfile = new Map();
    for (const t of allTasksForProfiles) {
      const profilesForTask = new Set();
      if (t.assigned_to) profilesForTask.add(t.assigned_to);
      for (const ta of taskAssignees.rows) {
        if (ta.task_id === t.id) profilesForTask.add(ta.profile_id);
      }
      for (const pid of profilesForTask) {
        if (!profileIds.includes(pid)) continue;
        if (!tasksByProfile.has(pid)) tasksByProfile.set(pid, []);
        tasksByProfile.get(pid).push(t);
      }
    }

    console.log('[Workload] 13. Per-user task count:', JSON.stringify(
      cleanUserIds.map((uid) => {
        const profileId = profileByUserId.get(uid);
        const tasks = profileId ? tasksByProfile.get(profileId) || [] : [];
        return { user_id: uid, profile_id: profileId, task_count: tasks.length };
      }),
      null,
      2
    ));
    console.log('[Workload] 14. User IDs with 0 tasks:', cleanUserIds.filter((uid) => {
      const profileId = profileByUserId.get(uid);
      const tasks = profileId ? tasksByProfile.get(profileId) || [] : [];
      return tasks.length === 0;
    }));

    const weekStart = new Date(monthStart);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const result = [];

    for (const uid of cleanUserIds) {
      const profileId = profileByUserId.get(uid);
      const tasks = profileId ? tasksByProfile.get(profileId) || [] : [];
      const activeTasksOnly = tasks.filter(
        (t) => !['completed', 'done', 'approved'].includes((t.status || '').toLowerCase())
      );
      const pending = activeTasksOnly.filter((x) => (x.status || '').toLowerCase() === 'pending').length;
      const inProgress = activeTasksOnly.filter((x) => (x.status || '').toLowerCase() === 'in_progress').length;
      const active_count = activeTasksOnly.length;
      const now = new Date();
      const overdue_count = activeTasksOnly.filter((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        return due && due < now;
      }).length;
      const due_this_week_count = activeTasksOnly.filter((t) => {
        const due = t.due_date ? new Date(t.due_date) : null;
        return due && due >= weekStart && due <= weekEnd;
      }).length;

      const activeTasks = activeTasksOnly;
      let hours_booked_today = 0;
      let hours_booked_this_week = 0;
      for (const t of activeTasks) {
        const dayVal = t.task_date || t.due_date;
        const td = dayVal ? new Date(dayVal) : null;
        if (!td) continue;
        const dOnly = new Date(td.getFullYear(), td.getMonth(), td.getDate());
        const hours = t.duration_hours != null ? Number(t.duration_hours) : 1;
        if (dOnly >= todayStart && dOnly < todayEnd) hours_booked_today += hours;
        if (dOnly >= weekStart && dOnly <= weekEnd) hours_booked_this_week += hours;
      }

      let workload_level = 'light';
      if (active_count > 5) workload_level = 'heavy';
      else if (active_count > 2) workload_level = 'moderate';

      const tasks_this_month = activeTasksOnly
        .filter((t) => {
          const taskDay = t.task_date ? new Date(t.task_date) : null;
          const due = t.due_date ? new Date(t.due_date) : null;
          const inMonth = (d) => d && d >= monthStart && d <= monthEnd;
          return inMonth(taskDay || due);
        })
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          task_date: t.task_date || t.due_date,
          duration_hours: t.duration_hours != null ? Number(t.duration_hours) : null,
        }))
        .sort((a, b) => {
          const ad = (a.task_date || a.due_date) ? new Date(a.task_date || a.due_date).getTime() : 0;
          const bd = (b.task_date || b.due_date) ? new Date(b.task_date || b.due_date).getTime() : 0;
          if (ad !== bd) return ad - bd;
          return String(a.title || '').localeCompare(String(b.title || ''));
        });

      result.push({
        user_id: uid,
        profile_id: profileId || null,
        pending_count: pending,
        in_progress_count: inProgress,
        overdue_count: overdue_count,
        due_this_week_count: due_this_week_count,
        active_count: active_count,
        workload_level,
        tasks_this_month,
        hours_booked_today: Math.round(hours_booked_today * 100) / 100,
        hours_booked_this_week: Math.round(hours_booked_this_week * 100) / 100,
      });
    }

    console.log('[Workload] 15. FINAL response summary:', JSON.stringify(result.map((r) => ({ user_id: r.user_id, active_count: r.active_count, tasks_this_month_len: (r.tasks_this_month || []).length })), null, 2));
    console.log('=== END WORKLOAD DEBUG ===');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ data: result, error: null });
  } catch (err) {
    console.error('[Workload] ERROR:', err.message, err.code, err.detail);
    next(err);
  }
});

/**
 * POST /tasks/check-overlap
 * Legacy: time-range overlap removed (no start/end on tasks). Always returns no conflicts.
 */
router.post('/check-overlap', async (req, res) => {
  res.json({ data: { conflicts: [] }, error: null });
});

/**
 * GET /tasks/next-due-by-assignees?profileIds=uuid,uuid
 * Earliest active task by due_date per assignee (profile id).
 */
router.get('/next-due-by-assignees', async (req, res, next) => {
  try {
    const raw = req.query.profileIds != null ? String(req.query.profileIds) : '';
    const profileIds = raw
      .split(',')
      .map((id) => normalizeUUID(id.trim()))
      .filter((id) => id && id.length === 36);
    if (profileIds.length === 0) {
      return res.json({ data: {}, error: null });
    }
    const { rows } = await query(
      `SELECT DISTINCT ON (t.assigned_to)
         t.assigned_to AS profile_id,
         t.title,
         t.due_date,
         t.duration_hours
       FROM tasks t
       WHERE t.assigned_to = ANY($1::uuid[])
         AND (t.is_deleted = false OR t.is_deleted IS NULL)
         AND LOWER(COALESCE(t.status, '')) NOT IN ('completed', 'done', 'approved')
         AND t.due_date IS NOT NULL
       ORDER BY t.assigned_to, t.due_date ASC`,
      [profileIds]
    );
    const data = {};
    for (const r of rows) {
      data[r.profile_id] = {
        title: r.title,
        due_date: r.due_date,
        duration_hours: r.duration_hours != null ? Number(r.duration_hours) : null,
      };
    }
    res.json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * Map template department names to profile department values (for assignee lookup).
 */
const DEPT_MAPPING = {
  HR: ['HR', 'Human Resource', 'Human Resources'],
  'Data&Ai': ['Data&Ai', 'Data & AI', 'Data and AI', 'AI'],
  'IT Help Desk': ['IT Help Desk', 'IT Helpdesk', 'IT Support'],
  Cybersecurity: ['Cybersecurity', 'Cyber Security', 'Security'],
  Organization: ['Organization', 'Operations'],
};

/**
 * GET /tasks/assignees?department=X&jobTitles=Y,Z&isCustom=true|false
 * Senior-manager dept task assignees grouped by external_role.
 */
router.get('/assignees', async (req, res, next) => {
  try {
    const department = (req.query.department || '').toString().trim();
    if (!department) {
      return res.status(400).json({ data: null, error: { message: 'department required' } });
    }
    const mappedDepts = DEPT_MAPPING[department] || [department];
    let jobTitles = req.query.jobTitles;
    if (typeof jobTitles === 'string') jobTitles = jobTitles ? jobTitles.split(',').map((s) => s.trim()).filter(Boolean) : null;
    if (Array.isArray(jobTitles)) jobTitles = jobTitles.map((s) => String(s).trim()).filter(Boolean);
    const isCustom = String(req.query.isCustom || 'false').trim().toLowerCase() === 'true';
    const taskTitle = (req.query.taskTitle || '').toString().trim();
    const currentUserId = normalizeUUID(req.userId);

    if (process.env.NODE_ENV === 'development') {
      console.log('[Assignees] dept:', department);
      console.log('[Assignees] mapped to:', mappedDepts);
    }

    const { rows } = await query(
      `SELECT
         p.id,
         p.user_id,
         p.full_name,
         p.job_title,
         p.avatar_url,
         p.employee_code,
         p.department,
         LOWER(TRIM(COALESCE(u.external_role, COALESCE(p.external_role, 'employee')))) AS external_role,
         COALESCE(p.assigned_task_template_ids, '{}') AS assigned_task_template_ids,
         COALESCE((
           SELECT SUM(COALESCE(tsm.weight, 1.0) * (COALESCE(s.proficiency_level, 0)::numeric / 100.0))
           FROM skills s
           JOIN task_skill_mappings tsm
             ON LOWER(TRIM(tsm.skill_name)) = LOWER(TRIM(s.name))
           WHERE s.user_id = p.user_id
             AND $5::text IS NOT NULL
             AND LOWER(TRIM(tsm.department)) = LOWER(TRIM($1::text))
             AND LOWER(TRIM(tsm.task_title)) = LOWER(TRIM($5::text))
         ), 0)::numeric(8,3) AS fit_score,
         COALESCE((
           SELECT COUNT(*)
           FROM skills s
           JOIN task_skill_mappings tsm
             ON LOWER(TRIM(tsm.skill_name)) = LOWER(TRIM(s.name))
           WHERE s.user_id = p.user_id
             AND $5::text IS NOT NULL
             AND LOWER(TRIM(tsm.department)) = LOWER(TRIM($1::text))
             AND LOWER(TRIM(tsm.task_title)) = LOWER(TRIM($5::text))
         ), 0)::int AS matched_skills
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.department = ANY($1::text[])
       AND LOWER(TRIM(COALESCE(p.status, ''))) != 'inactive'
       AND LOWER(TRIM(COALESCE(u.external_role, COALESCE(p.external_role, 'employee')))) IN ('employee', 'manager', 'subadmin')
       AND u.id != $2
       AND (
         $3::boolean = true
         OR LOWER(TRIM(COALESCE(u.external_role, COALESCE(p.external_role, 'employee')))) IN ('manager', 'subadmin')
         OR $4::text[] IS NULL
         OR p.job_title = ANY($4::text[])
       )
       ORDER BY
         CASE LOWER(TRIM(COALESCE(u.external_role, COALESCE(p.external_role, 'employee'))))
           WHEN 'subadmin' THEN 1
           WHEN 'manager' THEN 2
           ELSE 3
         END,
         fit_score DESC,
         matched_skills DESC,
         p.full_name ASC`,
      [mappedDepts, currentUserId, isCustom, jobTitles && jobTitles.length ? jobTitles : null, taskTitle || null]
    );

    if (process.env.NODE_ENV === 'development') {
      console.log('[Assignees] found:', rows.length);
    }

    const grouped = {};
    for (const r of rows) {
      const key =
        r.external_role === 'subadmin'
          ? 'Senior Manager'
          : r.external_role === 'manager'
            ? 'Manager'
            : 'Employee';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        id: r.id,
        user_id: r.user_id,
        full_name: r.full_name,
        job_title: r.job_title,
        avatar_url: r.avatar_url,
        employee_code: r.employee_code,
        department: r.department,
        external_role: r.external_role,
        assigned_task_template_ids: Array.isArray(r.assigned_task_template_ids)
          ? r.assigned_task_template_ids
          : [],
        fit_score: r.fit_score != null ? Number(r.fit_score) : 0,
        matched_skills: r.matched_skills != null ? Number(r.matched_skills) : 0,
        fit_label:
          Number(r.fit_score) >= 1.5 ? 'best_fit'
            : Number(r.fit_score) >= 0.7 ? 'good_fit'
              : Number(r.fit_score) > 0 ? 'possible_fit'
                : 'no_match',
      });
    }
    res.json({ data: grouped, error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /tasks/dept-task
 * Subadmin only. Create department-based task(s). Individual = one task per assignee; shared = one task + task_assignees.
 */
router.post('/dept-task', async (req, res, next) => {
  console.log('[DeptTask] ===== REQUEST =====');
  console.log('[DeptTask] body:', JSON.stringify(req.body, null, 2));
  console.log('[DeptTask] user:', {
    id: req.user?.userId ?? req.userId ?? req.user?.id,
    role: req.user?.role,
    external_role: req.profile?.external_role ?? req.user?.external_role,
  });

  try {
    if (!isSubadmin(req)) {
      return res.status(403).json({
        data: null,
        error: { message: 'Only senior managers can use this endpoint' },
      });
    }

    const {
      department,
      template_id,
      task_title,
      title,
      description,
      priority,
      due_date,
      assignee_ids,
      task_mode,
      taskMode,
      attachments,
      task_date: bodyTaskDate,
      duration_hours: bodyDurationHours,
    } = req.body || {};

    const finalTitle = (task_title ?? title ?? '').toString().trim();
    const rawAssignees = Array.isArray(assignee_ids) ? assignee_ids : Array.isArray(req.body?.assigneeIds) ? req.body.assigneeIds : [];
    const finalMode = task_mode === 'shared' || taskMode === 'shared' ? 'shared' : 'individual';

    if (!department || typeof department !== 'string' || !department.trim()) {
      return res.status(400).json({ data: null, error: { message: 'department required' } });
    }
    if (!finalTitle) {
      return res.status(400).json({ data: null, error: { message: 'task_title required' } });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ data: null, error: { message: 'description required' } });
    }
    const assigneeIds = rawAssignees.map((id) => (typeof id === 'string' ? id : id?.id ?? id)).map((id) => normalizeUUID(id)).filter(Boolean);
    if (assigneeIds.length === 0) {
      return res.status(400).json({ data: null, error: { message: 'assignee_ids must have at least one' } });
    }
    const dueDate = due_date ? String(due_date).trim() : null;
    if (dueDate) {
      const d = new Date(dueDate);
      if (Number.isNaN(d.getTime()) || d <= new Date()) {
        return res.status(400).json({ data: null, error: { message: 'due_date must be a future date' } });
      }
    }
    const mode = finalMode;
    const prio = ['high', 'medium', 'low'].includes(String(priority)) ? priority : 'medium';
    const creatorProfileId = normalizeUUID(req.profileId);
    const durationRaw = bodyDurationHours ?? req.body?.durationHours ?? null;
    let taskDateSlot = bodyTaskDate != null && String(bodyTaskDate).trim() !== '' ? String(bodyTaskDate).trim().slice(0, 10) : null;
    let durationHoursSlot = parseDurationHours(durationRaw);
    if (durationHoursSlot != null && Number.isFinite(durationHoursSlot) && durationHoursSlot > 0) {
      if (!taskDateSlot && dueDate) taskDateSlot = String(dueDate).slice(0, 10);
    } else {
      durationHoursSlot = null;
      taskDateSlot = null;
    }
    console.log('[CreateTask BE] effort fields:', {
      task_date: taskDateSlot,
      duration_hours: durationHoursSlot,
      duration_raw: durationRaw,
    });
    if (!creatorProfileId) {
      return res.status(403).json({ data: null, error: { message: 'Profile not found' } });
    }
    const templateId = template_id ? normalizeUUID(template_id) : null;

    console.log('[DeptTask] parsed values:', {
      finalTitle,
      department: department?.trim(),
      finalAssignees: assigneeIds.length,
      finalMode: mode,
      finalTemplateId: templateId,
      creatorProfileId,
      priority: prio,
      due_date: dueDate,
    });

    const created = [];
    if (mode === 'individual') {
      const pool = (await import('../config/database.js')).default;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const assigneeId of assigneeIds) {
          const { rows: profileRows } = await client.query(
            'SELECT id FROM profiles WHERE id = $1',
            [assigneeId]
          );
          if (!profileRows.length) {
            throw new Error(`Assignee profile not found: ${assigneeId}`);
          }
          try {
            const { rows: ins } = await client.query(
              `INSERT INTO tasks (title, description, priority, due_date, department, template_id, assigned_by, assigned_to, status, task_type, task_date, duration_hours)
               VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8, 'pending', 'separate_task', $9::date, $10)
               RETURNING id, title, assigned_to`,
              [
                finalTitle,
                description.trim(),
                prio,
                dueDate,
                department.trim(),
                templateId,
                creatorProfileId,
                assigneeId,
                taskDateSlot,
                durationHoursSlot,
              ]
            );
            created.push(ins[0]);
          } catch (insertErr) {
            console.error('[DeptTask] ===== ERROR =====');
            console.error('[DeptTask] message:', insertErr.message);
            console.error('[DeptTask] code:', insertErr.code);
            console.error('[DeptTask] detail:', insertErr.detail);
            console.error('[DeptTask] column:', insertErr.column);
            console.error('[DeptTask] table:', insertErr.table);
            console.error('[DeptTask] query:', insertErr.query);
            console.error('[DeptTask] full:', insertErr);
            await client.query('ROLLBACK').catch(() => {});
            return res.status(500).json({
              data: null,
              error: {
                message: 'Failed to create task',
                detail: insertErr.message,
                code: insertErr.code,
                column: insertErr.column,
              },
            });
          }
        }
        await client.query('COMMIT');
        const createdByUserId = normalizeUUID(req.userId);
        for (const createdTask of created) {
          const { rows: assigneeRows } = await query(
            'SELECT user_id FROM profiles WHERE id = $1 LIMIT 1',
            [createdTask.assigned_to]
          );
          const assignedToUserId = assigneeRows[0]?.user_id;
          if (assignedToUserId && assignedToUserId !== createdByUserId) {
            await sendPushToUser(assignedToUserId, {
              title: 'New task assigned',
              body: `"${finalTitle}" has been assigned to you`,
              link: '/tasks',
            });
          }
        }
        res.status(201).json({ data: { created: created.length, tasks: created }, error: null });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    } else {
      const assigneeId = assigneeIds[0];
      const { rows: profileRows } = await query('SELECT id FROM profiles WHERE id = $1', [assigneeId]);
      if (!profileRows.length) {
        return res.status(400).json({ data: null, error: { message: 'Assignee profile not found' } });
      }
      try {
        const { rows: ins } = await query(
          `INSERT INTO tasks (title, description, priority, due_date, department, template_id, assigned_by, assigned_to, status, task_type, task_date, duration_hours)
           VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8, 'pending', 'separate_task', $9::date, $10)
           RETURNING id, title, assigned_to`,
          [
            finalTitle,
            description.trim(),
            prio,
            dueDate,
            department.trim(),
            templateId,
            creatorProfileId,
            assigneeId,
            taskDateSlot,
            durationHoursSlot,
          ]
        );
        const taskId = ins[0].id;
        for (const pid of assigneeIds) {
          await query(
            'INSERT INTO task_assignees (task_id, profile_id) VALUES ($1, $2) ON CONFLICT (task_id, profile_id) DO NOTHING',
            [taskId, pid]
          );
        }
        const createdByUserId = normalizeUUID(req.userId);
        for (const pid of assigneeIds) {
          const { rows: assigneeRows } = await query(
            'SELECT user_id FROM profiles WHERE id = $1 LIMIT 1',
            [pid]
          );
          const assignedToUserId = assigneeRows[0]?.user_id;
          if (assignedToUserId && assignedToUserId !== createdByUserId) {
            await sendPushToUser(assignedToUserId, {
              title: 'New task assigned',
              body: `"${finalTitle}" has been assigned to you`,
              link: '/tasks',
            });
          }
        }
        created.push(ins[0]);
        res.status(201).json({ data: { created: 1, tasks: created }, error: null });
      } catch (insertErr) {
        console.error('[DeptTask] ===== ERROR =====');
        console.error('[DeptTask] message:', insertErr.message);
        console.error('[DeptTask] code:', insertErr.code);
        console.error('[DeptTask] detail:', insertErr.detail);
        console.error('[DeptTask] column:', insertErr.column);
        console.error('[DeptTask] table:', insertErr.table);
        console.error('[DeptTask] query:', insertErr.query);
        console.error('[DeptTask] full:', insertErr);
        return res.status(500).json({
          data: null,
          error: {
            message: 'Failed to create task',
            detail: insertErr.message,
            code: insertErr.code,
            column: insertErr.column,
          },
        });
      }
    }
  } catch (err) {
    console.error('[DeptTask] ===== ERROR =====');
    console.error('[DeptTask] message:', err.message);
    console.error('[DeptTask] code:', err.code);
    console.error('[DeptTask] detail:', err.detail);
    console.error('[DeptTask] column:', err.column);
    console.error('[DeptTask] table:', err.table);
    console.error('[DeptTask] query:', err.query);
    console.error('[DeptTask] full:', err);
    return res.status(500).json({
      data: null,
      error: {
        message: 'Failed to create task',
        detail: err.message,
        code: err.code,
        column: err.column,
      },
    });
  }
});

export default router;
