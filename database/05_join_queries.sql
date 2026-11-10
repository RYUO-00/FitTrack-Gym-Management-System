-- 9. INNER JOIN: active subscriptions with member and plan names.
SELECT s.subscription_id,m.member_name,p.plan_name,s.start_date,s.end_date
FROM subscriptions s INNER JOIN members m ON m.member_id=s.member_id
INNER JOIN membership_plans p ON p.plan_id=s.plan_id
WHERE s.status='ACTIVE' AND CURRENT_DATE BETWEEN s.start_date AND s.end_date;

-- 10. LEFT JOIN: retain members who have never subscribed.
SELECT m.member_id,m.member_name,COUNT(s.subscription_id) AS subscription_count
FROM members m LEFT JOIN subscriptions s ON s.member_id=m.member_id
GROUP BY m.member_id,m.member_name ORDER BY subscription_count,m.member_name;

-- 11. Multiple joins: list paid transactions with member, plan and optional trainer.
SELECT pay.payment_id,m.member_name,p.plan_name,t.trainer_name,pay.amount,pay.payment_date
FROM payments pay JOIN subscriptions s ON s.subscription_id=pay.subscription_id
JOIN members m ON m.member_id=s.member_id JOIN membership_plans p ON p.plan_id=s.plan_id
LEFT JOIN trainers t ON t.trainer_id=s.trainer_id WHERE pay.payment_status='PAID'
ORDER BY pay.payment_date DESC;

-- 12. RIGHT JOIN: retain every trainer, including those without an assignment.
SELECT t.trainer_name,s.subscription_id,m.member_name
FROM subscriptions s RIGHT JOIN trainers t ON t.trainer_id=s.trainer_id
LEFT JOIN members m ON m.member_id=s.member_id ORDER BY t.trainer_name;

-- 13. Attendance history with the member attached to each subscription.
SELECT a.attendance_id,m.member_name,a.check_in_at,a.check_out_at
FROM attendance a JOIN subscriptions s ON s.subscription_id=a.subscription_id
JOIN members m ON m.member_id=s.member_id ORDER BY a.check_in_at DESC;

-- 14. Payment history for a selected member, showing all linked plan records.
SELECT m.member_name,pay.payment_id,pay.amount,pay.payment_method,pay.payment_status
FROM members m JOIN subscriptions s ON s.member_id=m.member_id
JOIN payments pay ON pay.subscription_id=s.subscription_id
WHERE m.email='maya.kapoor@example.test' ORDER BY pay.payment_date DESC;
