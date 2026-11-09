import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function logEvent(event, fields = {}) {
  console.log(JSON.stringify({ level: 'info', event, at: new Date().toISOString(), ...fields }));
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields and try again.',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        requestId: res.locals.requestId,
      },
    });
  }
  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Something went wrong. Please try again.' : error.message;
  if (status >= 500) {
    console.error(JSON.stringify({ level: 'error', event: 'request.failed', requestId: res.locals.requestId, message: error.message, stack: error.stack }));
  } else {
    console.warn(JSON.stringify({ level: 'warn', event: 'request.rejected', requestId: res.locals.requestId, code, message: error.message }));
  }
  res.status(status).json({
    error: {
      code,
      message,
      ...(error.details ? { details: error.details } : {}),
      requestId: res.locals.requestId || randomUUID(),
    },
  });
}

export function notFound(_req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}
