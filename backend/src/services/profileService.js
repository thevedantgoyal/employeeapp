import { query } from '../config/database.js';

export async function getProfileByUserId(userId) {
  const { rows } = await query(
    'SELECT * FROM profiles WHERE user_id = $1',
    [userId]
  );
  return rows[0] || null;
}

export async function updateProfileByUserId(userId, updates) {
  const allowed = [
    'full_name', 'job_title', 'department', 'location', 'phone',
    'avatar_url', 'status', 'work_hours', 'linkedin_url', 'bio',
    'resume_url', 'date_of_birth', 'joining_date', 'other_social_links', 'working_status',
    'profile_completed', 'manager_id', 'team_id',
  ];
  const setClauses = [];
  const values = [];
  let i = 1;
  for (const [key, value] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (allowed.includes(col)) {
      setClauses.push(`${col} = $${i}`);
      values.push(value);
      i++;
    }
  }
  if (setClauses.length === 0) {
    return getProfileByUserId(userId);
  }
  values.push(userId);
  const sql = `UPDATE profiles SET ${setClauses.join(', ')}, updated_at = now() WHERE user_id = $${i} RETURNING *`;
  const { rows } = await query(sql, values);
  return rows[0] || null;
}

export async function getProfileById(profileId) {
  const { rows } = await query('SELECT * FROM profiles WHERE id = $1', [profileId]);
  return rows[0] || null;
}

export async function getAllProfiles() {
  const { rows } = await query(
    'SELECT id, full_name, email, job_title, department, user_id, manager_id, team_id, created_at FROM profiles ORDER BY full_name'
  );
  return rows;
}

export async function getProfilesByTeamId(teamId) {
  const { rows } = await query(
    'SELECT id, full_name, email, job_title, department, user_id FROM profiles WHERE team_id = $1 ORDER BY full_name',
    [teamId]
  );
  return rows;
}

export async function updateProfileTeam(profileId, teamId) {
  const { rows } = await query(
    'UPDATE profiles SET team_id = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [teamId, profileId]
  );
  return rows[0] || null;
}

export async function clearTeamFromProfiles(teamId) {
  await query('UPDATE profiles SET team_id = NULL, updated_at = now() WHERE team_id = $1', [teamId]);
}
