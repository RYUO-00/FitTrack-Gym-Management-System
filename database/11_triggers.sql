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
