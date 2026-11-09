import { Router } from 'express';
import { asyncHandler, HttpError, logEvent } from '../http.js';
import { hashPassword, issueSession, publicUser, refreshTokenHash, verifyPassword, REFRESH_COOKIE } from '../auth.js';
import { loginSchema, signupSchema } from '../validation.js';

export function authRoutes({ store, config, authenticate }) {
  const router = Router();

  router.post('/signup', asyncHandler(async (req, res) => {
    const body = signupSchema.parse(req.body);
    if (await store.findByEmail(body.email)) throw new HttpError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    const user = await store.create('user', {
      name: body.name, email: body.email, passwordHash: await hashPassword(body.password), role: 'user',
    });
    const session = await issueSession(res, user, store, config);
    logEvent('auth.signup', { userId: user.id });
    res.status(201).json({ data: session });
  }));

  router.post('/login', asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await store.findByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    const session = await issueSession(res, user, store, config);
    logEvent('auth.login', { userId: user.id, role: user.role });
    res.json({ data: session });
  }));

  router.post('/refresh', asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) throw new HttpError(401, 'REFRESH_REQUIRED', 'Please sign in again.');
    const oldHash = refreshTokenHash(rawToken);
    const stored = await store.findRefreshToken(oldHash);
    if (!stored || new Date(stored.expiresAt).getTime() <= Date.now()) {
      await store.deleteRefreshToken(oldHash);
      res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: config.secureCookies, sameSite: config.sameSite, path: '/api/auth' });
      throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Your session has expired. Please sign in again.');
    }
    const user = await store.get('user', stored.userId);
    await store.deleteRefreshToken(oldHash);
    if (!user) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Your session has expired. Please sign in again.');
    const session = await issueSession(res, user, store, config);
    logEvent('auth.refresh', { userId: user.id });
    res.json({ data: session });
  }));

  router.post('/logout', asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) await store.deleteRefreshToken(refreshTokenHash(rawToken));
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: config.secureCookies, sameSite: config.sameSite, path: '/api/auth' });
    res.json({ data: { signedOut: true } });
  }));

  router.get('/me', authenticate, asyncHandler(async (req, res) => {
    const user = await store.get('user', req.user.id);
    res.json({ data: publicUser(user) });
  }));

  return router;
}
