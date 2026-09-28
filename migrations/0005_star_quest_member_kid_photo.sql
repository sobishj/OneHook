-- Migration 0005: kid avatar photo support (uploaded from device)

ALTER TABLE sq_kid ADD COLUMN avatar_photo_key TEXT;
