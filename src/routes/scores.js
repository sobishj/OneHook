const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');
const { authenticateToken, optionalToken } = require('../middleware/auth');

// POST /api/score/submit
router.post('/score/submit', authenticateToken, async (req, res) => {
  try {
    const { score, durationSeconds, catches } = req.body;
    const userId = req.user.id;

    if (typeof score !== 'number' || score < 0 || !Array.isArray(catches)) {
      return res.status(400).json({ error: 'Invalid score submission payload' });
    }

    // Validation Logic:
    // 1. Calculate calculatedScore from catches array
    // Point table mapping
    const pointValues = {
      'small_fish': [1, 2, 3],
      'medium_fish': [3, 5, 8, 10],
      'large_fish': [10, 15, 20, 25],
      'shark': [50],
      'rare': [75, 100]
    };

    let calculatedScore = 0;
    for (const catchItem of catches) {
      const { type, pts } = catchItem;
      if (!type || typeof pts !== 'number') {
        return res.status(400).json({ error: 'Invalid catch data format' });
      }
      calculatedScore += pts;
    }

    // Check score tolerance (e.g. within bounds)
    if (Math.abs(calculatedScore - score) > 5) {
      console.warn(`Anti-cheat alert for user ${userId}: submitted ${score}, calculated ${calculatedScore}`);
      return res.status(400).json({ error: 'Score verification failed: telemetry mismatch' });
    }

    // Check maximum rate limit (e.g. hook drop max speed ~ 1 catch per 0.8 seconds)
    if (catches.length > 0 && durationSeconds > 0) {
      const catchesPerSecond = catches.length / durationSeconds;
      if (catchesPerSecond > 2.5) { // Impossible human speed
        console.warn(`Anti-cheat alert for user ${userId}: human speed exceeded (${catchesPerSecond} catches/sec)`);
        return res.status(400).json({ error: 'Score verification failed: unrealistic catch rate' });
      }
    }

    // Fetch user current best
    const user = await get(`SELECT best_score FROM users WHERE id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let isNewBest = false;
    let newBestScore = user.best_score;

    if (score > user.best_score) {
      isNewBest = true;
      newBestScore = score;
      await run(`UPDATE users SET best_score = ? WHERE id = ?`, [score, userId]);
    }

    res.json({
      score,
      bestScore: newBestScore,
      isNewBest,
      message: isNewBest ? '🔥 NEW BEST SCORE!' : 'Score recorded'
    });
  } catch (err) {
    console.error('Submit score error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/global
router.get('/leaderboard/global', optionalToken, async (req, res) => {
  try {
    const rows = await all(`
      SELECT username, best_score, id
      FROM users
      ORDER BY best_score DESC
      LIMIT 50
    `);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      score: row.best_score,
      isUser: req.user ? req.user.id === row.id : false
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('Global leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard/friends
router.get('/leaderboard/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get list of friend IDs
    const friends = await all(`
      SELECT CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END as friend_id
      FROM friendships
      WHERE user_id_1 = ? OR user_id_2 = ?
    `, [userId, userId, userId]);

    const friendIds = friends.map(f => f.friend_id);
    friendIds.push(userId); // Include self

    const placeholders = friendIds.map(() => '?').join(',');
    const rows = await all(`
      SELECT id, username, best_score
      FROM users
      WHERE id IN (${placeholders})
      ORDER BY best_score DESC
    `, friendIds);

    const leaderboard = rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      score: row.best_score,
      isUser: row.id === userId,
      userId: row.id
    }));

    res.json({ leaderboard });
  } catch (err) {
    console.error('Friends leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
