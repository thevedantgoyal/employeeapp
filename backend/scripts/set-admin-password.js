/**
 * Set super admin password to Admin@123!
 * Run from backend: node scripts/set-admin-password.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const NEW_PASSWORD = 'Admin@123!';

async function run() {
  const { query } = await import('../src/config/database.js');
  const { updatePassword } = await import('../src/services/authService.js');
  const pool = (await import('../src/config/database.js')).default;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  try {
    const { rows } = await query(
      `SELECT u.id, u.email FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'admin'
       LIMIT 1`,
      []
    );

    if (!rows.length) {
      console.error('No admin user found.');
      process.exit(1);
    }

    const admin = rows[0];
    await updatePassword(admin.id, NEW_PASSWORD);
    console.log('Super admin password updated.');
    console.log('  Email:', admin.email);
    console.log('  New password:', NEW_PASSWORD);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
