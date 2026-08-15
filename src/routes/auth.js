const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { run, get } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

function generateId() {
  return 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 2 || cleanUsername.length > 20) {
      return res.status(400).json({ error: 'Username must be between 2 and 20 characters' });
    }

    // Check if email already registered
    let existingUser = await get(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    if (existingUser) {
      // Send fresh verification code
      const otp = generateOTP();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins
      await run(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`, [cleanEmail, otp, expiresAt]);
      return res.json({
        message: 'Account already exists. Verification code sent.',
        email: cleanEmail,
        otp: otp, // Returned for instant testing!
        isExisting: true
      });
    }

    // Check if username taken
    const usernameTaken = await get(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, [cleanUsername]);
    if (usernameTaken) {
      return res.status(400).json({ error: 'Username is already taken by another angler' });
    }

    // Create user (unverified)
    const userId = generateId();
    await run(
      `INSERT INTO users (id, username, email, email_verified, best_score) VALUES (?, ?, ?, 0, 0)`,
      [userId, cleanUsername, cleanEmail]
    );

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await run(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`, [cleanEmail, otp, expiresAt]);

    res.json({
      message: 'Verification code sent to email',
      email: cleanEmail,
      otp: otp, // Displayed in toast for seamless testing
      isExisting: false
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpRecord = await get(`SELECT * FROM otp_codes WHERE email = ?`, [cleanEmail]);

    if (!otpRecord) {
      return res.status(400).json({ error: 'No verification request found for this email' });
    }

    if (Date.now() > otpRecord.expires_at) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    if (otpRecord.code !== code.trim()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Verify user
    await run(`UPDATE users SET email_verified = 1 WHERE email = ?`, [cleanEmail]);
    await run(`DELETE FROM otp_codes WHERE email = ?`, [cleanEmail]);

    const user = await get(`SELECT id, username, email, email_verified, best_score, created_at FROM users WHERE email = ?`, [cleanEmail]);

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        best_score: user.best_score
      }
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(`SELECT id, username, email, email_verified, best_score, created_at FROM users WHERE id = ?`, [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
