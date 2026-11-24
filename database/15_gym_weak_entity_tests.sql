-- Transactional assertions: all fixture rows are rolled back, even on the live database.
BEGIN;
DO $$
DECLARE g1 INTEGER; g2 INTEGER; m INTEGER; sub INTEGER; renewed INTEGER; pay INTEGER;
        rejected BOOLEAN; preserved DATE;
BEGIN
  INSERT INTO gyms(branch_name,address,city,contact_number,email) VALUES
    ('Branch Test ' || txid_current(),'Test address','Mangaluru','9000012345','branch.test@example.test') RETURNING gym_id INTO g1;
  INSERT INTO gyms(branch_name,address,city,contact_number,email) VALUES
    ('Other Branch Test ' || txid_current(),'Other address','Udupi','9000012346','other.test@example.test') RETURNING gym_id INTO g2;
  -- The same partial key and name are legal in different gyms.
  INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price)
  VALUES(g1,1,'Branch monthly',1,100),(g2,1,'Branch monthly',2,200),(g1,2,'Only in first gym',3,300);
  IF (SELECT COUNT(*) FROM membership_plans WHERE gym_id IN(g1,g2) AND plan_no=1) <> 2 THEN
    RAISE EXCEPTION 'Partial key must be reusable between gyms';
  END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) VALUES(g1,1,'Duplicate',1,100);
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Duplicate composite primary key accepted'; END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) VALUES(-2147483647,1,'Orphan owner',1,100);
  EXCEPTION WHEN foreign_key_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Plan without owner accepted'; END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) VALUES(g1,0,'Invalid partial key',1,100);
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Nonpositive plan number accepted'; END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) VALUES(NULL,1,'Missing owner',1,100);
  EXCEPTION WHEN not_null_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'NULL plan owner accepted'; END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO membership_plans(gym_id,plan_no,plan_name,duration_months,price) VALUES(g1,NULL,'Missing partial key',1,100);
  EXCEPTION WHEN not_null_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'NULL partial key accepted'; END IF;
  INSERT INTO members(gym_id,member_name,email,phone) VALUES(g2,'Branch Fixture','branch.'||txid_current()||'@example.test','branch'||txid_current()) RETURNING member_id INTO m;
  rejected := FALSE;
  BEGIN
    INSERT INTO subscriptions(member_id,gym_id,plan_no,start_date,end_date) VALUES(m,g2,NULL,CURRENT_DATE,CURRENT_DATE);
  EXCEPTION WHEN not_null_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Incomplete composite FK accepted'; END IF;
  rejected := FALSE;
  BEGIN
    INSERT INTO subscriptions(member_id,gym_id,plan_no,start_date,end_date)
      VALUES(m,g2,2,CURRENT_DATE,CURRENT_DATE+30);
  EXCEPTION WHEN foreign_key_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Mixed-branch plan reference accepted'; END IF;
  CALL create_subscription(m,g2,1,NULL,CURRENT_DATE,sub);
  IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscription_id=sub AND gym_id=g2 AND plan_no=1
                 AND end_date=calculate_expiry_date(CURRENT_DATE,2)) THEN
    RAISE EXCEPTION 'Subscription did not use its selected branch plan duration';
  END IF;
  SELECT end_date INTO preserved FROM subscriptions WHERE subscription_id=sub;
  CALL renew_subscription(sub,g2,1,NULL,CURRENT_DATE,renewed);
  IF renewed=sub OR NOT EXISTS(SELECT 1 FROM subscriptions WHERE subscription_id=renewed
    AND member_id=m AND gym_id=g2 AND plan_no=1 AND start_date=preserved+1) OR
    (SELECT end_date FROM subscriptions WHERE subscription_id=sub)<>preserved THEN
    RAISE EXCEPTION 'Renewal lost history or used wrong composite key';
  END IF;
  INSERT INTO payments(subscription_id,amount,payment_method,payment_status)
    VALUES(sub,200,'UPI','PENDING') RETURNING payment_id INTO pay;
  UPDATE payments SET payment_status='PAID' WHERE payment_id=pay;
  IF (SELECT COUNT(*) FROM payment_audit WHERE payment_id=pay)<>2 THEN
    RAISE EXCEPTION 'Payment audit trigger failed after composite-key change';
  END IF;
  INSERT INTO attendance(subscription_id,check_in_at,check_out_at) VALUES(sub,NOW(),NOW()+INTERVAL '1 hour');
  IF NOT EXISTS(SELECT 1 FROM v_active_subscriptions WHERE subscription_id=sub AND gym_id=g2 AND plan_no=1) THEN
    RAISE EXCEPTION 'Active view lost composite identity';
  END IF;
  rejected := FALSE;
  BEGIN
    UPDATE subscriptions SET plan_no=2 WHERE subscription_id=sub;
  EXCEPTION WHEN foreign_key_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Invalid composite UPDATE accepted'; END IF;
  rejected := FALSE;
  BEGIN DELETE FROM membership_plans WHERE gym_id=g2 AND plan_no=1;
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Referenced plan deletion accepted'; END IF;
  rejected := FALSE;
  BEGIN DELETE FROM gyms WHERE gym_id=g1;
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN rejected := TRUE; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Owner deletion accepted while plans depend on it'; END IF;
END $$;
ROLLBACK;
