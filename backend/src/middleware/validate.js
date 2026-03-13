import { validationResult } from 'express-validator';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join('; ');
    return res.status(400).json({ data: null, error: { message } });
  }
  next();
}
