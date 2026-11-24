-- Current active subscription snapshot; expired status is date-derived at query time.
CREATE OR REPLACE VIEW v_active_subscriptions AS
SELECT s.subscription_id,m.member_id,m.member_name,m.email,m.phone,
       p.gym_id,p.plan_no,p.plan_name,p.duration_months,p.price,
       t.trainer_id,t.trainer_name,t.specialization,
       s.start_date,s.end_date,
       CASE WHEN s.status='CANCELLED' THEN 'CANCELLED'
            WHEN CURRENT_DATE>s.end_date THEN 'EXPIRED'
            WHEN CURRENT_DATE<s.start_date THEN 'UPCOMING'
            ELSE 'ACTIVE' END AS effective_status
FROM subscriptions s JOIN members m ON m.member_id=s.member_id
JOIN membership_plans p ON p.gym_id=s.gym_id AND p.plan_no=s.plan_no
LEFT JOIN trainers t ON t.trainer_id=s.trainer_id
WHERE s.status='ACTIVE' AND CURRENT_DATE BETWEEN s.start_date AND s.end_date;

-- Monthly successful revenue, grouped by the payment date in the database session time zone.
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT DATE_TRUNC('month',payment_date)::DATE AS month,
       COALESCE(SUM(amount) FILTER (WHERE payment_status='PAID'),0)::NUMERIC(12,2) AS total_payments_received,
       COUNT(*) FILTER (WHERE p.payment_status='PAID') AS successful_payment_count,
       s.gym_id
FROM payments p JOIN subscriptions s USING(subscription_id)
GROUP BY s.gym_id,DATE_TRUNC('month',payment_date)::DATE;
