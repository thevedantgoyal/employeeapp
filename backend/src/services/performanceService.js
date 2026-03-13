import { query } from '../config/database.js';

/**
 * Calculate performance for a user. Returns same shape as frontend PerformanceData.
 */
export async function calculatePerformance(userId, profileId) {
  const { rows: profileRows } = await query(
    'SELECT id, full_name FROM profiles WHERE user_id = $1',
    [userId]
  );
  const profile = profileRows[0];
  if (!profile) {
    return {
      userId,
      fullName: 'Unknown',
      overallScore: 0,
      attendanceScore: 0,
      taskCompletionScore: 0,
      overduePenalty: 0,
      collaborationScore: 0,
      skillsScore: 0,
      calculatedAt: new Date().toISOString(),
    };
  }
  const pid = profile.id;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const { rows: attendance } = await query(
    "SELECT status FROM attendance WHERE user_id = $1 AND date >= $2",
    [userId, dateStr]
  );
  const workingDays = 22;
  let attendanceScore = 0;
  if (attendance.length > 0) {
    const present = attendance.filter((a) => a.status === 'present').length;
    const late = attendance.filter((a) => a.status === 'late').length;
    const half = attendance.filter((a) => a.status === 'half_day').length;
    const effective = present + late * 0.8 + half * 0.5;
    attendanceScore = Math.round(Math.min((effective / workingDays) * 100, 100));
  }

  const { rows: taskRows } = await query(
    "SELECT COUNT(*) AS c FROM tasks WHERE assigned_to = $1 AND is_deleted = false",
    [pid]
  );
  const totalTasks = parseInt(taskRows[0]?.c || '0', 10);
  const { rows: completedRows } = await query(
    "SELECT COUNT(*) AS c FROM tasks WHERE assigned_to = $1 AND is_deleted = false AND status IN ('completed', 'approved')",
    [pid]
  );
  const completedTasks = parseInt(completedRows[0]?.c || '0', 10);
  const taskCompletionScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const now = new Date().toISOString();
  const { rows: overdueRows } = await query(
    `SELECT COUNT(*) AS c FROM tasks WHERE assigned_to = $1 AND is_deleted = false
     AND status NOT IN ('completed', 'approved') AND due_date IS NOT NULL AND due_date < $2`,
    [pid, now]
  );
  const overdueTasks = parseInt(overdueRows[0]?.c || '0', 10);
  const overduePenalty = totalTasks > 0 ? Math.round((overdueTasks / totalTasks) * 100) : 0;

  const { rows: pmRows } = await query('SELECT COUNT(*) AS c FROM project_members WHERE employee_id = $1', [pid]);
  const { rows: contribRows } = await query('SELECT COUNT(*) AS c FROM contributions WHERE user_id = $1', [userId]);
  const { rows: commentRows } = await query('SELECT COUNT(*) AS c FROM task_comments WHERE author_id = $1', [pid]);
  const projectMemberships = parseInt(pmRows[0]?.c || '0', 10);
  const contributionsCount = parseInt(contribRows[0]?.c || '0', 10);
  const commentsCount = parseInt(commentRows[0]?.c || '0', 10);
  const projectScore = Math.min((projectMemberships / 5) * 100, 100);
  const contribScore = Math.min((contributionsCount / 20) * 100, 100);
  const commentScore = Math.min((commentsCount / 30) * 100, 100);
  const collaborationScore = Math.round(projectScore * 0.4 + contribScore * 0.4 + commentScore * 0.2);

  const { rows: skills } = await query(
    'SELECT proficiency_level, goal_level FROM skills WHERE user_id = $1',
    [userId]
  );
  let skillsScore = 0;
  if (skills.length > 0) {
    const countBonus = Math.min((skills.length / 5) * 50, 50);
    const avgProf = skills.reduce((s, sk) => s + (sk.proficiency_level || 0), 0) / skills.length;
    skillsScore = Math.round(countBonus + (avgProf / 100) * 50);
  }

  const overallScore = Math.round(
    attendanceScore * 0.25 +
      taskCompletionScore * 0.3 -
      overduePenalty * 0.2 +
      collaborationScore * 0.15 +
      skillsScore * 0.1
  );

  return {
    userId,
    fullName: profile.full_name || 'Unknown',
    overallScore: Math.max(0, overallScore),
    attendanceScore,
    taskCompletionScore,
    overduePenalty,
    collaborationScore,
    skillsScore,
    calculatedAt: new Date().toISOString(),
  };
}
