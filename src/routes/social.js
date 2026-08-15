const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db');
const { authenticateToken } = require('../middleware/auth');

function generateId(prefix) {
  return prefix + '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// GET /api/friends/search?q=username
router.get('/friends/search', authenticateToken, async (req, res) => {
  try {
    const query = req.query.q ? req.query.q.trim() : '';
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const userId = req.user.id;
    const users = await all(`
      SELECT id, username, best_score
      FROM users
      WHERE LOWER(username) LIKE LOWER(?) AND id != ?
      LIMIT 10
    `, [`%${query}%`, userId]);

    // Check existing friend & request statuses
    const results = [];
    for (const u of users) {
      const friendship = await get(`
        SELECT * FROM friendships
        WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
      `, [userId, u.id, u.id, userId]);

      const pendingRequest = await get(`
        SELECT * FROM friend_requests
        WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
          AND status = 'PENDING'
      `, [userId, u.id, u.id, userId]);

      let relationship = 'NONE';
      if (friendship) {
        relationship = 'FRIENDS';
      } else if (pendingRequest) {
        relationship = pendingRequest.sender_id === userId ? 'SENT_PENDING' : 'RECEIVED_PENDING';
      }

      results.push({
        id: u.id,
        username: u.username,
        best_score: u.best_score,
        relationship
      });
    }

    res.json({ users: results });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friends/request
router.post('/friends/request', authenticateToken, async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (!receiverId || receiverId === senderId) {
      return res.status(400).json({ error: 'Invalid receiver ID' });
    }

    const receiver = await get(`SELECT id FROM users WHERE id = ?`, [receiverId]);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already friends
    const alreadyFriends = await get(`
      SELECT * FROM friendships
      WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
    `, [senderId, receiverId, receiverId, senderId]);

    if (alreadyFriends) {
      return res.status(400).json({ error: 'You are already friends' });
    }

    // Check existing pending request
    const existingReq = await get(`
      SELECT * FROM friend_requests
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
        AND status = 'PENDING'
    `, [senderId, receiverId, receiverId, senderId]);

    if (existingReq) {
      return res.status(400).json({ error: 'Friend request already pending' });
    }

    const reqId = generateId('freq');
    await run(`
      INSERT INTO friend_requests (id, sender_id, receiver_id, status)
      VALUES (?, ?, ?, 'PENDING')
    `, [reqId, senderId, receiverId]);

    res.json({ message: 'Friend request sent successfully' });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/friends/requests
router.get('/friends/requests', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await all(`
      SELECT fr.id, fr.sender_id, fr.created_at, u.username as sender_username, u.best_score as sender_score
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = ? AND fr.status = 'PENDING'
      ORDER BY fr.created_at DESC
    `, [userId]);

    res.json({ requests });
  } catch (err) {
    console.error('Get friend requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/friends/respond
router.post('/friends/respond', authenticateToken, async (req, res) => {
  try {
    const { requestId, action } = req.body; // action: 'ACCEPT' or 'DECLINE'
    const userId = req.user.id;

    if (!requestId || !['ACCEPT', 'DECLINE'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request or action' });
    }

    const request = await get(`SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'PENDING'`, [requestId, userId]);
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (action === 'ACCEPT') {
      await run(`UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?`, [requestId]);
      await run(`
        INSERT OR IGNORE INTO friendships (user_id_1, user_id_2) VALUES (?, ?)
      `, [request.sender_id, userId]);
      res.json({ message: 'Friend request accepted' });
    } else {
      await run(`UPDATE friend_requests SET status = 'DECLINED' WHERE id = ?`, [requestId]);
      res.json({ message: 'Friend request declined' });
    }
  } catch (err) {
    console.error('Respond friend request error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/friends/list
router.get('/friends/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const friends = await all(`
      SELECT u.id, u.username, u.best_score
      FROM friendships f
      JOIN users u ON (u.id = CASE WHEN f.user_id_1 = ? THEN f.user_id_2 ELSE f.user_id_1 END)
      WHERE f.user_id_1 = ? OR f.user_id_2 = ?
      ORDER BY u.best_score DESC
    `, [userId, userId, userId]);

    res.json({ friends });
  } catch (err) {
    console.error('Get friends list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challenges/create
router.post('/challenges/create', authenticateToken, async (req, res) => {
  try {
    const { opponentId } = req.body;
    const challengerId = req.user.id;

    if (!opponentId || opponentId === challengerId) {
      return res.status(400).json({ error: 'Invalid opponent' });
    }

    const opponent = await get(`SELECT id, username, best_score FROM users WHERE id = ?`, [opponentId]);
    if (!opponent) {
      return res.status(404).json({ error: 'Opponent not found' });
    }

    const challenger = await get(`SELECT best_score FROM users WHERE id = ?`, [challengerId]);

    const challengeId = generateId('chg');
    const scoreToBeat = opponent.best_score;
    const challengerScore = challenger.best_score;

    await run(`
      INSERT INTO challenges (id, challenger_id, opponent_id, score_to_beat, challenger_score, status)
      VALUES (?, ?, ?, ?, ?, 'PENDING')
    `, [challengeId, challengerId, opponentId, scoreToBeat, challengerScore]);

    res.json({
      challengeId,
      opponent: {
        id: opponent.id,
        username: opponent.username,
        scoreToBeat
      }
    });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/challenges/list
router.get('/challenges/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Incoming challenges (where userId is opponent and pending or completed)
    const challenges = await all(`
      SELECT c.*,
        u_challenger.username as challenger_username,
        u_opponent.username as opponent_username
      FROM challenges c
      JOIN users u_challenger ON c.challenger_id = u_challenger.id
      JOIN users u_opponent ON c.opponent_id = u_opponent.id
      WHERE c.challenger_id = ? OR c.opponent_id = ?
      ORDER BY c.created_at DESC
      LIMIT 20
    `, [userId, userId]);

    res.json({ challenges });
  } catch (err) {
    console.error('List challenges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/challenges/complete
router.post('/challenges/complete', authenticateToken, async (req, res) => {
  try {
    const { challengeId, scoreAchieved } = req.body;
    const userId = req.user.id;

    if (!challengeId || typeof scoreAchieved !== 'number') {
      return res.status(400).json({ error: 'Invalid challenge completion data' });
    }

    const challenge = await get(`SELECT * FROM challenges WHERE id = ?`, [challengeId]);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const isChallenger = challenge.challenger_id === userId;
    const isOpponent = challenge.opponent_id === userId;

    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ error: 'Not authorized for this challenge' });
    }

    const targetScore = isChallenger ? challenge.score_to_beat : challenge.challenger_score;
    const won = scoreAchieved > targetScore;
    const winnerId = won ? userId : (isChallenger ? challenge.opponent_id : challenge.challenger_id);

    await run(`
      UPDATE challenges
      SET opponent_score = ?, status = 'COMPLETED', winner_id = ?
      WHERE id = ?
    `, [scoreAchieved, winnerId, challengeId]);

    const challengerUser = await get(`SELECT username FROM users WHERE id = ?`, [challenge.challenger_id]);
    const opponentUser = await get(`SELECT username FROM users WHERE id = ?`, [challenge.opponent_id]);

    res.json({
      won,
      scoreAchieved,
      targetScore,
      winnerId,
      challengerUsername: challengerUser ? challengerUser.username : 'Challenger',
      opponentUsername: opponentUser ? opponentUser.username : 'Opponent'
    });
  } catch (err) {
    console.error('Complete challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
