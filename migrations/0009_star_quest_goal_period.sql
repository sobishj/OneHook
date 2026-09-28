-- Migration 0009: support up to three concurrent goals per kid — one each
-- for week, month, and year — instead of a single shared goal slot. Each
-- period is tracked, unlocked, and redeemed independently. Existing goals
-- (all created before this feature existed) become 'month' goals so they
-- keep behaving exactly like the single goal slot they were.
ALTER TABLE sq_goal ADD COLUMN period TEXT NOT NULL DEFAULT 'month';
CREATE INDEX IF NOT EXISTS idx_sq_goal_kid_period ON sq_goal(kid_id, period);
