-- Atomic renewal + first payment: execute as one transaction in a real workflow.
-- Replace IDs with existing records. If either statement fails, issue ROLLBACK.
-- BEGIN;
-- CALL renew_subscription(1,2,NULL,CURRENT_DATE,NULL);
-- INSERT INTO payments(subscription_id,amount,payment_method,payment_status)
-- VALUES (/* returned subscription_id */,4800.00,'UPI','PAID');
-- COMMIT;

-- Executable read-only transaction showing the COMMIT boundary.
BEGIN;
SELECT COUNT(*) AS subscription_rows_before FROM subscriptions;
COMMIT;

-- Executable rollback example: the temporary member is absent after ROLLBACK.
BEGIN;
INSERT INTO members(member_name,email,phone) VALUES('Rollback Demo','rollback.demo@example.test','+91-90000-99998');
UPDATE members SET member_name='This update is also rolled back' WHERE email='rollback.demo@example.test';
ROLLBACK;
SELECT COUNT(*) AS rollback_demo_rows_remaining FROM members WHERE email='rollback.demo@example.test';
