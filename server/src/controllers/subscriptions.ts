import { query, inTransaction } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { parseId } from '../validators';

const listSql = `SELECT s.subscription_id,s.member_id,s.plan_id,s.trainer_id,s.start_date,s.end_date,s.status,s.created_at,
  m.member_name,m.email,p.plan_name,p.duration_months,p.price,t.trainer_name,
  CASE WHEN s.status='CANCELLED' THEN 'CANCELLED' WHEN CURRENT_DATE<s.start_date THEN 'UPCOMING'
       WHEN CURRENT_DATE>s.end_date THEN 'EXPIRED' ELSE 'ACTIVE' END AS effective_status
  FROM subscriptions s JOIN members m ON m.member_id=s.member_id
  JOIN membership_plans p ON p.plan_id=s.plan_id LEFT JOIN trainers t ON t.trainer_id=s.trainer_id`;

export const list = asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? '').toUpperCase();
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10) || 10));
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (search) { values.push(`%${search}%`); conditions.push(`(m.member_name ILIKE $${values.length} OR p.plan_name ILIKE $${values.length})`); }
  if (['ACTIVE','EXPIRED','CANCELLED','UPCOMING'].includes(status)) {
    values.push(status);
    conditions.push(`(CASE WHEN s.status='CANCELLED' THEN 'CANCELLED' WHEN CURRENT_DATE<s.start_date THEN 'UPCOMING' WHEN CURRENT_DATE>s.end_date THEN 'EXPIRED' ELSE 'ACTIVE' END)=$${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM subscriptions s JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id ${where}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const rows = await query(`${listSql} ${where} ORDER BY s.start_date DESC,s.subscription_id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  const total = Number(count.rows[0]?.count ?? 0);
  res.json(toCamel({ rows: rows.rows, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }));
});

export const getOne = asyncHandler(async (req, res) => {
  const result = await query(`${listSql} WHERE s.subscription_id=$1`, [parseId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'Subscription not found.');
  res.json(toCamel(result.rows[0]));
});

export const create = asyncHandler(async (req, res) => {
  const body = req.body as { memberId: number; planId: number; trainerId?: number | null; startDate: string; amount?: number; paymentMethod?: string };
  const subscription = await inTransaction(async (client) => {
    const created = await client.query<{ p_subscription_id: number }>(
      'CALL create_subscription($1,$2,$3,$4,NULL)', [body.memberId, body.planId, body.trainerId ?? null, body.startDate],
    );
    const id = created.rows[0]?.p_subscription_id;
    if (!id) throw new Error('Subscription procedure did not return the new identifier.');
    if (body.amount !== undefined) {
      await client.query(`INSERT INTO payments(subscription_id,amount,payment_method,payment_status)
        VALUES($1,$2,$3,'PAID')`, [id, body.amount, body.paymentMethod ?? 'UPI']);
    }
    const row = await client.query(`${listSql} WHERE s.subscription_id=$1`, [id]);
    return row.rows[0];
  });
  res.status(201).json(toCamel(subscription));
});

export const renew = asyncHandler(async (req, res) => {
  const previousId = parseId(req.params.id);
  const body = req.body as { planId: number; trainerId?: number | null; startDate?: string; amount?: number; paymentMethod?: string };
  const renewed = await inTransaction(async (client) => {
    const call = await client.query<{ p_subscription_id: number }>(
      'CALL renew_subscription($1,$2,$3,$4,NULL)', [previousId, body.planId, body.trainerId ?? null, body.startDate ?? null],
    );
    const id = call.rows[0]?.p_subscription_id;
    if (!id) throw new Error('Renewal procedure did not return the new identifier.');
    if (body.amount !== undefined) {
      await client.query(`INSERT INTO payments(subscription_id,amount,payment_method,payment_status)
        VALUES($1,$2,$3,'PAID')`, [id, body.amount, body.paymentMethod ?? 'UPI']);
    }
    const row = await client.query(`${listSql} WHERE s.subscription_id=$1`, [id]);
    return row.rows[0];
  });
  res.status(201).json(toCamel(renewed));
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await query(`UPDATE subscriptions SET status='CANCELLED' WHERE subscription_id=$1 AND status<>'CANCELLED' RETURNING subscription_id,status`, [parseId(req.params.id)]);
  if (!result.rowCount) throw new HttpError(404, 'Subscription not found or already cancelled.');
  res.json(toCamel(result.rows[0]));
});
