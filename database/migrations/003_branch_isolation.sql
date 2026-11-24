-- Apply after 002, as the existing table owner. No tables or records are deleted.
-- Ambiguous legacy ownership aborts; never guess an owner for a multi-branch person.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path TO public,pg_catalog;
LOCK TABLE gyms,admins,members,trainers,subscriptions IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE default_gym INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
                AND table_name='members' AND column_name='gym_id') THEN
    IF EXISTS(SELECT member_id FROM subscriptions GROUP BY member_id HAVING COUNT(DISTINCT gym_id)>1)
       OR EXISTS(SELECT trainer_id FROM subscriptions WHERE trainer_id IS NOT NULL
                 GROUP BY trainer_id HAVING COUNT(DISTINCT gym_id)>1) THEN
      RAISE EXCEPTION 'Ambiguous legacy member/trainer branch ownership. Resolve explicitly before migration; no changes committed';
    END IF;
    SELECT gym_id INTO default_gym FROM gyms WHERE branch_name='FitTrack Main Branch';
    IF default_gym IS NULL THEN RAISE EXCEPTION 'Default branch is missing; apply migration 002 first'; END IF;
    ALTER TABLE gyms RENAME COLUMN phone TO contact_number;
    ALTER TABLE gyms ADD COLUMN city TEXT NOT NULL DEFAULT 'Not specified';
    UPDATE gyms SET city='Mangaluru' WHERE gym_id=default_gym;
    ALTER TABLE gyms ALTER COLUMN city DROP DEFAULT;
    ALTER TABLE gyms ADD CHECK(LENGTH(BTRIM(city)) BETWEEN 2 AND 100);
    ALTER TABLE gyms ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','INACTIVE'));
    ALTER TABLE admins ADD COLUMN gym_id INTEGER REFERENCES gyms(gym_id) ON DELETE RESTRICT;
    ALTER TABLE members ADD COLUMN gym_id INTEGER;
    ALTER TABLE trainers ADD COLUMN gym_id INTEGER;
    UPDATE members m SET gym_id=COALESCE((SELECT MIN(s.gym_id) FROM subscriptions s WHERE s.member_id=m.member_id),default_gym);
    UPDATE trainers t SET gym_id=COALESCE((SELECT MIN(s.gym_id) FROM subscriptions s WHERE s.trainer_id=t.trainer_id),default_gym);
    ALTER TABLE members ALTER COLUMN gym_id SET NOT NULL;
    ALTER TABLE trainers ALTER COLUMN gym_id SET NOT NULL;
    ALTER TABLE members ADD FOREIGN KEY(gym_id) REFERENCES gyms(gym_id) ON DELETE RESTRICT;
    ALTER TABLE trainers ADD FOREIGN KEY(gym_id) REFERENCES gyms(gym_id) ON DELETE RESTRICT;
    ALTER TABLE members ADD UNIQUE(gym_id,member_id);
    ALTER TABLE trainers ADD UNIQUE(gym_id,trainer_id);
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_member_id_fkey;
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_trainer_id_fkey;
    ALTER TABLE subscriptions ADD FOREIGN KEY(gym_id,member_id) REFERENCES members(gym_id,member_id) ON DELETE RESTRICT;
    ALTER TABLE subscriptions ADD FOREIGN KEY(gym_id,trainer_id) REFERENCES trainers(gym_id,trainer_id) ON DELETE SET NULL (trainer_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_members_branch_name ON members(gym_id,member_name);
CREATE INDEX IF NOT EXISTS idx_trainers_branch_name ON trainers(gym_id,trainer_name);
CREATE INDEX IF NOT EXISTS idx_admins_branch ON admins(gym_id);
-- Current routine definitions follow; the upgrade is committed as one operation.

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

-- Audit payment insertions and updates with complete old/new values.
CREATE OR REPLACE FUNCTION audit_payment_change() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO payment_audit(payment_id,operation,new_values)
    VALUES(NEW.payment_id,'INSERT',TO_JSONB(NEW));
    RETURN NEW;
  END IF;
  INSERT INTO payment_audit(payment_id,operation,old_values,new_values)
  VALUES(NEW.payment_id,'UPDATE',TO_JSONB(OLD),TO_JSONB(NEW));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_payment_audit ON payments;
CREATE TRIGGER trg_payment_audit AFTER INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION audit_payment_change();

-- Reject check-ins outside an uncancelled subscription's inclusive coverage dates.
CREATE OR REPLACE FUNCTION validate_attendance_subscription() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_start DATE; v_end DATE; v_status TEXT;
BEGIN
  SELECT start_date,end_date,status INTO v_start,v_end,v_status
  FROM subscriptions WHERE subscription_id=NEW.subscription_id;
  IF NOT EXISTS (SELECT 1 FROM subscriptions s JOIN gyms g USING(gym_id)
    WHERE s.subscription_id=NEW.subscription_id AND g.status='ACTIVE') OR v_status <> 'ACTIVE' OR NEW.check_in_at::DATE NOT BETWEEN v_start AND v_end THEN
    RAISE EXCEPTION 'Attendance requires a subscription active on the check-in date'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_attendance_validation ON attendance;
CREATE TRIGGER trg_attendance_validation BEFORE INSERT OR UPDATE OF subscription_id,check_in_at ON attendance
FOR EACH ROW EXECUTE FUNCTION validate_attendance_subscription();

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

COMMIT;
