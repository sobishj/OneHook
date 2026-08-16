import jwt from 'jsonwebtoken';

const FALLBACK_JWT_SECRET = 'onehook_secret_key_sprintgames_2026_secure';

function getJwtSecret(env) {
  if (env && env.JWT_SECRET) {
    return env.JWT_SECRET;
  }
  return FALLBACK_JWT_SECRET;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

function generateId(prefix = 'usr') {
  return prefix + '_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function verifyToken(request, env) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, getJwtSecret(env));
    return decoded;
  } catch (err) {
    return null;
  }
}

let schemaInitialized = false;

async function ensureSchema(env) {
  if (schemaInitialized || !env.DB) return;
  try {
    await env.DB.batch([
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          email_verified INTEGER DEFAULT 0,
          best_score INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS otp_codes (
          email TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS friend_requests (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          receiver_id TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS friendships (
          user_id_1 TEXT NOT NULL,
          user_id_2 TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id_1, user_id_2)
        )
      `),
      env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS challenges (
          id TEXT PRIMARY KEY,
          challenger_id TEXT NOT NULL,
          opponent_id TEXT NOT NULL,
          score_to_beat INTEGER NOT NULL,
          challenger_score INTEGER NOT NULL,
          opponent_score INTEGER DEFAULT NULL,
          status TEXT DEFAULT 'PENDING',
          winner_id TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
    ]);
    schemaInitialized = true;
  } catch (err) {
    console.error('Schema auto-init notice:', err);
  }
}

async function sendVerificationEmail({ email, username, code, env }) {
  const subject = `Your OneHook Verification Code: ${code}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: #ffffff; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8; text-align: center; margin-top: 0; font-size: 24px;">🎣 OneHook Arcade</h2>
      <p style="font-size: 16px; color: #e2e8f0;">Ahoy <strong>${username || 'Angler'}</strong>,</p>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.5;">Use the following 6-digit verification code to complete your registration on OneHook:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; padding: 14px 28px; background: #1e293b; color: #fbbf24; border-radius: 10px; border: 2px dashed #f59e0b; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">${code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.4; border-top: 1px solid #334155; padding-top: 16px;">This code will expire in <strong>10 minutes</strong>. If you did not request this verification code, you can safely ignore this message.</p>
    </div>
  `;
  const text = `Ahoy ${username || 'Angler'},\n\nYour OneHook verification code is: ${code}\nThis code will expire in 10 minutes.\n\nHappy Fishing!`;

  // 1. Resend API Integration (https://resend.com)
  if (env && env.RESEND_API_KEY) {
    try {
      const fromEmail = env.EMAIL_FROM || 'OneHook Arcade <onboarding@resend.dev>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
          text
        })
      });
      if (res.ok) {
        console.log(`[EMAIL] Verification code successfully sent to ${email} via Resend`);
        return;
      }
    } catch (err) {
      console.error('[EMAIL ERROR] Resend dispatch error:', err);
    }
  }

  // 2. MailChannels Cloudflare Worker Direct Dispatch
  try {
    const fromEmail = (env && env.EMAIL_FROM) || 'verify@sprintgames.online';
    const mcRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email, name: username || 'Angler' }] }],
        from: { email: fromEmail, name: 'OneHook Arcade' },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html }
        ]
      })
    });
    if (mcRes.ok) {
      console.log(`[EMAIL] Verification code successfully sent to ${email} via MailChannels`);
      return;
    }
  } catch (err) {
    console.error('[EMAIL ERROR] MailChannels dispatch error:', err);
  }

  // 3. Fallback: Log to Cloudflare Worker logs for inspection / development
  console.log(`[EMAIL VERIFICATION CODE] To: ${email} | Angler: ${username} | Code: ${code}`);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method.toUpperCase();

    // Handle OPTIONS preflight for CORS
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      if (pathname.startsWith('/api/')) {
        await ensureSchema(env);
      }
      // ----------------------------------------------------
      // AUTH ROUTES
      // ----------------------------------------------------

      // POST /api/auth/register
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { username, email } = body;

        if (!username || !email) {
          return jsonResponse({ error: 'Username and email are required' }, 400);
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanUsername.length < 2 || cleanUsername.length > 20) {
          return jsonResponse({ error: 'Username must be between 2 and 20 characters' }, 400);
        }

        // Check if email already registered
        const existingUser = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(cleanEmail).first();
        if (existingUser) {
          const otp = generateOTP();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          await env.DB.prepare(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`).bind(cleanEmail, otp, expiresAt).run();

          // Send verification email
          ctx.waitUntil(sendVerificationEmail({ email: cleanEmail, username: existingUser.username, code: otp, env }));

          return jsonResponse({
            message: 'Verification code sent to your email. Please check your inbox!',
            email: cleanEmail,
            isExisting: true
          });
        }

        // Check if username taken
        const usernameTaken = await env.DB.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).bind(cleanUsername).first();
        if (usernameTaken) {
          return jsonResponse({ error: 'Username is already taken by another angler' }, 400);
        }

        // Create user (unverified)
        const userId = generateId('usr');
        await env.DB.prepare(`INSERT INTO users (id, username, email, email_verified, best_score) VALUES (?, ?, ?, 0, 0)`).bind(userId, cleanUsername, cleanEmail).run();

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        await env.DB.prepare(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`).bind(cleanEmail, otp, expiresAt).run();

        // Send verification email
        ctx.waitUntil(sendVerificationEmail({ email: cleanEmail, username: cleanUsername, code: otp, env }));

        return jsonResponse({
          message: 'Verification code sent to your email. Please check your inbox!',
          email: cleanEmail,
          isExisting: false
        });
      }

      // POST /api/auth/verify
      if (pathname === '/api/auth/verify' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { email, code } = body;

        if (!email || !code) {
          return jsonResponse({ error: 'Email and verification code are required' }, 400);
        }

        const cleanEmail = email.trim().toLowerCase();
        const otpRecord = await env.DB.prepare(`SELECT * FROM otp_codes WHERE email = ?`).bind(cleanEmail).first();

        if (!otpRecord) {
          return jsonResponse({ error: 'No verification request found for this email' }, 400);
        }

        if (Date.now() > otpRecord.expires_at) {
          return jsonResponse({ error: 'Verification code has expired. Please request a new one.' }, 400);
        }

        if (otpRecord.code !== code.trim()) {
          return jsonResponse({ error: 'Invalid verification code' }, 400);
        }

        // Verify user
        await env.DB.prepare(`UPDATE users SET email_verified = 1 WHERE email = ?`).bind(cleanEmail).run();
        await env.DB.prepare(`DELETE FROM otp_codes WHERE email = ?`).bind(cleanEmail).run();

        const user = await env.DB.prepare(`SELECT id, username, email, email_verified, best_score, created_at FROM users WHERE email = ?`).bind(cleanEmail).first();

        const token = jwt.sign(
          { id: user.id, username: user.username, email: user.email },
          getJwtSecret(env),
          { expiresIn: '30d' }
        );

        return jsonResponse({
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            best_score: user.best_score
          }
        });
      }

      // GET /api/auth/me
      if (pathname === '/api/auth/me' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }

        const user = await env.DB.prepare(`SELECT id, username, email, email_verified, best_score, created_at FROM users WHERE id = ?`).bind(authUser.id).first();
        if (!user) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        return jsonResponse({ user });
      }

      // ----------------------------------------------------
      // SCORE & LEADERBOARD ROUTES
      // ----------------------------------------------------

      // POST /api/score/submit
      if (pathname === '/api/score/submit' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const { score, durationSeconds, catches } = body;
        const userId = authUser.id;

        if (typeof score !== 'number' || score < 0 || !Array.isArray(catches)) {
          return jsonResponse({ error: 'Invalid score submission payload' }, 400);
        }

        let calculatedScore = 0;
        for (const catchItem of catches) {
          const { type, pts } = catchItem;
          if (!type || typeof pts !== 'number') {
            return jsonResponse({ error: 'Invalid catch data format' }, 400);
          }
          calculatedScore += pts;
        }

        if (Math.abs(calculatedScore - score) > 5) {
          return jsonResponse({ error: 'Score verification failed: telemetry mismatch' }, 400);
        }

        if (catches.length > 0 && durationSeconds > 0) {
          const catchesPerSecond = catches.length / durationSeconds;
          if (catchesPerSecond > 2.5) {
            return jsonResponse({ error: 'Score verification failed: unrealistic catch rate' }, 400);
          }
        }

        const user = await env.DB.prepare(`SELECT best_score FROM users WHERE id = ?`).bind(userId).first();
        if (!user) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        let isNewBest = false;
        let newBestScore = user.best_score;

        if (score > user.best_score) {
          isNewBest = true;
          newBestScore = score;
          await env.DB.prepare(`UPDATE users SET best_score = ? WHERE id = ?`).bind(score, userId).run();
        }

        return jsonResponse({
          score,
          bestScore: newBestScore,
          isNewBest,
          message: isNewBest ? '🔥 NEW BEST SCORE!' : 'Score recorded'
        });
      }

      // GET /api/leaderboard/global
      if (pathname === '/api/leaderboard/global' && method === 'GET') {
        const authUser = verifyToken(request, env);
        const { results } = await env.DB.prepare(`
          SELECT username, best_score, id
          FROM users
          ORDER BY best_score DESC
          LIMIT 50
        `).all();

        const leaderboard = (results || []).map((row, index) => ({
          rank: index + 1,
          username: row.username,
          score: row.best_score,
          isUser: authUser ? authUser.id === row.id : false
        }));

        return jsonResponse({ leaderboard });
      }

      // GET /api/leaderboard/friends
      if (pathname === '/api/leaderboard/friends' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const friendsRes = await env.DB.prepare(`
          SELECT CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END as friend_id
          FROM friendships
          WHERE user_id_1 = ? OR user_id_2 = ?
        `).bind(userId, userId, userId).all();

        const friendIds = (friendsRes.results || []).map(f => f.friend_id);
        friendIds.push(userId);

        const placeholders = friendIds.map(() => '?').join(',');
        const { results } = await env.DB.prepare(`
          SELECT id, username, best_score
          FROM users
          WHERE id IN (${placeholders})
          ORDER BY best_score DESC
        `).bind(...friendIds).all();

        const leaderboard = (results || []).map((row, index) => ({
          rank: index + 1,
          username: row.username,
          score: row.best_score,
          isUser: row.id === userId,
          userId: row.id
        }));

        return jsonResponse({ leaderboard });
      }

      // ----------------------------------------------------
      // SOCIAL & FRIEND ROUTES
      // ----------------------------------------------------

      // GET /api/friends/search
      if (pathname === '/api/friends/search' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }

        const query = url.searchParams.get('q') ? url.searchParams.get('q').trim() : '';
        if (!query || query.length < 2) {
          return jsonResponse({ error: 'Search query must be at least 2 characters' }, 400);
        }

        const userId = authUser.id;
        const usersRes = await env.DB.prepare(`
          SELECT id, username, best_score
          FROM users
          WHERE LOWER(username) LIKE LOWER(?) AND id != ?
          LIMIT 10
        `).bind(`%${query}%`, userId).all();

        const results = [];
        for (const u of (usersRes.results || [])) {
          const friendship = await env.DB.prepare(`
            SELECT * FROM friendships
            WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
          `).bind(userId, u.id, u.id, userId).first();

          const pendingRequest = await env.DB.prepare(`
            SELECT * FROM friend_requests
            WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
              AND status = 'PENDING'
          `).bind(userId, u.id, u.id, userId).first();

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

        return jsonResponse({ users: results });
      }

      // POST /api/friends/request
      if (pathname === '/api/friends/request' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const { receiverId } = body;
        const senderId = authUser.id;

        if (!receiverId || receiverId === senderId) {
          return jsonResponse({ error: 'Invalid receiver ID' }, 400);
        }

        const receiver = await env.DB.prepare(`SELECT id FROM users WHERE id = ?`).bind(receiverId).first();
        if (!receiver) {
          return jsonResponse({ error: 'User not found' }, 404);
        }

        const alreadyFriends = await env.DB.prepare(`
          SELECT * FROM friendships
          WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)
        `).bind(senderId, receiverId, receiverId, senderId).first();

        if (alreadyFriends) {
          return jsonResponse({ error: 'You are already friends' }, 400);
        }

        const existingReq = await env.DB.prepare(`
          SELECT * FROM friend_requests
          WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
            AND status = 'PENDING'
        `).bind(senderId, receiverId, receiverId, senderId).first();

        if (existingReq) {
          return jsonResponse({ error: 'Friend request already pending' }, 400);
        }

        const reqId = generateId('freq');
        await env.DB.prepare(`
          INSERT INTO friend_requests (id, sender_id, receiver_id, status)
          VALUES (?, ?, ?, 'PENDING')
        `).bind(reqId, senderId, receiverId).run();

        return jsonResponse({ message: 'Friend request sent successfully' });
      }

      // GET /api/friends/requests
      if (pathname === '/api/friends/requests' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const { results } = await env.DB.prepare(`
          SELECT fr.id, fr.sender_id, fr.created_at, u.username as sender_username, u.best_score as sender_score
          FROM friend_requests fr
          JOIN users u ON fr.sender_id = u.id
          WHERE fr.receiver_id = ? AND fr.status = 'PENDING'
          ORDER BY fr.created_at DESC
        `).bind(userId).all();

        return jsonResponse({ requests: results || [] });
      }

      // POST /api/friends/respond
      if (pathname === '/api/friends/respond' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const body = await request.json().catch(() => ({}));
        const { requestId, action } = body;

        if (!requestId || !['ACCEPT', 'DECLINE'].includes(action)) {
          return jsonResponse({ error: 'Invalid request or action' }, 400);
        }

        const friendReq = await env.DB.prepare(`SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = 'PENDING'`).bind(requestId, userId).first();
        if (!friendReq) {
          return jsonResponse({ error: 'Friend request not found' }, 404);
        }

        if (action === 'ACCEPT') {
          await env.DB.prepare(`UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?`).bind(requestId).run();
          await env.DB.prepare(`INSERT OR IGNORE INTO friendships (user_id_1, user_id_2) VALUES (?, ?)`).bind(friendReq.sender_id, userId).run();
          return jsonResponse({ message: 'Friend request accepted' });
        } else {
          await env.DB.prepare(`UPDATE friend_requests SET status = 'DECLINED' WHERE id = ?`).bind(requestId).run();
          return jsonResponse({ message: 'Friend request declined' });
        }
      }

      // GET /api/friends/list
      if (pathname === '/api/friends/list' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const { results } = await env.DB.prepare(`
          SELECT u.id, u.username, u.best_score
          FROM friendships f
          JOIN users u ON (u.id = CASE WHEN f.user_id_1 = ? THEN f.user_id_2 ELSE f.user_id_1 END)
          WHERE f.user_id_1 = ? OR f.user_id_2 = ?
          ORDER BY u.best_score DESC
        `).bind(userId, userId, userId).all();

        return jsonResponse({ friends: results || [] });
      }

      // ----------------------------------------------------
      // CHALLENGE ROUTES
      // ----------------------------------------------------

      // POST /api/challenges/create
      if (pathname === '/api/challenges/create' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const challengerId = authUser.id;

        const body = await request.json().catch(() => ({}));
        const { opponentId } = body;

        if (!opponentId || opponentId === challengerId) {
          return jsonResponse({ error: 'Invalid opponent' }, 400);
        }

        const opponent = await env.DB.prepare(`SELECT id, username, best_score FROM users WHERE id = ?`).bind(opponentId).first();
        if (!opponent) {
          return jsonResponse({ error: 'Opponent not found' }, 404);
        }

        const challenger = await env.DB.prepare(`SELECT best_score FROM users WHERE id = ?`).bind(challengerId).first();

        const challengeId = generateId('chg');
        const scoreToBeat = opponent.best_score;
        const challengerScore = challenger ? challenger.best_score : 0;

        await env.DB.prepare(`
          INSERT INTO challenges (id, challenger_id, opponent_id, score_to_beat, challenger_score, status)
          VALUES (?, ?, ?, ?, ?, 'PENDING')
        `).bind(challengeId, challengerId, opponentId, scoreToBeat, challengerScore).run();

        return jsonResponse({
          challengeId,
          opponent: {
            id: opponent.id,
            username: opponent.username,
            scoreToBeat
          }
        });
      }

      // GET /api/challenges/list
      if (pathname === '/api/challenges/list' && method === 'GET') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const { results } = await env.DB.prepare(`
          SELECT c.*,
            u_challenger.username as challenger_username,
            u_opponent.username as opponent_username
          FROM challenges c
          JOIN users u_challenger ON c.challenger_id = u_challenger.id
          JOIN users u_opponent ON c.opponent_id = u_opponent.id
          WHERE c.challenger_id = ? OR c.opponent_id = ?
          ORDER BY c.created_at DESC
          LIMIT 20
        `).bind(userId, userId).all();

        return jsonResponse({ challenges: results || [] });
      }

      // POST /api/challenges/complete
      if (pathname === '/api/challenges/complete' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const body = await request.json().catch(() => ({}));
        const { challengeId, scoreAchieved } = body;

        if (!challengeId || typeof scoreAchieved !== 'number') {
          return jsonResponse({ error: 'Invalid challenge completion data' }, 400);
        }

        const challenge = await env.DB.prepare(`SELECT * FROM challenges WHERE id = ?`).bind(challengeId).first();
        if (!challenge) {
          return jsonResponse({ error: 'Challenge not found' }, 404);
        }

        const isChallenger = challenge.challenger_id === userId;
        const isOpponent = challenge.opponent_id === userId;

        if (!isChallenger && !isOpponent) {
          return jsonResponse({ error: 'Not authorized for this challenge' }, 403);
        }

        const targetScore = isChallenger ? challenge.score_to_beat : challenge.challenger_score;
        const won = scoreAchieved > targetScore;
        const winnerId = won ? userId : (isChallenger ? challenge.opponent_id : challenge.challenger_id);

        await env.DB.prepare(`
          UPDATE challenges
          SET opponent_score = ?, status = 'COMPLETED', winner_id = ?
          WHERE id = ?
        `).bind(scoreAchieved, winnerId, challengeId).run();

        const challengerUser = await env.DB.prepare(`SELECT username FROM users WHERE id = ?`).bind(challenge.challenger_id).first();
        const opponentUser = await env.DB.prepare(`SELECT username FROM users WHERE id = ?`).bind(challenge.opponent_id).first();

        return jsonResponse({
          won,
          scoreAchieved,
          targetScore,
          winnerId,
          challengerUsername: challengerUser ? challengerUser.username : 'Challenger',
          opponentUsername: opponentUser ? opponentUser.username : 'Opponent'
        });
      }

      // ----------------------------------------------------
      // FALLBACK TO ASSETS (or 404 for API)
      // ----------------------------------------------------
      if (pathname.startsWith('/api/')) {
        return jsonResponse({ error: 'Endpoint not found' }, 404);
      }

      // If env.ASSETS binding exists, pass request to static assets server
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response('Not Found', { status: 404 });

    } catch (err) {
      console.error(`Worker execution error [${pathname}]:`, err);
      return jsonResponse({ error: 'Internal server error', details: err.message }, 500);
    }
  }
};
