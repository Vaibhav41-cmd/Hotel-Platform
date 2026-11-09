import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { HttpError } from './http.js';

export const REFRESH_COOKIE = 'serein_refresh';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role });

export function authConfig(overrides = {}) {
  return {
    jwtSecret: overrides.jwtSecret || process.env.JWT_SECRET || 'local-dev-access-secret-change-before-deploy-32chars',
    secureCookies: overrides.secureCookies ?? process.env.NODE_ENV === 'production',
    sameSite: overrides.sameSite || 'lax',
    accessTtl: overrides.accessTtl || '15m',
    refreshTtlMs: overrides.refreshTtlMs || REFRESH_TTL_MS,
  };
}

export function createAuthMiddleware(store, config) {
  async function authenticate(req, _res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return next(new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      const user = await store.get('user', payload.sub);
      if (!user) throw new Error('User no longer exists');
      req.user = publicUser(user);
      next();
    } catch {
      next(new HttpError(401, 'INVALID_SESSION', 'Your session has expired. Please sign in again.'));
    }
  }

  const requireAdmin = (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'));
    if (req.user.role !== 'admin') return next(new HttpError(403, 'FORBIDDEN', 'Front-desk access is required for this action.'));
    next();
  };
  return { authenticate, requireAdmin };
}

export async function issueSession(res, user, store, config) {
  const accessToken = jwt.sign({ role: user.role, jti: randomBytes(16).toString('hex') }, config.jwtSecret, { subject: user.id, expiresIn: config.accessTtl });
  const refreshToken = randomBytes(48).toString('base64url');
  await store.create('refreshToken', {
    tokenHash: hashToken(refreshToken), userId: user.id,
    expiresAt: new Date(Date.now() + config.refreshTtlMs).toISOString(),
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: config.sameSite,
    path: '/api/auth',
    maxAge: config.refreshTtlMs,
  });
  return { accessToken, user: publicUser(user) };
}

export function refreshTokenHash(token) {
  return hashToken(token);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
