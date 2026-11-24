import bcrypt from 'bcryptjs';
import { query } from '../database/pool';
import { setSessionCookie, clearSessionCookie } from '../middleware/auth';
import { HttpError } from '../utils/errors';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';

export const login = asyncHandler(async (req, res) => {
  const result = await query<{ admin_id: number; email: string; display_name: string; password_hash: string; gym_id: number | null }>(
    'SELECT admin_id,email,display_name,password_hash,gym_id FROM admins WHERE email=$1', [req.body.email],
  );
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(req.body.password, admin.password_hash))) throw new HttpError(401, 'Email or password is incorrect.');
  const user = { adminId: admin.admin_id, email: admin.email, displayName: admin.display_name, gymId: admin.gym_id };
  setSessionCookie(res, user);
  res.json({ user });
});

export const logout = asyncHandler(async (_req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

export const me = asyncHandler(async (req, res) => {
  const result = await query('SELECT admin_id,email,display_name,gym_id FROM admins WHERE admin_id=$1', [req.admin?.adminId]);
  if (!result.rowCount) throw new HttpError(401, 'Please sign in to continue.');
  res.json({ user: toCamel(result.rows[0]) });
});
