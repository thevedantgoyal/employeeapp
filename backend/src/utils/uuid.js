/**
 * Normalize a value to a clean UUID string for PostgreSQL.
 * Handles: array (take first), string with {} braces, plain string.
 */
export function normalizeUUID(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return normalizeUUID(value[0]);
  if (typeof value === 'string') return value.replace(/[{}]/g, '').trim();
  return value;
}

/**
 * Normalize an array of UUIDs (e.g. filter params) for PostgreSQL uuid[].
 */
export function normalizeUUIDArray(arr) {
  if (!Array.isArray(arr)) return arr;
  return arr.map((v) => normalizeUUID(v)).filter((v) => v != null && v !== '');
}
