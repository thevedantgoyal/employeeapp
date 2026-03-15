/**
 * Seed 7 meeting rooms after DB reset. Uses meeting_rooms table (exact schema).
 * Idempotent: skips insert if table already has any rows.
 * Run from backend: node scripts/seed-meeting-rooms.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const ROOMS = [
  { name: 'Conference Room A', capacity: 10, location: 'Floor 1', floor: '1' },
  { name: 'Conference Room B', capacity: 8, location: 'Floor 1', floor: '1' },
  { name: 'Meeting Room 1', capacity: 6, location: 'Floor 2', floor: '2' },
  { name: 'Meeting Room 2', capacity: 6, location: 'Floor 2', floor: '2' },
  { name: 'Boardroom', capacity: 20, location: 'Floor 3', floor: '3' },
  { name: 'Leadership Suite', capacity: 15, location: 'Floor 3', floor: '3' },
  { name: 'Executive Room', capacity: 12, location: 'Floor 4', floor: '4' },
];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set. Run from backend: node scripts/seed-meeting-rooms.js');
    process.exit(1);
  }

  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  try {
    const { rows: existing } = await query('SELECT id FROM meeting_rooms');
    if (existing.length > 0) {
      console.log('[Seed] meeting_rooms already has', existing.length, 'rows. Skipping insert.');
      return;
    }

    const { rows: userRows } = await query('SELECT id FROM users LIMIT 1');
    if (!userRows.length) {
      console.error('[Seed] No users in database. Create at least one user (e.g. run seed-demo-users.js) first.');
      process.exit(1);
    }
    const createdBy = userRows[0].id;

    console.log('[Seed] Inserting 7 rooms...');
    for (const room of ROOMS) {
      await query(
        `INSERT INTO meeting_rooms (name, location, floor, capacity, has_projector, has_video_conferencing, has_whiteboard, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          room.name,
          room.location,
          room.floor,
          room.capacity,
          true,
          true,
          true,
          'active',
          createdBy,
        ]
      );
      console.log('[Seed] ✅', room.name);
    }
    console.log('[Seed] Done. 7 rooms inserted.');
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
