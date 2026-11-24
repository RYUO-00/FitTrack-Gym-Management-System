-- Explicit supporting indexes for common joins, filters and chronological reports.
CREATE INDEX IF NOT EXISTS idx_subscriptions_member_start ON subscriptions(member_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(gym_id,plan_no);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trainer ON subscriptions(trainer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates_status ON subscriptions(start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_date_status ON payments(payment_date DESC, payment_status);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance(check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_subscription ON attendance(subscription_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_audit_payment_date ON payment_audit(payment_id, changed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_open_visit ON attendance(subscription_id) WHERE check_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_members_branch_name ON members(gym_id,member_name);
CREATE INDEX IF NOT EXISTS idx_trainers_branch_name ON trainers(gym_id,trainer_name);
CREATE INDEX IF NOT EXISTS idx_admins_branch ON admins(gym_id);
