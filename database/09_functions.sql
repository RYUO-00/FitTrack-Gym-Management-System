-- Calculate the final covered day using calendar-month arithmetic (e.g. Jan 31 + 1 month).
CREATE OR REPLACE FUNCTION calculate_expiry_date(p_start_date DATE,p_duration_months INTEGER)
RETURNS DATE LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
  IF p_duration_months <= 0 OR p_duration_months > 60 THEN
    RAISE EXCEPTION 'duration_months must be between 1 and 60' USING ERRCODE='22023';
  END IF;
  RETURN (p_start_date + make_interval(months => p_duration_months))::DATE;
END;
$$;

-- Compute a subscription's effective status without waiting for a date-trigger.
CREATE OR REPLACE FUNCTION effective_subscription_status(p_status TEXT,p_start_date DATE,p_end_date DATE,p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT CASE WHEN p_status='CANCELLED' THEN 'CANCELLED'
              WHEN p_as_of < p_start_date THEN 'UPCOMING'
              WHEN p_as_of > p_end_date THEN 'EXPIRED'
              ELSE 'ACTIVE' END;
$$;
