-- 1. List members with their join dates, newest first.
SELECT member_id, member_name, email, phone, join_date FROM members ORDER BY join_date DESC, member_name;

-- 2. Find subscriptions that are currently in force; dates are evaluated at query time.
SELECT subscription_id, member_id, gym_id,plan_no, start_date, end_date FROM subscriptions
WHERE status='ACTIVE' AND CURRENT_DATE BETWEEN start_date AND end_date ORDER BY end_date;

-- 3. Find subscriptions whose date range has ended (excluding cancelled records).
SELECT subscription_id, member_id, gym_id,plan_no, end_date FROM subscriptions
WHERE status <> 'CANCELLED' AND end_date < CURRENT_DATE ORDER BY end_date DESC;

-- 4. Find subscriptions expiring during the next seven calendar days.
SELECT subscription_id, member_id, gym_id,plan_no, end_date FROM subscriptions
WHERE status='ACTIVE' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 ORDER BY end_date;

-- 5. Find active plans with their prices.
SELECT plan_name, duration_months, price FROM membership_plans WHERE is_active ORDER BY price;

-- 6. Find payment records with an outstanding or unsuccessful status.
SELECT payment_id, subscription_id, amount, payment_status, payment_date FROM payments
WHERE payment_status IN ('PENDING','FAILED') ORDER BY payment_date DESC;

-- 7. Show members who joined in the current calendar month.
SELECT member_id, member_name, join_date FROM members
WHERE join_date >= DATE_TRUNC('month', CURRENT_DATE)::DATE ORDER BY join_date;

-- 8. Demonstrate INSERT, UPDATE and DELETE on real tables, then roll all three back.
BEGIN;
INSERT INTO members (gym_id,member_name,email,phone) VALUES ((SELECT gym_id FROM gyms ORDER BY gym_id LIMIT 1),'SQL Demo Member','sql.demo@example.test','+91-90000-99999');
UPDATE members SET member_name='SQL Demo Updated' WHERE email='sql.demo@example.test';
DELETE FROM members WHERE email='sql.demo@example.test';
ROLLBACK;
