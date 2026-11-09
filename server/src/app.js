import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { authConfig, createAuthMiddleware } from './auth.js';
import { asyncHandler, errorHandler, HttpError, logEvent } from './http.js';
import { authRoutes } from './routes/auth.js';
import { propertyRoutes } from './routes/properties.js';
import { bookingRoutes } from './routes/bookings.js';
import { inquiryRoutes } from './routes/inquiries.js';
import { adminRoutes } from './routes/admin.js';

const uploadsPath = fileURLToPath(new URL('../uploads/', import.meta.url));

export function createApp({ store, config: configOverrides = {}, enqueueNotification } = {}) {
  if (!store) throw new Error('createApp requires a data store');
  const config = authConfig(configOverrides);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.locals.requestId = req.get('x-request-id') || randomUUID();
    res.setHeader('x-request-id', res.locals.requestId);
    const startedAt = Date.now();
    res.on('finish', () => logEvent('http.request', {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  const allowedOrigins = String(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((item) => item.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'This website is not allowed to access the API.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(uploadsPath, { maxAge: '7d', immutable: true }));
  app.use('/api/uploads', express.static(uploadsPath, { maxAge: '7d', immutable: true }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
  const { authenticate, requireAdmin } = createAuthMiddleware(store, config);

  app.get('/api/health', asyncHandler(async (_req, res) => {
    res.json({ data: { status: 'ok', mode: store.mode, timestamp: new Date().toISOString() } });
  }));
  app.use('/api/auth', authLimiter, authRoutes({ store, config, authenticate }));
  app.use('/api/properties', propertyRoutes({ store, authenticate }));
  app.use('/api/bookings', bookingRoutes({ store, authenticate, enqueueNotification }));
  app.use('/api/inquiries', inquiryRoutes({ store, enqueueNotification }));
  app.use('/api/admin', adminRoutes({ store, authenticate, requireAdmin }));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'API_ROUTE_NOT_FOUND', 'The requested API endpoint was not found.')));
  app.use(errorHandler);
  return app;
}
