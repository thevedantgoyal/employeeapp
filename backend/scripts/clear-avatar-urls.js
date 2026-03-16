/**
 * Clear URL-based avatar_url so users can re-upload (then stored as Base64).
 * Run from backend: node scripts/clear-avatar-urls.js
 *
 * SQL equivalent:
 *   UPDATE profiles SET avatar_url = NULL, updated_at = NOW()
 *   WHERE avatar_url LIKE 'http://localhost%' OR avatar_url LIKE 'http://%';
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { query } = await import('../src/config/database.js');

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }
  const { rowCount } = await query(
    `UPDATE profiles SET avatar_url = NULL, updated_at = NOW()
     WHERE avatar_url LIKE 'http://localhost%' OR avatar_url LIKE 'http://%'`
  );
  console.log('[Clear] Cleared avatar_url for', rowCount, 'profile(s).');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
