-- 15. Find the most popular plan by subscription count; ties are returned.
SELECT p.plan_id,p.plan_name,COUNT(*) AS subscriptions
FROM membership_plans p JOIN subscriptions s ON s.plan_id=p.plan_id
GROUP BY p.plan_id,p.plan_name HAVING COUNT(*)=(
  SELECT MAX(plan_total) FROM (SELECT COUNT(*) AS plan_total FROM subscriptions GROUP BY plan_id) totals
);

-- 16. Correlated subquery: trainers with the highest assigned member count (ties included).
SELECT t.trainer_id,t.trainer_name,
  (SELECT COUNT(DISTINCT s.member_id) FROM subscriptions s WHERE s.trainer_id=t.trainer_id) AS assigned_members
FROM trainers t WHERE (SELECT COUNT(DISTINCT s.member_id) FROM subscriptions s WHERE s.trainer_id=t.trainer_id)
  >= ALL (SELECT COUNT(DISTINCT s2.member_id) FROM subscriptions s2 GROUP BY s2.trainer_id);

-- 17. Find members who have never visited using NOT EXISTS.
SELECT m.member_id,m.member_name FROM members m
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s JOIN attendance a ON a.subscription_id=s.subscription_id
                  WHERE s.member_id=m.member_id);

-- 18. Find members with at least one pending payment using EXISTS.
SELECT m.member_id,m.member_name FROM members m
WHERE EXISTS (SELECT 1 FROM subscriptions s JOIN payments pay ON pay.subscription_id=s.subscription_id
              WHERE s.member_id=m.member_id AND pay.payment_status='PENDING');

-- 19. Find members whose total visit count is greater than the average member visit count.
WITH visit_totals AS (
  SELECT m.member_id,m.member_name,COUNT(a.attendance_id) AS visits
  FROM members m LEFT JOIN subscriptions s ON s.member_id=m.member_id
  LEFT JOIN attendance a ON a.subscription_id=s.subscription_id GROUP BY m.member_id,m.member_name
)
SELECT member_id,member_name,visits FROM visit_totals
WHERE visits > (SELECT AVG(visits)::NUMERIC FROM visit_totals) ORDER BY visits DESC;

-- 20. Find trainers without an assigned subscription using NOT EXISTS.
SELECT t.trainer_id,t.trainer_name FROM trainers t
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.trainer_id=t.trainer_id);

-- 21. Find members with multiple subscription records (renewals and plan changes included).
SELECT m.member_id,m.member_name FROM members m WHERE m.member_id IN (
  SELECT s.member_id FROM subscriptions s GROUP BY s.member_id HAVING COUNT(*)>1
) ORDER BY m.member_name;

-- 22. Find payments greater than the average payment amount.
SELECT payment_id,subscription_id,amount FROM payments
WHERE amount > (SELECT AVG(amount) FROM payments) ORDER BY amount DESC;
