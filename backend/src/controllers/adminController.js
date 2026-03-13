import { query, getPool } from '../config/database.js';
import * as authService from '../services/authService.js';

const ALL_TABLES = [
  'file_storage', 'task_tag_assignments', 'task_tags', 'task_dependencies',
  'task_comments', 'task_evidence', 'task_activity_logs', 'timesheets',
  'leaves', 'leave_balances', 'leave_types', 'attendance', 'audit_views',
  'booking_audit_log', 'room_bookings', 'meeting_rooms', 'scheduled_notifications',
  'push_subscriptions', 'notifications', 'skills', 'performance_metrics',
  'metric_categories', 'contributions', 'tasks', 'project_members', 'projects',
  'teams', 'request_trail', 'requests', 'user_roles', 'profiles', 'users',
];

/**
 * POST /admin/action
 * Body: { action, ... }. Actions: get-all-employees, get-managers, get-employee, update-employee, assign-role, reset-password
 */
export async function action(req, res, next) {
  try {
    const { action } = req.body || {};
    if (!action) {
      return res.status(400).json({ error: 'Missing action' });
    }

    if (action === 'get-all-employees') {
      const { rows: profiles } = await query(
        'SELECT * FROM profiles ORDER BY created_at DESC',
        []
      );
      const { rows: roles } = await query('SELECT user_id, role FROM user_roles', []);
      const rolesMap = new Map();
      roles.forEach((r) => {
        if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
        rolesMap.get(r.user_id).push({ role: r.role });
      });
      const employees = profiles.map((p) => ({
        ...p,
        user_roles: rolesMap.get(p.user_id) || null,
      }));
      return res.json({ data: { employees } });
    }

    if (action === 'get-managers') {
      const { role: roleFilter, exclude_profile_id: excludeProfileId } = req.body || {};
      let managers;
      if (roleFilter === 'manager' && excludeProfileId) {
        const { rows } = await query(
          `SELECT p.id, p.full_name, p.job_title, p.user_id
           FROM profiles p
           INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'manager'
           WHERE p.id != $1
           ORDER BY p.full_name`,
          [excludeProfileId]
        );
        managers = rows;
      } else {
        const { rows } = await query(
          'SELECT id, full_name, job_title, user_id FROM profiles ORDER BY full_name',
          []
        );
        managers = rows;
      }
      return res.json({ data: { managers } });
    }

    if (action === 'get-employee') {
      const { employee_profile_id } = req.body;
      if (!employee_profile_id) return res.status(400).json({ error: 'Missing employee_profile_id' });
      const { rows: profileRows } = await query('SELECT * FROM profiles WHERE id = $1', [employee_profile_id]);
      const profile = profileRows[0];
      if (!profile) return res.status(404).json({ error: 'Employee not found' });
      const { rows: userRoles } = await query('SELECT role FROM user_roles WHERE user_id = $1', [profile.user_id]);
      let manager_name = null;
      if (profile.manager_id) {
        const { rows: mgr } = await query('SELECT full_name FROM profiles WHERE id = $1', [profile.manager_id]);
        manager_name = mgr[0]?.full_name ?? null;
      }
      return res.json({
        data: { employee: { ...profile, user_roles: userRoles || [], manager_name } },
      });
    }

    if (action === 'update-employee') {
      const { employee_profile_id, updates } = req.body;
      if (!employee_profile_id || !updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Missing employee_profile_id or updates' });
      }
      if (updates.manager_id && updates.manager_id === employee_profile_id) {
        return res.status(400).json({ error: 'An employee cannot be their own manager' });
      }
      if (updates.manager_id) {
        let current = updates.manager_id;
        const visited = new Set([employee_profile_id]);
        while (current) {
          if (visited.has(current)) {
            return res.status(400).json({ error: 'Circular reporting structure detected' });
          }
          visited.add(current);
          const { rows } = await query('SELECT manager_id FROM profiles WHERE id = $1', [current]);
          current = rows[0]?.manager_id ?? null;
        }
      }
      const allowed = ['job_title', 'department', 'location', 'manager_id', 'team_id'];
      const setClauses = [];
      const values = [];
      let i = 1;
      for (const key of allowed) {
        if (updates[key] === undefined) continue;
        setClauses.push(`${key} = $${i}`);
        values.push(updates[key]);
        i++;
      }
      if (setClauses.length === 0) return res.status(400).json({ error: 'No updates' });
      values.push(employee_profile_id);
      await query(
        `UPDATE profiles SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${i}`,
        values
      );
      return res.json({ data: { message: 'Employee updated successfully' } });
    }

    if (action === 'assign-role') {
      const { user_id, role } = req.body;
      if (!user_id || !role) return res.status(400).json({ error: 'Missing user_id or role' });
      const valid = ['employee', 'team_lead', 'manager', 'hr', 'admin', 'organization'];
      if (!valid.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      await query('DELETE FROM user_roles WHERE user_id = $1', [user_id]);
      await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [user_id, role]);
      return res.json({ data: { message: 'Role assigned successfully' } });
    }

    if (action === 'reset-password') {
      const { user_id, new_password } = req.body;
      if (!user_id || !new_password) return res.status(400).json({ error: 'Missing user_id or new_password' });
      if (new_password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      if (!/[A-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
        return res.status(400).json({ error: 'Password must contain at least one uppercase letter and one number' });
      }
      await authService.updatePassword(user_id, new_password);
      return res.json({ data: { message: 'Password reset successfully' } });
    }

    if (action === 'get-users-names') {
      const { userIds } = req.body || {};
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.json({ data: { names: {} } });
      }
      const unique = [...new Set(userIds)].filter(Boolean);
      if (unique.length === 0) return res.json({ data: { names: {} } });
      const placeholders = unique.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await query(
        `SELECT id, full_name FROM users WHERE id IN (${placeholders})`,
        unique
      );
      const names = {};
      rows.forEach((r) => { names[r.id] = r.full_name || ''; });
      return res.json({ data: { names } });
    }

    return res.status(400).json({ data: null, error: 'Invalid action' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/bulk-onboard
 * Body: { employees: [{ email, full_name, job_title?, department?, location?, manager_id?, role?, password? }] }
 */
export async function bulkOnboard(req, res, next) {
  try {
    const { employees } = req.body || {};
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'No employees provided' });
    }
    const success = [];
    const failed = [];
    for (const emp of employees) {
      try {
        await authService.createUserAsAdmin(
          emp.email,
          emp.password,
          emp.full_name,
          {
            job_title: emp.job_title,
            department: emp.department,
            location: emp.location,
            manager_id: emp.manager_id,
            role: emp.role,
          }
        );
        success.push(emp.email);
      } catch (e) {
        failed.push({ email: emp.email, error: e.message || String(e) });
      }
    }
    return res.json({
      data: {
        message: `Successfully onboarded ${success.length} employees`,
        success,
        failed,
      },
    });
  } catch (err) {
    next(err);
  }
}

const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * POST /admin/api-fetch
 * Proxy to fetch external API (avoids CORS). Body: { url, method?, headers? }
 */
export async function apiFetch(req, res, next) {
  try {
    const { url, method = 'GET', headers: customHeaders = {} } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url' });
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
    }
    const allowedMethod = VALID_HTTP_METHODS.includes(String(method).toUpperCase())
      ? String(method).toUpperCase()
      : 'GET';
    const headers = { 'Accept': 'application/json', ...customHeaders };
    const fetchOpts = { method: allowedMethod, headers };
    const response = await fetch(url, fetchOpts);
    const text = await response.text();
    let data = text;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch {
        // leave as text
      }
    }
    return res.json({
      data: { body: data, status: response.status, ok: response.ok },
    });
  } catch (err) {
    next(err);
  }
}

const VALID_ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin', 'organization'];

/**
 * Resolve reporting manager **employee code** to profile id for manager_id.
 * reportingManagerId from API is an employee CODE string (e.g. "EMP-2026-0004"), not a UUID.
 * We look up the corresponding profile by profiles.employee_code. If not found, return null.
 */
async function resolveManagerProfileIdFromCode(reportingManagerCode) {
  if (!reportingManagerCode || typeof reportingManagerCode !== 'string') return null;
  const trimmed = reportingManagerCode.trim();
  if (!trimmed) return null;
  try {
    const { rows } = await query('SELECT id FROM profiles WHERE employee_code = $1 LIMIT 1', [trimmed]);
    return rows[0]?.id ?? null;
  } catch (_) {
    return null;
  }
}

/** Normalize date to YYYY-MM-DD for DATE column. */
function normalizeDateOfJoining(value) {
  if (value == null || value === '') return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch (_) {
    return null;
  }
}

/**
 * POST /admin/import-employees-from-api
 * Body: { employees: [{
 *   email, full_name,
 *   employee_code?, job_title?, department?, location?,
 *   employment_type?, // raw: full_time | part_time | contract
 *   reporting_manager_name?, reporting_manager_code?,
 *   external_role?, external_sub_role?,
 *   default_password?, date_of_joining?
 * }], onConflict?: 'skip' | 'overwrite' }
 * If onConflict not set and any email exists: returns { conflict: true, existingEmails, existingCount } (no DB write).
 * If onConflict 'skip': create only new users; return { created, skipped, failed }.
 * If onConflict 'overwrite': create new, update existing profiles; return { created, updated, failed }.
 * default_password is hashed before saving (never stored plain).
 */
export async function importEmployeesFromApi(req, res, next) {
  try {
    const { employees: inputEmployees, onConflict } = req.body || {};
    if (!inputEmployees || !Array.isArray(inputEmployees) || inputEmployees.length === 0) {
      return res.status(400).json({ error: 'No employees provided' });
    }

    // Ensure optional columns exist (idempotent)
    try {
      await query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_code TEXT', []);
      await query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_type TEXT', []);
      await query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS external_role TEXT', []);
      await query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS external_sub_role TEXT', []);
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS external_role TEXT', []);
      await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS external_sub_role TEXT', []);
    } catch (alterErr) {
      console.warn('[Import] Ensure columns:', alterErr.message);
    }

    const normalized = inputEmployees
      .map((e) => ({
        email: (e.email && String(e.email).trim()) || null,
        full_name: (e.full_name != null && String(e.full_name).trim()) || (e.name && String(e.name).trim()) || '',
        job_title: e.job_title != null ? String(e.job_title).trim() : null,
        department: e.department != null ? String(e.department).trim() : null,
        location: e.location != null ? String(e.location).trim() : null,
        // App role is managed separately; treat imported employees as regular employees by default.
        role: 'employee',
        employee_code: e.employee_code != null ? String(e.employee_code).trim() : null,
        employment_type: e.employment_type != null ? String(e.employment_type).trim() : null,
        reporting_manager_name: e.reporting_manager_name != null ? String(e.reporting_manager_name).trim() : null,
        reporting_manager_code: e.reporting_manager_code != null ? String(e.reporting_manager_code).trim() : null,
        external_role: e.external_role != null ? String(e.external_role).trim() : null,
        external_sub_role: e.external_sub_role != null ? String(e.external_sub_role).trim() : null,
        default_password: e.default_password != null ? String(e.default_password) : undefined,
        date_of_joining: normalizeDateOfJoining(e.date_of_joining) ?? e.date_of_joining ?? null,
      }))
      .filter((e) => e.email);

    if (normalized.length === 0) {
      return res.status(400).json({ error: 'No valid employees (email required)' });
    }

    const emails = normalized.map((e) => e.email);
    const { rows: existingRows } = await query(
      'SELECT u.email FROM users u WHERE u.email = ANY($1)',
      [emails]
    );
    const existingEmails = new Set(existingRows.map((r) => r.email));

    if (existingEmails.size > 0 && !onConflict) {
      return res.json({
        data: {
          conflict: true,
          existingEmails: [...existingEmails],
          existingCount: existingEmails.size,
          totalInRequest: normalized.length,
        },
      });
    }

    const created = [];
    const updatedList = [];
    const skippedList = [];
    const failed = [];

    for (const emp of normalized) {
      try {
        if (existingEmails.has(emp.email)) {
          if (onConflict === 'skip') {
            skippedList.push(emp.email);
            continue;
          }
          if (onConflict === 'overwrite') {
            const { rows: userRows } = await query('SELECT id FROM users WHERE email = $1', [emp.email]);
            const userId = userRows[0]?.id;
            if (!userId) {
              failed.push({ email: emp.email, error: 'User not found' });
              continue;
            }
            const { rows: profileRows } = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
            const profileId = profileRows[0]?.id;
            if (!profileId) {
              failed.push({ email: emp.email, error: 'Profile not found' });
              continue;
            }
            const managerProfileId = await resolveManagerProfileIdFromCode(emp.reporting_manager_code);
            const joiningDate = normalizeDateOfJoining(emp.date_of_joining) ?? emp.date_of_joining;
            await query(
              `UPDATE profiles SET full_name = COALESCE($1, full_name), job_title = COALESCE($2, job_title),
               department = COALESCE($3, department), location = COALESCE($4, location),
               employee_code = COALESCE($5, employee_code), employment_type = COALESCE($6, employment_type),
               joining_date = COALESCE($7, joining_date), manager_id = COALESCE($8, manager_id),
               external_role = COALESCE($9, external_role), external_sub_role = COALESCE($10, external_sub_role),
               updated_at = now()
               WHERE id = $11`,
              [
                emp.full_name || null,
                emp.job_title,
                emp.department,
                emp.location,
                emp.employee_code,
                emp.employment_type,
                joiningDate,
                managerProfileId,
                emp.external_role || null,
                emp.external_sub_role || null,
                profileId,
              ]
            );
            // Persist external role/sub-role on users table for reference (optional mirror)
            await query(
              'UPDATE users SET external_role = COALESCE($1, external_role), external_sub_role = COALESCE($2, external_sub_role) WHERE id = $3',
              [emp.external_role || null, emp.external_sub_role || null, userId]
            );
            if (emp.default_password) {
              await authService.updatePassword(userId, emp.default_password);
            }
            await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
            await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, emp.role]);
            updatedList.push(emp.email);
            continue;
          }
        }

        const managerProfileId = await resolveManagerProfileIdFromCode(emp.reporting_manager_code);
        const passwordToUse = emp.default_password || undefined;
        const joiningDate = normalizeDateOfJoining(emp.date_of_joining) ?? emp.date_of_joining;

        console.log('[SaveEmployee] Inserting:', {
          email: emp.email,
          full_name: emp.full_name,
          employee_code: emp.employee_code ?? null,
          manager_id: managerProfileId ?? null,
          role: emp.role,
          password: emp.default_password ? '[PROVIDED]' : '[MISSING]',
          date_of_joining: joiningDate ?? null,
        });

        await authService.createUserAsAdmin(emp.email, passwordToUse, emp.full_name || emp.email.split('@')[0], {
          job_title: emp.job_title,
          department: emp.department,
          location: emp.location,
          role: emp.role,
          manager_id: managerProfileId,
          employee_code: emp.employee_code,
          employment_type: emp.employment_type,
          joining_date: joiningDate || null,
          external_role: emp.external_role,
          external_sub_role: emp.external_sub_role,
        });
        created.push(emp.email);
      } catch (e) {
        const errMsg = e.message || String(e);
        const errDetail = e.detail ?? e.code ?? '';
        console.error('[SaveEmployee] Failed:', {
          email: emp.email,
          full_name: emp.full_name,
          error: errMsg,
          code: e.code,
          detail: e.detail,
          column: e.column,
          table: e.table,
        });
        failed.push({ email: emp.email, error: errMsg + (errDetail ? ` (${errDetail})` : '') });
      }
    }

    return res.json({
      data: {
        conflict: false,
        created,
        updated: updatedList.length,
        skipped: skippedList.length,
        failed,
        failedDetails: failed,
        message: `Created ${created.length}, ${onConflict === 'overwrite' ? `updated ${updatedList.length}` : `skipped ${skippedList.length}`}, ${failed.length} failed`,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /admin/reset-database
 * Body: { confirmToken: "RESET_CONFIRMED" }
 * Clears all data, preserves super admin (first user with role='admin').
 */
export async function resetDatabase(req, res, next) {
  try {
    const { confirmToken } = req.body || {};
    if (confirmToken !== 'RESET_CONFIRMED') {
      return res.status(403).json({
        data: null,
        error: { message: 'Reset requires confirmToken: "RESET_CONFIRMED"' },
      });
    }

    console.warn('[DB RESET] Triggered by:', req.user?.email ?? 'unknown', new Date());

    const { rows: adminUsers } = await query(
      `SELECT u.* FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
       LIMIT 1`,
      []
    );
    const adminUser = adminUsers[0];
    if (!adminUser) {
      return res.status(400).json({
        data: null,
        error: { message: 'No admin user found. Cannot reset - no admin to preserve.' },
      });
    }

    const { rows: adminProfiles } = await query(
      'SELECT * FROM profiles WHERE user_id = $1',
      [adminUser.id]
    );
    const adminProfile = adminProfiles[0];
    if (!adminProfile) {
      return res.status(400).json({
        data: null,
        error: { message: 'Admin profile not found. Cannot reset.' },
      });
    }

    const { rows: adminRoles } = await query(
      'SELECT * FROM user_roles WHERE user_id = $1',
      [adminUser.id]
    );

    const pool = getPool();
    const client = await pool.connect();
    let tablesCleared = [];
    try {
      const { rows: tableRows } = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
      );
      const existingTables = tableRows.map((r) => r.table_name);
      tablesCleared = ALL_TABLES.filter((t) => existingTables.includes(t));

      await client.query('SET session_replication_role = replica');
      if (tablesCleared.length) {
        const tableList = tablesCleared.join(', ');
        await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
      }
      await client.query('SET session_replication_role = origin');

      const userCols = ['id', 'email', 'password_hash', 'full_name', 'created_at', 'updated_at'];
      const userVals = [
        adminUser.id,
        adminUser.email,
        adminUser.password_hash,
        adminUser.full_name || '',
        adminUser.created_at,
        adminUser.updated_at,
      ];
      if (adminUser.first_login !== undefined) {
        userCols.push('first_login');
        userVals.push(adminUser.first_login);
      }
      const userPlaceholders = userVals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO users (${userCols.join(', ')}) VALUES (${userPlaceholders})`,
        userVals
      );

      const profileCols = [
        'id', 'user_id', 'full_name', 'email', 'job_title', 'department', 'location',
        'phone', 'avatar_url', 'status', 'work_hours', 'linkedin_url', 'manager_id', 'team_id',
        'bio', 'resume_url', 'joining_date', 'other_social_links', 'working_status', 'profile_completed',
        'created_at', 'updated_at',
      ];
      const profileVals = [
        adminProfile.id, adminProfile.user_id, adminProfile.full_name, adminProfile.email,
        adminProfile.job_title, adminProfile.department, adminProfile.location, adminProfile.phone,
        adminProfile.avatar_url, adminProfile.status, adminProfile.work_hours, adminProfile.linkedin_url,
        null, null,
        adminProfile.bio, adminProfile.resume_url, adminProfile.joining_date,
        adminProfile.other_social_links ?? {}, adminProfile.working_status,
        adminProfile.profile_completed, adminProfile.created_at, adminProfile.updated_at,
      ];
      const { rows: profileColRows } = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'profiles'
         AND column_name IN ('employee_code', 'employment_type', 'external_role', 'external_sub_role')`
      );
      for (const r of profileColRows) {
        profileCols.push(r.column_name);
        profileVals.push(adminProfile[r.column_name] ?? null);
      }
      const placeholders = profileVals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO profiles (${profileCols.join(', ')}) VALUES (${placeholders})`,
        profileVals
      );

      for (const ur of adminRoles) {
        await client.query(
          'INSERT INTO user_roles (id, user_id, role, created_at) VALUES ($1, $2, $3, $4)',
          [ur.id, ur.user_id, ur.role, ur.created_at]
        );
      }
    } finally {
      client.release();
    }

    return res.json({
      data: {
        success: true,
        message: 'Database cleared successfully',
        preserved: 'admin user',
        tablesCleared,
        timestamp: new Date(),
      },
    });
  } catch (err) {
    console.error('[DB RESET] Error:', err);
    next(err);
  }
}
