/**
 * Ensures super admin exists: admin@cachedigitech.com / Superadmin@123
 * Has access to Settings → Reset All Data.
 * Run from backend: node scripts/ensure-super-admin.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const SUPER_ADMIN_EMAIL = 'admin@cachedigitech.com';
const SUPER_ADMIN_PASSWORD = 'Superadmin@123';
const SUPER_ADMIN_NAME = 'Super Admin';

async function run() {
  const { query } = await import('../src/config/database.js');
  const { createUserAsAdmin, updatePassword } = await import('../src/services/authService.js');
  const pool = (await import('../src/config/database.js')).default;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  try {
    const { rows } = await query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [SUPER_ADMIN_EMAIL]
    );

    if (rows.length) {
      const userId = rows[0].id;
      await updatePassword(userId, SUPER_ADMIN_PASSWORD);

      const { rows: roleRows } = await query(
        "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'admin'",
        [userId]
      );
      if (!roleRows.length) {
        await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
        await query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin')", [userId]);
      }

      console.log('Super admin updated.');
    } else {
      await createUserAsAdmin(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME, {
        role: 'admin',
      });
      console.log('Super admin created.');
    }

    console.log('  Email:', SUPER_ADMIN_EMAIL);
    console.log('  Password:', SUPER_ADMIN_PASSWORD);
    console.log('  → Use Settings → Danger Zone to reset all DB data.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
