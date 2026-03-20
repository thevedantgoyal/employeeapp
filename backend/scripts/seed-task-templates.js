/**
 * Seed department task templates using ACTUAL departments and job_titles from profiles.
 * Run after 11_dept_task_templates.sql. Run from backend: node scripts/seed-task-templates.js
 * Idempotent: only inserts if dept_task_templates is empty.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set. Run from backend: node scripts/seed-task-templates.js');
    process.exit(1);
  }

  const { query } = await import('../src/config/database.js');

  try {
    const { rows: existing } = await query('SELECT id FROM dept_task_templates LIMIT 1');
    if (existing.length > 0) {
      console.log('[Seed] dept_task_templates already has rows. Skipping.');
      return;
    }

    const { rows: deptRows } = await query(
      `SELECT DISTINCT department FROM profiles WHERE department IS NOT NULL AND TRIM(department) != '' ORDER BY department`
    );
    const departments = deptRows.map((r) => r.department.trim());

    const { rows: jobRows } = await query(
      `SELECT DISTINCT job_title FROM profiles WHERE job_title IS NOT NULL AND TRIM(job_title) != '' ORDER BY job_title`
    );
    const jobTitles = jobRows.map((r) => r.job_title.trim());

    if (departments.length === 0) {
      console.log('[Seed] No departments in profiles. Add employees with department set, then re-run.');
      return;
    }

    const { rows: userRows } = await query('SELECT id FROM users LIMIT 1');
    const createdBy = userRows.length ? userRows[0].id : null;

    console.log('[Seed] Departments:', departments.join(', '));
    console.log('[Seed] Job titles:', jobTitles.slice(0, 15).join(', ') + (jobTitles.length > 15 ? '...' : ''));

    let inserted = 0;
    for (const department of departments) {
      const jobsInDept = jobTitles.length; // use all for generic templates
      const requiredOptions = jobTitles.slice(0, 5);
      const templates = [
        { task_title: 'General task', description_hint: 'Complete as per team guidelines.', required: requiredOptions.length ? [requiredOptions[0]] : [] },
        { task_title: 'Review and report', description_hint: 'Review and submit report by due date.', required: requiredOptions.slice(0, 2) },
        { task_title: 'Follow-up task', description_hint: 'Follow up and update status.', required: [] },
      ];
      for (const t of templates) {
        await query(
          `INSERT INTO dept_task_templates (department, task_title, description_hint, required_job_titles, is_active, created_by)
           VALUES ($1, $2, $3, $4, true, $5)`,
          [department, t.task_title, t.description_hint, t.required, createdBy]
        );
        inserted++;
      }
    }

    console.log('[Seed] Inserted', inserted, 'templates.');
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
  }
}

run();
