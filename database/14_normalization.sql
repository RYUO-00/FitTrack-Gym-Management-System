-- Lossless reconstruction demonstration. A compact report relation is decomposed into
-- a subscription fact and its member, plan, and trainer dimensions.
WITH original_report AS (
  SELECT s.subscription_id,s.member_id,m.member_name,m.email,
         s.plan_id,p.plan_name,p.duration_months,p.price,
         s.trainer_id,t.trainer_name,s.start_date,s.end_date,s.status
  FROM subscriptions s JOIN members m ON m.member_id=s.member_id
  JOIN membership_plans p ON p.plan_id=s.plan_id
  LEFT JOIN trainers t ON t.trainer_id=s.trainer_id
),
subscription_fact AS (
  SELECT subscription_id,member_id,plan_id,trainer_id,start_date,end_date,status FROM subscriptions
),
member_dimension AS (
  SELECT member_id,member_name,email FROM members
),
plan_dimension AS (
  SELECT plan_id,plan_name,duration_months,price FROM membership_plans
),
trainer_dimension AS (
  SELECT trainer_id,trainer_name FROM trainers
),
reconstructed AS (
  SELECT sf.subscription_id,sf.member_id,md.member_name,md.email,
         sf.plan_id,pd.plan_name,pd.duration_months,pd.price,
         sf.trainer_id,td.trainer_name,sf.start_date,sf.end_date,sf.status
  FROM subscription_fact sf JOIN member_dimension md ON md.member_id=sf.member_id
  JOIN plan_dimension pd ON pd.plan_id=sf.plan_id
  LEFT JOIN trainer_dimension td ON td.trainer_id=sf.trainer_id
)
SELECT (SELECT COUNT(*) FROM original_report) AS original_rows,
       (SELECT COUNT(*) FROM reconstructed) AS reconstructed_rows,
       (SELECT COUNT(*) FROM original_report o FULL JOIN reconstructed r
         ON r.subscription_id=o.subscription_id
         WHERE o.subscription_id IS NULL OR r.subscription_id IS NULL
            OR ROW(o.member_id,o.member_name,o.email,o.plan_id,o.plan_name,o.duration_months,o.price,o.trainer_id,o.trainer_name,o.start_date,o.end_date,o.status)
               IS DISTINCT FROM
               ROW(r.member_id,r.member_name,r.email,r.plan_id,r.plan_name,r.duration_months,r.price,r.trainer_id,r.trainer_name,r.start_date,r.end_date,r.status)
       ) AS mismatched_or_missing_rows;
