import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import * as storageService from '../services/storageService.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

/**
 * GET /storage/avatars/* — serve avatar image without auth so <img src="..."> works.
 * Avatars are not sensitive; URL is hard to guess (userId + timestamp).
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
 * Returns { data: { url, path }, error: null }
 */
const AVATAR_ALLOWED_MIMES = ['image/jpeg', 'image/png'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5MB

router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const bucket = req.body?.bucket || 'evidence';
    let path = req.body?.path;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ data: null, error: { message: 'No file' } });
    }
    if (!path) path = `${req.userId}/${req.file.originalname || 'file'}`;
    path = path.replace(/^\/+/, '').replace(/\.\./g, '');
    if (bucket === 'avatars') {
      if (!AVATAR_ALLOWED_MIMES.includes(req.file.mimetype)) {
        return res.status(400).json({ data: null, error: { message: 'Only JPEG and PNG images are allowed' } });
      }
      if (req.file.size > AVATAR_MAX_BYTES) {
        return res.status(400).json({ data: null, error: { message: 'Image must be less than 5MB' } });
      }
      const prefix = `${req.userId}/`;
      if (path !== req.userId && !path.startsWith(prefix)) {
        return res.status(403).json({ data: null, error: { message: 'You can only upload to your own folder' } });
      }
    }
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
});

export default router;
