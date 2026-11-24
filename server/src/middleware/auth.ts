import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../database/pool';
import { env } from '../config/env';
import { HttpError } from '../utils/errors';

const COOKIE_NAME = 'fittrack_session';
const SESSION_HOURS = 12;
export type SessionUser = { adminId: number; email: string; displayName: string; gymId?: number | null };
declare global { namespace Express { interface Request { admin?: SessionUser; gymId?: number; gymStatus?: string } } }

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

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    // Refresh branch authorization from PostgreSQL on every request; never trust cookie scope.
    const row = (await query('SELECT admin_id,email,display_name,gym_id FROM admins WHERE admin_id=$1',[session.adminId])).rows[0];
    if (!row) throw new Error('Account removed');
    req.admin = { adminId: row.admin_id, email: row.email, displayName: row.display_name, gymId: row.gym_id };
    next();
  } catch {
    next(new HttpError(401, 'Please sign in to continue.'));
  }
}
