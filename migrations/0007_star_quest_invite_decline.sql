-- Migration 0007: allow declining a family invite (kept as a row, not
-- deleted, so a declined invite doesn't re-appear as "pending").

ALTER TABLE sq_family_invite ADD COLUMN declined_at DATETIME;
