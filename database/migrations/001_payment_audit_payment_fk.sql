-- Existing installations: run as the owner of public.payment_audit and public.payments.
-- Safe to re-run. No records are deleted, rewritten, or inferred from JSON snapshots.
-- Stop and repair legacy NULL/orphan references explicitly if the preflight fails.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;

-- Block concurrent payment/audit writes during the preflight and schema change.
LOCK TABLE public.payments IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.payment_audit IN ACCESS EXCLUSIVE MODE;

DO $migration$
DECLARE
  v_nulls BIGINT;
  v_orphans BIGINT;
  v_payment_att SMALLINT;
  v_parent_att SMALLINT;
  v_constraint RECORD;
BEGIN
  SELECT COUNT(*) FILTER (WHERE a.payment_id IS NULL),
         COUNT(*) FILTER (WHERE a.payment_id IS NOT NULL AND p.payment_id IS NULL)
  INTO v_nulls, v_orphans
  FROM public.payment_audit AS a
  LEFT JOIN public.payments AS p ON p.payment_id = a.payment_id;

  IF v_nulls > 0 OR v_orphans > 0 THEN
    RAISE EXCEPTION 'Payment audit migration stopped: % NULL payment_id values and % orphan references.', v_nulls, v_orphans
      USING ERRCODE = '23514',
            HINT = 'Resolve each legacy reference with the data owner, then rerun. No data has been changed.';
  END IF;

  SELECT attnum INTO STRICT v_payment_att FROM pg_attribute
  WHERE attrelid = 'public.payment_audit'::regclass AND attname = 'payment_id' AND NOT attisdropped;
  SELECT attnum INTO STRICT v_parent_att FROM pg_attribute
  WHERE attrelid = 'public.payments'::regclass AND attname = 'payment_id' AND NOT attisdropped;

  -- Refuse to overwrite a differently defined constraint with the expected name.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_audit'::regclass
      AND conname = 'payment_audit_payment_id_fkey'
      AND NOT (contype = 'f' AND confrelid = 'public.payments'::regclass
        AND conkey = ARRAY[v_payment_att] AND confkey = ARRAY[v_parent_att]
        AND confdeltype = 'r' AND confupdtype = 'a' AND NOT condeferrable)
  ) THEN
    RAISE EXCEPTION 'Existing payment_audit_payment_id_fkey has an unexpected definition; review it before migration.';
  END IF;

  ALTER TABLE public.payment_audit ALTER COLUMN payment_id SET NOT NULL;

  -- Accept an equivalent FK even if it was created under a different name.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.payment_audit'::regclass AND contype = 'f'
      AND confrelid = 'public.payments'::regclass
      AND conkey = ARRAY[v_payment_att] AND confkey = ARRAY[v_parent_att]
      AND confdeltype = 'r' AND confupdtype = 'a' AND NOT condeferrable
  ) THEN
    ALTER TABLE public.payment_audit
      ADD CONSTRAINT payment_audit_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES public.payments(payment_id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  FOR v_constraint IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.payment_audit'::regclass AND contype = 'f'
      AND confrelid = 'public.payments'::regclass
      AND conkey = ARRAY[v_payment_att] AND confkey = ARRAY[v_parent_att]
      AND confdeltype = 'r' AND NOT convalidated
  LOOP
    EXECUTE format('ALTER TABLE public.payment_audit VALIDATE CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$migration$;
COMMIT;
