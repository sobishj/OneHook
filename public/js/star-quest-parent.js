// Star Quest — Parent-side UI: dashboard, give-star flow, goals/rewards,
// family/invites. Rendered inside #sq-app by star-quest.js once a family
// exists. No dependency on ui.js/game.js — fully isolated from One Hook.

const SQ_AVATARS = ['fox', 'bear', 'rabbit', 'cat', 'dog', 'penguin', 'owl', 'duck', 'koala', 'panda', 'lion', 'frog'];
const SQ_AVATAR_EMOJI = {
  fox: '🦊', bear: '🐻', rabbit: '🐰', cat: '🐱', dog: '🐶',
  penguin: '🐧', owl: '🦉', duck: '🦆', koala: '🐨', panda: '🐼',
  lion: '🦁', frog: '🐸'
};
const SQ_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];
const SQ_REASONS = [
  { icon: '🪥', label: 'Brushed teeth' },
  { icon: '📚', label: 'Read a book' },
  { icon: '🧸', label: 'Tidied toys' },
  { icon: '🤝', label: 'Helped at home' },
  { icon: '💛', label: 'Kind to sibling' },
  { icon: '🥦', label: 'Ate veggies' },
  { icon: '😴', label: 'Bedtime on time' },
  { icon: '✏️', label: 'Homework' }
];
// Curated picker offered when adding a custom "Give a Star" reason, so a
// parent isn't stuck typing a raw emoji character into a text box.
const SQ_ICON_CHOICES = [
  '⭐', '🌟', '🏆', '🎯', '🎨', '🎵', '🎮', '⚽', '🚴', '🏊', '📖', '✏️',
  '🧹', '🧺', '🍎', '🥕', '🦷', '🛏️', '🚿', '🧴', '🐾', '💪', '🤗', '💯'
];
// A kid can run up to three goals at once, one per period — each tracked,
// unlocked, and redeemed independently (see /goal/* routes).
const SQ_GOAL_PERIODS = ['week', 'month', 'year'];
const SQ_GOAL_PERIOD_LABELS = { week: 'Weekly', month: 'Monthly', year: 'Yearly' };
const SQ_GOAL_PERIOD_DEFAULT_TARGET = { week: 7, month: 30, year: 365 };

class StarQuestParent {
  constructor(mountEl) {
    this.mountEl = mountEl;
    this.family = null;
    this.myRole = null;
    this.members = [];
    this.kids = [];
    this.selectedKidId = null;
    this.currentTab = 'today';
    this.pendingStars = 2;
    this.pendingReason = SQ_REASONS[0];
    this.pendingInvites = [];
  }

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  kidAvatarHtml(kid, cssClass) {
    // /api/sq/media requires a Bearer auth header, which a plain <img src>
    // can't send — render a placeholder here and fill in the real image
    // (as a blob: URL) in hydrateAvatarPhotos() after the DOM exists.
    if (kid.avatar_photo_key) {
      return `<img class="${cssClass} sq-kid-avatar-photo" data-avatar-key="${this.esc(kid.avatar_photo_key)}" alt="${this.esc(kid.name)}">`;
    }
    return `<span class="${cssClass}">${SQ_AVATAR_EMOJI[kid.avatar] || '⭐'}</span>`;
  }

  async hydrateAvatarPhotos() {
    this.avatarBlobCache = this.avatarBlobCache || {};
    const imgs = this.mountEl.querySelectorAll('img[data-avatar-key]');
    for (const img of imgs) {
      const key = img.dataset.avatarKey;
      if (this.avatarBlobCache[key]) { img.src = this.avatarBlobCache[key]; continue; }
      try {
        const res = await fetch(window.sqApi.mediaUrl(key), { headers: { Authorization: `Bearer ${window.apiClient.token}` } });
        if (!res.ok) continue;
        const blobUrl = URL.createObjectURL(await res.blob());
        this.avatarBlobCache[key] = blobUrl;
        img.src = blobUrl;
      } catch (err) { /* falls back to broken-image icon; non-fatal */ }
    }
  }

  async load(familyData) {
    this.family = familyData.family;
    this.myRole = familyData.myRole;
    this.members = familyData.members || [];
    this.kids = familyData.kids || [];
    if (!this.selectedKidId && this.kids.length > 0) this.selectedKidId = this.kids[0].id;
    // Invites addressed to my email stay visible here even once I'm already
    // in a family — e.g. a second invite from another household — not just
    // during onboarding, which only runs before a family exists at all.
    this.pendingInvites = await window.sqApi.pendingInvites().then((r) => r.invites || []).catch(() => []);
    await this.render();
  }

  async render() {
    const kid = this.kids.find((k) => k.id === this.selectedKidId) || null;
    let goals = { week: null, month: null, year: null };
    let history = [];
    if (kid) {
      const [goalsRes, historyRes] = await Promise.all([
        window.sqApi.listGoals(kid.id).catch(() => ({ goals: { week: null, month: null, year: null } })),
        window.sqApi.starHistory(kid.id).catch(() => ({ entries: [] })),
        this.reasons ? Promise.resolve() : window.sqApi.listReasons().then((r) => { this.reasons = r.reasons; }).catch(() => {})
      ]);
      goals = goalsRes.goals || goals;
      // A REDEEMED goal is fully closed out (it lives on in the memory
      // wall); treat it the same as "no goal" for that period so the
      // parent can set the next one. goal/list returns the most recent
      // goal per period regardless of status, so this normalization has
      // to happen client-side.
      SQ_GOAL_PERIODS.forEach((p) => { if (goals[p] && goals[p].status === 'REDEEMED') goals[p] = null; });
      history = historyRes.entries || [];
    }

    this.mountEl.innerHTML = `
      <div class="sq-shell">
        <header class="sq-header">
          <h1 class="sq-header-title">⭐ ${this.esc(this.family.name || 'Star Quest')}</h1>
          <div class="sq-header-actions">
            ${this.kids.length > 0 ? '<button class="btn btn-yellow-play btn-sm" id="sq-kid-view-btn">🌟 Kid View</button>' : ''}
            <a href="/" class="sq-back-link-inline" title="Back to SprintGames home">🏠 Home</a>
          </div>
        </header>

        <nav class="sq-tabs">
          <button class="sq-tab ${this.currentTab === 'today' ? 'active' : ''}" data-tab="today">Today</button>
          <button class="sq-tab ${this.currentTab === 'family' ? 'active' : ''}" data-tab="family">Family</button>
          <button class="sq-tab ${this.currentTab === 'rewards' ? 'active' : ''}" data-tab="rewards">Rewards</button>
          <button class="sq-tab ${this.currentTab === 'requests' ? 'active' : ''}" data-tab="requests">📬 Requests${this.pendingInvites.length > 0 ? `<span class="sq-tab-badge">${this.pendingInvites.length}</span>` : ''}</button>
        </nav>

        ${this.kids.length > 0 ? `
          <div class="sq-kid-chips">
            ${this.kids.map((k) => `
              <button class="sq-kid-chip ${k.id === this.selectedKidId ? 'active' : ''}" data-kid-id="${k.id}" style="--kid-color:${this.esc(k.color)}">
                ${this.kidAvatarHtml(k, 'sq-kid-chip-avatar')}
                <span>${this.esc(k.name)}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div id="sq-tab-content" class="sq-tab-content">
          ${this.currentTab === 'requests' ? this.renderRequestsTab() :
            this.kids.length === 0 ? this.renderNoKidsState() :
            this.currentTab === 'today' ? this.renderTodayTab(kid, goals, history) :
            this.currentTab === 'family' ? this.renderFamilyTab() :
            this.renderRewardsTab(kid, goals)}
        </div>
      </div>
    `;

    this.bindEvents();
    this.hydrateAvatarPhotos();
  }

  renderNoKidsState() {
    return `
      <div class="sq-empty-state">
        <div class="sq-empty-icon">👶</div>
        <h2>Add your first kid</h2>
        <p>Create a profile for your child to start giving stars.</p>
        <button class="btn btn-primary" id="sq-add-kid-empty-btn">+ Add a Kid</button>
      </div>
      ${this.renderAddKidModal()}
    `;
  }

  // Invites addressed to my account's email, still open — lets an already
  // set-up parent (owner or partner of some family) accept or decline a
  // join request without needing to leave the app first. Accepting one
  // switches me into that family (see /family/invite/accept).
  renderRequestsTab() {
    if (this.pendingInvites.length === 0) {
      return `
        <div class="sq-empty-state">
          <div class="sq-empty-icon">📬</div>
          <h2>No requests</h2>
          <p>Invitations sent to your account's email will show up here.</p>
        </div>
      `;
    }
    return `
      <div class="sq-invite-requests">
        ${this.pendingInvites.map((inv) => `
          <div class="sq-invite-request-card" data-invite-code="${this.esc(inv.code)}">
            <p class="sq-invite-request-text">
              <strong>${this.esc(inv.inviter_display_name || inv.inviter_username || 'A family member')}</strong>
              invited you to join <strong>${this.esc(inv.family_name || 'their family')}</strong>.
            </p>
            <div class="sq-invite-request-form">
              <input type="text" class="sq-invite-request-name" placeholder="Your name (e.g. Mummy, Papa)" maxlength="30">
              <p class="sq-invite-request-error hidden"></p>
              <div class="sq-invite-request-actions">
                <button type="button" class="btn btn-secondary btn-sm sq-req-decline-btn" data-code="${this.esc(inv.code)}">Decline</button>
                <button type="button" class="btn btn-primary btn-sm sq-req-accept-btn" data-code="${this.esc(inv.code)}">Accept</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  filterHistoryByPeriod(history, period) {
    if (period === 'all') return history;
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    return history.filter((h) => new Date(h.created_at).getTime() >= cutoff.getTime());
  }

  renderTodayTab(kid, goals, history) {
    if (!kid) return this.renderNoKidsState();
    const today = new Date().toISOString().slice(0, 10);
    const todayStars = history.filter((h) => h.date === today).reduce((sum, h) => sum + h.stars, 0);

    const period = this.historyPeriod || 'week';
    const periodHistory = this.filterHistoryByPeriod(history, period);
    const periodTotal = periodHistory.reduce((sum, h) => sum + h.stars, 0);
    const periodLabels = { week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time' };

    return `
      <div class="sq-kid-dashboard">
        <div class="sq-today-summary">
          <div class="sq-today-stat">
            <span class="sq-today-stat-val">⭐ ${todayStars}</span>
            <span class="sq-today-stat-label">Stars today</span>
          </div>
        </div>

        <div class="sq-goals-row">
          ${SQ_GOAL_PERIODS.map((p) => this.renderGoalMiniCard(p, goals[p])).join('')}
        </div>

        <button class="btn btn-primary btn-full sq-give-star-btn" id="sq-give-star-btn">🌟 Give a Star</button>

        <div class="sq-history-header">
          <h3 class="sq-section-title" style="margin:0">${periodLabels[period]} <small class="sq-hint-inline">(⭐ ${periodTotal})</small></h3>
          <div class="sq-period-tabs">
            ${Object.keys(periodLabels).map((p) => `<button class="sq-period-btn ${p === period ? 'active' : ''}" data-period="${p}">${p === 'all' ? 'All' : p[0].toUpperCase() + p.slice(1, 2)}</button>`).join('')}
          </div>
        </div>
        <div class="sq-history-list">
          ${periodHistory.length === 0 ? '<p class="sq-empty-hint">No stars given in this period.</p>' : periodHistory.slice(0, 50).map((h) => `
            <div class="sq-history-item">
              <span class="sq-history-icon">⭐×${h.stars}</span>
              <span class="sq-history-reason">${this.esc(h.reason)}</span>
              <span class="sq-history-date">${this.esc(h.date)}</span>
              <button class="sq-history-undo" data-undo-id="${h.id}" title="Undo">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
      ${this.renderGiveStarModal(kid)}
    `;
  }

  renderGoalMiniCard(period, goal) {
    const label = SQ_GOAL_PERIOD_LABELS[period];
    if (!goal) {
      return `
        <div class="sq-goal-mini-card sq-goal-mini-empty">
          <span class="sq-goal-mini-label">${label}</span>
          <button class="btn btn-secondary btn-sm" data-goto-tab="rewards">Set Goal</button>
        </div>
      `;
    }
    const pct = Math.min(100, Math.round((goal.progress / goal.target_stars) * 100));
    return `
      <div class="sq-goal-mini-card">
        <div class="sq-goal-mini-header">
          <span class="sq-goal-mini-label">${label}${goal.status === 'UNLOCKED' ? ' 🎉' : ''}</span>
          <span class="sq-goal-mini-count">${goal.progress}/${goal.target_stars} ⭐</span>
        </div>
        <div class="sq-progress-bar sq-progress-bar-sm"><div class="sq-progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  renderGiveStarModal(kid) {
    const reasons = this.reasons || SQ_REASONS.map((r, i) => ({ id: `fallback-${i}`, ...r }));
    return `
      <div id="sq-give-star-modal" class="sq-modal-backdrop hidden">
        <div class="sq-modal">
          <h2>Give ${this.esc(kid.name)} a star</h2>
          <div class="sq-modal-body">
            <div class="sq-star-picker">
              ${[1, 2, 3].map((n) => `<button class="sq-star-btn" data-stars="${n}">${'⭐'.repeat(n)}</button>`).join('')}
            </div>
            <h3 class="sq-section-title">Why? <small class="sq-hint-inline">(hold a reason to remove it)</small></h3>
            <div class="sq-reason-grid" id="sq-reason-grid">
              ${reasons.map((r) => `
                <div class="sq-reason-tile" data-reason-id="${r.id}">
                  <button class="sq-reason-btn" data-icon="${r.icon}" data-label="${this.esc(r.label)}" data-icon-photo-key="${r.icon_photo_key || ''}">
                    ${r.icon_photo_key ? `<img class="sq-reason-icon-img" data-avatar-key="${this.esc(r.icon_photo_key)}" alt="">` : `<span>${r.icon}</span>`}
                    <small>${this.esc(r.label)}</small>
                  </button>
                  <button class="sq-reason-delete" data-delete-reason="${r.id}" title="Remove">✕</button>
                </div>
              `).join('')}
              <button class="sq-reason-add-btn" id="sq-reason-add-btn">
                <span>➕</span><small>Custom</small>
              </button>
            </div>
            ${this.renderAddReasonForm()}
            <textarea id="sq-praise-text" class="sq-praise-input" placeholder="Optional: a little note of praise..." maxlength="200"></textarea>
          </div>
          <div class="sq-modal-actions">
            <button class="btn btn-secondary" id="sq-give-star-cancel">Cancel</button>
            <button class="btn btn-primary" id="sq-give-star-submit">Give Star</button>
          </div>
        </div>
      </div>
    `;
  }

  // The "Custom" reason form: an emoji grid (default), or a photo picked
  // from the device, as the reason's icon — plus the label text field.
  renderAddReasonForm() {
    return `
      <div id="sq-add-reason-form" class="sq-add-reason-form hidden">
        <div class="sq-reason-icon-row">
          <button type="button" class="sq-reason-icon-preview" id="sq-reason-icon-preview" title="Tap to pick an icon">⭐</button>
          <button type="button" class="btn btn-secondary btn-sm sq-photo-choose-btn" id="sq-reason-photo-btn">📷 Use a photo</button>
          <input type="file" id="sq-reason-icon-file" accept="image/png,image/jpeg,image/webp" class="hidden">
        </div>
        <div id="sq-reason-emoji-grid" class="sq-emoji-grid hidden">
          ${SQ_ICON_CHOICES.map((e) => `<button type="button" class="sq-emoji-opt" data-emoji="${e}">${e}</button>`).join('')}
        </div>
        <p id="sq-reason-icon-status" class="sq-empty-hint hidden"></p>
        <input type="text" id="sq-new-reason-label" placeholder="Custom task..." maxlength="40">
        <button type="button" class="btn btn-secondary btn-sm" id="sq-new-reason-save">Add</button>
      </div>
    `;
  }

  renderFamilyTab() {
    return `
      <div class="sq-family-tab">
        <h3 class="sq-section-title">Kids</h3>
        <div class="sq-kid-manage-list">
          ${this.kids.map((k) => `
            <div class="sq-kid-manage-item">
              ${this.kidAvatarHtml(k, 'sq-kid-chip-avatar')}
              <span>${this.esc(k.name)}</span>
              <button class="sq-icon-btn" data-edit-kid="${k.id}" title="Edit">✏️</button>
              <button class="sq-icon-btn" data-delete-kid="${k.id}" title="Remove">🗑️</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" id="sq-add-kid-btn">+ Add a Kid</button>

        <h3 class="sq-section-title">Members</h3>
        <div class="sq-member-list">
          ${this.members.map((m) => {
            const isMe = window.apiClient.user && m.user_id === window.apiClient.user.id;
            return `
            <div class="sq-member-item" data-member-user-id="${m.user_id}">
              <span class="sq-member-name-view">${this.esc(m.display_name || m.username)} — ${m.role}${isMe ? ' (you)' : ''}</span>
              <input type="text" class="sq-member-name-edit hidden" maxlength="30" value="${this.esc(m.display_name || '')}">
              ${isMe ? `
                <button class="sq-icon-btn" data-edit-member="${m.user_id}" title="Edit your name">✏️</button>
                <button class="sq-icon-btn sq-member-save-btn hidden" data-save-member="${m.user_id}">Save</button>
              ` : ''}
              ${this.myRole === 'OWNER' && m.role === 'PARTNER' ? `<button class="sq-icon-btn" data-remove-partner="${m.user_id}">Remove</button>` : ''}
            </div>
          `;
          }).join('')}
        </div>
        <form id="sq-invite-form" class="sq-form sq-inline-form">
          <input type="email" id="sq-invite-email" placeholder="Partner's email (optional)" maxlength="100">
          <button type="submit" class="btn btn-secondary btn-sm">📤 Invite Partner</button>
        </form>
        <div id="sq-invite-result" class="sq-invite-result hidden"></div>
      </div>
      ${this.renderAddKidModal()}
    `;
  }

  renderRewardsTab(kid, goals) {
    if (!kid) return this.renderNoKidsState();
    return `
      <div class="sq-rewards-tab">
        ${SQ_GOAL_PERIODS.map((p) => this.renderGoalSection(kid, p, goals[p])).join('')}

        <h3 class="sq-section-title">Memory Wall</h3>
        <div id="sq-memory-wall" class="sq-memory-wall"><p class="sq-empty-hint">Loading...</p></div>
      </div>
    `;
  }

  // One goal slot (week/month/year): a create form when the kid has no
  // goal for that period, otherwise a progress card with an Edit toggle
  // (while ACTIVE) or a redeem button (once REVEALED).
  renderGoalSection(kid, period, goal) {
    const label = SQ_GOAL_PERIOD_LABELS[period];
    if (!goal) {
      return `
        <div class="sq-goal-section">
          <h3 class="sq-section-title">${label} Goal for ${this.esc(kid.name)}</h3>
          <form class="sq-form sq-goal-form" data-goal-period="${period}">
            <label>Target stars</label>
            <input type="number" class="sq-goal-target" min="1" max="1000" value="${SQ_GOAL_PERIOD_DEFAULT_TARGET[period]}" required>
            <label>Secret reward (kept hidden until unlocked)</label>
            <input type="text" class="sq-goal-secret" placeholder="e.g. Trip to the zoo!" maxlength="200" required>
            <input type="text" class="sq-goal-secret-emoji" placeholder="Emoji (optional, e.g. 🦁)" maxlength="8">
            <label>Hint shown to your kid now</label>
            <input type="text" class="sq-goal-hint" placeholder="e.g. Something fun outdoors" maxlength="200">
            <input type="text" class="sq-goal-hint-emoji" placeholder="Hint emoji (optional, e.g. 🌳)" maxlength="8">
            <button type="submit" class="btn btn-primary btn-full">Create ${label} Goal</button>
          </form>
        </div>
      `;
    }
    return `
      <div class="sq-goal-section">
        <h3 class="sq-section-title">${label} Goal</h3>
        <div class="sq-goal-progress-card">
          <div class="sq-goal-progress-header">
            <span>${goal.status === 'ACTIVE' ? 'Active' : goal.status === 'UNLOCKED' ? '🎉 Unlocked — waiting for the scratch card!' : '🎁 Revealed'}</span>
            <span>${goal.target_stars} ⭐ target</span>
          </div>
          ${goal.reward_hint && goal.status !== 'REVEALED' ? `<p class="sq-goal-hint">${goal.reward_hint_emoji || '🎁'} ${this.esc(goal.reward_hint)}</p>` : ''}
          ${goal.status === 'REVEALED' ? `
            <p class="sq-goal-hint">${goal.reward_secret_emoji || '🎁'} ${this.esc(goal.reward_secret)}</p>
            <button class="btn btn-primary btn-sm sq-redeem-goal-btn" data-goal-id="${goal.id}">Mark Redeemed</button>
          ` : ''}
          ${goal.status === 'ACTIVE' ? `<button type="button" class="btn btn-secondary btn-sm sq-edit-goal-toggle-btn" data-goal-id="${goal.id}">✏️ Edit</button>` : ''}
        </div>
        ${goal.status === 'ACTIVE' ? `
          <form class="sq-form sq-edit-goal-form hidden" id="sq-edit-goal-form-${goal.id}" data-goal-id="${goal.id}">
            <label>Target stars</label>
            <input type="number" class="sq-edit-goal-target" min="1" max="1000" value="${goal.target_stars}" required>
            <label>Secret reward <small class="sq-hint-inline">(kept hidden — leave blank to keep the current one)</small></label>
            <input type="text" class="sq-edit-goal-secret" placeholder="Leave blank to keep unchanged" maxlength="200">
            <input type="text" class="sq-edit-goal-secret-emoji" placeholder="Emoji (optional)" maxlength="8">
            <label>Hint shown to your kid now</label>
            <input type="text" class="sq-edit-goal-hint" placeholder="e.g. Something fun outdoors" maxlength="200" value="${this.esc(goal.reward_hint || '')}">
            <input type="text" class="sq-edit-goal-hint-emoji" placeholder="Hint emoji (optional)" maxlength="8" value="${this.esc(goal.reward_hint_emoji || '')}">
            <button type="submit" class="btn btn-primary btn-full">Save Changes</button>
          </form>
        ` : ''}
      </div>
    `;
  }

  renderAddKidModal() {
    return `
      <div id="sq-add-kid-modal" class="sq-modal-backdrop hidden">
        <div class="sq-modal">
          <h2 id="sq-add-kid-title">Add a Kid</h2>
          <form id="sq-add-kid-form" class="sq-form sq-modal-form">
            <div class="sq-modal-body">
              <input type="text" id="sq-kid-name" placeholder="Name" maxlength="30" required>
              <label>Photo (optional — or pick an icon below)</label>
              <div class="sq-kid-photo-row">
                <div class="sq-kid-photo-preview" id="sq-kid-photo-preview"></div>
                <button type="button" class="btn btn-secondary btn-sm sq-photo-choose-btn" id="sq-kid-photo-btn">📷 Choose Photo</button>
                <input type="file" id="sq-kid-photo-input" accept="image/png,image/jpeg,image/webp" class="hidden">
              </div>
              <p id="sq-kid-photo-status" class="sq-empty-hint hidden"></p>
              <label>Avatar</label>
              <div class="sq-avatar-picker">
                ${SQ_AVATARS.map((a, i) => `<button type="button" class="sq-avatar-opt ${i === 0 ? 'selected' : ''}" data-avatar="${a}">${SQ_AVATAR_EMOJI[a]}</button>`).join('')}
              </div>
              <label>Color</label>
              <div class="sq-color-picker">
                ${SQ_COLORS.map((c, i) => `<button type="button" class="sq-color-opt ${i === 0 ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
              </div>
              <input type="hidden" id="sq-kid-avatar" value="${SQ_AVATARS[0]}">
              <input type="hidden" id="sq-kid-color" value="${SQ_COLORS[0]}">
            </div>
            <div class="sq-modal-actions">
              <button type="button" class="btn btn-secondary" id="sq-add-kid-cancel">Cancel</button>
              <button type="submit" class="btn btn-primary" id="sq-add-kid-submit">Add Kid</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  async loadMemoryWall() {
    const kid = this.kids.find((k) => k.id === this.selectedKidId);
    const wallEl = document.getElementById('sq-memory-wall');
    if (!kid || !wallEl) return;
    try {
      const { goals } = await window.sqApi.goalHistory(kid.id);
      wallEl.innerHTML = goals.length === 0
        ? '<p class="sq-empty-hint">No rewards redeemed yet.</p>'
        : goals.map((g) => `
          <div class="sq-memory-card">
            <span class="sq-memory-emoji">${g.reward_secret_emoji || '🎁'}</span>
            <span>${this.esc(g.reward_secret)}</span>
          </div>
        `).join('');
    } catch (err) {
      wallEl.innerHTML = '<p class="sq-empty-hint">Could not load.</p>';
    }
  }

  bindEvents() {
    this.mountEl.querySelectorAll('.sq-tab').forEach((btn) => {
      btn.addEventListener('click', () => { this.currentTab = btn.dataset.tab; this.render(); });
    });
    this.mountEl.querySelectorAll('[data-goto-tab]').forEach((btn) => {
      btn.addEventListener('click', () => { this.currentTab = btn.dataset.gotoTab; this.render(); });
    });
    this.mountEl.querySelectorAll('.sq-kid-chip').forEach((btn) => {
      btn.addEventListener('click', () => { this.selectedKidId = btn.dataset.kidId; this.render(); });
    });
    this.mountEl.querySelectorAll('.sq-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => { this.historyPeriod = btn.dataset.period; this.render(); });
    });

    const giveBtn = document.getElementById('sq-give-star-btn');
    if (giveBtn) giveBtn.addEventListener('click', () => this.openGiveStarModal());

    const kidViewBtn = document.getElementById('sq-kid-view-btn');
    if (kidViewBtn) kidViewBtn.addEventListener('click', () => {
      if (window.onEnterKidView) window.onEnterKidView(this.kids);
    });

    this.mountEl.querySelectorAll('[data-undo-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.sqApi.undoStar(btn.dataset.undoId).catch(() => {});
        this.render();
      });
    });

    this.mountEl.querySelectorAll('.sq-req-decline-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await window.sqApi.declineInvite(btn.dataset.code);
          this.pendingInvites = this.pendingInvites.filter((i) => i.code !== btn.dataset.code);
          this.render();
        } catch (err) {
          btn.disabled = false;
        }
      });
    });

    this.mountEl.querySelectorAll('.sq-req-accept-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.sq-invite-request-card');
        const nameInput = card.querySelector('.sq-invite-request-name');
        const errorEl = card.querySelector('.sq-invite-request-error');
        const displayName = nameInput.value.trim();
        errorEl.classList.add('hidden');
        if (!displayName) {
          nameInput.focus();
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Joining…';
        try {
          await window.sqApi.acceptInvite(btn.dataset.code, displayName);
          // Membership (and possibly which family I'm in) just changed —
          // a full reboot re-fetches everything rather than trying to
          // patch this.family/this.kids/etc. in place.
          if (window.boot) await window.boot();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Accept';
          errorEl.textContent = err.message || 'Could not join this family.';
          errorEl.classList.remove('hidden');
        }
      });
    });

    const addKidEmptyBtn = document.getElementById('sq-add-kid-empty-btn');
    const addKidBtn = document.getElementById('sq-add-kid-btn');
    [addKidEmptyBtn, addKidBtn].filter(Boolean).forEach((btn) => btn.addEventListener('click', () => this.openAddKidModal()));

    this.mountEl.querySelectorAll('[data-edit-kid]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kid = this.kids.find((k) => k.id === btn.dataset.editKid);
        if (kid) this.openEditKidModal(kid);
      });
    });

    this.mountEl.querySelectorAll('[data-delete-kid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this kid? This deletes their star history too.')) return;
        await window.sqApi.deleteKid(btn.dataset.deleteKid).catch(() => {});
        this.selectedKidId = null;
        await this.refresh();
      });
    });

    this.mountEl.querySelectorAll('[data-remove-partner]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.sqApi.removePartner(btn.dataset.removePartner).catch(() => {});
        await this.refresh();
      });
    });

    this.mountEl.querySelectorAll('[data-edit-member]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.sq-member-item');
        row.querySelector('.sq-member-name-view').classList.add('hidden');
        row.querySelector('.sq-member-name-edit').classList.remove('hidden');
        row.querySelector('.sq-member-save-btn').classList.remove('hidden');
        btn.classList.add('hidden');
        row.querySelector('.sq-member-name-edit').focus();
      });
    });

    this.mountEl.querySelectorAll('[data-save-member]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.sq-member-item');
        const newName = row.querySelector('.sq-member-name-edit').value.trim();
        if (!newName) return;
        try {
          await window.sqApi.updateMyDisplayName(newName);
          await this.refresh();
        } catch (err) {
          alert(err.message || 'Could not update your name.');
        }
      });
    });

    const inviteForm = document.getElementById('sq-invite-form');
    if (inviteForm) inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const resultEl = document.getElementById('sq-invite-result');
      const email = document.getElementById('sq-invite-email').value.trim();
      try {
        const { url, email: sentTo, emailResult } = await window.sqApi.createInvite(email);
        if (sentTo && emailResult === 'sent') {
          resultEl.textContent = `✅ Invite sent to ${sentTo}! You can also share this link directly: ${url}`;
        } else if (sentTo && emailResult === 'failed') {
          resultEl.textContent = `Couldn't email ${sentTo} — share this link with them instead: ${url}`;
        } else {
          resultEl.textContent = url;
        }
        resultEl.classList.remove('hidden');
      } catch (err) {
        resultEl.textContent = err.message || 'Could not create invite.';
        resultEl.classList.remove('hidden');
      }
    });

    this.mountEl.querySelectorAll('.sq-goal-form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kid = this.kids.find((k) => k.id === this.selectedKidId);
        try {
          await window.sqApi.createGoal({
            kidId: kid.id,
            period: form.dataset.goalPeriod,
            targetStars: parseInt(form.querySelector('.sq-goal-target').value, 10),
            rewardSecret: form.querySelector('.sq-goal-secret').value.trim(),
            rewardSecretEmoji: form.querySelector('.sq-goal-secret-emoji').value.trim() || null,
            rewardHint: form.querySelector('.sq-goal-hint').value.trim() || null,
            rewardHintEmoji: form.querySelector('.sq-goal-hint-emoji').value.trim() || null
          });
          await this.render();
        } catch (err) {
          alert(err.message || 'Could not create goal.');
        }
      });
    });

    this.mountEl.querySelectorAll('.sq-edit-goal-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const form = document.getElementById(`sq-edit-goal-form-${btn.dataset.goalId}`);
        if (form) form.classList.toggle('hidden');
      });
    });

    this.mountEl.querySelectorAll('.sq-edit-goal-form').forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
          targetStars: parseInt(form.querySelector('.sq-edit-goal-target').value, 10),
          rewardHint: form.querySelector('.sq-edit-goal-hint').value.trim() || null,
          rewardHintEmoji: form.querySelector('.sq-edit-goal-hint-emoji').value.trim() || null
        };
        // Secret fields are never sent back down while a goal is ACTIVE
        // (see sanitizeGoal), so there's nothing to prefill — only
        // overwrite the stored secret if the parent actually typed a new
        // one here.
        const secret = form.querySelector('.sq-edit-goal-secret').value.trim();
        const secretEmoji = form.querySelector('.sq-edit-goal-secret-emoji').value.trim();
        if (secret) updates.rewardSecret = secret;
        if (secretEmoji) updates.rewardSecretEmoji = secretEmoji;
        try {
          await window.sqApi.updateGoal(form.dataset.goalId, updates);
          await this.render();
        } catch (err) {
          alert(err.message || 'Could not update goal.');
        }
      });
    });

    this.mountEl.querySelectorAll('.sq-redeem-goal-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await window.sqApi.redeemGoal(btn.dataset.goalId);
          await this.render();
        } catch (err) {
          alert(err.message || 'Could not mark as redeemed.');
        }
      });
    });

    if (this.currentTab === 'rewards' && this.kids.length > 0) this.loadMemoryWall();

    this.bindAddKidModal();
  }

  openGiveStarModal() {
    const modal = document.getElementById('sq-give-star-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.pendingStars = 2;
    const firstReason = (this.reasons && this.reasons[0]) || SQ_REASONS[0];
    this.pendingReason = { icon: firstReason.icon, label: firstReason.label, iconPhotoKey: firstReason.icon_photo_key || null };
    this.hydrateAvatarPhotos();
    modal.querySelectorAll('.sq-star-btn').forEach((b) => b.classList.toggle('selected', Number(b.dataset.stars) === 2));
    modal.querySelectorAll('.sq-reason-btn').forEach((b, i) => b.classList.toggle('selected', i === 0));

    // This modal's DOM persists across open/close (only Cancel toggles the
    // hidden class — it isn't re-rendered until a star is actually given),
    // so without this guard every reopen would pile on a fresh set of
    // listeners and things like "Give Star" would fire once per past open.
    // Only the state-reset above needs to rerun each time; the bindings
    // below are attached once per DOM instance.
    if (modal.dataset.sqBound === '1') return;
    modal.dataset.sqBound = '1';

    modal.querySelectorAll('.sq-star-btn').forEach((b) => b.addEventListener('click', () => {
      this.pendingStars = Number(b.dataset.stars);
      modal.querySelectorAll('.sq-star-btn').forEach((x) => x.classList.toggle('selected', x === b));
    }));

    // Tap a reason to select it; hold ~500ms to reveal a small remove
    // button on that tile instead (so an accidental tap never deletes).
    modal.querySelectorAll('.sq-reason-tile').forEach((tile) => {
      const btn = tile.querySelector('.sq-reason-btn');
      let holdTimer = null;
      const startHold = () => { holdTimer = setTimeout(() => tile.classList.add('show-delete'), 500); };
      const cancelHold = () => clearTimeout(holdTimer);
      // pointerleave intentionally not used to cancel — same reasoning as
      // the Kid Mode gate hold: a finger/cursor wobbling slightly during a
      // real hold shouldn't reset it. pointerup/pointercancel are the only
      // real "let go" signals.
      btn.addEventListener('pointerdown', startHold);
      btn.addEventListener('pointerup', cancelHold);
      btn.addEventListener('pointercancel', cancelHold);
      btn.addEventListener('click', () => {
        if (tile.classList.contains('show-delete')) { tile.classList.remove('show-delete'); return; }
        this.pendingReason = { icon: btn.dataset.icon, label: btn.dataset.label, iconPhotoKey: btn.dataset.iconPhotoKey || null };
        modal.querySelectorAll('.sq-reason-btn').forEach((x) => x.classList.toggle('selected', x === btn));
      });
    });

    modal.querySelectorAll('[data-delete-reason]').forEach((delBtn) => {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await window.sqApi.deleteReason(delBtn.dataset.deleteReason);
          this.reasons = this.reasons.filter((r) => r.id !== delBtn.dataset.deleteReason);
          await this.render();
          this.openGiveStarModal();
        } catch (err) {
          alert(err.message || 'Could not remove this reason.');
        }
      });
    });

    const addBtn = document.getElementById('sq-reason-add-btn');
    const addForm = document.getElementById('sq-add-reason-form');
    const resetNewReasonPicker = () => {
      this.pendingNewReasonIcon = '⭐';
      this.pendingNewReasonFile = null;
      const preview = document.getElementById('sq-reason-icon-preview');
      if (preview) preview.textContent = '⭐';
      const grid = document.getElementById('sq-reason-emoji-grid');
      if (grid) grid.classList.add('hidden');
      const fileInput = document.getElementById('sq-reason-icon-file');
      if (fileInput) fileInput.value = '';
      const status = document.getElementById('sq-reason-icon-status');
      if (status) status.classList.add('hidden');
      const labelInput = document.getElementById('sq-new-reason-label');
      if (labelInput) labelInput.value = '';
    };
    if (addBtn) addBtn.addEventListener('click', () => {
      const wasHidden = addForm.classList.contains('hidden');
      addForm.classList.toggle('hidden');
      if (wasHidden) resetNewReasonPicker();
    });

    // The icon preview itself is the trigger — tapping it is how you pick
    // an icon, rather than a separate "choose emoji" button next to it.
    const emojiToggle = document.getElementById('sq-reason-icon-preview');
    const emojiGrid = document.getElementById('sq-reason-emoji-grid');
    if (emojiToggle) emojiToggle.addEventListener('click', () => emojiGrid.classList.toggle('hidden'));
    if (emojiGrid) emojiGrid.querySelectorAll('.sq-emoji-opt').forEach((b) => b.addEventListener('click', () => {
      this.pendingNewReasonIcon = b.dataset.emoji;
      this.pendingNewReasonFile = null;
      document.getElementById('sq-reason-icon-preview').textContent = b.dataset.emoji;
      document.getElementById('sq-reason-icon-file').value = '';
      emojiGrid.classList.add('hidden');
    }));

    const reasonFileInput = document.getElementById('sq-reason-icon-file');
    const reasonPhotoBtn = document.getElementById('sq-reason-photo-btn');
    // A real <button> + input.click() here instead of a <label> wrapping a
    // hidden input — label-forwarded clicks to a display:none file input
    // don't reliably open the OS picker in every embedded webview, but a
    // direct click() call inside a genuine user-gesture handler always does.
    if (reasonPhotoBtn && reasonFileInput) reasonPhotoBtn.addEventListener('click', () => reasonFileInput.click());
    if (reasonFileInput) reasonFileInput.addEventListener('change', () => {
      const file = reasonFileInput.files[0];
      if (!file) return;
      this.pendingNewReasonFile = file;
      document.getElementById('sq-reason-icon-preview').innerHTML =
        `<img class="sq-reason-icon-preview-img" src="${URL.createObjectURL(file)}" alt="">`;
      if (emojiGrid) emojiGrid.classList.add('hidden');
    });

    const saveReasonBtn = document.getElementById('sq-new-reason-save');
    if (saveReasonBtn) saveReasonBtn.addEventListener('click', async () => {
      const icon = this.pendingNewReasonIcon || '⭐';
      const label = document.getElementById('sq-new-reason-label').value.trim();
      if (!label) return;
      const statusEl = document.getElementById('sq-reason-icon-status');
      try {
        const { reason } = await window.sqApi.createReason(icon, label);
        let finalReason = reason;
        if (this.pendingNewReasonFile) {
          try {
            const uploadRes = await window.sqApi.uploadReasonIconPhoto(reason.id, this.pendingNewReasonFile);
            if (uploadRes.uploaded) {
              finalReason = { ...reason, icon_photo_key: uploadRes.key };
            } else if (statusEl) {
              statusEl.textContent = "Photo upload isn't available yet — saved with the emoji icon instead.";
              statusEl.classList.remove('hidden');
            }
          } catch (uploadErr) {
            if (statusEl) {
              statusEl.textContent = uploadErr.message || 'Could not upload the photo — saved with the emoji icon instead.';
              statusEl.classList.remove('hidden');
            }
          }
        }
        this.reasons = [...(this.reasons || []), finalReason];
        this.pendingReason = { icon: finalReason.icon, label: finalReason.label, iconPhotoKey: finalReason.icon_photo_key || null };
        await this.render();
        this.openGiveStarModal();
      } catch (err) {
        alert(err.message || 'Could not add this reason.');
      }
    });

    document.getElementById('sq-give-star-cancel').addEventListener('click', () => modal.classList.add('hidden'));
    document.getElementById('sq-give-star-submit').addEventListener('click', async () => {
      const kid = this.kids.find((k) => k.id === this.selectedKidId);
      const praiseText = document.getElementById('sq-praise-text').value.trim();
      try {
        await window.sqApi.giveStar(kid.id, this.pendingStars, this.pendingReason.label, this.pendingReason.icon, praiseText || null, this.pendingReason.iconPhotoKey);
        modal.classList.add('hidden');
        await this.render();
      } catch (err) {
        alert(err.message || 'Could not give star.');
      }
    });
  }

  resetKidPhotoPicker(existingKid) {
    this.pendingAvatarFile = null;
    const preview = document.getElementById('sq-kid-photo-preview');
    const status = document.getElementById('sq-kid-photo-status');
    status.classList.add('hidden');
    if (existingKid && existingKid.avatar_photo_key) {
      preview.innerHTML = `<img class="sq-kid-photo-thumb" data-avatar-key="${this.esc(existingKid.avatar_photo_key)}" alt="">`;
      this.hydrateAvatarPhotos();
    } else {
      preview.innerHTML = '';
    }
    document.getElementById('sq-kid-photo-input').value = '';
  }

  openAddKidModal() {
    this.editingKidId = null;
    const modal = document.getElementById('sq-add-kid-modal');
    if (!modal) return;
    document.getElementById('sq-add-kid-title').textContent = 'Add a Kid';
    document.getElementById('sq-add-kid-submit').textContent = 'Add Kid';
    document.getElementById('sq-kid-name').value = '';
    this.setKidPickerSelection(modal, SQ_AVATARS[0], SQ_COLORS[0]);
    this.resetKidPhotoPicker(null);
    modal.classList.remove('hidden');
  }

  openEditKidModal(kid) {
    this.editingKidId = kid.id;
    const modal = document.getElementById('sq-add-kid-modal');
    if (!modal) return;
    document.getElementById('sq-add-kid-title').textContent = `Edit ${kid.name}`;
    document.getElementById('sq-add-kid-submit').textContent = 'Save Changes';
    document.getElementById('sq-kid-name').value = kid.name;
    this.setKidPickerSelection(modal, kid.avatar, kid.color);
    this.resetKidPhotoPicker(kid);
    modal.classList.remove('hidden');
  }

  setKidPickerSelection(modal, avatar, color) {
    document.getElementById('sq-kid-avatar').value = avatar;
    document.getElementById('sq-kid-color').value = color;
    modal.querySelectorAll('.sq-avatar-opt').forEach((x) => x.classList.toggle('selected', x.dataset.avatar === avatar));
    modal.querySelectorAll('.sq-color-opt').forEach((x) => x.classList.toggle('selected', x.dataset.color === color));
  }

  bindAddKidModal() {
    const modal = document.getElementById('sq-add-kid-modal');
    if (!modal) return;
    modal.querySelectorAll('.sq-avatar-opt').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('sq-kid-avatar').value = b.dataset.avatar;
      modal.querySelectorAll('.sq-avatar-opt').forEach((x) => x.classList.toggle('selected', x === b));
    }));
    modal.querySelectorAll('.sq-color-opt').forEach((b) => b.addEventListener('click', () => {
      document.getElementById('sq-kid-color').value = b.dataset.color;
      modal.querySelectorAll('.sq-color-opt').forEach((x) => x.classList.toggle('selected', x === b));
    }));
    const cancelBtn = document.getElementById('sq-add-kid-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));

    const photoInput = document.getElementById('sq-kid-photo-input');
    const photoBtn = document.getElementById('sq-kid-photo-btn');
    if (photoBtn && photoInput) photoBtn.addEventListener('click', () => photoInput.click());
    if (photoInput) photoInput.addEventListener('change', () => {
      const file = photoInput.files[0];
      if (!file) return;
      this.pendingAvatarFile = file;
      document.getElementById('sq-kid-photo-preview').innerHTML =
        `<img class="sq-kid-photo-thumb" src="${URL.createObjectURL(file)}" alt="">`;
    });

    const form = document.getElementById('sq-add-kid-form');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const kidData = {
        name: document.getElementById('sq-kid-name').value.trim(),
        avatar: document.getElementById('sq-kid-avatar').value,
        color: document.getElementById('sq-kid-color').value
      };
      const statusEl = document.getElementById('sq-kid-photo-status');
      try {
        let kidId = this.editingKidId;
        if (this.editingKidId) {
          await window.sqApi.updateKid(this.editingKidId, kidData);
        } else {
          const { kid } = await window.sqApi.createKid(kidData);
          kidId = kid.id;
          this.selectedKidId = kid.id;
        }

        if (this.pendingAvatarFile) {
          try {
            const uploadRes = await window.sqApi.uploadKidAvatarPhoto(kidId, this.pendingAvatarFile);
            if (uploadRes.uploaded === false) {
              statusEl.textContent = "Photo upload isn't available yet — saved with the icon avatar instead.";
              statusEl.classList.remove('hidden');
              await new Promise((r) => setTimeout(r, 1400));
            }
          } catch (uploadErr) {
            statusEl.textContent = uploadErr.message || 'Could not upload the photo — saved with the icon avatar instead.';
            statusEl.classList.remove('hidden');
            await new Promise((r) => setTimeout(r, 1400));
          }
        }

        this.editingKidId = null;
        this.pendingAvatarFile = null;
        await this.refresh();
      } catch (err) {
        alert(err.message || 'Could not save this kid.');
      }
    });
  }

  async refresh() {
    const familyData = await window.sqApi.getMyFamily();
    await this.load(familyData);
  }
}

window.StarQuestParent = StarQuestParent;
