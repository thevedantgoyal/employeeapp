import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import * as storageService from '../services/storageService.js';
import { query } from '../config/database.js';

const router = Router();

/** Max size for a single uploaded file (multipart). */
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50MB
/** After client compression, avatar is usually small; allow large JPEG edge cases. */
const AVATAR_MAX_BYTES = 25 * 1024 * 1024; // 25MB

function isAllowedAvatarMime(mime, originalname) {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return true;
  const name = (originalname || '').toLowerCase();
  if (/\.(jpe?g|png|gif|webp|bmp|tiff?|ico|svg|heic|heif|avif|jfif|pjpeg|pjp)$/i.test(name)) return true;
  if (m === 'application/octet-stream' && /\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif|avif)$/i.test(name)) return true;
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES },
});

/**
 * GET /storage/avatars/* — serve avatar image without auth (legacy URL-based avatars).
 * New avatars are stored as Base64 in profiles.avatar_url; this route remains for backward compatibility.
 */
router.get('/avatars/*', async (req, res, next) => {
  try {
    const objectPath = req.params[0];
    if (!objectPath) {
      return res.status(400).json({ data: null, error: { message: 'Invalid path' } });
    }
    const file = await storageService.getFile('avatars', objectPath);
    if (!file) {
      return res.status(404).json({ data: null, error: { message: 'Not found' } });
    }
    res.set('Content-Type', file.content_type);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(file.file_data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /storage/:bucket/* — serve file (path after bucket)
 * Auth: owner or admin or (resumes) manager of owner.
 */
router.get('/:bucket/*', authenticate, async (req, res, next) => {
  try {
    const bucket = req.params.bucket;
    const objectPath = req.params[0];
    if (!bucket || !objectPath) {
      return res.status(400).json({ data: null, error: { message: 'Invalid path' } });
    }
    const allowed = await storageService.canAccessFile(bucket, objectPath, req.userId, req.roles);
    if (!allowed) {
      return res.status(403).json({ data: null, error: { message: 'Access denied' } });
    }
    const file = await storageService.getFile(bucket, objectPath);
    if (!file) {
      return res.status(404).json({ data: null, error: { message: 'File not found' } });
    }
    res.set('Content-Type', file.content_type);
    res.send(file.file_data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /storage/upload
 * Form: bucket, path, file
 * For bucket=avatars: converts to Base64, updates profiles.avatar_url, returns { data: { avatar_url }, error: null }.
 * For other buckets: Returns { data: { url, path }, error: null }.
 */
async function handleAvatarUpload(req, res) {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ data: null, error: { message: 'No file uploaded' } });
  }
  const base64String = `data:${req.file.mimetype};base64,` + req.file.buffer.toString('base64');
  const { rows } = await query(
    `UPDATE profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2 RETURNING id`,
    [base64String, req.userId]
  );
  if (!rows.length) {
    return res.status(404).json({ data: null, error: { message: 'Profile not found' } });
  }
  return res.status(200).json({ data: { avatar_url: base64String }, error: null });
}

router.post(
  '/upload',
  authenticate,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ data: null, error: { message: 'File too large (max 10MB)' } });
        }
        return res.status(400).json({ data: null, error: { message: err.message || 'Upload error' } });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
    const bucket = (req.body && req.body.bucket) || 'evidence';
    if (bucket === 'avatars') {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ data: null, error: { message: 'No file uploaded' } });
      }
      if (!isAllowedAvatarMime(req.file.mimetype, req.file.originalname)) {
        return res.status(400).json({
          data: null,
          error: {
            message:
              'Invalid file type for profile photo. Use a standard image file (photos are converted automatically in the app).',
          },
        });
      }
      if (req.file.size > AVATAR_MAX_BYTES) {
        return res.status(400).json({
          data: null,
          error: { message: 'Image file is too large after upload (max 25MB). Try a smaller photo.' },
        });
      }
      return await handleAvatarUpload(req, res);
    }
    let path = req.body?.path;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ data: null, error: { message: 'No file' } });
    }
    if (!path) path = `${req.userId}/${req.file.originalname || 'file'}`;
    path = path.replace(/^\/+/, '').replace(/\.\./g, '');
    const result = await storageService.uploadFile(
      bucket,
      path,
      req.userId,
      req.file.buffer,
      req.file.mimetype || 'application/octet-stream'
    );
    const baseUrl = process.env.FILE_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/api/storage/${bucket}/${encodeURIComponent(path)}`;
    res.status(201).json({ data: { url, path: result.path }, error: null });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
