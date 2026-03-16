/**
 * Migrate profiles.avatar_url from localhost/file URLs to Base64 data URIs.
 * - Rows with avatar_url like http://localhost% or http://% are updated.
 * - If the file exists in file_storage (avatars bucket), convert to Base64 and set avatar_url.
 * - If the file is missing, set avatar_url = NULL.
 *
 * Run from backend: node scripts/migrate-avatars-to-base64.js
 *
 * Option A (clear only, no file read): run SQL:
 *   UPDATE profiles SET avatar_url = NULL WHERE avatar_url LIKE 'http://localhost%' OR avatar_url LIKE 'http://%';
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { query } = await import('../src/config/database.js');

function getAvatarObjectPath(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return null;
  try {
    const idx = trimmed.indexOf('/avatars/');
    if (idx !== -1) {
      const pathPart = trimmed.slice(idx + '/avatars/'.length);
      return decodeURIComponent(pathPart.replace(/\+/g, ' ')) || null;
    }
    if (!trimmed.startsWith('http') && !trimmed.startsWith('/') && !trimmed.includes('..')) {
      return decodeURIComponent(trimmed.replace(/\+/g, ' '));
    }
    if (trimmed.startsWith('/api/storage/avatars/')) {
      const pathPart = trimmed.slice('/api/storage/avatars/'.length);
      return decodeURIComponent(pathPart.replace(/\+/g, ' '));
    }
    return null;
  } catch {
    return null;
  }
}

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || typeof dbUrl !== 'string') {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const { rows } = await query(
    `SELECT user_id, avatar_url FROM profiles
     WHERE avatar_url IS NOT NULL AND avatar_url LIKE 'http%'`
  );

  console.log(`[Migrate] Found ${rows.length} profile(s) with URL-based avatar_url.`);

  for (const row of rows) {
    try {
      const objectPath = getAvatarObjectPath(row.avatar_url);
      if (!objectPath) {
        await query(`UPDATE profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1`, [row.user_id]);
        console.log('[Migrate] Cleared (invalid URL):', row.user_id);
        continue;
      }

      const { rows: fileRows } = await query(
        `SELECT file_data, content_type FROM file_storage WHERE bucket = $1 AND object_path = $2`,
        ['avatars', objectPath]
      );

      if (!fileRows.length) {
        await query(`UPDATE profiles SET avatar_url = NULL, updated_at = NOW() WHERE user_id = $1`, [row.user_id]);
        console.log('[Migrate] File missing, cleared:', row.user_id);
        continue;
      }

      const file = fileRows[0];
      const buffer = file.file_data;
      const contentType = file.content_type || 'image/jpeg';
      const base64 = `data:${contentType};base64,` + (Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64'));

      await query(
        `UPDATE profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2`,
        [base64, row.user_id]
      );
      console.log('[Migrate] Converted:', row.user_id);
    } catch (err) {
      console.error('[Migrate] Failed for:', row.user_id, err.message);
    }
  }

  console.log('[Migrate] Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
