// Star Quest API routes — everything under /api/sq/*.
// Delegated from src/worker.js. Do NOT duplicate these handlers inline in
// worker.js — a previous version of this project had both an inline block
// and this imported module simultaneously, with the inline block silently
// shadowing this file as dead code. This file is the single source of truth
// for /api/sq/* routing.

import jwt from 'jsonwebtoken';

// Kept as a local copy (not imported from worker.js) to avoid a circular
// import between worker.js and this file. Must match worker.js's fallback.
const FALLBACK_JWT_SECRET = 'sprintgames_secret_key_2026_secure';

function getJwtSecret(env) {
  return (env && env.JWT_SECRET) || FALLBACK_JWT_SECRET;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

function verifyToken(request, env) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret(env));
  } catch (err) {
    return null;
  }
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

// Seeded into a family's sq_reason_preset rows the first time it's read,
// so "remove a default" and "remove a custom one" are the same operation
// (delete a row) rather than needing to track hidden defaults separately.
const DEFAULT_REASON_PRESETS = [
  { icon: '🪥', label: 'Brushed teeth' },
  { icon: '📚', label: 'Read a book' },
  { icon: '🧸', label: 'Tidied toys' },
  { icon: '🤝', label: 'Helped at home' },
  { icon: '💛', label: 'Kind to sibling' },
  { icon: '🥦', label: 'Ate veggies' },
  { icon: '😴', label: 'Bedtime on time' },
  { icon: '✏️', label: 'Homework' }
];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Best-effort invite email via Brevo (same API/pattern as worker.js's OTP
// email). Degrades gracefully: the invite link is always returned to the
// caller regardless of whether the email send succeeds, so a missing
// BREVO_API_KEY or a delivery failure never blocks inviting a partner —
// the parent can just share the link manually instead.
async function sendInviteEmail({ env, toEmail, inviterName, familyName, url }) {
  if (!env || !env.BREVO_API_KEY) return { success: false, error: 'not_configured' };

  const senderEmail = (env.EMAIL_FROM && env.EMAIL_FROM.trim()) || 'sobishjt@gmail.com';
  const senderName = (env.EMAIL_FROM_NAME && env.EMAIL_FROM_NAME.trim()) || 'SprintGames';
  const subject = `${inviterName} invited you to join ${familyName || 'their family'} on Star Quest`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #fffbeb; color: #78350f; border-radius: 12px; border: 1px solid #fde68a;">
      <h2 style="color: #f59e0b; text-align: center; margin-top: 0; font-size: 24px;">⭐ Star Quest</h2>
      <p style="font-size: 16px;"><strong>${inviterName}</strong> invited you to join <strong>${familyName || 'their family'}</strong> on Star Quest — give your kids stars for daily achievements and unlock rewards together.</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${url}" style="display: inline-block; padding: 14px 28px; background: #f59e0b; color: #fff; font-weight: 700; text-decoration: none; border-radius: 10px;">Join the Family</a>
      </div>
      <p style="color: #92400e; font-size: 13px; border-top: 1px solid #fde68a; padding-top: 16px;">This invite expires in 24 hours. You'll need a SprintGames account (or can create one) to accept it.</p>
    </div>
  `;
  const textContent = `${inviterName} invited you to join ${familyName || 'their family'} on Star Quest.\n\nJoin here: ${url}\n\nThis invite expires in 24 hours.`;

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: [{ email: toEmail }], subject, htmlContent: html, textContent })
    });
    if (res.ok) return { success: true };
    const brevoError = await res.json().catch(() => ({}));
    return { success: false, error: brevoError.message || 'send_failed' };
  } catch (err) {
    return { success: false, error: 'network_error' };
  }
}

// ---- Membership helpers ----
async function getFamilyMember(env, userId, familyId) {
  return env.DB.prepare(`SELECT * FROM sq_family_member WHERE family_id = ? AND user_id = ?`)
    .bind(familyId, userId).first();
}

async function getMyFamilyMembership(env, userId) {
  return env.DB.prepare(`SELECT * FROM sq_family_member WHERE user_id = ?`).bind(userId).first();
}

async function assertKidAccess(env, userId, kidId) {
  const kid = await env.DB.prepare(`SELECT * FROM sq_kid WHERE id = ?`).bind(kidId).first();
  if (!kid) return null;
  const member = await getFamilyMember(env, userId, kid.family_id);
  if (!member) return null;
  return { kid, member };
}

// ---- Goal progress: counts ALL qualifying stars since the boundary, not
// just stars given after the goal was created — a goal set after stars
// were already given should credit them, and any stars given between one
// goal's redemption and the next new goal should carry over too. The
// boundary is the most recent REDEEMED goal's redeemed_at for this kid AND
// PERIOD, or the beginning of time if no goal of that period has ever been
// redeemed. A kid can run up to three goals at once — one per period
// ('week', 'month', 'year') — each tracked independently on its own
// boundary/progress, so finishing (or resetting) one never touches the
// others. ----
async function goalProgressBoundary(env, kidId, period) {
  const lastRedeemed = await env.DB.prepare(
    `SELECT redeemed_at FROM sq_goal WHERE kid_id = ? AND period = ? AND status = 'REDEEMED' AND redeemed_at IS NOT NULL ORDER BY redeemed_at DESC LIMIT 1`
  ).bind(kidId, period).first();
  return (lastRedeemed && lastRedeemed.redeemed_at) || '1970-01-01T00:00:00.000Z';
}

async function computeGoalProgress(env, kidId, period) {
  const boundary = await goalProgressBoundary(env, kidId, period);
  const res = await env.DB.prepare(
    `SELECT COALESCE(SUM(stars), 0) as total FROM sq_star_entry WHERE kid_id = ? AND deleted_at IS NULL AND created_at >= ?`
  ).bind(kidId, boundary).first();
  return res ? res.total : 0;
}

async function withProgress(env, goal) {
  if (!goal) return goal;
  const progress = await computeGoalProgress(env, goal.kid_id, goal.period);
  return { ...goal, progress };
}

// ---- Secret-hiding: strip reward_secret* fields unless the goal has
// progressed past ACTIVE. Kids have no separate login (they're sub-profiles,
// not accounts), so kid mode runs under the same parent JWT as parent mode —
// there is no server-side signal for "a kid is looking right now." This
// means secret-hiding must be purely a function of goal.status, applied
// unconditionally by every route that returns a goal, never role-based. ----
function sanitizeGoal(goal) {
  if (!goal) return goal;
  if (goal.status === 'ACTIVE') {
    const { reward_secret, reward_secret_emoji, reward_secret_photo_key, ...safe } = goal;
    return safe;
  }
  return goal;
}

export async function handleStarQuest(request, env, pathname, method) {
  const sqPath = pathname.slice('/api/sq'.length); // e.g. /family/create
  const authUser = verifyToken(request, env);
  if (!authUser) return jsonResponse({ error: 'Authentication required' }, 401);

  // =========================================================
  // FAMILY
  // =========================================================
  if (sqPath === '/family/create' && method === 'POST') {
    const existing = await getMyFamilyMembership(env, authUser.id);
    if (existing) return jsonResponse({ error: 'You already belong to a family. Leave it first to create a new one.' }, 400);

    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim().slice(0, 50) || null;
    const displayName = (body.displayName || 'Parent').trim().slice(0, 30);

    const familyId = newId('fam');
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO sq_family (id, owner_user_id, name) VALUES (?, ?, ?)`)
        .bind(familyId, authUser.id, name),
      env.DB.prepare(`INSERT INTO sq_family_member (id, family_id, user_id, role, display_name) VALUES (?, ?, ?, 'OWNER', ?)`)
        .bind(newId('mem'), familyId, authUser.id, displayName)
    ]);

    const family = await env.DB.prepare(`SELECT id, name, owner_user_id, created_at FROM sq_family WHERE id = ?`).bind(familyId).first();
    return jsonResponse({ family });
  }

  if (sqPath === '/family/me' && method === 'GET') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ family: null });

    const [family, membersRes, kidsRes] = await Promise.all([
      env.DB.prepare(`SELECT id, name, owner_user_id, created_at FROM sq_family WHERE id = ?`).bind(member.family_id).first(),
      env.DB.prepare(`SELECT m.user_id, m.role, m.display_name, m.created_at, u.username FROM sq_family_member m JOIN users u ON u.id = m.user_id WHERE m.family_id = ?`).bind(member.family_id).all(),
      env.DB.prepare(`SELECT * FROM sq_kid WHERE family_id = ? ORDER BY created_at ASC`).bind(member.family_id).all()
    ]);

    return jsonResponse({
      family,
      myRole: member.role,
      myDisplayName: member.display_name,
      members: membersRes.results || [],
      kids: kidsRes.results || []
    });
  }

  if (sqPath === '/family/delete' && method === 'POST') {
    const family = await env.DB.prepare(`SELECT * FROM sq_family WHERE owner_user_id = ?`).bind(authUser.id).first();
    if (!family) return jsonResponse({ error: 'Family not found or you are not the owner.' }, 404);

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM sq_goal WHERE kid_id IN (SELECT id FROM sq_kid WHERE family_id = ?)`).bind(family.id),
      env.DB.prepare(`DELETE FROM sq_star_entry WHERE kid_id IN (SELECT id FROM sq_kid WHERE family_id = ?)`).bind(family.id),
      env.DB.prepare(`DELETE FROM sq_kid WHERE family_id = ?`).bind(family.id),
      env.DB.prepare(`DELETE FROM sq_family_invite WHERE family_id = ?`).bind(family.id),
      env.DB.prepare(`DELETE FROM sq_family_member WHERE family_id = ?`).bind(family.id),
      env.DB.prepare(`DELETE FROM sq_family WHERE id = ?`).bind(family.id)
    ]);
    return jsonResponse({ success: true });
  }

  // =========================================================
  // INVITES
  // =========================================================
  if (sqPath === '/family/invite/create' && method === 'POST') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const body = await request.json().catch(() => ({}));
    const toEmail = (body.email || '').trim().toLowerCase();
    if (toEmail && !isValidEmail(toEmail)) return jsonResponse({ error: 'Please enter a valid email address.' }, 400);

    const code = Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

    await env.DB.prepare(`INSERT INTO sq_family_invite (code, family_id, created_by, expires_at, email) VALUES (?, ?, ?, ?, ?)`)
      .bind(code, member.family_id, authUser.id, expiresAt, toEmail || null).run();

    const origin = new URL(request.url).origin;
    const url = `${origin}/star-quest?invite=${code}`;

    let emailResult = null;
    if (toEmail) {
      const family = await env.DB.prepare(`SELECT name FROM sq_family WHERE id = ?`).bind(member.family_id).first();
      const sendRes = await sendInviteEmail({
        env, toEmail, url,
        inviterName: member.display_name || 'A family member',
        familyName: family ? family.name : null
      });
      emailResult = sendRes.success ? 'sent' : 'failed';
    }

    return jsonResponse({ code, url, expiresAt, email: toEmail || null, emailResult });
  }

  // Invites addressed to my account's email, still open (not used, not
  // declined, not expired) — powers the "Requests" notification so an
  // invited partner doesn't need the raw code/link to join.
  if (sqPath === '/family/invite/pending' && method === 'GET') {
    if (!authUser.email) return jsonResponse({ invites: [] });

    const { results } = await env.DB.prepare(`
      SELECT i.code, i.family_id, i.expires_at, i.created_at,
             f.name as family_name,
             m.display_name as inviter_display_name, u.username as inviter_username
      FROM sq_family_invite i
      JOIN sq_family f ON f.id = i.family_id
      LEFT JOIN sq_family_member m ON m.family_id = i.family_id AND m.user_id = i.created_by
      LEFT JOIN users u ON u.id = i.created_by
      WHERE i.email = ? AND i.used_by IS NULL AND i.declined_at IS NULL AND i.expires_at > ?
      ORDER BY i.created_at DESC
    `).bind(authUser.email.toLowerCase(), Date.now()).all();

    return jsonResponse({ invites: results || [] });
  }

  if (sqPath === '/family/invite/decline' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return jsonResponse({ error: 'Invite code required.' }, 400);

    const invite = await env.DB.prepare(`SELECT * FROM sq_family_invite WHERE code = ? AND used_by IS NULL AND declined_at IS NULL`)
      .bind(code).first();
    if (!invite) return jsonResponse({ error: 'Invite not found.' }, 404);
    if (authUser.email && invite.email && invite.email !== authUser.email.toLowerCase()) {
      return jsonResponse({ error: 'This invite is not addressed to you.' }, 403);
    }

    await env.DB.prepare(`UPDATE sq_family_invite SET declined_at = CURRENT_TIMESTAMP WHERE code = ?`).bind(code).run();
    return jsonResponse({ success: true });
  }

  if (sqPath === '/family/invite/accept' && method === 'POST') {
    const existing = await getMyFamilyMembership(env, authUser.id);
    if (existing) return jsonResponse({ error: 'You already belong to a family.' }, 400);

    const body = await request.json().catch(() => ({}));
    const code = (body.code || '').trim().toUpperCase();
    if (!code) return jsonResponse({ error: 'Invite code required.' }, 400);

    const invite = await env.DB.prepare(`SELECT * FROM sq_family_invite WHERE code = ? AND used_by IS NULL AND declined_at IS NULL AND expires_at > ?`)
      .bind(code, Date.now()).first();
    if (!invite) return jsonResponse({ error: 'Invalid or expired invite code.' }, 404);

    const displayName = (body.displayName || 'Parent').trim().slice(0, 30);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO sq_family_member (id, family_id, user_id, role, display_name) VALUES (?, ?, ?, 'PARTNER', ?)`)
        .bind(newId('mem'), invite.family_id, authUser.id, displayName),
      env.DB.prepare(`UPDATE sq_family_invite SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE code = ?`)
        .bind(authUser.id, code)
    ]);

    const family = await env.DB.prepare(`SELECT id, name, owner_user_id, created_at FROM sq_family WHERE id = ?`).bind(invite.family_id).first();
    return jsonResponse({ success: true, family });
  }

  if (sqPath === '/family/partner/remove' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId;
    const ownerMember = await env.DB.prepare(`SELECT family_id FROM sq_family_member WHERE user_id = ? AND role = 'OWNER'`).bind(authUser.id).first();
    if (!ownerMember) return jsonResponse({ error: 'Only the family owner can remove a partner.' }, 403);

    await env.DB.prepare(`DELETE FROM sq_family_member WHERE family_id = ? AND user_id = ? AND role = 'PARTNER'`)
      .bind(ownerMember.family_id, targetUserId).run();
    return jsonResponse({ success: true });
  }

  // Self-service only — a member renames themselves ("Mummy"/"Papa"/etc.),
  // not other members, so there's no permission check to design beyond
  // "you must be in this family," which getMyFamilyMembership already gives.
  if (sqPath === '/family/member/update' && method === 'POST') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const body = await request.json().catch(() => ({}));
    const displayName = (body.displayName || '').trim().slice(0, 30);
    if (!displayName) return jsonResponse({ error: 'Display name is required.' }, 400);

    await env.DB.prepare(`UPDATE sq_family_member SET display_name = ? WHERE family_id = ? AND user_id = ?`)
      .bind(displayName, member.family_id, authUser.id).run();
    return jsonResponse({ success: true, displayName });
  }

  // =========================================================
  // KIDS
  // =========================================================
  if (sqPath === '/kid/list' && method === 'GET') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ kids: [] });
    const { results } = await env.DB.prepare(`SELECT * FROM sq_kid WHERE family_id = ? ORDER BY created_at ASC`).bind(member.family_id).all();
    return jsonResponse({ kids: results || [] });
  }

  if (sqPath === '/kid/create' && method === 'POST') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim();
    if (!name || name.length > 30) return jsonResponse({ error: 'Kid name must be 1–30 characters.' }, 400);
    const avatar = (body.avatar || 'fox').trim().slice(0, 20);
    const color = (body.color || '#f59e0b').trim().slice(0, 20);
    const birthday = body.birthday || null;
    const showNumbers = body.showNumbers === false ? 0 : 1;

    const countRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM sq_kid WHERE family_id = ?`).bind(member.family_id).first();
    if (countRes && countRes.c >= 10) return jsonResponse({ error: 'Maximum 10 kids per family.' }, 400);

    const kidId = newId('kid');
    await env.DB.prepare(`INSERT INTO sq_kid (id, family_id, name, avatar, color, birthday, show_numbers) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(kidId, member.family_id, name, avatar, color, birthday, showNumbers).run();

    const kid = await env.DB.prepare(`SELECT * FROM sq_kid WHERE id = ?`).bind(kidId).first();
    return jsonResponse({ kid });
  }

  if (sqPath === '/kid/update' && method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const access = await assertKidAccess(env, authUser.id, body.kidId);
    if (!access) return jsonResponse({ error: 'Kid not found or access denied.' }, 404);

    const updates = [];
    const values = [];
    if (body.name !== undefined) { updates.push('name = ?'); values.push(String(body.name).trim().slice(0, 30)); }
    if (body.avatar !== undefined) { updates.push('avatar = ?'); values.push(String(body.avatar).slice(0, 20)); }
    if (body.color !== undefined) { updates.push('color = ?'); values.push(String(body.color).slice(0, 20)); }
    if (body.birthday !== undefined) { updates.push('birthday = ?'); values.push(body.birthday || null); }
    if (body.showNumbers !== undefined) { updates.push('show_numbers = ?'); values.push(body.showNumbers ? 1 : 0); }
    if (updates.length === 0) return jsonResponse({ error: 'Nothing to update.' }, 400);

    values.push(body.kidId);
    await env.DB.prepare(`UPDATE sq_kid SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

    const kid = await env.DB.prepare(`SELECT * FROM sq_kid WHERE id = ?`).bind(body.kidId).first();
    return jsonResponse({ kid });
  }

  if (sqPath === '/kid/delete' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const access = await assertKidAccess(env, authUser.id, body.kidId);
    if (!access) return jsonResponse({ error: 'Kid not found or access denied.' }, 404);

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM sq_goal WHERE kid_id = ?`).bind(body.kidId),
      env.DB.prepare(`DELETE FROM sq_star_entry WHERE kid_id = ?`).bind(body.kidId),
      env.DB.prepare(`DELETE FROM sq_kid WHERE id = ?`).bind(body.kidId)
    ]);
    return jsonResponse({ success: true });
  }

  // =========================================================
  // REASON PRESETS — per-family editable list shown in the "Give a Star"
  // picker. Defaults are seeded into real rows the first time a family
  // reads them, so removing a default and removing a custom one are the
  // same delete operation.
  // =========================================================
  if (sqPath === '/reasons' && method === 'GET') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const existing = await env.DB.prepare(`SELECT * FROM sq_reason_preset WHERE family_id = ? ORDER BY created_at ASC`)
      .bind(member.family_id).all();

    if ((existing.results || []).length === 0) {
      await env.DB.batch(
        DEFAULT_REASON_PRESETS.map((r) =>
          env.DB.prepare(`INSERT INTO sq_reason_preset (id, family_id, icon, label) VALUES (?, ?, ?, ?)`)
            .bind(newId('rsn'), member.family_id, r.icon, r.label)
        )
      );
      const seeded = await env.DB.prepare(`SELECT * FROM sq_reason_preset WHERE family_id = ? ORDER BY created_at ASC`)
        .bind(member.family_id).all();
      return jsonResponse({ reasons: seeded.results || [] });
    }

    return jsonResponse({ reasons: existing.results });
  }

  if (sqPath === '/reasons/create' && method === 'POST') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const body = await request.json().catch(() => ({}));
    const label = (body.label || '').trim().slice(0, 40);
    const icon = (body.icon || '⭐').trim().slice(0, 8);
    if (!label) return jsonResponse({ error: 'Label is required.' }, 400);

    const countRes = await env.DB.prepare(`SELECT COUNT(*) as c FROM sq_reason_preset WHERE family_id = ?`).bind(member.family_id).first();
    if (countRes && countRes.c >= 30) return jsonResponse({ error: 'Maximum 30 reasons per family.' }, 400);

    const id = newId('rsn');
    await env.DB.prepare(`INSERT INTO sq_reason_preset (id, family_id, icon, label) VALUES (?, ?, ?, ?)`)
      .bind(id, member.family_id, icon, label).run();

    const reason = await env.DB.prepare(`SELECT * FROM sq_reason_preset WHERE id = ?`).bind(id).first();
    return jsonResponse({ reason });
  }

  if (sqPath === '/reasons/delete' && method === 'POST') {
    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const body = await request.json().catch(() => ({}));
    const preset = await env.DB.prepare(`SELECT * FROM sq_reason_preset WHERE id = ?`).bind(body.reasonId).first();
    if (!preset || preset.family_id !== member.family_id) return jsonResponse({ error: 'Reason not found.' }, 404);

    await env.DB.prepare(`DELETE FROM sq_reason_preset WHERE id = ?`).bind(body.reasonId).run();
    return jsonResponse({ success: true });
  }

  // =========================================================
  // STARS
  // =========================================================
  if (sqPath === '/star/give' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { kidId, stars, reason, reasonIcon, reasonIconPhotoKey, praiseText } = body;
    if (!kidId || typeof stars !== 'number' || stars < 1 || stars > 3) {
      return jsonResponse({ error: 'kidId and stars (1–3) are required.' }, 400);
    }
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Kid not found or access denied.' }, 404);

    const entryId = newId('se');
    const today = new Date().toISOString().slice(0, 10);
    const cleanReason = (reason || 'Great job!').trim().slice(0, 100);
    const cleanIcon = (reasonIcon || 'star').trim().slice(0, 20);
    const cleanPraise = (praiseText || '').trim().slice(0, 200) || null;
    // Only trust a photo key that actually belongs to this family — same
    // "sq/{familyId}/..." check as GET /media, since this value comes
    // straight from the client and is otherwise unvalidated here.
    const cleanIconPhotoKey = (reasonIconPhotoKey && reasonIconPhotoKey.startsWith(`sq/${access.kid.family_id}/`))
      ? reasonIconPhotoKey : null;

    const { results: activeGoals } = await env.DB.prepare(
      `SELECT id, period, target_stars FROM sq_goal WHERE kid_id = ? AND status = 'ACTIVE'`
    ).bind(kidId).all();

    const batchOps = [
      env.DB.prepare(
        `INSERT INTO sq_star_entry (id, kid_id, date, stars, reason, reason_icon, reason_icon_photo_key, praise_text, given_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(entryId, kidId, today, stars, cleanReason, cleanIcon, cleanIconPhotoKey, cleanPraise, authUser.id)
    ];

    // Every active goal (up to one per period) is checked independently —
    // a single star can cross the week goal's finish line without touching
    // the month/year ones, or unlock several at once.
    let goalUnlocked = false;
    const unlockedPeriods = [];
    for (const g of (activeGoals || [])) {
      const currentProgress = (await computeGoalProgress(env, kidId, g.period)) + stars;
      if (currentProgress >= g.target_stars) {
        goalUnlocked = true;
        unlockedPeriods.push(g.period);
        batchOps.push(
          env.DB.prepare(`UPDATE sq_goal SET status = 'UNLOCKED', unlocked_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(g.id)
        );
      }
    }

    await env.DB.batch(batchOps);
    return jsonResponse({ success: true, entryId, goalUnlocked, unlockedPeriods });
  }

  if (sqPath === '/star/undo' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const entry = await env.DB.prepare(`SELECT * FROM sq_star_entry WHERE id = ?`).bind(body.starEntryId).first();
    if (!entry) return jsonResponse({ error: 'Star entry not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, entry.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    await env.DB.prepare(`UPDATE sq_star_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(body.starEntryId).run();
    return jsonResponse({ success: true });
  }

  // Kid Mode's drag-into-the-jar ritual: marks a given star as "collected"
  // so it stops showing in the pending tray. Purely a Kid Mode engagement
  // layer — goal/reward progress already counted this star the moment it
  // was given, so this has no effect on unlocking.
  if (sqPath === '/star/collect' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const entry = await env.DB.prepare(`SELECT * FROM sq_star_entry WHERE id = ?`).bind(body.starEntryId).first();
    if (!entry) return jsonResponse({ error: 'Star entry not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, entry.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);
    if (entry.collected_at) return jsonResponse({ success: true });

    await env.DB.prepare(`UPDATE sq_star_entry SET collected_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(body.starEntryId).run();
    return jsonResponse({ success: true });
  }

  if (sqPath === '/star/history' && method === 'GET') {
    const url = new URL(request.url);
    const kidId = url.searchParams.get('kidId');
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const { results } = await env.DB.prepare(
      `SELECT * FROM sq_star_entry WHERE kid_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`
    ).bind(kidId).all();
    return jsonResponse({ entries: results || [] });
  }

  // =========================================================
  // GOALS
  // =========================================================
  const SQ_GOAL_PERIODS = ['week', 'month', 'year'];

  if (sqPath === '/goal/create' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { kidId, period, targetStars, rewardSecret, rewardSecretEmoji, rewardHint, rewardHintEmoji } = body;
    if (!kidId || !SQ_GOAL_PERIODS.includes(period) || typeof targetStars !== 'number' || targetStars < 1 || targetStars > 1000) {
      return jsonResponse({ error: 'kidId, period (week/month/year), and targetStars (1–1000) are required.' }, 400);
    }
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 404);

    const existingActive = await env.DB.prepare(
      `SELECT id FROM sq_goal WHERE kid_id = ? AND period = ? AND status = 'ACTIVE'`
    ).bind(kidId, period).first();
    if (existingActive) return jsonResponse({ error: `This kid already has an active ${period} goal.` }, 400);

    const goalId = newId('goal');
    await env.DB.prepare(
      `INSERT INTO sq_goal (id, kid_id, period, target_stars, reward_secret, reward_secret_emoji, reward_hint, reward_hint_emoji, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(goalId, kidId, period, targetStars, rewardSecret || null, rewardSecretEmoji || null, rewardHint || null, rewardHintEmoji || null, authUser.id).run();

    const goal = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(goalId).first();
    return jsonResponse({ goal: sanitizeGoal(await withProgress(env, goal)) });
  }

  // Editable only while ACTIVE — once a goal is UNLOCKED the kid has
  // already crossed the target and is about to scratch-reveal, so the
  // target/reward are locked in from that point on.
  if (sqPath === '/goal/update' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const goal = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    if (!goal) return jsonResponse({ error: 'Goal not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, goal.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);
    if (goal.status !== 'ACTIVE') return jsonResponse({ error: 'Only an active goal can be edited.' }, 400);

    const targetStars = typeof body.targetStars === 'number' ? body.targetStars : goal.target_stars;
    if (targetStars < 1 || targetStars > 1000) return jsonResponse({ error: 'targetStars must be between 1 and 1000.' }, 400);
    const rewardSecret = body.rewardSecret !== undefined ? (body.rewardSecret || null) : goal.reward_secret;
    const rewardSecretEmoji = body.rewardSecretEmoji !== undefined ? (body.rewardSecretEmoji || null) : goal.reward_secret_emoji;
    const rewardHint = body.rewardHint !== undefined ? (body.rewardHint || null) : goal.reward_hint;
    const rewardHintEmoji = body.rewardHintEmoji !== undefined ? (body.rewardHintEmoji || null) : goal.reward_hint_emoji;

    await env.DB.prepare(
      `UPDATE sq_goal SET target_stars = ?, reward_secret = ?, reward_secret_emoji = ?, reward_hint = ?, reward_hint_emoji = ? WHERE id = ?`
    ).bind(targetStars, rewardSecret, rewardSecretEmoji, rewardHint, rewardHintEmoji, body.goalId).run();

    const updated = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    return jsonResponse({ goal: sanitizeGoal(await withProgress(env, updated)) });
  }

  if (sqPath === '/goal/active' && method === 'GET') {
    const url = new URL(request.url);
    const kidId = url.searchParams.get('kidId');
    const period = url.searchParams.get('period');
    if (!SQ_GOAL_PERIODS.includes(period)) return jsonResponse({ error: 'period (week/month/year) is required.' }, 400);
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const goal = await env.DB.prepare(
      `SELECT * FROM sq_goal WHERE kid_id = ? AND period = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(kidId, period).first();
    return jsonResponse({ goal: sanitizeGoal(await withProgress(env, goal)) });
  }

  // Bulk fetch of all three period slots at once — what the parent
  // dashboard's Today/Rewards tabs and the kid jar view both render from.
  if (sqPath === '/goal/list' && method === 'GET') {
    const url = new URL(request.url);
    const kidId = url.searchParams.get('kidId');
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const goals = {};
    for (const period of SQ_GOAL_PERIODS) {
      const goal = await env.DB.prepare(
        `SELECT * FROM sq_goal WHERE kid_id = ? AND period = ? ORDER BY created_at DESC LIMIT 1`
      ).bind(kidId, period).first();
      goals[period] = sanitizeGoal(await withProgress(env, goal));
    }
    return jsonResponse({ goals });
  }

  if (sqPath === '/goal/history' && method === 'GET') {
    const url = new URL(request.url);
    const kidId = url.searchParams.get('kidId');
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const { results } = await env.DB.prepare(
      `SELECT * FROM sq_goal WHERE kid_id = ? AND status IN ('REVEALED', 'REDEEMED') ORDER BY created_at DESC`
    ).bind(kidId).all();
    return jsonResponse({ goals: (results || []).map(sanitizeGoal) });
  }

  if (sqPath === '/goal/reveal' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const goal = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    if (!goal) return jsonResponse({ error: 'Goal not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, goal.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);
    if (goal.status !== 'UNLOCKED') return jsonResponse({ error: 'Goal is not unlocked yet.' }, 400);

    await env.DB.prepare(`UPDATE sq_goal SET status = 'REVEALED', revealed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(body.goalId).run();
    const updated = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    return jsonResponse({ goal: sanitizeGoal(updated) });
  }

  if (sqPath === '/goal/redeem' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const goal = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    if (!goal) return jsonResponse({ error: 'Goal not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, goal.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);
    if (goal.status !== 'REVEALED') return jsonResponse({ error: 'Goal must be revealed before it can be redeemed.' }, 400);

    await env.DB.prepare(`UPDATE sq_goal SET status = 'REDEEMED', redeemed_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(body.goalId).run();
    const updated = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(body.goalId).first();
    return jsonResponse({ goal: sanitizeGoal(updated) });
  }

  // =========================================================
  // UPLOADS — R2 optional everywhere. No binding present yet on this
  // account (R2 must be enabled + bucket created manually by the user
  // first); every route below feature-detects env.SQ_MEDIA and degrades
  // gracefully with a 200 rather than an error when it's absent.
  // =========================================================
  if (sqPath === '/upload/status' && method === 'GET') {
    return jsonResponse({ available: !!env.SQ_MEDIA });
  }

  if (sqPath === '/upload/reward-photo' && method === 'POST') {
    if (!env.SQ_MEDIA) return jsonResponse({ uploaded: false, reason: 'storage_unavailable' }, 200);

    const url = new URL(request.url);
    const goalId = url.searchParams.get('goalId');
    const goal = await env.DB.prepare(`SELECT * FROM sq_goal WHERE id = ?`).bind(goalId).first();
    if (!goal) return jsonResponse({ error: 'Goal not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, goal.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const contentType = request.headers.get('content-type') || '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      return jsonResponse({ error: 'Unsupported image type.' }, 400);
    }
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) return jsonResponse({ error: 'Image must be 2MB or smaller.' }, 400);

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `sq/${access.kid.family_id}/${access.kid.id}/goal/${goalId}/reward.${ext}`;
    await env.SQ_MEDIA.put(key, buffer, { httpMetadata: { contentType } });
    await env.DB.prepare(`UPDATE sq_goal SET reward_secret_photo_key = ? WHERE id = ?`).bind(key, goalId).run();

    return jsonResponse({ uploaded: true, key });
  }

  // A kid's own picture from a phone/laptop, as an alternative to the
  // preset animal avatars. Not secret — any family member can view it as
  // soon as it's uploaded, unlike reward photos.
  if (sqPath === '/upload/kid-avatar' && method === 'POST') {
    if (!env.SQ_MEDIA) return jsonResponse({ uploaded: false, reason: 'storage_unavailable' }, 200);

    const url = new URL(request.url);
    const kidId = url.searchParams.get('kidId');
    const access = await assertKidAccess(env, authUser.id, kidId);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const contentType = request.headers.get('content-type') || '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      return jsonResponse({ error: 'Unsupported image type.' }, 400);
    }
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) return jsonResponse({ error: 'Image must be 2MB or smaller.' }, 400);

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `sq/${access.kid.family_id}/${kidId}/avatar.${ext}`;
    await env.SQ_MEDIA.put(key, buffer, { httpMetadata: { contentType } });
    await env.DB.prepare(`UPDATE sq_kid SET avatar_photo_key = ? WHERE id = ?`).bind(key, kidId).run();

    return jsonResponse({ uploaded: true, key });
  }

  // A custom "Give a Star" reason icon, as an alternative to typing/picking
  // an emoji. Scoped to the reason's own family, same as reasons/delete.
  if (sqPath === '/upload/reason-icon' && method === 'POST') {
    if (!env.SQ_MEDIA) return jsonResponse({ uploaded: false, reason: 'storage_unavailable' }, 200);

    const member = await getMyFamilyMembership(env, authUser.id);
    if (!member) return jsonResponse({ error: 'You are not in a family.' }, 404);

    const url = new URL(request.url);
    const reasonId = url.searchParams.get('reasonId');
    const preset = await env.DB.prepare(`SELECT * FROM sq_reason_preset WHERE id = ?`).bind(reasonId).first();
    if (!preset || preset.family_id !== member.family_id) return jsonResponse({ error: 'Reason not found.' }, 404);

    const contentType = request.headers.get('content-type') || '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      return jsonResponse({ error: 'Unsupported image type.' }, 400);
    }
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) return jsonResponse({ error: 'Image must be 2MB or smaller.' }, 400);

    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `sq/${member.family_id}/reason/${reasonId}/icon.${ext}`;
    await env.SQ_MEDIA.put(key, buffer, { httpMetadata: { contentType } });
    await env.DB.prepare(`UPDATE sq_reason_preset SET icon_photo_key = ? WHERE id = ?`).bind(key, reasonId).run();

    return jsonResponse({ uploaded: true, key });
  }

  if (sqPath === '/upload/voice-note' && method === 'POST') {
    if (!env.SQ_MEDIA) return jsonResponse({ uploaded: false, reason: 'storage_unavailable' }, 200);

    const url = new URL(request.url);
    const starEntryId = url.searchParams.get('starEntryId');
    const entry = await env.DB.prepare(`SELECT * FROM sq_star_entry WHERE id = ?`).bind(starEntryId).first();
    if (!entry) return jsonResponse({ error: 'Star entry not found.' }, 404);
    const access = await assertKidAccess(env, authUser.id, entry.kid_id);
    if (!access) return jsonResponse({ error: 'Access denied.' }, 403);

    const contentType = request.headers.get('content-type') || '';
    if (!['audio/webm', 'audio/mp4', 'audio/ogg'].includes(contentType)) {
      return jsonResponse({ error: 'Unsupported audio type.' }, 400);
    }
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 1024 * 1024) return jsonResponse({ error: 'Voice note must be 1MB or smaller.' }, 400);

    const ext = contentType === 'audio/webm' ? 'webm' : contentType === 'audio/mp4' ? 'm4a' : 'ogg';
    const key = `sq/${access.kid.family_id}/${access.kid.id}/voice/${starEntryId}.${ext}`;
    await env.SQ_MEDIA.put(key, buffer, { httpMetadata: { contentType } });
    await env.DB.prepare(`UPDATE sq_star_entry SET praise_voice_key = ? WHERE id = ?`).bind(key, starEntryId).run();

    return jsonResponse({ uploaded: true, key });
  }

  // GET /api/sq/media?key=... — serve an uploaded file. Checks family
  // membership on every key, and additionally requires the goal to be past
  // ACTIVE for reward-photo keys (same rule as sanitizeGoal, enforced here
  // too since a photo URL bypasses the JSON sanitizer entirely).
  if (sqPath === '/media' && method === 'GET') {
    if (!env.SQ_MEDIA) return jsonResponse({ error: 'Storage not available.' }, 503);

    const url = new URL(request.url);
    const key = url.searchParams.get('key') || '';
    if (!key.startsWith('sq/')) return jsonResponse({ error: 'Invalid key.' }, 400);

    const familyId = key.split('/')[1];
    const member = await getFamilyMember(env, authUser.id, familyId);
    if (!member) return jsonResponse({ error: 'Access denied.' }, 403);

    if (key.includes('/goal/')) {
      const goal = await env.DB.prepare(`SELECT status FROM sq_goal WHERE reward_secret_photo_key = ?`).bind(key).first();
      if (goal && goal.status === 'ACTIVE') return jsonResponse({ error: 'Reward not yet unlocked.' }, 403);
    }

    const obj = await env.SQ_MEDIA.get(key);
    if (!obj) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'private, max-age=3600');
    return new Response(obj.body, { headers });
  }

  return jsonResponse({ error: 'Star Quest endpoint not found' }, 404);
}
