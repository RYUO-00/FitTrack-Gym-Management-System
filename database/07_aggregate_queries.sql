-- 23. Calculate all-time recognized revenue from successful payments only.
SELECT COALESCE(SUM(amount),0)::NUMERIC(12,2) AS total_revenue FROM payments WHERE payment_status='PAID';

-- 24. Calculate month-wise recognized revenue and successful transaction counts.
SELECT DATE_TRUNC('month',payment_date)::DATE AS month,
  SUM(amount) FILTER (WHERE payment_status='PAID')::NUMERIC(12,2) AS revenue,
  COUNT(*) FILTER (WHERE payment_status='PAID') AS successful_payments
FROM payments GROUP BY DATE_TRUNC('month',payment_date) ORDER BY month;

-- 25. Count plans purchased and total paid per plan.
SELECT p.plan_name,COUNT(DISTINCT s.subscription_id) AS subscriptions,
  COALESCE(SUM(pay.amount) FILTER (WHERE pay.payment_status='PAID'),0)::NUMERIC(12,2) AS revenue
FROM membership_plans p LEFT JOIN subscriptions s ON s.plan_id=p.plan_id
LEFT JOIN payments pay ON pay.subscription_id=s.subscription_id
GROUP BY p.plan_id,p.plan_name ORDER BY subscriptions DESC;

-- 26. Trainer member assignment totals with zero-assignment trainers retained.
SELECT t.trainer_name,COUNT(DISTINCT s.member_id) AS assigned_members
FROM trainers t LEFT JOIN subscriptions s ON s.trainer_id=t.trainer_id
GROUP BY t.trainer_id,t.trainer_name ORDER BY assigned_members DESC,t.trainer_name;

-- 27. Payment counts and balances by status.
SELECT payment_status,COUNT(*) AS payment_count,SUM(amount)::NUMERIC(12,2) AS amount_total
FROM payments GROUP BY payment_status ORDER BY payment_status;

-- 28. Average recognized revenue per member who has made at least one successful payment.
SELECT AVG(member_revenue)::NUMERIC(12,2) AS average_paid_revenue_per_paying_member FROM (
  SELECT s.member_id,SUM(pay.amount) AS member_revenue FROM subscriptions s
  JOIN payments pay ON pay.subscription_id=s.subscription_id WHERE pay.payment_status='PAID'
  GROUP BY s.member_id
) revenue_by_member;

-- 29. Attendance counts by day for the most recent thirty days.
SELECT check_in_at::DATE AS attendance_day,COUNT(*) AS visits
FROM attendance WHERE check_in_at >= NOW()-INTERVAL '30 days'
GROUP BY check_in_at::DATE ORDER BY attendance_day;

-- 30. Monthly new member registrations, using a date range.
SELECT DATE_TRUNC('month',join_date)::DATE AS month,COUNT(*) AS new_members
FROM members WHERE join_date >= CURRENT_DATE-INTERVAL '12 months'
GROUP BY DATE_TRUNC('month',join_date) ORDER BY month;
