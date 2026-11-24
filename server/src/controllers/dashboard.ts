import { query } from '../database/pool';
import { asyncHandler } from '../utils/async-handler';
import { toCamel } from '../utils/format';
export const dashboard=asyncHandler(async(req,res)=>{
 const args=[req.gymId!];
 const [stats,revenue,planMix,recentPayments,recentMembers,expirations,attendance]=await Promise.all([
  query(`SELECT
   (SELECT count(*)::int FROM members WHERE gym_id=$1) AS total_members,
   (SELECT count(*)::int FROM subscriptions WHERE gym_id=$1 AND status='ACTIVE' AND CURRENT_DATE BETWEEN start_date AND end_date) AS active_subscriptions,
   (SELECT count(*)::int FROM subscriptions WHERE gym_id=$1 AND status<>'CANCELLED' AND end_date<CURRENT_DATE) AS expired_subscriptions,
   (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN subscriptions s USING(subscription_id) WHERE s.gym_id=$1 AND p.payment_status='PAID' AND p.payment_date>=date_trunc('month',CURRENT_DATE)) AS monthly_revenue,
   (SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN subscriptions s USING(subscription_id) WHERE s.gym_id=$1 AND p.payment_status='PENDING') AS pending_payments,
   (SELECT count(*)::int FROM attendance a JOIN subscriptions s USING(subscription_id) WHERE s.gym_id=$1 AND a.check_in_at::date=CURRENT_DATE) AS todays_attendance`,args),
  query(`WITH months AS(SELECT generate_series(date_trunc('month',CURRENT_DATE)-INTERVAL '5 months',date_trunc('month',CURRENT_DATE),INTERVAL '1 month') AS month)
   SELECT m.month::date AS month,COALESCE(SUM(p.amount) FILTER(WHERE p.payment_status='PAID'),0) AS revenue
   FROM months m LEFT JOIN(SELECT p.* FROM payments p JOIN subscriptions s USING(subscription_id) WHERE s.gym_id=$1)p ON date_trunc('month',p.payment_date)=m.month
   GROUP BY m.month ORDER BY m.month`,args),
  query(`SELECT p.gym_id,p.plan_no,p.plan_name,count(s.subscription_id)::int AS active_subscriptions
   FROM membership_plans p LEFT JOIN subscriptions s ON s.gym_id=p.gym_id AND s.plan_no=p.plan_no AND s.status='ACTIVE' AND CURRENT_DATE BETWEEN s.start_date AND s.end_date
   WHERE p.gym_id=$1 GROUP BY p.gym_id,p.plan_no ORDER BY active_subscriptions DESC,p.plan_name`,args),
  query(`SELECT pay.payment_id,pay.amount,pay.payment_date,pay.payment_method,pay.payment_status,m.member_name,p.plan_name
   FROM payments pay JOIN subscriptions s USING(subscription_id) JOIN members m USING(member_id)
   JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no WHERE s.gym_id=$1 ORDER BY pay.payment_date DESC LIMIT 6`,args),
  query('SELECT member_id,member_name,email,join_date FROM members WHERE gym_id=$1 ORDER BY created_at DESC LIMIT 5',args),
  query(`SELECT s.subscription_id,m.member_name,p.plan_name,s.end_date,(s.end_date-CURRENT_DATE)::int AS days_remaining
   FROM subscriptions s JOIN members m USING(member_id) JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no
   WHERE s.gym_id=$1 AND s.status='ACTIVE' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 ORDER BY s.end_date LIMIT 8`,args),
  query(`SELECT d.day::date AS attendance_day,count(a.attendance_id)::int AS visits
   FROM generate_series(CURRENT_DATE-INTERVAL '6 days',CURRENT_DATE,INTERVAL '1 day')d(day)
   LEFT JOIN(SELECT a.* FROM attendance a JOIN subscriptions s USING(subscription_id) WHERE s.gym_id=$1)a ON a.check_in_at::date=d.day::date
   GROUP BY d.day ORDER BY d.day`,args),
 ]);
 res.json(toCamel({gymId:req.gymId,stats:stats.rows[0],revenue:revenue.rows,planMix:planMix.rows,recentPayments:recentPayments.rows,recentMembers:recentMembers.rows,expirations:expirations.rows,attendance:attendance.rows}));
});
