-- Migration 0001: Initial schema for SprintGames

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id_1 TEXT NOT NULL,
  user_id_2 TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id_1, user_id_2),
  FOREIGN KEY (user_id_1) REFERENCES users(id),
  FOREIGN KEY (user_id_2) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  challenger_id TEXT NOT NULL,
  opponent_id TEXT NOT NULL,
  score_to_beat INTEGER NOT NULL,
  challenger_score INTEGER NOT NULL,
  opponent_score INTEGER DEFAULT NULL,
  status TEXT DEFAULT 'PENDING',
  winner_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (challenger_id) REFERENCES users(id),
  FOREIGN KEY (opponent_id) REFERENCES users(id)
);

-- Initial seed data for global leaderboard
INSERT OR IGNORE INTO users (id, username, email, email_verified, best_score) VALUES
  ('usr_rahul', 'Rahul', 'rahul@example.com', 1, 2842),
  ('usr_arun', 'Arun', 'arun@example.com', 1, 2731),
  ('usr_ethan', 'Ethan', 'ethan@example.com', 1, 2694),
  ('usr_vishnu', 'Vishnu', 'vishnu@example.com', 1, 2520),
  ('usr_anu', 'Anu', 'anu@example.com', 1, 2410);
