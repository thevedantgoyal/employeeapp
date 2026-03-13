/**
 * Verify meeting_rooms and seed 7 default rooms (Room1..Room7) if missing.
 * Idempotent: only inserts rooms whose name does not already exist.
 * Run from backend: node scripts/seed-meeting-rooms.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const ROOM_NAMES = ['Room1', 'Room2', 'Room3', 'Room4', 'Room5', 'Room6', 'Room7'];

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set. Run from backend: node scripts/seed-meeting-rooms.js');
    process.exit(1);
  }

  const { query } = await import('../src/config/database.js');
  const pool = (await import('../src/config/database.js')).default;

  try {
    const { rows: existing } = await query('SELECT id, name FROM meeting_rooms');
    const existingNames = new Set(existing.map((r) => r.name));
    const toInsert = ROOM_NAMES.filter((name) => !existingNames.has(name));

    if (toInsert.length === 0) {
      console.log('meeting_rooms already has 7 default rooms. Count:', existing.length);
      return;
    }

    const { rows: userRows } = await query('SELECT id FROM users LIMIT 1');
    if (!userRows.length) {
      console.error('No users in database. Create at least one user (e.g. run seed-demo-users.js) first.');
      process.exit(1);
    }
    const createdBy = userRows[0].id;

    for (const name of toInsert) {
      await query(
        `INSERT INTO meeting_rooms (name, location, floor, capacity, has_projector, has_video_conferencing, has_whiteboard, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [name, 'Building A', '1', 10, true, true, true, 'active', createdBy]
      );
      console.log('Inserted:', name);
    }
    console.log('Done. Total meeting_rooms:', existing.length + toInsert.length);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
