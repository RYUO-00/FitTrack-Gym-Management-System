-- Create a new subscription record and return its key; existing history is never overwritten.
CREATE OR REPLACE PROCEDURE create_subscription(
  IN p_member_id INTEGER, IN p_gym_id INTEGER, IN p_plan_no INTEGER, IN p_trainer_id INTEGER,
  IN p_start_date DATE, INOUT p_subscription_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE v_duration INTEGER;
BEGIN
  IF p_start_date IS NULL THEN RAISE EXCEPTION 'start_date is required' USING ERRCODE='22004'; END IF;
  IF NOT EXISTS(SELECT 1 FROM gyms WHERE gym_id=p_gym_id AND status='ACTIVE') THEN
    RAISE EXCEPTION 'Branch is inactive or missing' USING ERRCODE='23514';
  END IF;
  SELECT duration_months INTO v_duration FROM membership_plans WHERE gym_id=p_gym_id AND plan_no=p_plan_no AND is_active=TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active membership plan (%, %) was not found',p_gym_id,p_plan_no USING ERRCODE='23503'; END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE member_id=p_member_id AND gym_id=p_gym_id) THEN
    RAISE EXCEPTION 'Member % was not found',p_member_id USING ERRCODE='23503';
  END IF;
  IF p_trainer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainer_id=p_trainer_id AND gym_id=p_gym_id) THEN
    RAISE EXCEPTION 'Trainer % was not found',p_trainer_id USING ERRCODE='23503';
  END IF;
  INSERT INTO subscriptions(member_id,gym_id,plan_no,trainer_id,start_date,end_date,status)
  VALUES(p_member_id,p_gym_id,p_plan_no,p_trainer_id,p_start_date,calculate_expiry_date(p_start_date,v_duration),'ACTIVE')
  RETURNING subscription_id INTO p_subscription_id;
END;
$$;

-- Renew by inserting a new row for the same member. Start after current coverage if still active.
CREATE OR REPLACE PROCEDURE renew_subscription(
  IN p_previous_subscription_id INTEGER, IN p_gym_id INTEGER, IN p_plan_no INTEGER, IN p_trainer_id INTEGER,
  IN p_start_date DATE, INOUT p_subscription_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE v_member_id INTEGER; v_old_end DATE; v_duration INTEGER;
BEGIN
  SELECT member_id,end_date INTO v_member_id,v_old_end FROM subscriptions
  WHERE subscription_id=p_previous_subscription_id AND gym_id=p_gym_id AND status <> 'CANCELLED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Renewable subscription % was not found',p_previous_subscription_id USING ERRCODE='23503'; END IF;
  IF NOT EXISTS(SELECT 1 FROM gyms WHERE gym_id=p_gym_id AND status='ACTIVE') THEN
    RAISE EXCEPTION 'Branch is inactive or missing' USING ERRCODE='23514';
  END IF;
  SELECT duration_months INTO v_duration FROM membership_plans WHERE gym_id=p_gym_id AND plan_no=p_plan_no AND is_active=TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active membership plan (%, %) was not found',p_gym_id,p_plan_no USING ERRCODE='23503'; END IF;
  IF p_trainer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE trainer_id=p_trainer_id AND gym_id=p_gym_id) THEN
    RAISE EXCEPTION 'Trainer % was not found',p_trainer_id USING ERRCODE='23503';
  END IF;
  IF p_start_date IS NULL OR p_start_date < CURRENT_DATE OR
     (v_old_end >= CURRENT_DATE AND p_start_date <= v_old_end) THEN
    p_start_date := GREATEST(CURRENT_DATE,COALESCE(v_old_end+1,CURRENT_DATE));
  END IF;
  INSERT INTO subscriptions(member_id,gym_id,plan_no,trainer_id,start_date,end_date,status)
  VALUES(v_member_id,p_gym_id,p_plan_no,p_trainer_id,p_start_date,calculate_expiry_date(p_start_date,v_duration),'ACTIVE')
  RETURNING subscription_id INTO p_subscription_id;
END;
$$;
