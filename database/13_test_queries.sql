-- Run after schema, indexes, SQL routines, triggers, and seed data. Assertions raise on failure.
DO $$
DECLARE v_count INTEGER; v_expiry DATE;
BEGIN
  SELECT COUNT(*) INTO v_count FROM members;
  IF v_count < 15 THEN RAISE EXCEPTION 'Expected at least 15 seeded members; found %',v_count; END IF;
  SELECT COUNT(*) INTO v_count FROM subscriptions;
  IF v_count < 20 THEN RAISE EXCEPTION 'Expected at least 20 subscriptions; found %',v_count; END IF;
  SELECT COUNT(*) INTO v_count FROM payments;
  IF v_count < 30 THEN RAISE EXCEPTION 'Expected at least 30 payments; found %',v_count; END IF;
  SELECT calculate_expiry_date(DATE '2026-01-31',1) INTO v_expiry;
  IF v_expiry <> DATE '2026-02-28' THEN RAISE EXCEPTION 'Expiry function returned %',v_expiry; END IF;
  SELECT COUNT(*) INTO v_count FROM v_active_subscriptions;
  IF v_count <> (SELECT COUNT(*) FROM subscriptions WHERE status='ACTIVE' AND CURRENT_DATE BETWEEN start_date AND end_date) THEN
    RAISE EXCEPTION 'Active subscription view count does not match';
  END IF;
  IF (SELECT COUNT(*) FROM v_monthly_revenue) = 0 THEN RAISE EXCEPTION 'Monthly revenue view is empty'; END IF;
END $$;

-- Exercise payment audit INSERT/UPDATE, required references, and delete restriction.
BEGIN;
DO $$
DECLARE v_payment_id INTEGER; v_subscription_id INTEGER; v_audit_count INTEGER;
        v_rejected BOOLEAN; v_missing_payment INTEGER; v_fk_name TEXT;
BEGIN
  SELECT subscription_id INTO v_subscription_id FROM subscriptions LIMIT 1;
  INSERT INTO payments(subscription_id,amount,payment_method,payment_status)
    VALUES(v_subscription_id,1.00,'CASH','PENDING') RETURNING payment_id INTO v_payment_id;
  UPDATE payments SET payment_status='PAID' WHERE payment_id=v_payment_id;
  SELECT COUNT(*) INTO v_audit_count FROM payment_audit WHERE payment_id=v_payment_id;
  IF v_audit_count <> 2 THEN RAISE EXCEPTION 'Expected two payment audit records; found %',v_audit_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM payment_audit WHERE payment_id=v_payment_id AND operation='INSERT'
    AND old_values IS NULL AND new_values->>'payment_status'='PENDING') THEN
    RAISE EXCEPTION 'Audit INSERT snapshot is incorrect';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM payment_audit WHERE payment_id=v_payment_id AND operation='UPDATE'
    AND old_values->>'payment_status'='PENDING' AND new_values->>'payment_status'='PAID') THEN
    RAISE EXCEPTION 'Audit UPDATE snapshots are incorrect';
  END IF;

  v_rejected := FALSE;
  BEGIN
    INSERT INTO payment_audit(payment_id,operation,new_values) VALUES(NULL,'INSERT','{}'::JSONB);
  EXCEPTION WHEN not_null_violation THEN v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Audit payment_id accepted NULL'; END IF;

  -- Choose an absent integer without assuming any particular identity sequence.
  SELECT candidate INTO v_missing_payment
  FROM generate_series(-2147483647,-2147482648) AS candidate
  WHERE NOT EXISTS (SELECT 1 FROM payments WHERE payment_id=candidate) LIMIT 1;
  IF v_missing_payment IS NULL THEN RAISE EXCEPTION 'No unused test identifier available'; END IF;
  v_rejected := FALSE;
  BEGIN
    INSERT INTO payment_audit(payment_id,operation,new_values) VALUES(v_missing_payment,'INSERT','{}'::JSONB);
  EXCEPTION WHEN foreign_key_violation THEN v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Audit accepted an orphan payment reference'; END IF;

  v_rejected := FALSE;
  BEGIN
    UPDATE payment_audit SET payment_id=v_missing_payment WHERE payment_id=v_payment_id;
  EXCEPTION WHEN foreign_key_violation THEN v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Audit UPDATE accepted an orphan payment reference'; END IF;

  v_rejected := FALSE;
  BEGIN
    DELETE FROM payments WHERE payment_id=v_payment_id;
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
    GET STACKED DIAGNOSTICS v_fk_name = CONSTRAINT_NAME;
    v_rejected := EXISTS (
      SELECT 1 FROM pg_constraint WHERE conrelid='payment_audit'::regclass
        AND conname=v_fk_name AND contype='f' AND confrelid='payments'::regclass
        AND confdeltype='r' AND convalidated AND NOT condeferrable
    );
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Audited payment deletion was not blocked by ON DELETE RESTRICT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM payments WHERE payment_id=v_payment_id) OR
     (SELECT COUNT(*) FROM payment_audit WHERE payment_id=v_payment_id) <> 2 THEN
    RAISE EXCEPTION 'Delete restriction did not preserve the payment and its audit history';
  END IF;
END $$;
ROLLBACK;

-- Procedure smoke test uses an explicit transaction and leaves no extra membership behind.
BEGIN;
DO $$
DECLARE v_subscription_id INTEGER; v_member_id INTEGER; v_plan_id INTEGER;
BEGIN
  SELECT member_id INTO v_member_id FROM members ORDER BY member_id LIMIT 1;
  SELECT plan_id INTO v_plan_id FROM membership_plans WHERE is_active ORDER BY plan_id LIMIT 1;
  CALL create_subscription(v_member_id,v_plan_id,NULL,CURRENT_DATE,v_subscription_id);
  IF v_subscription_id IS NULL OR NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscription_id=v_subscription_id) THEN
    RAISE EXCEPTION 'Subscription procedure did not create a record';
  END IF;
END $$;
ROLLBACK;

-- Renewal procedure must insert a new row, preserve the old one, and schedule after current coverage.
BEGIN;
DO $$
DECLARE v_previous_id INTEGER; v_previous_end DATE; v_previous_member INTEGER; v_plan_id INTEGER; v_renewed_id INTEGER; v_renewed_start DATE;
BEGIN
  SELECT subscription_id,member_id,end_date INTO v_previous_id,v_previous_member,v_previous_end
  FROM subscriptions WHERE status='ACTIVE' ORDER BY subscription_id LIMIT 1;
  SELECT plan_id INTO v_plan_id FROM membership_plans WHERE is_active ORDER BY plan_id LIMIT 1;
  CALL renew_subscription(v_previous_id,v_plan_id,NULL,CURRENT_DATE,v_renewed_id);
  SELECT start_date INTO v_renewed_start FROM subscriptions WHERE subscription_id=v_renewed_id;
  IF v_renewed_id IS NULL OR v_renewed_id=v_previous_id THEN RAISE EXCEPTION 'Renewal did not create a new key'; END IF;
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscription_id=v_previous_id AND member_id=v_previous_member) THEN
    RAISE EXCEPTION 'Renewal modified or removed the original subscription';
  END IF;
  IF v_previous_end>=CURRENT_DATE AND v_renewed_start<=v_previous_end THEN
    RAISE EXCEPTION 'Renewal starts before the existing coverage ends';
  END IF;
END $$;
ROLLBACK;

-- Unique and positive-value constraints reject invalid records.
DO $$
DECLARE v_rejected BOOLEAN;
BEGIN
  v_rejected := FALSE;
  BEGIN
    INSERT INTO members(member_name,email,phone) VALUES('Duplicate Email Test','maya.kapoor@example.test','+91-90000-99997');
  EXCEPTION WHEN unique_violation THEN v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Member email uniqueness constraint did not reject duplicate'; END IF;
  v_rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(plan_name,duration_months,price) VALUES('Invalid Zero Price',1,0);
  EXCEPTION WHEN check_violation THEN v_rejected := TRUE;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'Plan price constraint did not reject zero'; END IF;
END $$;

-- Attendance validation trigger must reject a date beyond the subscription's coverage.
DO $$
DECLARE v_subscription_id INTEGER; v_rejected BOOLEAN := FALSE;
BEGIN
  SELECT subscription_id INTO v_subscription_id FROM subscriptions
  WHERE status='CANCELLED' OR end_date < CURRENT_DATE OR start_date > CURRENT_DATE LIMIT 1;
  IF v_subscription_id IS NOT NULL THEN
    BEGIN
      INSERT INTO attendance(subscription_id,check_in_at)
      VALUES(v_subscription_id,NOW());
    EXCEPTION WHEN check_violation THEN v_rejected := TRUE;
    END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Attendance trigger accepted an ineligible subscription'; END IF;
  END IF;
END $$;

-- These result sets are convenient for a live DBMS demonstration.
SELECT COUNT(*) AS members FROM members;
SELECT COUNT(*) AS subscriptions FROM subscriptions;
SELECT COUNT(*) AS payments FROM payments;
SELECT COUNT(*) AS attendance_visits FROM attendance;
SELECT COUNT(*) AS payment_audit_rows FROM payment_audit;
SELECT * FROM v_active_subscriptions ORDER BY end_date LIMIT 5;
SELECT * FROM v_monthly_revenue ORDER BY month;
