/**
 * Seed 7 leave types after DB reset. Uses leave_types table (exact schema).
 * Idempotent: skips insert if table already has any rows.
 * Run from backend: node scripts/seed-leave-types.js
 * Use --force to clear leave_types (and dependent tables) then insert 7 types:
 *   node scripts/seed-leave-types.js --force
 *
 * Schema: id, code, name, default_days, color, created_at
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const force = process.argv.includes('--force');

const LEAVE_TYPES = [
  { code: 'AL', name: 'Annual Leave', default_days: 18, color: '#4CAF50' },
  { code: 'SL', name: 'Sick Leave', default_days: 12, color: '#F44336' },
  { code: 'CL', name: 'Casual Leave', default_days: 6, color: '#FF9800' },
  { code: 'ML', name: 'Maternity Leave', default_days: 180, color: '#E91E63' },
  { code: 'PL', name: 'Paternity Leave', default_days: 15, color: '#9C27B0' },
  { code: 'UL', name: 'Unpaid Leave', default_days: 30, color: '#9E9E9E' },
  { code: 'CO', name: 'Compensatory Leave', default_days: 6, color: '#2196F3' },
];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('[Seed] DATABASE_URL is not set. Run from backend: node scripts/seed-leave-types.js');
    process.exit(1);
  }

  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  try {
    const { rows: countRows } = await query('SELECT COUNT(*) AS count FROM leave_types');
    const count = parseInt(countRows[0]?.count ?? '0', 10);

    if (count > 0 && !force) {
      console.log('[Seed] Leave types already exist, skipping. Use --force to clear and re-seed.');
      return;
    }

    if (force && count > 0) {
      console.log('[Seed] --force: clearing leave_types and dependent tables...');
      await query('TRUNCATE TABLE leave_types RESTART IDENTITY CASCADE');
    }

    console.log('[Seed] Inserting 7 leave types...');
    for (const lt of LEAVE_TYPES) {
      await query(
        `INSERT INTO leave_types (code, name, default_days, color) VALUES ($1, $2, $3, $4)`,
        [lt.code, lt.name, lt.default_days, lt.color]
      );
      console.log('[Seed] ✅', lt.name);
    }
    console.log('[Seed] Done. 7 leave types inserted.');
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
