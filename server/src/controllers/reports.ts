import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
import { HttpError } from '../utils/errors';
import { isIsoDate } from '../validators';

export const reports = asyncHandler(async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  if ((from !== undefined && !isIsoDate(from)) || (to !== undefined && !isIsoDate(to))) throw new HttpError(400, 'Use a valid YYYY-MM-DD date for report filters.');
  const [range] = await query<{ from_date: string; to_date: string }>(
    `SELECT COALESCE($1::date,CURRENT_DATE-INTERVAL '11 months')::DATE AS from_date,
            COALESCE($2::date,CURRENT_DATE)::DATE AS to_date`, [from ?? null,to ?? null],
  ).then((result) => result.rows);
  if (range.from_date > range.to_date) throw new HttpError(400, 'The start date must be before the end date.');
  const dates = [range.from_date,range.to_date];
  const [revenue, plans, statuses, attendance, trainers, pending] = await Promise.all([
    query(`WITH months AS (SELECT GENERATE_SERIES(DATE_TRUNC('month',$1::date),DATE_TRUNC('month',$2::date),INTERVAL '1 month') AS month)
      SELECT months.month::DATE AS month,COALESCE(SUM(pay.amount),0)::NUMERIC(12,2) AS revenue,COUNT(pay.payment_id)::INTEGER AS paid_payments
      FROM months LEFT JOIN payments pay ON DATE_TRUNC('month',pay.payment_date)=months.month
        AND pay.payment_status='PAID' AND pay.payment_date >= $1::date AND pay.payment_date < $2::date+1
      GROUP BY months.month ORDER BY months.month`, dates),
    query(`SELECT p.plan_name,COUNT(s.subscription_id)::INTEGER AS subscriptions
      FROM membership_plans p LEFT JOIN subscriptions s ON s.plan_id=p.plan_id AND s.start_date BETWEEN $1::date AND $2::date
      GROUP BY p.plan_id,p.plan_name ORDER BY subscriptions DESC,p.plan_name`, dates),
    query(`SELECT CASE WHEN status='CANCELLED' THEN 'CANCELLED' WHEN CURRENT_DATE<start_date THEN 'UPCOMING'
        WHEN CURRENT_DATE>end_date THEN 'EXPIRED' ELSE 'ACTIVE' END AS effective_status,COUNT(*)::INTEGER AS subscriptions
      FROM subscriptions WHERE start_date BETWEEN $1::date AND $2::date
      GROUP BY effective_status ORDER BY effective_status`, dates),
    query(`SELECT m.member_id,m.member_name,COUNT(a.attendance_id)::INTEGER AS visits
      FROM members m LEFT JOIN subscriptions s ON s.member_id=m.member_id
      LEFT JOIN attendance a ON a.subscription_id=s.subscription_id AND a.check_in_at >= $1::date AND a.check_in_at < $2::date+1
      GROUP BY m.member_id,m.member_name ORDER BY visits DESC,m.member_name LIMIT 20`, dates),
    query(`SELECT t.trainer_name,t.specialization,COUNT(DISTINCT s.member_id)::INTEGER AS assigned_members
      FROM trainers t LEFT JOIN subscriptions s ON s.trainer_id=t.trainer_id AND s.start_date BETWEEN $1::date AND $2::date
      GROUP BY t.trainer_id,t.trainer_name,t.specialization ORDER BY assigned_members DESC,t.trainer_name`, dates),
    query(`SELECT pay.payment_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,m.member_name,p.plan_name
      FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
      JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id
      WHERE pay.payment_status='PENDING' AND pay.payment_date >= $1::date AND pay.payment_date < $2::date+1
      ORDER BY pay.payment_date DESC`, dates),
  ]);
  res.json(toCamel({ range, revenue: revenue.rows, plans: plans.rows, statuses: statuses.rows,
    attendance: attendance.rows, trainers: trainers.rows, pending: pending.rows }));
});
