import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url || typeof url !== 'string') {
  throw new Error('DATABASE_URL is not set in backend/.env');
}

function decodeURIComponentSafe(str) {
  if (str == null || str === '') return '';
  try {
    return decodeURIComponent(String(str));
  } catch {
    return String(str);
  }
}

let poolConfig;
try {
  const parsed = new URL(url);
  poolConfig = {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '5432', 10),
    database: (parsed.pathname || '/').slice(1) || 'postgres',
    user: decodeURIComponentSafe(parsed.username),
    password: decodeURIComponentSafe(parsed.password),
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,

    ssl: parsed.hostname !== 'localhost' ? { rejectUnauthorized: false } : false,
  };
} catch (e) {
  throw new Error('Invalid DATABASE_URL in .env: ' + (e.message || 'parse error'));
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.warn(`Slow query (${duration}ms):`, text?.substring(0, 80));
  }
  return res;
}

export function getPool() {
  return pool;
}

export default pool;
