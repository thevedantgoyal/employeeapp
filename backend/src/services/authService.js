import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { config } from '../config/index.js';

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signAccessToken(userId) {
  return jwt.sign(
    { userId, type: 'access' },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function signRefreshToken(userId) {
  return jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function getUserTypeFromProfile(profile) {
  const externalRole = (profile?.external_role || '').toString().trim().toLowerCase();
  const hasManager = !!profile?.manager_id;
  if (externalRole === 'subadmin' && !hasManager) return 'SENIOR_MANAGER';
  if (externalRole === 'manager' && hasManager) return 'MANAGER';
  return 'EMPLOYEE';
}

async function getPrimaryRoleByUserId(userId) {
  const { rows } = await query('SELECT role FROM user_roles WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
  return rows[0]?.role ?? 'employee';
}

/**
 * Sign up: create user, profile, default employee role.
 * Returns { user, profile, session } in same shape as Supabase where possible.
 */
export async function signUp(email, password, fullName) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('User already registered with this email');
    err.statusCode = 400;
    throw err;
  }
  const passwordHash = await hashPassword(password);
  const userId = uuidv4();
  const client = await (await import('../config/database.js')).default.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, first_login) VALUES ($1, $2, $3, $4, true)`,
      [userId, email, passwordHash, fullName || email.split('@')[0]]
    );
    const profileId = uuidv4();
    await client.query(
      `INSERT INTO profiles (id, user_id, full_name, email) VALUES ($1, $2, $3, $4)`,
      [profileId, userId, fullName || email.split('@')[0], email]
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'employee')`,
      [userId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  const user = { id: userId, email, first_login: true, user_metadata: { full_name: fullName } };
  const profile = await getProfileByUserId(userId);
  const role = await getPrimaryRoleByUserId(userId);
  const userType = getUserTypeFromProfile(profile);
  const accessToken = jwt.sign(
    {
      userId,
      type: 'access',
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
  const refreshToken = signRefreshToken(userId);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 604800,
    user: {
      id: userId,
      email,
      first_login: true,
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
  };
  return { user, profile, session };
}

/**
 * Set first_login = false after onboarding is complete.
 */
export async function setFirstLoginComplete(userId) {
  await query('UPDATE users SET first_login = false, updated_at = now() WHERE id = $1', [userId]);
  return true;
}

/**
 * Sign in with Microsoft Azure AD id_token.
 * Verifies token, matches email to existing user, returns app session. No new user creation.
 */
export async function signInWithMicrosoft(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Missing Microsoft id_token');
    err.statusCode = 400;
    throw err;
  }
  const { azure } = config;
  if (!azure?.clientId) {
    const err = new Error('Microsoft login is not configured');
    err.statusCode = 503;
    throw err;
  }
  const tenant = azure.tenantId || 'common';
  const jwksUri = `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`;
  const client = jwksClient({ jwksUri, cache: true, cacheMaxAge: 600000 });
  const getKey = (header, cb) => {
    client.getSigningKey(header.kid).then((key) => {
      const pub = key.getPublicKey();
      cb(null, pub);
    }).catch(cb);
  };
  const decoded = await new Promise((resolve, reject) => {
    const options = {
      algorithms: ['RS256'],
      audience: azure.clientId,
      ignoreExpiration: false,
    };
    if (tenant !== 'common') {
      options.issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
    }
    jwt.verify(idToken, getKey, options, (err, payload) => {
      if (err) reject(err);
      else resolve(payload);
    });
  });
  const email = (decoded.preferred_username || decoded.email || decoded.upn || '').toString().trim().toLowerCase();
  if (!email) {
    const err = new Error('Microsoft token did not contain an email');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await query(
    'SELECT id, email, full_name, COALESCE(first_login, false) AS first_login FROM users WHERE LOWER(email) = $1',
    [email]
  );
  if (!rows.length) {
    const err = new Error('No account found for this email. Please contact HR.');
    err.statusCode = 401;
    throw err;
  }
  const u = rows[0];
  const user = { id: u.id, email: u.email, first_login: !!u.first_login, user_metadata: { full_name: u.full_name } };
  const profile = await getProfileByUserId(u.id);
  const role = await getPrimaryRoleByUserId(u.id);
  const userType = getUserTypeFromProfile(profile);
  const accessToken = jwt.sign(
    {
      userId: u.id,
      type: 'access',
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
  const refreshToken = signRefreshToken(u.id);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 604800,
    user: {
      id: u.id,
      email: u.email,
      first_login: !!u.first_login,
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
  };
  return { user, profile, session };
}

/**
 * Sign in: validate credentials, return session.
 * Email is matched case-insensitively and trimmed.
 */
export async function signIn(email, password) {
  const emailTrimmed = (email && String(email).trim()) || '';
  const passwordStr = password != null ? String(password) : '';
  if (!emailTrimmed || !passwordStr) {
    const err = new Error('Invalid login credentials');
    err.statusCode = 400;
    throw err;
  }
  const { rows } = await query(
    'SELECT id, email, password_hash, full_name, COALESCE(first_login, false) AS first_login FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))',
    [emailTrimmed]
  );
  if (!rows.length) {
    const err = new Error('Invalid login credentials');
    err.statusCode = 400;
    throw err;
  }
  const u = rows[0];
  const valid = await comparePassword(password, u.password_hash);
  if (!valid) {
    const err = new Error('Invalid login credentials');
    err.statusCode = 400;
    throw err;
  }
  const user = { id: u.id, email: u.email, first_login: !!u.first_login, user_metadata: { full_name: u.full_name } };
  const profile = await getProfileByUserId(u.id);
  const role = await getPrimaryRoleByUserId(u.id);
  const userType = getUserTypeFromProfile(profile);
  const accessToken = jwt.sign(
    {
      userId: u.id,
      type: 'access',
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
  const refreshToken = signRefreshToken(u.id);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 604800,
    user: {
      id: u.id,
      email: u.email,
      first_login: !!u.first_login,
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
  };
  return { user, profile, session };
}

/**
 * Refresh session from refresh_token.
 */
export async function refreshSession(refreshToken) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.secret);
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  } catch (e) {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }
  const { rows } = await query('SELECT id, email, COALESCE(first_login, false) AS first_login FROM users WHERE id = $1', [decoded.userId]);
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }
  const u = rows[0];
  const profile = await getProfileByUserId(u.id);
  const role = await getPrimaryRoleByUserId(u.id);
  const userType = getUserTypeFromProfile(profile);
  const accessToken = jwt.sign(
    {
      userId: u.id,
      type: 'access',
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
  const newRefreshToken = signRefreshToken(u.id);
  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    expires_in: 604800,
    user: {
      id: u.id,
      email: u.email,
      first_login: !!u.first_login,
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
    },
  };
}

/**
 * Get session from access token (validate and return user + profile).
 */
export async function getSession(accessToken) {
  let decoded;
  try {
    decoded = jwt.verify(accessToken, config.jwt.secret);
    if (decoded.type !== 'access') throw new Error('Invalid token type');
  } catch {
    return null;
  }
  const { rows: userRows } = await query(
    'SELECT id, email, full_name, COALESCE(first_login, false) AS first_login FROM users WHERE id = $1',
    [decoded.userId]
  );
  if (!userRows.length) return null;
  const user = userRows[0];
  const profile = await getProfileByUserId(user.id);
  const role = await getPrimaryRoleByUserId(user.id);
  const userType = getUserTypeFromProfile(profile);
  return {
    user: {
      id: user.id,
      email: user.email,
      first_login: !!user.first_login,
      role,
      external_role: profile?.external_role ?? null,
      external_sub_role: profile?.external_sub_role ?? null,
      userType,
      manager_id: profile?.manager_id ?? null,
      user_metadata: { full_name: user.full_name },
    },
    profile,
  };
}

async function getProfileByUserId(userId) {
  const { rows } = await query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  );
  return rows[0] || null;
}

/**
 * Setup first admin (no admins must exist). Removes other roles and sets admin.
 */
export async function setupFirstAdmin(userId, setupCode) {
  const { rows: adminCount } = await query(
    "SELECT COUNT(*) AS c FROM user_roles WHERE role = 'admin'",
    []
  );
  if (parseInt(adminCount[0].c, 10) > 0) {
    const err = new Error('Admin setup is no longer available. An admin already exists.');
    err.statusCode = 403;
    throw err;
  }
  await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [userId]);
  return true;
}

/**
 * Update password (for reset flow). No old password check if token is from reset.
 * Also used by admin reset-password.
 */
export async function updatePassword(userId, newPassword) {
  const hash = await hashPassword(newPassword);
  await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
    hash,
    userId,
  ]);
  return true;
}

const VALID_ROLES = ['employee', 'team_lead', 'manager', 'hr', 'admin', 'organization'];

/**
 * Create user as admin (for bulk onboard). Creates user, profile, and optional role/profile fields.
 * Returns { user } or throws.
 */
export async function createUserAsAdmin(email, password, fullName, options = {}) {
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    const err = new Error('User already registered with this email');
    err.statusCode = 400;
    throw err;
  }
  const passwordHash = await hashPassword(password || Math.random().toString(36).slice(-12) + 'A1!');
  const userId = uuidv4();
  const role = VALID_ROLES.includes(options.role) ? options.role : 'employee';
  const client = await (await import('../config/database.js')).default.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, first_login) VALUES ($1, $2, $3, $4, true)`,
      [userId, email, passwordHash, fullName || email.split('@')[0]]
    );
    const profileId = uuidv4();
    await client.query(
      `INSERT INTO profiles (id, user_id, full_name, email) VALUES ($1, $2, $3, $4)`,
      [profileId, userId, fullName || email.split('@')[0], email]
    );
    await client.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`,
      [userId, role]
    );
    // Optional extra fields on users (external role/sub-role only; employee_code lives in profiles)
    if (options.external_role != null || options.external_sub_role != null) {
      const updates = [];
      const values = [];
      let i = 1;
      if (options.external_role != null) { updates.push(`external_role = $${i}`); values.push(options.external_role); i++; }
      if (options.external_sub_role != null) { updates.push(`external_sub_role = $${i}`); values.push(options.external_sub_role); i++; }
      if (updates.length > 0) {
        values.push(userId);
        await client.query(
          `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`,
          values
        );
      }
    }
    if (options.job_title || options.department || options.location || options.manager_id ||
        options.employee_code != null || options.employment_type != null || options.joining_date != null ||
        options.external_role != null || options.external_sub_role != null) {
      const updates = [];
      const values = [];
      let i = 1;
      if (options.job_title != null) { updates.push(`job_title = $${i}`); values.push(options.job_title); i++; }
      if (options.department != null) { updates.push(`department = $${i}`); values.push(options.department); i++; }
      if (options.location != null) { updates.push(`location = $${i}`); values.push(options.location); i++; }
      if (options.manager_id != null) { updates.push(`manager_id = $${i}`); values.push(options.manager_id); i++; }
      if (options.employee_code != null) { updates.push(`employee_code = $${i}`); values.push(options.employee_code); i++; }
      if (options.employment_type != null) { updates.push(`employment_type = $${i}`); values.push(options.employment_type); i++; }
      if (options.joining_date != null) { updates.push(`joining_date = $${i}`); values.push(options.joining_date); i++; }
      if (options.external_role != null) { updates.push(`external_role = $${i}`); values.push(options.external_role); i++; }
      if (options.external_sub_role != null) { updates.push(`external_sub_role = $${i}`); values.push(options.external_sub_role); i++; }
      values.push(profileId);
      await client.query(
        `UPDATE profiles SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i}`,
        values
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { user: { id: userId, email } };
}
