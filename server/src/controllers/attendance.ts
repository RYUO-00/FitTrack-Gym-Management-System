import { requireActiveBranch } from '../middleware/branch';
import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { isIsoDate,parseId } from '../validators';

const attendanceSelect = `SELECT a.attendance_id,a.subscription_id,a.check_in_at,a.check_out_at,
  s.start_date,s.end_date,m.member_id,m.member_name,m.email,p.plan_name,t.trainer_name
  FROM attendance a JOIN subscriptions s ON s.subscription_id=a.subscription_id
  JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no
  LEFT JOIN trainers t ON t.trainer_id=s.trainer_id`;

export const list = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const date = String(req.query.date ?? '');
  const conditions: string[] = ['s.gym_id=$1'];
  const values: unknown[] = [req.gymId!];
  if (search) { values.push(`%${search}%`); conditions.push(`(m.member_name ILIKE $${values.length} OR m.email ILIKE $${values.length})`); }
  if (date) {
    if (!isIsoDate(date)) throw new HttpError(400,'Use a valid YYYY-MM-DD attendance date.');
    values.push(date); conditions.push(`a.check_in_at::DATE=$${values.length}::date`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`${attendanceSelect} ${where} ORDER BY a.check_in_at DESC LIMIT 500`, values);
  res.json(toCamel(result.rows));
});

export const checkIn = asyncHandler(async (req, res) => {
  requireActiveBranch(req);
  const inserted = await query('INSERT INTO attendance(subscription_id) SELECT subscription_id FROM subscriptions WHERE subscription_id=$1 AND gym_id=$2 RETURNING attendance_id', [req.body.subscriptionId,req.gymId!]);
  if(!inserted.rowCount)throw new HttpError(404,'Subscription not found in this branch.');
  const result = await query(`${attendanceSelect} WHERE a.attendance_id=$1`, [inserted.rows[0].attendance_id]);
  res.status(201).json(toCamel(result.rows[0]));
});

export const checkOut = asyncHandler(async (req, res) => {
  const result = await query('UPDATE attendance a SET check_out_at=NOW() FROM subscriptions s WHERE a.subscription_id=s.subscription_id AND a.attendance_id=$1 AND s.gym_id=$2 AND a.check_out_at IS NULL RETURNING a.attendance_id', [parseId(req.params.id),req.gymId!]);
  if (!result.rowCount) throw new HttpError(404, 'Open attendance visit not found.');
  const updated = await query(`${attendanceSelect} WHERE a.attendance_id=$1`, [result.rows[0].attendance_id]);
  res.json(toCamel(updated.rows[0]));
});
