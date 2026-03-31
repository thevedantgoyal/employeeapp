import './index.js';
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

function resolveSsl(parsed) {
  const sslFlag = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (sslFlag === 'false' || sslFlag === '0' || sslFlag === 'disable') {
    return false;
  }
  const mode = (parsed.searchParams.get('sslmode') || '').toLowerCase();
  if (mode === 'disable') {
    return false;
  }
  const host = parsed.hostname || '';
  if (host === 'localhost' || host === '127.0.0.1') {
    return false;
  }
  return { rejectUnauthorized: false };
}

/** Default 30s — remote DBs / VPNs often need more than 2s (old default). Override with DATABASE_CONNECTION_TIMEOUT_MS. */
function parseEnvInt(key, fallback) {
  const raw = process.env[key];
  if (raw == null || String(raw).trim() === '') return fallback;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const connectionTimeoutMillis = parseEnvInt('DATABASE_CONNECTION_TIMEOUT_MS', 30000);
const idleTimeoutMillis = parseEnvInt('DATABASE_POOL_IDLE_TIMEOUT_MS', 60000);
const poolMax = parseEnvInt('DATABASE_POOL_MAX', 20);

let poolConfig;
try {
  const parsed = new URL(url);
  poolConfig = {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '5432', 10),
    database: (parsed.pathname || '/').slice(1) || 'postgres',
    user: decodeURIComponentSafe(parsed.username),
    password: decodeURIComponentSafe(parsed.password),
    max: poolMax,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    /** Reduce idle disconnects through NAT / firewalls (remote PostgreSQL). */
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    ssl: resolveSsl(parsed),
  };
} catch (e) {
  throw new Error('Invalid DATABASE_URL in .env: ' + (e.message || 'parse error'));
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected database pool error', err);
});

function isTransientConnectionError(err) {
  if (!err) return false;
  const code = err.code;
  const msg = String(err.message || '');
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;
  if (/connection terminated|Connection terminated|unexpectedly|timeout/i.test(msg)) return true;
  if (err.cause && isTransientConnectionError(err.cause)) return true;
  return false;
}

const QUERY_RETRIES = Math.min(5, Math.max(1, parseEnvInt('DATABASE_QUERY_RETRIES', 3)));

/**
 * Run query with retries on transient network / pool connection failures.
 */
export async function query(text, params) {
  let lastErr;
  for (let attempt = 1; attempt <= QUERY_RETRIES; attempt++) {
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.warn(`Slow query (${duration}ms):`, text?.substring(0, 80));
      }
      return res;
    } catch (err) {
      lastErr = err;
      const transient = isTransientConnectionError(err);
      if (attempt < QUERY_RETRIES && transient) {
        const delayMs = 150 * attempt;
        console.warn(
          `[DB] Transient error (attempt ${attempt}/${QUERY_RETRIES}), retrying in ${delayMs}ms:`,
          err?.message || err,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export function getPool() {
  return pool;
}

export default pool;
