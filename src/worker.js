import jwt from 'jsonwebtoken';

const FALLBACK_JWT_SECRET = 'sprintgames_secret_key_2026_secure';

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  let maskedLocal;
  if (local.length <= 2) {
    maskedLocal = local[0] + '*';
  } else if (local.length <= 4) {
    maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
  } else {
    maskedLocal = local[0] + '*'.repeat(local.length - 2) + local.slice(-2);
  }
  const domainParts = domain.split('.');
  const domainName = domainParts[0];
  let maskedDomain;
  if (domainName.length <= 2) {
    maskedDomain = domainName;
  } else {
    maskedDomain = domainName[0] + '*'.repeat(domainName.length - 2) + domainName[domainName.length - 1];
  }
  return maskedLocal + '@' + maskedDomain + '.' + domainParts.slice(1).join('.');
}

async function sendVerificationEmail({ email, username, code, env }) {
  if (!env || !env.BREVO_API_KEY) {
    console.error('[EMAIL ERROR] BREVO_API_KEY secret is not configured in worker environment.');
    return {
      success: false,
      error: 'Email verification service is not configured. Please try again later or contact support.'
    };
  }

  const subject = 'SprintGames - Your Verification Code';
  const senderEmail = (env.EMAIL_FROM && env.EMAIL_FROM.trim()) || 'sobishjt@gmail.com';
  const senderName = (env.EMAIL_FROM_NAME && env.EMAIL_FROM_NAME.trim()) || 'SprintGames';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f172a; color: #ffffff; border-radius: 12px; border: 1px solid #334155;">
      <h2 style="color: #38bdf8; text-align: center; margin-top: 0; font-size: 24px;">🎮 SprintGames</h2>
      <p style="font-size: 16px; color: #e2e8f0;">Hello <strong>${username || 'Player'}</strong>,</p>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.5;">Use the following 6-digit verification code to complete your registration on SprintGames:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; padding: 14px 28px; background: #1e293b; color: #fbbf24; border-radius: 10px; border: 2px dashed #f59e0b; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">${code}</span>
      </div>
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.4; border-top: 1px solid #334155; padding-top: 16px;">This code will expire in <strong>10 minutes</strong>. If you did not request this verification code, you can safely ignore this message.</p>
    </div>
  `;
  const textContent = `Hello ${username || 'Player'},\n\nYour SprintGames verification code is: ${code}\nThis code will expire in 10 minutes.\n\nHappy Gaming!`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: email, name: username || 'Player' }],
        subject,
        htmlContent: html,
        textContent
      })
    });

    if (res.ok) {
      console.log(`[EMAIL] Verification code successfully sent to ${email} via Brevo`);
      return { success: true };
    }

    const brevoError = await res.json().catch(() => ({}));
    console.error(`[EMAIL ERROR] Brevo API error (${res.status}):`, JSON.stringify(brevoError));

    const clientMsg = brevoError.message || 'Failed to send verification email. Please check your email address and try again.';
    return { success: false, error: clientMsg };
  } catch (err) {
    console.error('[EMAIL ERROR] Brevo dispatch network error:', err);
    return { success: false, error: 'Failed to communicate with email delivery service. Please try again later.' };
  }
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

      // POST /api/auth/start or POST /api/auth/login or POST /api/auth/register
      if ((pathname === '/api/auth/start' || pathname === '/api/auth/login' || pathname === '/api/auth/register') && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const rawIdentifier = body.identifier || body.email || body.username || '';

        if (!rawIdentifier || typeof rawIdentifier !== 'string' || !rawIdentifier.trim()) {
          return jsonResponse({ error: 'Please enter your username or email address' }, 400);
        }

        const cleanIdentifier = rawIdentifier.trim();

        // 1. If it's an email address
        if (isValidEmail(cleanIdentifier)) {
          const cleanEmail = cleanIdentifier.toLowerCase();
          let user = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(cleanEmail).first();

          if (!user) {
            // Auto-register new user with email
            let baseName = '';
            if (body.username && typeof body.username === 'string' && body.username.trim()) {
              baseName = body.username.trim().replace(/[^a-zA-Z0-9_]/g, '');
            }
            if (!baseName || baseName.length < 2) {
              baseName = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
            }
            if (baseName.length < 2) baseName = 'Player';
            if (baseName.length > 20) baseName = baseName.substring(0, 20);

            // Ensure unique username
            let finalName = baseName;
            const existingName = await env.DB.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`).bind(finalName).first();
            if (existingName) {
              finalName = `${baseName}_${Math.floor(100 + Math.random() * 900)}`;
            }

            const userId = generateId('usr');
            await env.DB.prepare(`INSERT INTO users (id, username, email, email_verified, best_score) VALUES (?, ?, ?, 0, 0)`).bind(userId, finalName, cleanEmail).run();
            user = { id: userId, username: finalName, email: cleanEmail };
          } else {
             // User exists. If it's a register call, maybe we should return an error, but for smooth UX we can just send the OTP to login.
             // But if they explicitly clicked "Register" and provided a username that doesn't match, maybe we don't care.
          }

          const otp = generateOTP();
          const expiresAt = Date.now() + 10 * 60 * 1000;
          await env.DB.prepare(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`).bind(user.email, otp, expiresAt).run();

          const emailResult = await sendVerificationEmail({
            email: user.email,
            username: user.username,
            code: otp,
            env
          });

          if (!emailResult.success) {
            return jsonResponse({ error: emailResult.error }, 500);
          }

          return jsonResponse({
            success: true,
            message: `Verification code sent to ${maskEmail(user.email)}!`,
            email: user.email,
            username: user.username
          });
        }

        // 2. If it's a username
        const user = await env.DB.prepare(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`).bind(cleanIdentifier).first();

        if (!user) {
          return jsonResponse({
            error: `No account found for "${cleanIdentifier}". Please enter your email address to sign up!`,
            notFound: true
          }, 404);
        }

        const otp = generateOTP();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        await env.DB.prepare(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`)
          .bind(user.email, otp, expiresAt).run();

        const emailResult = await sendVerificationEmail({
          email: user.email,
          username: user.username,
          code: otp,
          env
        });

        if (!emailResult.success) {
          return jsonResponse({ error: emailResult.error }, 500);
        }

        return jsonResponse({
          success: true,
          message: `Verification code sent to ${maskEmail(user.email)}!`,
          email: user.email,
          username: user.username
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
        const { opponentId, score } = body;

        if (!opponentId || opponentId === challengerId) {
          return jsonResponse({ error: 'Invalid opponent selected' }, 400);
        }

        const opponent = await env.DB.prepare(`SELECT id, username, best_score FROM users WHERE id = ?`).bind(opponentId).first();
        if (!opponent) {
          return jsonResponse({ error: 'Opponent not found' }, 404);
        }

        const challenger = await env.DB.prepare(`SELECT id, username, best_score FROM users WHERE id = ?`).bind(challengerId).first();
        const challengerScore = (typeof score === 'number' && score > 0)
          ? Math.floor(score)
          : (challenger ? (challenger.best_score || 0) : 0);

        if (challengerScore <= 0) {
          return jsonResponse({ error: 'Score must be greater than 0 to send a challenge. Play a match first!' }, 400);
        }

        const scoreToBeat = challengerScore; // The opponent must beat the challenger's match score

        // Check if there's already a challenge with this EXACT score sent from this challenger to this opponent
        const duplicateScoreChallenge = await env.DB.prepare(`
          SELECT id, status, opponent_score, winner_id
          FROM challenges
          WHERE challenger_id = ? AND opponent_id = ? AND challenger_score = ?
        `).bind(challengerId, opponentId, challengerScore).first();

        if (duplicateScoreChallenge) {
          return jsonResponse({
            error: `You have already sent a challenge to ${opponent.username} with ${challengerScore.toLocaleString()} pts! Play another match to challenge with a new score.`
          }, 400);
        }

        const challengeId = generateId('chg');
        await env.DB.prepare(`
          INSERT INTO challenges (id, challenger_id, opponent_id, score_to_beat, challenger_score, status)
          VALUES (?, ?, ?, ?, ?, 'PENDING')
        `).bind(challengeId, challengerId, opponentId, scoreToBeat, challengerScore).run();

        return jsonResponse({
          success: true,
          message: `⚔️ Challenge sent to ${opponent.username} to beat your score of ${scoreToBeat.toLocaleString()} pts!`,
          challengeId,
          opponent: {
            id: opponent.id,
            username: opponent.username,
            bestScore: opponent.best_score
          },
          scoreToBeat
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
            u_challenger.best_score as challenger_best,
            u_opponent.username as opponent_username,
            u_opponent.best_score as opponent_best
          FROM challenges c
          JOIN users u_challenger ON c.challenger_id = u_challenger.id
          JOIN users u_opponent ON c.opponent_id = u_opponent.id
          WHERE c.challenger_id = ? OR c.opponent_id = ?
          ORDER BY c.created_at DESC
          LIMIT 50
        `).bind(userId, userId).all();

        const allChallenges = results || [];
        const incoming = [];
        const won = [];
        const lost = [];
        const sent = [];
        const completed = [];

        for (const ch of allChallenges) {
          const isOpponent = ch.opponent_id === userId;
          const isChallenger = ch.challenger_id === userId;
          const hasAttempted = ch.opponent_score !== null && ch.opponent_score !== undefined;
          const isWonByUser = ch.winner_id === userId;

          const item = {
            id: ch.id,
            challengerId: ch.challenger_id,
            challengerUsername: ch.challenger_username,
            challengerScore: ch.challenger_score,
            opponentId: ch.opponent_id,
            opponentUsername: ch.opponent_username,
            opponentScore: ch.opponent_score,
            scoreToBeat: ch.score_to_beat,
            status: ch.status,
            winnerId: ch.winner_id,
            createdAt: ch.created_at,
            isIncoming: isOpponent,
            isSent: isChallenger,
            isWinner: isWonByUser,
            isCompleted: ch.status === 'COMPLETED' || (isOpponent && isWonByUser),
            canRetry: isOpponent && !isWonByUser
          };

          if (isOpponent) {
            if (isWonByUser || (hasAttempted && ch.opponent_score > ch.challenger_score)) {
              won.push(item);
              completed.push(item);
            } else if (hasAttempted) {
              lost.push(item);
              completed.push(item);
            } else {
              incoming.push(item);
            }
          } else if (isChallenger) {
            sent.push(item);
            if (ch.status === 'COMPLETED' || hasAttempted) {
              completed.push(item);
              if (isWonByUser) {
                won.push(item);
              }
            }
          }
        }

        return jsonResponse({
          challenges: allChallenges,
          incoming,
          won,
          lost,
          sent,
          completed,
          stats: {
            incomingCount: incoming.length,
            wonCount: won.length,
            lostCount: lost.length,
            sentCount: sent.length,
            totalCount: allChallenges.length
          }
        });
      }

      // POST /api/challenges/withdraw
      if (pathname === '/api/challenges/withdraw' && method === 'POST') {
        const authUser = verifyToken(request, env);
        if (!authUser) {
          return jsonResponse({ error: 'Authentication token required' }, 401);
        }
        const userId = authUser.id;

        const body = await request.json().catch(() => ({}));
        const { challengeId } = body;

        if (!challengeId) {
          return jsonResponse({ error: 'Challenge ID required' }, 400);
        }

        const challenge = await env.DB.prepare(`SELECT * FROM challenges WHERE id = ?`).bind(challengeId).first();
        if (!challenge) {
          return jsonResponse({ error: 'Challenge not found' }, 404);
        }

        if (challenge.challenger_id !== userId) {
          return jsonResponse({ error: 'You can only withdraw challenges you sent' }, 403);
        }

        if (challenge.opponent_score !== null && challenge.opponent_score !== undefined) {
          return jsonResponse({ error: 'Cannot withdraw challenge after friend has already played it' }, 400);
        }

        await env.DB.prepare(`DELETE FROM challenges WHERE id = ? AND challenger_id = ?`).bind(challengeId, userId).run();

        return jsonResponse({
          success: true,
          message: '↩️ Challenge withdrawn successfully!'
        });
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

        const targetScore = challenge.challenger_score;
        const won = scoreAchieved > targetScore;
        const winnerId = won ? userId : challenge.challenger_id;
        const finalStatus = won ? 'COMPLETED' : 'FAILED_ATTEMPT';

        // Keep track of the highest score achieved so far by the opponent
        const bestOpponentScore = Math.max(challenge.opponent_score || 0, scoreAchieved);

        await env.DB.prepare(`
          UPDATE challenges
          SET opponent_score = ?, status = ?, winner_id = ?
          WHERE id = ?
        `).bind(bestOpponentScore, finalStatus, winnerId, challengeId).run();

        const challengerUser = await env.DB.prepare(`SELECT username FROM users WHERE id = ?`).bind(challenge.challenger_id).first();
        const opponentUser = await env.DB.prepare(`SELECT username FROM users WHERE id = ?`).bind(challenge.opponent_id).first();

        const challengerName = challengerUser ? challengerUser.username : 'Challenger';
        const opponentName = opponentUser ? opponentUser.username : 'Opponent';

        return jsonResponse({
          success: true,
          challengeId: challenge.id,
          won,
          scoreAchieved,
          bestOpponentScore,
          targetScore,
          winnerId,
          challengerUsername: challengerName,
          opponentUsername: opponentName,
          canRetry: !won,
          message: won
            ? `🎉 VICTORY! You beat ${challengerName}'s score of ${targetScore.toLocaleString()} with ${scoreAchieved.toLocaleString()} pts!`
            : `You scored ${scoreAchieved.toLocaleString()} pts. Target is ${targetScore.toLocaleString()} pts. You can retry anytime from the Lost tab!`
        });
      }

      // ----------------------------------------------------
      // TEMPORARY DEBUG ENDPOINT — REMOVE AFTER DEBUGGING
      // ----------------------------------------------------
      if (pathname === '/api/debug/email-test' && method === 'GET') {
        const diagnostics = {
          hasBrevoKey: !!env.BREVO_API_KEY,
          brevoKeyPrefix: env.BREVO_API_KEY ? env.BREVO_API_KEY.substring(0, 10) + '...' : 'NOT SET',
          senderEmail: (env.EMAIL_FROM && env.EMAIL_FROM.trim()) || 'sobishjt@gmail.com (fallback)',
          senderName: (env.EMAIL_FROM_NAME && env.EMAIL_FROM_NAME.trim()) || 'SprintGames (fallback)',
        };

        const testEmail = url.searchParams.get('to');
        if (!testEmail) {
          return jsonResponse({
            message: 'Add ?to=your@email.com to send a test email',
            diagnostics
          });
        }

        try {
          const senderEmail = (env.EMAIL_FROM && env.EMAIL_FROM.trim()) || 'sobishjt@gmail.com';
          const senderName = (env.EMAIL_FROM_NAME && env.EMAIL_FROM_NAME.trim()) || 'SprintGames';
          const res = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': env.BREVO_API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              sender: { name: senderName, email: senderEmail },
              to: [{ email: testEmail, name: 'Test User' }],
              subject: 'SprintGames Debug Test',
              textContent: 'If you received this, email sending works!'
            })
          });

          const responseBody = await res.json().catch(() => ({}));
          return jsonResponse({
            diagnostics,
            testResult: {
              httpStatus: res.status,
              brevoResponse: responseBody,
              sentTo: testEmail,
              sentFrom: `${senderName} <${senderEmail}>`
            }
          });
        } catch (err) {
          return jsonResponse({
            diagnostics,
            testResult: { error: err.message }
          }, 500);
        }
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
