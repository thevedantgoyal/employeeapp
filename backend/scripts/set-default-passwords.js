/**
 * Set default password (Cachetask@123) for all users except those with external_role = 'admin'.
 * Run from backend: node scripts/set-default-passwords.js
 */

import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const DEFAULT_PASSWORD = 'Cachetask@123';
const BCRYPT_ROUNDS = 10;

async function run() {
  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  try {
    // Admins: users where external_role = 'admin' (skip these)
    const { rows: adminRows } = await query(
      `SELECT email FROM users WHERE external_role = $1`,
      ['admin']
    );
    const adminEmails = adminRows.map((r) => r.email);

    const hashed = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

    const { rowCount } = await query(
      `UPDATE users
       SET password_hash = $1, updated_at = now()
       WHERE (external_role IS NULL OR external_role != $2)`,
      [hashed, 'admin']
    );

    const updatedCount = rowCount ?? 0;
    console.log('[Script] Updated', updatedCount, 'users');
    if (adminEmails.length > 0) {
      console.log('[Script] Skipped admins:', adminEmails.join(', '));
    } else {
      console.log('[Script] Skipped admins: (none)');
    }
  } catch (err) {
    console.error('[Script] Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
