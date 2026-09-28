-- Migration 0003: per-family editable "give a star" reason presets

CREATE TABLE IF NOT EXISTS sq_reason_preset (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  icon TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES sq_family(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_reason_family ON sq_reason_preset(family_id);
