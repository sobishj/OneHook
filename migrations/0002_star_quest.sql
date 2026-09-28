-- Migration 0002: Star Quest tables

CREATE TABLE IF NOT EXISTS sq_family (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT,
  pin_hash TEXT,
  pin_salt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sq_family_member (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','PARTNER')),
  display_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (family_id, user_id),
  FOREIGN KEY (family_id) REFERENCES sq_family(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_member_user ON sq_family_member(user_id);
CREATE INDEX IF NOT EXISTS idx_sq_member_family ON sq_family_member(family_id);

CREATE TABLE IF NOT EXISTS sq_family_invite (
  code TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_by TEXT,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES sq_family(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_invite_family ON sq_family_invite(family_id);

CREATE TABLE IF NOT EXISTS sq_kid (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  color TEXT NOT NULL,
  birthday TEXT,
  show_numbers INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES sq_family(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_kid_family ON sq_kid(family_id);

CREATE TABLE IF NOT EXISTS sq_star_entry (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL,
  date TEXT NOT NULL,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 3),
  reason TEXT,
  reason_icon TEXT,
  praise_text TEXT,
  praise_voice_key TEXT,
  given_by_user_id TEXT NOT NULL,
  seen_by_kid INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  FOREIGN KEY (kid_id) REFERENCES sq_kid(id),
  FOREIGN KEY (given_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_star_kid_date ON sq_star_entry(kid_id, date);

CREATE TABLE IF NOT EXISTS sq_goal (
  id TEXT PRIMARY KEY,
  kid_id TEXT NOT NULL,
  target_stars INTEGER NOT NULL,
  reward_secret TEXT,
  reward_secret_emoji TEXT,
  reward_secret_photo_key TEXT,
  reward_hint TEXT,
  reward_hint_emoji TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','UNLOCKED','REVEALED','REDEEMED')),
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unlocked_at DATETIME,
  revealed_at DATETIME,
  redeemed_at DATETIME,
  FOREIGN KEY (kid_id) REFERENCES sq_kid(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sq_goal_kid ON sq_goal(kid_id);
