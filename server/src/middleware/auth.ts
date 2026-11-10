import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { HttpError } from '../utils/errors';

const COOKIE_NAME = 'fittrack_session';
const SESSION_HOURS = 12;
export type SessionUser = { adminId: number; email: string; displayName: string };
declare global { namespace Express { interface Request { admin?: SessionUser } } }

const sign = (payload: string) => createHmac('sha256', env.cookieSecret).update(payload).digest('base64url');

export function setSessionCookie(res: Response, user: SessionUser): void {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 })).toString('base64url');
  res.cookie(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/',
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: env.nodeEnv === 'production', sameSite: 'lax', path: '/' });
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!token) throw new Error('Missing session');
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length) throw new Error('Malformed session');
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid signature');
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionUser & { exp?: number };
    if (!session.adminId || !session.email || !session.exp || session.exp < Date.now()) throw new Error('Expired session');
    req.admin = { adminId: session.adminId, email: session.email, displayName: session.displayName };
    next();
  } catch {
    next(new HttpError(401, 'Please sign in to continue.'));
  }
}
