-- Migration 0006: custom photo icons for reason presets (in addition to
-- emoji), and a snapshot column on star entries so history keeps showing
-- the icon that was used at the time even if the preset is later edited.

ALTER TABLE sq_reason_preset ADD COLUMN icon_photo_key TEXT;
ALTER TABLE sq_star_entry ADD COLUMN reason_icon_photo_key TEXT;
