import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { parseId } from '../validators';

const paymentSelect = `SELECT pay.payment_id,pay.subscription_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,
  m.member_id,m.member_name,p.plan_name,s.start_date,s.end_date
  FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
  JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no`;

export const list = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').toUpperCase();
  const conditions: string[] = ['s.gym_id=$1'];
  const values: unknown[] = [req.gymId!];
  if (search) { values.push(`%${search}%`); conditions.push(`(m.member_name ILIKE $${values.length} OR p.plan_name ILIKE $${values.length} OR pay.payment_method ILIKE $${values.length})`); }
  if (['PAID','PENDING','FAILED','REFUNDED'].includes(status)) { values.push(status); conditions.push(`pay.payment_status=$${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`${paymentSelect} ${where} ORDER BY pay.payment_date DESC LIMIT 300`, values);
  res.json(toCamel(result.rows));
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body as { subscriptionId: number; amount: number; paymentDate?: string; paymentMethod: string; paymentStatus: string };
  const inserted = await query(
    `INSERT INTO payments(subscription_id,amount,payment_date,payment_method,payment_status)
     SELECT $1,$2,COALESCE($3::timestamptz,NOW()),$4,$5 FROM subscriptions WHERE subscription_id=$1 AND gym_id=$6 RETURNING payment_id`,
    [body.subscriptionId,body.amount,body.paymentDate ?? null,body.paymentMethod,body.paymentStatus,req.gymId!],
  );
  if(!inserted.rowCount)throw new HttpError(404,'Subscription not found in this branch.');
  const result = await query(`${paymentSelect} WHERE pay.payment_id=$1`, [inserted.rows[0].payment_id]);
  res.status(201).json(toCamel(result.rows[0]));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const result = await query(`UPDATE payments pay SET payment_status=$1 FROM subscriptions s WHERE pay.subscription_id=s.subscription_id AND pay.payment_id=$2 AND s.gym_id=$3 RETURNING pay.payment_id`, [req.body.paymentStatus,parseId(req.params.id),req.gymId!]);
  if (!result.rowCount) throw new HttpError(404, 'Payment not found.');
  const updated = await query(`${paymentSelect} WHERE pay.payment_id=$1`, [result.rows[0].payment_id]);
  res.json(toCamel(updated.rows[0]));
});
