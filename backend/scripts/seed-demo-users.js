/**
 * Seed demo users: 1 admin, 2 managers, 4 employees (2 per manager).
 * Run from backend: node scripts/seed-demo-users.js
 *
 * Demo credentials (change in production):
 *   Admin:    admin@demo.com      / AdminDemo123!
 *   Manager1: manager1@demo.com  / ManagerDemo123!
 *   Manager2: manager2@demo.com  / ManagerDemo123!
 *   Emp M1:   emp1@demo.com      / EmployeeDemo123!
 *   Emp M1:   emp2@demo.com      / EmployeeDemo123!
 *   Emp M2:   emp3@demo.com      / EmployeeDemo123!
 *   Emp M2:   emp4@demo.com      / EmployeeDemo123!
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from backend directory BEFORE importing anything that uses DATABASE_URL
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl || typeof dbUrl !== 'string') {
  console.error('DATABASE_URL is not set in .env. Add it (e.g. DATABASE_URL=postgresql://user:password@localhost:5432/dbname) and run from backend: node scripts/seed-demo-users.js');
  process.exit(1);
}

const DEMO_USERS = {
  admin: {
    email: 'admin@demo.com',
    password: 'AdminDemo123!',
    fullName: 'Demo Admin',
    role: 'admin',
  },
  managers: [
    { email: 'manager1@demo.com', password: 'ManagerDemo123!', fullName: 'Demo Manager One', role: 'manager' },
    { email: 'manager2@demo.com', password: 'ManagerDemo123!', fullName: 'Demo Manager Two', role: 'manager' },
  ],
  employees: [
    { email: 'emp1@demo.com', password: 'EmployeeDemo123!', fullName: 'Employee One', managerIndex: 0 },
    { email: 'emp2@demo.com', password: 'EmployeeDemo123!', fullName: 'Employee Two', managerIndex: 0 },
    { email: 'emp3@demo.com', password: 'EmployeeDemo123!', fullName: 'Employee Three', managerIndex: 1 },
    { email: 'emp4@demo.com', password: 'EmployeeDemo123!', fullName: 'Employee Four', managerIndex: 1 },
  ],
};

async function run() {
  // Import after env is loaded so DATABASE_URL is set when the pool is created
  const { createUserAsAdmin } = await import('../src/services/authService.js');
  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  async function getProfileIdByUserId(userId) {
    const { rows } = await query('SELECT id FROM profiles WHERE user_id = $1', [userId]);
    return rows[0]?.id ?? null;
  }

  console.log('Seeding demo users...\n');

  try {
    // 1. Admin
    await createUserAsAdmin(DEMO_USERS.admin.email, DEMO_USERS.admin.password, DEMO_USERS.admin.fullName, {
      role: DEMO_USERS.admin.role,
    });
    console.log('Created admin:', DEMO_USERS.admin.email);

    // 2. Managers
    const managerProfileIds = [];
    for (const m of DEMO_USERS.managers) {
      const { user } = await createUserAsAdmin(m.email, m.password, m.fullName, { role: m.role });
      const profileId = await getProfileIdByUserId(user.id);
      managerProfileIds.push(profileId);
      console.log('Created manager:', m.email, '(profile id:', profileId, ')');
    }

    // 3. Employees (2 per manager)
    for (const e of DEMO_USERS.employees) {
      const managerProfileId = managerProfileIds[e.managerIndex];
      await createUserAsAdmin(e.email, e.password, e.fullName, {
        role: 'employee',
        manager_id: managerProfileId,
      });
      console.log('Created employee:', e.email, '-> manager', e.managerIndex + 1);
    }

    console.log('\nDone. Demo users:');
    console.log('  Admin:   ', DEMO_USERS.admin.email, '/', DEMO_USERS.admin.password);
    console.log('  Managers:', DEMO_USERS.managers.map((m) => m.email).join(', '), '/', DEMO_USERS.managers[0].password);
    console.log('  Employees (M1):', DEMO_USERS.employees.filter((e) => e.managerIndex === 0).map((e) => e.email).join(', '));
    console.log('  Employees (M2):', DEMO_USERS.employees.filter((e) => e.managerIndex === 1).map((e) => e.email).join(', '));
    console.log('  Employee password:', DEMO_USERS.employees[0].password);
  } catch (err) {
    if (err.message?.includes('already registered')) {
      console.warn('One or more demo users already exist. Delete them first if you need a fresh seed.');
    }
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
