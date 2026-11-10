import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { isIsoDate,parseId } from '../validators';

const attendanceSelect = `SELECT a.attendance_id,a.subscription_id,a.check_in_at,a.check_out_at,
  s.start_date,s.end_date,m.member_id,m.member_name,m.email,p.plan_name,t.trainer_name
  FROM attendance a JOIN subscriptions s ON s.subscription_id=a.subscription_id
  JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id
  LEFT JOIN trainers t ON t.trainer_id=s.trainer_id`;

export const list = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const date = String(req.query.date ?? '');
  const conditions: string[] = [];
  const values: unknown[] = [];
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
  const inserted = await query('INSERT INTO attendance(subscription_id) VALUES($1) RETURNING attendance_id', [req.body.subscriptionId]);
  const result = await query(`${attendanceSelect} WHERE a.attendance_id=$1`, [inserted.rows[0].attendance_id]);
  res.status(201).json(toCamel(result.rows[0]));
});

export const checkOut = asyncHandler(async (req, res) => {
  const result = await query('UPDATE attendance SET check_out_at=NOW() WHERE attendance_id=$1 AND check_out_at IS NULL RETURNING attendance_id', [parseId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'Open attendance visit not found.');
  const updated = await query(`${attendanceSelect} WHERE a.attendance_id=$1`, [result.rows[0].attendance_id]);
  res.json(toCamel(updated.rows[0]));
});
