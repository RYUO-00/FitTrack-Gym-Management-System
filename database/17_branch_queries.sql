-- Demonstration: organization administrators can run these SQL examples directly.
-- HTTP APIs instead bind the authorized branch as a parameter on every request.
WITH selected_branch AS (SELECT gym_id FROM gyms WHERE branch_name='FitTrack Main Branch')
SELECT g.gym_id,g.branch_name,g.city,g.status,COUNT(p.plan_no) AS plans
FROM gyms g JOIN selected_branch b USING(gym_id)
LEFT JOIN membership_plans p USING(gym_id) GROUP BY g.gym_id;

-- Branch-scoped members and trainers include zero-subscription registrations.
SELECT member_id,member_name,email,join_date FROM members
WHERE gym_id=(SELECT gym_id FROM gyms WHERE branch_name='FitTrack Main Branch') ORDER BY member_name;
SELECT trainer_id,trainer_name,specialization FROM trainers
WHERE gym_id=(SELECT gym_id FROM gyms WHERE branch_name='FitTrack Main Branch') ORDER BY trainer_name;

-- A composite key joins the plan without mixing branch-local plan numbers.
SELECT s.subscription_id,g.branch_name,m.member_name,p.plan_no,p.plan_name,s.end_date
FROM subscriptions s JOIN gyms g USING(gym_id) JOIN members m USING(member_id)
JOIN membership_plans p ON (p.gym_id,p.plan_no)=(s.gym_id,s.plan_no)
WHERE g.branch_name='FitTrack Main Branch' ORDER BY s.end_date;

-- Monthly view retains the branch key for independently filterable reports.
SELECT month,gym_id,total_payments_received,successful_payment_count FROM v_monthly_revenue
WHERE gym_id=(SELECT gym_id FROM gyms WHERE branch_name='FitTrack Main Branch') ORDER BY month;

-- Eligibility and attendance branch are derived from the subscription.
SELECT a.attendance_id,g.branch_name,m.member_name,a.check_in_at
FROM attendance a JOIN subscriptions s USING(subscription_id) JOIN gyms g USING(gym_id)
JOIN members m USING(member_id) WHERE g.branch_name='FitTrack Main Branch' ORDER BY a.check_in_at DESC;
