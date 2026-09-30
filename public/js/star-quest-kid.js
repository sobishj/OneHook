// Star Quest — Kid Mode. Ages 3-8, no reading required: big tap targets,
// TTS on every label, positive-only feedback. Fully isolated from
// parent-view code and from One Hook/ui.js.

const SQ_AVATAR_EMOJI_K = {
  fox: '🦊', bear: '🐻', rabbit: '🐰', cat: '🐱', dog: '🐶',
  penguin: '🐧', owl: '🦉', duck: '🦆', koala: '🐨', panda: '🐼',
  lion: '🦁', frog: '🐸'
};
// A kid can have up to three concurrent goals — one per period — each
// with its own jar/progress/reward (see star-quest-parent.js for the
// matching parent-side create/edit UI).
const SQK_GOAL_PERIODS = ['week', 'month', 'year'];
const SQK_GOAL_PERIOD_LABELS = { week: 'Week', month: 'Month', year: 'Year' };

// One of these is picked at random each time a star lands in the jar, so
// repeated drops don't all look the same. 'fall' particles drift down from
// the top of the screen (stars, hearts, flowers, confetti); 'firework'
// particles launch up from the bottom instead, like a real firework.
const SQK_CELEBRATION_THEMES = [
  { emojis: ['⭐', '🌟', '✨'], mode: 'fall' },
  { emojis: ['💖', '💕', '💗', '❤️'], mode: 'fall' },
  { emojis: ['🌸', '🌺', '🌹', '🌷'], mode: 'fall' },
  { emojis: ['🎉', '🎊', '✨'], mode: 'fall' },
  { emojis: ['💫', '⭐', '✨'], mode: 'fall' },
  { emojis: ['🎆', '🎇', '✨'], mode: 'firework' },
  { emojis: ['🧨', '✨', '🎆'], mode: 'firework' }
];

class StarQuestKid {
  constructor(mountEl) {
    this.mountEl = mountEl;
    this.kids = [];
    this.kid = null;
    this.goals = { week: null, month: null, year: null };
    this.goalPeriod = null;
    this.goal = null;
    this.history = [];
    this.onExit = null;
  }

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  async open(kids, onExit) {
    this.kids = kids || [];
    this.onExit = onExit;
    this.kid = null;
    this.renderWho();
  }

  kidAvatarHtml(kid) {
    // /api/sq/media needs a Bearer header, which <img src> can't send —
    // placeholder here, filled in as a blob: URL by hydrateAvatarPhotos().
    if (kid.avatar_photo_key) {
      return `<img class="sqk-avatar-emoji sqk-avatar-photo" data-avatar-key="${this.esc(kid.avatar_photo_key)}" alt="">`;
    }
    return `<span class="sqk-avatar-emoji">${SQ_AVATAR_EMOJI_K[kid.avatar] || '⭐'}</span>`;
  }

  async hydrateAvatarPhotos() {
    this.avatarBlobCache = this.avatarBlobCache || {};
    for (const img of this.mountEl.querySelectorAll('img[data-avatar-key]')) {
      const key = img.dataset.avatarKey;
      if (this.avatarBlobCache[key]) { img.src = this.avatarBlobCache[key]; continue; }
      try {
        const res = await fetch(window.sqApi.mediaUrl(key), { headers: { Authorization: `Bearer ${window.apiClient.token}` } });
        if (!res.ok) continue;
        const blobUrl = URL.createObjectURL(await res.blob());
        this.avatarBlobCache[key] = blobUrl;
        img.src = blobUrl;
      } catch (err) { /* non-fatal */ }
    }
  }

  // Small circular button, top-right, that mutes/unmutes all Star Quest
  // audio (chimes + TTS) — preference persists via SqSounds.setEnabled.
  soundToggleHtml() {
    const on = window.SqSounds.enabled;
    return `<button class="sqk-sound-btn" id="sqk-sound-toggle" type="button" title="${on ? 'Sound on' : 'Sound off'}" aria-label="Toggle sound">${on ? '🔊' : '🔇'}</button>`;
  }

  bindSoundToggle() {
    const btn = document.getElementById('sqk-sound-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = !window.SqSounds.enabled;
      window.SqSounds.setEnabled(next);
      btn.textContent = next ? '🔊' : '🔇';
      btn.title = next ? 'Sound on' : 'Sound off';
      if (next) window.SqSounds.chime();
    });
  }

  renderWho() {
    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-who">
        <div class="sqk-topbar">
          <button class="sqk-back-btn" id="sqk-back-to-parent">← Back</button>
          ${this.soundToggleHtml()}
        </div>
        <div class="sqk-sparkle-decor" aria-hidden="true">✨🌟✨</div>
        <h1 class="sqk-who-title">Who's playing?</h1>
        <div class="sqk-avatar-grid">
          ${this.kids.map((k, i) => `
            <button class="sqk-avatar-btn sqk-bounce-in" data-kid-id="${k.id}" style="--kid-color:${this.esc(k.color)}; --delay:${i * 0.08}s">
              ${this.kidAvatarHtml(k)}
              <span class="sqk-avatar-name">${this.esc(k.name)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
    document.getElementById('sqk-back-to-parent').addEventListener('click', () => {
      if (this.onExit) this.onExit();
    });
    this.bindSoundToggle();
    this.hydrateAvatarPhotos();
    this.mountEl.querySelectorAll('.sqk-avatar-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        // A cheerful chime, not spoken TTS, on entering a kid's jar — the
        // name doesn't need to be read aloud for this transition.
        window.SqSounds.chime();
        const kid = this.kids.find((k) => k.id === btn.dataset.kidId);
        this.selectKid(kid);
      });
    });
  }

  async selectKid(kid) {
    this.kid = kid;
    await this.loadAndRenderJar();
  }

  // A kid can have up to three concurrent goals — week/month/year — each
  // with its own jar/progress. this.goalPeriod picks which one is showing;
  // it defaults to an already-UNLOCKED one (so a scratch card is never
  // missed) or else the first period that actually has a goal.
  async loadAndRenderJar() {
    const [goalsRes, historyRes] = await Promise.all([
      window.sqApi.listGoals(this.kid.id).catch(() => ({ goals: { week: null, month: null, year: null } })),
      window.sqApi.starHistory(this.kid.id).catch(() => ({ entries: [] }))
    ]);
    this.goals = goalsRes.goals || { week: null, month: null, year: null };
    this.history = historyRes.entries || [];

    if (!this.goalPeriod || !this.goals[this.goalPeriod]) {
      this.goalPeriod = SQK_GOAL_PERIODS.find((p) => this.goals[p] && this.goals[p].status === 'UNLOCKED')
        || SQK_GOAL_PERIODS.find((p) => this.goals[p])
        || 'week';
    }
    this.goal = this.goals[this.goalPeriod];

    if (this.goal && this.goal.status === 'UNLOCKED') {
      this.renderScratch();
      return;
    }
    this.renderJar();
  }

  switchGoalPeriod(period) {
    this.goalPeriod = period;
    this.goal = this.goals[period];
    if (this.goal && this.goal.status === 'UNLOCKED') {
      this.renderScratch();
      return;
    }
    this.renderJar();
  }

  progressStars() {
    // With no goal set yet there's nothing server-computed to show; fall
    // back to a simple lifetime total just for this generic jar display.
    if (!this.goal) return this.history.reduce((s, h) => s + h.stars, 0);
    return this.goal.progress;
  }

  // Day/Week/Month/Year/All filter for the "stars collected" stat above the
  // jar — mirrors the parent dashboard's period tabs. Unlike goal progress
  // (which counts every given star immediately, always), this only counts
  // stars the kid has actually dragged into the jar.
  filterByPeriod(entries, period) {
    if (period === 'all') return entries;
    const now = new Date();
    if (period === 'day') {
      const today = now.toISOString().slice(0, 10);
      return entries.filter((h) => h.date === today);
    }
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    return entries.filter((h) => new Date(h.created_at).getTime() >= cutoff.getTime());
  }

  renderJar() {
    const target = this.goal ? this.goal.target_stars : 10;
    const progress = this.progressStars();
    const pct = Math.min(100, Math.round((progress / target) * 100));

    // Pending = given but not yet dragged into the jar — shown regardless
    // of period, since they're waiting on an action, not a date range.
    const pendingEntries = this.history.filter((h) => !h.collected_at);
    const collectedEntries = this.history.filter((h) => h.collected_at);
    const period = this.jarPeriod || 'week';
    const periodLabels = { day: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'All' };
    // Phrasing for the jar-tap voice line — always "in the jar", matching
    // the visible "⭐ N in the jar" stat above, plus whichever period is
    // selected (kept separate from periodLabels/tab text since "in the
    // jar this Year" reads naturally as speech but "Year" alone doesn't).
    const periodSpokenPhrase = { day: 'in the jar today', week: 'in the jar this week', month: 'in the jar this month', year: 'in the jar this year', all: 'in the jar' };
    const periodTotal = this.filterByPeriod(collectedEntries, period).reduce((s, h) => s + h.stars, 0);

    // Flatten each entry into one draggable unit per star — a kid drags
    // stars into the jar one at a time, even when a parent gave several at
    // once. this.pendingRemaining tracks how many units of each entry are
    // still outstanding so the entry is only marked collected (one API
    // call, see /star/collect) once every one of its units has landed.
    this.pendingRemaining = {};
    const pendingUnits = [];
    pendingEntries.forEach((h) => {
      this.pendingRemaining[h.id] = h.stars;
      for (let i = 0; i < h.stars; i++) {
        pendingUnits.push({ entryId: h.id, reason: h.reason, reasonIcon: h.reason_icon, reasonIconPhotoKey: h.reason_icon_photo_key });
      }
    });

    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-jar-screen">
        <div class="sqk-topbar">
          <button class="sqk-switch-kid-btn" id="sqk-switch-kid">🔄 ${this.esc(this.kid.name)}</button>
          <div class="sqk-topbar-right">
            ${this.soundToggleHtml()}
            <button class="sqk-exit-btn" id="sqk-exit-btn" title="Back to parent">🏠</button>
          </div>
        </div>

        ${this.viewTabsHtml('jar')}

        <div class="sqk-goal-period-tabs">
          ${SQK_GOAL_PERIODS.map((p) => `<button class="sqk-goal-period-btn ${p === this.goalPeriod ? 'active' : ''} ${this.goals[p] ? '' : 'sqk-goal-period-empty'}" data-goal-period="${p}">${SQK_GOAL_PERIOD_LABELS[p]}</button>`).join('')}
        </div>

        <div class="sqk-period-tabs">
          ${Object.keys(periodLabels).map((p) => `<button class="sqk-period-btn ${p === period ? 'active' : ''}" data-period="${p}">${periodLabels[p]}</button>`).join('')}
        </div>
        <div class="sqk-collected-stat">⭐ <span id="sqk-collected-count">${periodTotal}</span> in the jar</div>

        <div class="sqk-jar-wrap" id="sqk-jar-tap">
          <div class="sqk-jar-fill" style="height:${pct}%"></div>
          <div class="sqk-jar-mascot">⭐</div>
        </div>

        <div id="sqk-pending-section" class="sqk-pending-section">
          ${pendingUnits.length === 0 ? '' : `
            <p class="sqk-pending-label">✨ Drag your stars into the jar!</p>
            <div class="sqk-pending-stars" id="sqk-pending-stars">
              ${pendingUnits.map((u) => `
                <div class="sqk-pending-star" data-entry-id="${u.entryId}" data-reason="${this.esc(u.reason)}">
                  ${u.reasonIconPhotoKey
                    ? `<img class="sqk-pending-star-badge-photo" data-avatar-key="${this.esc(u.reasonIconPhotoKey)}" alt="">`
                    : `<span class="sqk-pending-star-badge">${u.reasonIcon || '⭐'}</span>`}
                  <div class="sqk-pending-star-icons">⭐</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    document.getElementById('sqk-switch-kid').addEventListener('click', () => this.renderWho());
    document.getElementById('sqk-exit-btn').addEventListener('click', () => { if (this.onExit) this.onExit(); });
    this.bindSoundToggle();
    this.bindViewTabs();

    this.mountEl.querySelectorAll('.sqk-goal-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => { window.SqSounds.chime(); this.switchGoalPeriod(btn.dataset.goalPeriod); });
    });

    this.mountEl.querySelectorAll('.sqk-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => { this.jarPeriod = btn.dataset.period; this.renderJar(); });
    });

    const jarTap = document.getElementById('sqk-jar-tap');
    // Speaks the same number the "in the jar" stat above is showing, so
    // switching the Day/Week/Month/Year/All tab changes what tapping the
    // jar says too, instead of always reporting the goal's own progress.
    jarTap.addEventListener('click', () => window.SqSounds.speak(`${periodTotal} stars ${periodSpokenPhrase[period]}!`));

    this.hydrateAvatarPhotos();
    this.bindPendingDrag();
  }

  // Custom pointer-based drag (not native HTML5 drag-and-drop, which touch
  // browsers support poorly/inconsistently) for dragging a pending star
  // chip into the jar. A short tap (little/no movement) speaks the reason
  // instead of collecting, matching the old tap-to-hear behavior.
  bindPendingDrag() {
    const jarEl = document.getElementById('sqk-jar-tap');
    if (!jarEl) return;
    const isOverJar = (x, y) => {
      const r = jarEl.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    this.mountEl.querySelectorAll('.sqk-pending-star').forEach((chip) => {
      let startX = 0, startY = 0, dragging = false, moved = false;

      chip.addEventListener('pointerdown', (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        chip.setPointerCapture(e.pointerId);
        chip.classList.add('dragging');
      });

      chip.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > 8) moved = true;
        if (moved) {
          chip.style.transform = `translate(${dx}px, ${dy}px) scale(1.15)`;
          jarEl.classList.toggle('sqk-jar-target', isOverJar(e.clientX, e.clientY));
        }
      });

      const onRelease = async (e) => {
        if (!dragging) return;
        dragging = false;
        chip.classList.remove('dragging');
        jarEl.classList.remove('sqk-jar-target');

        if (!moved) {
          window.SqSounds.speak(chip.dataset.reason || 'Great job!');
          return;
        }
        if (isOverJar(e.clientX, e.clientY)) {
          await this.collectPendingStar(chip);
        } else {
          chip.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
          chip.style.transform = '';
          setTimeout(() => { chip.style.transition = ''; }, 260);
        }
      };
      chip.addEventListener('pointerup', onRelease);
      chip.addEventListener('pointercancel', onRelease);
    });
  }

  // Animates one star unit flying into the jar. The entry it belongs to
  // (which may have several units — see renderJar) is only marked
  // collected server-side once every one of its units has landed, but the
  // fly-in/celebration/count-up happens per star so dragging always feels
  // one-at-a-time, never an all-or-nothing batch.
  async collectPendingStar(chip) {
    const entryId = chip.dataset.entryId;
    const jarEl = document.getElementById('sqk-jar-tap');
    const jarRect = jarEl.getBoundingClientRect();
    const targetX = jarRect.left + jarRect.width / 2;
    const targetY = jarRect.top + jarRect.height / 2;
    const chipRect = chip.getBoundingClientRect();
    const dx = targetX - (chipRect.left + chipRect.width / 2);
    const dy = targetY - (chipRect.top + chipRect.height / 2);

    chip.style.transition = 'transform 0.3s ease-in, opacity 0.3s ease-in';
    chip.style.transform = `translate(${dx}px, ${dy}px) scale(0.2)`;
    chip.style.opacity = '0';
    window.SqSounds.dropChime();
    const theme = SQK_CELEBRATION_THEMES[Math.floor(Math.random() * SQK_CELEBRATION_THEMES.length)];
    this.spawnCelebration(targetX, targetY, theme.emojis);
    if (theme.mode === 'firework') this.spawnFireworks(theme.emojis);
    else this.spawnPageConfetti(theme.emojis);

    setTimeout(() => {
      chip.remove();
      this.bumpCollectedStat(1);
      const remainingChips = this.mountEl.querySelectorAll('.sqk-pending-star').length;
      if (remainingChips === 0) {
        const section = document.getElementById('sqk-pending-section');
        if (section) section.innerHTML = '';
      }
    }, 300);

    const remaining = Math.max(0, (this.pendingRemaining[entryId] || 1) - 1);
    this.pendingRemaining[entryId] = remaining;
    if (remaining === 0) {
      try {
        await window.sqApi.collectStar(entryId);
        const entry = this.history.find((h) => h.id === entryId);
        if (entry) entry.collected_at = new Date().toISOString();
      } catch (err) {
        // Non-fatal — this is purely a Kid Mode engagement layer (see
        // migration 0008); a failed collect call doesn't affect goal
        // progress, and a later reload will simply offer the star again.
      }
    }
  }

  // The "⭐ N in the jar" counter is bumped in place as each star lands,
  // rather than recomputed from server state, so it climbs one at a time
  // alongside the drags instead of jumping only once a whole entry (which
  // may be several stars) finishes collecting.
  bumpCollectedStat(delta) {
    const el = document.getElementById('sqk-collected-count');
    if (!el) return;
    el.textContent = String((parseInt(el.textContent, 10) || 0) + delta);
  }

  // A small burst of emoji particles at (x, y), in the drop's theme —
  // reads as the immediate "impact" at the jar. Skipped under
  // prefers-reduced-motion.
  spawnCelebration(x, y, emojis) {
    if (window.SqSounds.reducedMotion) return;
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'sqk-celebrate-particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const dist = 50 + Math.random() * 60;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      particle.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      particle.style.fontSize = `${14 + Math.random() * 14}px`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 950);
    }
  }

  // Confetti drifting down from the top of the viewport — unlike
  // spawnCelebration (a small burst anchored at the jar), this reads as the
  // entire page celebrating, not just the drop point. Skipped under
  // prefers-reduced-motion.
  spawnPageConfetti(emojis) {
    if (window.SqSounds.reducedMotion) return;
    const count = 22;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'sqk-confetti-particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.left = `${Math.random() * 100}vw`;
      particle.style.setProperty('--fall-delay', `${(Math.random() * 0.5).toFixed(2)}s`);
      particle.style.setProperty('--fall-duration', `${(1.6 + Math.random()).toFixed(2)}s`);
      particle.style.setProperty('--fall-rotate', `${Math.round(Math.random() * 720 - 360)}deg`);
      particle.style.fontSize = `${16 + Math.random() * 16}px`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 3200);
    }
  }

  // Fireworks launching up from the bottom of the viewport — the "upward"
  // counterpart to spawnPageConfetti's downward drift. Skipped under
  // prefers-reduced-motion.
  spawnFireworks(emojis) {
    if (window.SqSounds.reducedMotion) return;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'sqk-firework-particle';
      particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      particle.style.left = `${10 + Math.random() * 80}vw`;
      particle.style.setProperty('--rise-height', `-${55 + Math.random() * 30}vh`);
      particle.style.setProperty('--rise-duration', `${(1.1 + Math.random() * 0.5).toFixed(2)}s`);
      particle.style.setProperty('--rise-delay', `${(Math.random() * 0.4).toFixed(2)}s`);
      particle.style.setProperty('--rise-rotate', `${Math.round(Math.random() * 60 - 30)}deg`);
      particle.style.fontSize = `${16 + Math.random() * 16}px`;
      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 2200);
    }
  }

  // Every reward a kid has scratched open, grouped by Today/Week/Month/
  // Year/All — based on when it was revealed (scratched), not when the
  // goal itself was created or which goal period (week/month/year) it was
  // for. That's shown per-card instead, since a Yearly goal revealed today
  // still belongs in "Today".
  async renderAchievements() {
    let goals = [];
    try {
      const res = await window.sqApi.goalHistory(this.kid.id);
      goals = res.goals || [];
    } catch (err) { /* leaves the empty state below */ }
    this.achievementGoals = goals;
    if (!this.achievementPeriod) this.achievementPeriod = 'week';
    this.renderAchievementsList();
  }

  filterGoalsByPeriod(goals, period) {
    if (period === 'all') return goals;
    const dateOf = (g) => new Date(g.revealed_at || g.redeemed_at || g.created_at);
    const now = new Date();
    if (period === 'day') {
      const today = now.toISOString().slice(0, 10);
      return goals.filter((g) => dateOf(g).toISOString().slice(0, 10) === today);
    }
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    return goals.filter((g) => dateOf(g).getTime() >= cutoff.getTime());
  }

  formatAchievementDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Shared by renderJar() and renderAchievementsList() — a real tab bar,
  // not a separate screen reached via an icon button, so switching between
  // the jar and past rewards feels like one place, not a detour.
  viewTabsHtml(activeView) {
    return `
      <div class="sqk-view-tabs">
        <button class="sqk-view-tab ${activeView === 'jar' ? 'active' : ''}" data-view="jar">🫙 Jar</button>
        <button class="sqk-view-tab ${activeView === 'achievements' ? 'active' : ''}" data-view="achievements">🏆 Achievements</button>
      </div>
    `;
  }

  bindViewTabs() {
    this.mountEl.querySelectorAll('.sqk-view-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view === 'achievements') this.renderAchievements();
        else this.renderJar();
      });
    });
  }

  renderAchievementsList() {
    const period = this.achievementPeriod;
    const periodLabels = { day: 'Today', week: 'Week', month: 'Month', year: 'Year', all: 'All' };
    const periodEmptyPhrase = { day: 'today', week: 'this week', month: 'this month', year: 'this year', all: 'yet' };
    const goalPeriodLabel = { week: 'Weekly', month: 'Monthly', year: 'Yearly' };

    const filtered = this.filterGoalsByPeriod(this.achievementGoals || [], period)
      .slice()
      .sort((a, b) => new Date(b.revealed_at || b.redeemed_at) - new Date(a.revealed_at || a.redeemed_at));

    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-jar-screen">
        <div class="sqk-topbar">
          <button class="sqk-switch-kid-btn" id="sqk-switch-kid">🔄 ${this.esc(this.kid.name)}</button>
          <div class="sqk-topbar-right">
            ${this.soundToggleHtml()}
            <button class="sqk-exit-btn" id="sqk-exit-btn" title="Back to parent">🏠</button>
          </div>
        </div>

        ${this.viewTabsHtml('achievements')}

        <div class="sqk-period-tabs">
          ${Object.keys(periodLabels).map((p) => `<button class="sqk-period-btn ${p === period ? 'active' : ''}" data-achievement-period="${p}">${periodLabels[p]}</button>`).join('')}
        </div>

        <div class="sqk-achievements-list">
          ${filtered.length === 0
            ? `<p class="sqk-empty-hint">No rewards unlocked ${periodEmptyPhrase[period]}.</p>`
            : filtered.map((g) => `
              <div class="sqk-achievement-card">
                <span class="sqk-achievement-emoji">${g.reward_secret_emoji || '🎁'}</span>
                <div class="sqk-achievement-info">
                  <p class="sqk-achievement-text">${this.esc(g.reward_secret || '')}</p>
                  <p class="sqk-achievement-meta">${goalPeriodLabel[g.period] || ''} goal · ${this.formatAchievementDate(g.revealed_at || g.redeemed_at)}</p>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    document.getElementById('sqk-switch-kid').addEventListener('click', () => this.renderWho());
    document.getElementById('sqk-exit-btn').addEventListener('click', () => { if (this.onExit) this.onExit(); });
    this.bindSoundToggle();
    this.bindViewTabs();
    this.mountEl.querySelectorAll('[data-achievement-period]').forEach((btn) => {
      btn.addEventListener('click', () => { this.achievementPeriod = btn.dataset.achievementPeriod; this.renderAchievementsList(); });
    });
  }

  renderScratch() {
    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-scratch-screen">
        <h1 class="sqk-who-title">🎉 You did it! 🎉</h1>
        <div class="sqk-scratch-wrap">
          <div class="sqk-scratch-reveal" id="sqk-reveal-content">
            <span class="sqk-reveal-emoji">${this.goal.reward_secret_emoji || '🎁'}</span>
          </div>
          <canvas id="sqk-scratch-canvas" class="sqk-scratch-canvas"></canvas>
        </div>
        <p class="sqk-scratch-hint">Scratch with your finger!</p>
      </div>
    `;
    window.SqSounds.celebrate();
    this.initScratchCanvas();
  }

  initScratchCanvas() {
    const canvas = document.getElementById('sqk-scratch-canvas');
    const wrap = canvas.parentElement;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText('✨ Scratch here! ✨', canvas.width / 2, canvas.height / 2);

    ctx.globalCompositeOperation = 'destination-out';
    const brushRadius = 32;
    let scratching = false;
    let lastTick = 0;
    let revealed = false;

    const scratchAt = (x, y) => {
      ctx.beginPath();
      ctx.arc(x, y, brushRadius, 0, Math.PI * 2);
      ctx.fill();
      const now = Date.now();
      if (now - lastTick > 60) { window.SqSounds.scratchTick(); lastTick = now; }
    };

    const checkPercent = () => {
      if (revealed) return;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0;
      const step = 16; // sample every 4th pixel for performance
      let total = 0;
      for (let i = 3; i < data.length; i += step) {
        total++;
        if (data[i] < 32) clear++;
      }
      if (clear / total > 0.5) {
        revealed = true;
        this.completeScratch(canvas);
      }
    };

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return { x: point.clientX - r.left, y: point.clientY - r.top };
    };

    const start = (e) => { scratching = true; const p = getPos(e); scratchAt(p.x, p.y); };
    const move = (e) => {
      if (!scratching) return;
      e.preventDefault();
      const p = getPos(e);
      scratchAt(p.x, p.y);
      checkPercent();
    };
    const end = () => { scratching = false; };

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    canvas.addEventListener('touchstart', start, { passive: true });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  async completeScratch(canvas) {
    if (!window.SqSounds.reducedMotion) canvas.style.transition = 'opacity 0.4s ease';
    canvas.style.opacity = '0';
    window.SqSounds.celebrate();
    const theme = SQK_CELEBRATION_THEMES[Math.floor(Math.random() * SQK_CELEBRATION_THEMES.length)];
    if (theme.mode === 'firework') this.spawnFireworks(theme.emojis);
    else this.spawnPageConfetti(theme.emojis);
    try {
      const { goal } = await window.sqApi.revealGoal(this.goal.id);
      this.goal = goal;
      this.goals[this.goalPeriod] = goal;
    } catch (err) { /* non-fatal for the kid-facing view */ }

    setTimeout(() => {
      const revealEl = document.getElementById('sqk-reveal-content');
      revealEl.innerHTML = `
        <span class="sqk-reveal-emoji">${this.goal.reward_secret_emoji || '🎁'}</span>
        <p class="sqk-reveal-text">${this.esc(this.goal.reward_secret || '')}</p>
        <button class="btn btn-primary" id="sqk-scratch-done">Yay!</button>
      `;
      window.SqSounds.speak(this.goal.reward_secret || 'You unlocked your reward!');
      document.getElementById('sqk-scratch-done').addEventListener('click', () => this.renderJar());
    }, 500);
  }

}

window.StarQuestKid = StarQuestKid;
