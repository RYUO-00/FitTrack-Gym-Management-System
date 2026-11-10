import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';

export const dashboard = asyncHandler(async (_req, res) => {
  const [stats, revenue, planMix, recentPayments, recentMembers, expirations, attendance] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*)::INTEGER FROM members) AS total_members,
      (SELECT COUNT(*)::INTEGER FROM subscriptions WHERE status='ACTIVE' AND CURRENT_DATE BETWEEN start_date AND end_date) AS active_subscriptions,
      (SELECT COUNT(*)::INTEGER FROM subscriptions WHERE status<>'CANCELLED' AND end_date<CURRENT_DATE) AS expired_subscriptions,
      (SELECT COALESCE(SUM(amount),0)::NUMERIC(12,2) FROM payments WHERE payment_status='PAID' AND payment_date>=DATE_TRUNC('month',CURRENT_DATE)) AS monthly_revenue,
      (SELECT COALESCE(SUM(amount),0)::NUMERIC(12,2) FROM payments WHERE payment_status='PENDING') AS pending_payments,
      (SELECT COUNT(*)::INTEGER FROM attendance WHERE check_in_at::DATE=CURRENT_DATE) AS todays_attendance`),
    query(`WITH months AS (SELECT GENERATE_SERIES(DATE_TRUNC('month',CURRENT_DATE)-INTERVAL '5 months',DATE_TRUNC('month',CURRENT_DATE),INTERVAL '1 month') AS month)
      SELECT m.month::DATE AS month,COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status='PAID'),0)::NUMERIC(12,2) AS revenue
      FROM months m LEFT JOIN payments p ON DATE_TRUNC('month',p.payment_date)=m.month
      GROUP BY m.month ORDER BY m.month`),
    query(`SELECT p.plan_name,COUNT(s.subscription_id)::INTEGER AS active_subscriptions
      FROM membership_plans p LEFT JOIN subscriptions s ON s.plan_id=p.plan_id AND s.status='ACTIVE'
        AND CURRENT_DATE BETWEEN s.start_date AND s.end_date
      GROUP BY p.plan_id,p.plan_name ORDER BY active_subscriptions DESC,p.plan_name`),
    query(`SELECT pay.payment_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,
        m.member_name,p.plan_name FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
        JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id
        ORDER BY pay.payment_date DESC LIMIT 6`),
    query(`SELECT member_id,member_name,email,join_date FROM members ORDER BY created_at DESC LIMIT 5`),
    query(`SELECT s.subscription_id,m.member_name,p.plan_name,s.end_date,
        (s.end_date-CURRENT_DATE)::INTEGER AS days_remaining FROM subscriptions s
        JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id
        WHERE s.status='ACTIVE' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 ORDER BY s.end_date LIMIT 8`),
    query(`SELECT days.day::DATE AS attendance_day,COUNT(a.attendance_id)::INTEGER AS visits
      FROM GENERATE_SERIES(CURRENT_DATE-INTERVAL '6 days',CURRENT_DATE,INTERVAL '1 day') days(day)
      LEFT JOIN attendance a ON a.check_in_at::DATE=days.day::DATE
      GROUP BY days.day ORDER BY days.day`),
  ]);
  res.json(toCamel({ stats: stats.rows[0], revenue: revenue.rows, planMix: planMix.rows, recentPayments: recentPayments.rows,
    recentMembers: recentMembers.rows, expirations: expirations.rows, attendance: attendance.rows }));
});
