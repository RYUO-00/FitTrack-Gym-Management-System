import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { parseId } from '../validators';

const paymentSelect = `SELECT pay.payment_id,pay.subscription_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,
  m.member_id,m.member_name,p.plan_name,s.start_date,s.end_date
  FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
  JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id`;

export const list = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').toUpperCase();
  const conditions: string[] = [];
  const values: unknown[] = [];
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
     VALUES($1,$2,COALESCE($3::timestamptz,NOW()),$4,$5) RETURNING payment_id`,
    [body.subscriptionId,body.amount,body.paymentDate ?? null,body.paymentMethod,body.paymentStatus],
  );
  const result = await query(`${paymentSelect} WHERE pay.payment_id=$1`, [inserted.rows[0].payment_id]);
  res.status(201).json(toCamel(result.rows[0]));
});

export const updateStatus = asyncHandler(async (req, res) => {
  const result = await query(`UPDATE payments SET payment_status=$1 WHERE payment_id=$2 RETURNING payment_id`, [req.body.paymentStatus,parseId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'Payment not found.');
  const updated = await query(`${paymentSelect} WHERE pay.payment_id=$1`, [result.rows[0].payment_id]);
  res.json(toCamel(updated.rows[0]));
});
