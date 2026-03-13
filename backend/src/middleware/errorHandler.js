import { config } from '../config/index.js';

/**
 * Centralized error handler. Ensures { data: null, error: { message } } shape for API.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  if (config.nodeEnv === 'development') {
    console.error(err);
  }
  res.status(status).json({
    data: null,
    error: { message: err.message || 'Internal server error', code: err.code },
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ data: null, error: { message: 'Not found' } });
}
