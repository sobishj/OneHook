const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'onehook.db');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  db.serialize(async () => {
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        email_verified INTEGER DEFAULT 0,
        best_score INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS otp_codes (
        email TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS friendships (
        user_id_1 TEXT NOT NULL,
        user_id_2 TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id_1, user_id_2),
        FOREIGN KEY (user_id_1) REFERENCES users(id),
        FOREIGN KEY (user_id_2) REFERENCES users(id)
      )
    `);

    await run(`
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
      )
    `);

    // Seed mock leaderboard data if table is empty
    const count = await get(`SELECT COUNT(*) as cnt FROM users`);
    if (count && count.cnt === 0) {
      console.log('Seeding initial leaderboard players...');
      const seedUsers = [
        { id: 'usr_rahul', username: 'Rahul', email: 'rahul@example.com', score: 2842 },
        { id: 'usr_arun', username: 'Arun', email: 'arun@example.com', score: 2731 },
        { id: 'usr_sobish', username: 'Sobish', email: 'sobish@example.com', score: 2694 },
        { id: 'usr_vishnu', username: 'Vishnu', email: 'vishnu@example.com', score: 2520 },
        { id: 'usr_anu', username: 'Anu', email: 'anu@example.com', score: 2410 }
      ];

      for (const u of seedUsers) {
        await run(
          `INSERT INTO users (id, username, email, email_verified, best_score) VALUES (?, ?, ?, 1, ?)`,
          [u.id, u.username, u.email, u.score]
        );
      }
    }
  });
}

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};
