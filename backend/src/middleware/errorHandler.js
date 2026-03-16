import { config } from '../config/index.js';

/**
 * Centralized error handler. Ensures { data: null, error: { message } } shape for API.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const isProd = config.nodeEnv === 'production';
  console.error(err);
  const messageToClient =
    isProd && status >= 500
      ? 'Internal server error'
      : (err.message || 'Internal server error');
  res.status(status).json({
    data: null,
    error: { message: messageToClient, code: err.code },
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ data: null, error: { message: 'Not found' } });
}
