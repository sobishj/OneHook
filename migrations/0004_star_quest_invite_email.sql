-- Migration 0004: allow inviting a partner by email (send them the link directly)

ALTER TABLE sq_family_invite ADD COLUMN email TEXT;
