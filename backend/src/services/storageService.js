import { query } from '../config/database.js';
import { config } from '../config/index.js';

const FILE_BASE = config.fileBaseUrl || '';

/**
 * Save file to file_storage. objectPath should be e.g. "userId/filename.ext".
 */
export async function uploadFile(bucket, objectPath, userId, buffer, contentType = 'application/octet-stream') {
  await query(
    `INSERT INTO file_storage (bucket, object_path, user_id, content_type, file_data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (bucket, object_path) DO UPDATE SET file_data = $5, content_type = $4`,
    [bucket, objectPath, userId, contentType, buffer]
  );
  const url = FILE_BASE ? `${FILE_BASE}/api/storage/${bucket}/${encodeURIComponent(objectPath)}` : `/api/storage/${bucket}/${encodeURIComponent(objectPath)}`;
  return { url, path: objectPath };
}

/**
 * Get file record (for serving). Returns { file_data, content_type } or null.
 */
export async function getFile(bucket, objectPath) {
  const { rows } = await query(
    'SELECT file_data, content_type FROM file_storage WHERE bucket = $1 AND object_path = $2',
    [bucket, objectPath]
  );
  return rows[0] || null;
}

/**
 * Delete file from file_storage.
 */
export async function deleteFile(bucket, objectPath) {
  const { rowCount } = await query(
    'DELETE FROM file_storage WHERE bucket = $1 AND object_path = $2',
    [bucket, objectPath]
  );
  return rowCount > 0;
}

/**
 * Check if user can access file (owner or manager of owner for resumes, or admin).
 */
export async function canAccessFile(bucket, objectPath, userId, userRoles) {
  const { rows } = await query(
    'SELECT user_id FROM file_storage WHERE bucket = $1 AND object_path = $2',
    [bucket, objectPath]
  );
  if (!rows.length) return false;
  const ownerId = rows[0].user_id;
  if (ownerId === userId) return true;
  if (userRoles && userRoles.includes('admin')) return true;
  if (bucket === 'resumes') {
    const { isManagerOf } = await import('../middleware/rbac.js');
    return isManagerOf(userId, ownerId);
  }
  return false;
}
