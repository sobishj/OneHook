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

// One of these is picked at random each time a star lands in the jar, so
// repeated drops don't all look the same. 'fall' particles drift down from
// the top of the screen (stars, hearts, flowers, confetti); 'firework'
// particles launch up from the bottom instead, like a real firework. Each
// theme also swaps the screen's background to a matching scene (see
// SQK_SCENES) — stars fly through space, flowers bloom in a garden, etc.
const SQK_CELEBRATION_THEMES = [
  { emojis: ['⭐', '🌟', '✨'], mode: 'fall', scene: 'space' },
  { emojis: ['💖', '💕', '💗', '❤️'], mode: 'fall', scene: 'love' },
  { emojis: ['🌸', '🌺', '🌹', '🌷'], mode: 'fall', scene: 'garden' },
  { emojis: ['🎉', '🎊', '✨'], mode: 'fall', scene: 'party' },
  { emojis: ['💫', '⭐', '✨'], mode: 'fall', scene: 'galaxy' },
  { emojis: ['🎆', '🎇', '✨'], mode: 'firework', scene: 'night' },
  { emojis: ['🧨', '✨', '🎆'], mode: 'firework', scene: 'night' }
];

// Full-screen background scenes shown briefly behind the jar. `twinkles`
// sprinkles blinking star dots; each `fx` entry is one emoji placed at
// (x%, y%) and moved by a CSS motion class (.sqk-fx-<motion>). `extra` is
// scene-specific decoration markup (aurora bands, spotlights, bursts).
const SQK_SCENES = {
  space: {
    twinkles: 40,
    fx: [
      { e: '🪐', x: 8, y: 14, size: 54, motion: 'float' },
      { e: '🌙', x: 78, y: 8, size: 46, motion: 'float', d: 0.6 },
      { e: '🚀', x: -10, y: 80, size: 46, motion: 'fly' },
      { e: '☄️', x: 90, y: 4, size: 34, motion: 'shoot', d: 0.4 },
      { e: '🛰️', x: 70, y: 60, size: 32, motion: 'drift' },
      { e: '👨‍🚀', x: 10, y: 55, size: 40, motion: 'float', d: 1 },
      { e: '🌍', x: 80, y: 82, size: 50, motion: 'spin' }
    ]
  },
  galaxy: {
    twinkles: 30,
    extra: '<div class="sqk-aurora"></div><div class="sqk-aurora sqk-aurora-2"></div>',
    fx: [
      { e: '🛸', x: -10, y: 30, size: 44, motion: 'fly' },
      { e: '👽', x: 78, y: 70, size: 38, motion: 'float' },
      { e: '🪐', x: 6, y: 78, size: 44, motion: 'float', d: 0.7 },
      { e: '💫', x: 84, y: 12, size: 34, motion: 'spin' },
      { e: '🌟', x: 20, y: 8, size: 30, motion: 'float', d: 0.3 }
    ]
  },
  night: {
    twinkles: 34,
    extra: [12, 36, 62, 84, 50].map((x, i) => `<div class="sqk-burst" style="left:${x}%;top:${14 + (i % 3) * 16}%;--d:${(i * 0.35).toFixed(2)}s;--c:${['#f472b6', '#facc15', '#60a5fa', '#34d399', '#c084fc'][i]}"></div>`).join(''),
    fx: [
      { e: '🌙', x: 80, y: 6, size: 46, motion: 'float' },
      { e: '🏰', x: 4, y: 84, size: 54, motion: 'none' },
      { e: '🦉', x: 82, y: 82, size: 38, motion: 'float', d: 0.5 }
    ]
  },
  love: {
    extra: '<div class="sqk-cloud" style="top:10%;--d:0s"></div><div class="sqk-cloud" style="top:62%;--d:-6s"></div>',
    fx: [
      ...[8, 24, 42, 60, 76, 90].map((x, i) => ({ e: ['💖', '💗', '💕', '💓', '💞', '💝'][i], x, y: 100, size: 26 + (i % 3) * 8, motion: 'rise', d: i * 0.3 })),
      { e: '🦄', x: 6, y: 18, size: 46, motion: 'float' },
      { e: '🌈', x: 70, y: 4, size: 54, motion: 'float', d: 0.5 }
    ]
  },
  garden: {
    extra: '<div class="sqk-meadow"></div><div class="sqk-cloud" style="top:16%;--d:-3s"></div>',
    fx: [
      { e: '☀️', x: 76, y: 4, size: 58, motion: 'spin' },
      { e: '🌈', x: 4, y: 6, size: 52, motion: 'float' },
      { e: '🦋', x: 16, y: 40, size: 34, motion: 'flutter' },
      { e: '🦋', x: 74, y: 48, size: 30, motion: 'flutter', d: 0.8 },
      { e: '🐝', x: 48, y: 30, size: 26, motion: 'flutter', d: 0.4 },
      ...['🌼', '🌷', '🌻', '🌸', '🌹', '🌼', '🌷'].map((e, i) => ({ e, x: 2 + i * 14, y: 88, size: 34, motion: 'sway', d: i * 0.15 }))
    ]
  },
  party: {
    extra: '<div class="sqk-spotlight" style="--c:#f472b6"></div><div class="sqk-spotlight" style="--c:#60a5fa;--d:-1.2s"></div><div class="sqk-spotlight" style="--c:#facc15;--d:-2.4s"></div>',
    fx: [
      { e: '🪩', x: 44, y: 2, size: 50, motion: 'swing' },
      ...[6, 22, 70, 86, 38, 56].map((x, i) => ({ e: '🎈', x, y: 100, size: 34 + (i % 2) * 8, motion: 'rise', d: i * 0.25 })),
      { e: '🥳', x: 6, y: 16, size: 40, motion: 'float' },
      { e: '🎁', x: 80, y: 18, size: 36, motion: 'float', d: 0.5 }
    ]
  }
};
const SQK_SCENE_ORDER = ['space', 'garden', 'love', 'party', 'galaxy', 'night'];

// D1's CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC with no zone —
// Safari can't parse that at all and Chrome reads it as local time, so
// normalise to ISO-UTC before handing it to Date.
function sqkDate(s) {
  if (!s) return new Date(NaN);
  return new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}Z` : s);
}

class StarQuestKid {
  constructor(mountEl) {
    this.mountEl = mountEl;
    this.kids = [];
    this.kid = null;
    this.goals = { week: null, month: null, year: null };
    this.goalPeriod = null;
    this.goal = null;
    this.history = [];
    // Unlocked-but-unscratched rewards (any period) and already-opened
    // ones, both from /goal/history — see renderAchievementsList().
    this.pendingRewards = [];
    this.achievementGoals = [];
    this.scratchGoal = null;
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
        ${this.backdropHtml()}
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
  // it defaults to the first period that actually has a goal. Any reward
  // that's unlocked but not yet scratched (whatever its period) opens
  // straight onto its scratch card, so a finished goal is never missed.
  async loadAndRenderJar() {
    const [goalsRes, historyRes, rewardsRes] = await Promise.all([
      window.sqApi.listGoals(this.kid.id).catch(() => ({ goals: { week: null, month: null, year: null } })),
      window.sqApi.starHistory(this.kid.id).catch(() => ({ entries: [] })),
      window.sqApi.goalHistory(this.kid.id).catch(() => ({ goals: [], pending: [] }))
    ]);
    this.goals = goalsRes.goals || { week: null, month: null, year: null };
    this.history = historyRes.entries || [];
    this.achievementGoals = rewardsRes.goals || [];
    this.pendingRewards = rewardsRes.pending || [];

    if (!this.goalPeriod || !this.goals[this.goalPeriod]) {
      this.goalPeriod = SQK_GOAL_PERIODS.find((p) => this.goals[p]) || 'week';
    }
    this.goal = this.goals[this.goalPeriod];

    if (this.pendingRewards.length) {
      this.openScratch(this.pendingRewards[0]);
      return;
    }
    this.renderJar();
  }

  // Ambient background for every kid screen: slow drifting clouds and
  // floating sparkles, plus an empty .sqk-scene layer that showScene()
  // fills on drops/taps. Both sit behind the screen's content.
  backdropHtml() {
    const sparkles = Array.from({ length: 8 }, (_, i) =>
      `<span class="sqk-ambient-sparkle" style="left:${(i * 13 + 5) % 96}%;top:${(i * 29 + 12) % 90}%;--d:${(i * 0.6).toFixed(1)}s">${i % 2 ? '✨' : '⭐'}</span>`
    ).join('');
    return `
      <div class="sqk-ambient" aria-hidden="true">
        <div class="sqk-cloud" style="top:14%;--d:-4s"></div>
        <div class="sqk-cloud sqk-cloud-small" style="top:46%;--d:-14s"></div>
        ${sparkles}
      </div>
      <div class="sqk-scene" aria-hidden="true"></div>
    `;
  }

  // Swaps the background to one of SQK_SCENES for a few seconds — fades
  // in, plays its decorations, fades back out. A new call while one is
  // showing just switches scene and restarts the timer.
  showScene(name) {
    if (window.SqSounds.reducedMotion) return;
    const screen = this.mountEl.querySelector('.sqk-screen');
    const layer = screen && screen.querySelector('.sqk-scene');
    const scene = SQK_SCENES[name];
    if (!layer || !scene) return;

    const twinkles = Array.from({ length: scene.twinkles || 0 }, () =>
      `<i class="sqk-twinkle-dot" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 2).toFixed(2)}s;--s:${(2 + Math.random() * 3).toFixed(1)}px"></i>`
    ).join('');
    const fx = scene.fx.map((f) =>
      `<span class="sqk-fx sqk-fx-${f.motion}" style="left:${f.x}%;top:${f.y}%;font-size:${f.size}px;--d:${f.d || 0}s">${f.e}</span>`
    ).join('');

    layer.className = `sqk-scene sqk-scene-${name}`;
    layer.style.height = `${screen.scrollHeight}px`;
    layer.innerHTML = twinkles + (scene.extra || '') + fx;
    void layer.offsetWidth; // restart the fade-in when switching scenes
    layer.classList.add('show');
    clearTimeout(this.sceneTimer);
    this.sceneTimer = setTimeout(() => layer.classList.remove('show'), 3400);
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
    return entries.filter((h) => sqkDate(h.created_at).getTime() >= cutoff.getTime());
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

    // Little stars bubbling up inside the jar's fill — only once there's
    // something in it.
    const bubbles = pct > 0
      ? Array.from({ length: 7 }, (_, i) => `<span class="sqk-jar-bubble" style="left:${8 + i * 13}%;--d:${(i * 0.45).toFixed(2)}s">${i % 3 ? '⭐' : '✨'}</span>`).join('')
      : '';

    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-jar-screen">
        ${this.backdropHtml()}
        <div class="sqk-topbar">
          <button class="sqk-switch-kid-btn" id="sqk-switch-kid">🔄 ${this.esc(this.kid.name)}</button>
          <div class="sqk-topbar-right">
            ${this.soundToggleHtml()}
            <button class="sqk-exit-btn" id="sqk-exit-btn" title="Back to parent">🏠</button>
          </div>
        </div>

        ${this.viewTabsHtml('jar')}

        <div class="sqk-period-tabs">
          ${Object.keys(periodLabels).map((p) => `<button class="sqk-period-btn ${p === period ? 'active' : ''}" data-period="${p}">${periodLabels[p]}</button>`).join('')}
        </div>
        <div class="sqk-collected-stat">⭐ <span id="sqk-collected-count">${periodTotal}</span> in the jar</div>

        <div class="sqk-jar-holder" id="sqk-jar-tap" role="button" aria-label="Star jar">
          <div class="sqk-jar-glow"></div>
          <div class="sqk-jar-lid"></div>
          <div class="sqk-jar-wrap">
            <div class="sqk-jar-fill" style="height:${pct}%">${bubbles}</div>
            <div class="sqk-jar-shine"></div>
            <div class="sqk-jar-mascot">⭐</div>
          </div>
          ${this.goal ? `<div class="sqk-jar-goal">🎯 ${progress} / ${target}</div>` : ''}
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

    this.mountEl.querySelectorAll('.sqk-period-btn').forEach((btn) => {
      btn.addEventListener('click', () => { this.jarPeriod = btn.dataset.period; this.renderJar(); });
    });

    const jarTap = document.getElementById('sqk-jar-tap');
    // Speaks the same number the "in the jar" stat above is showing. Reads
    // it live from the DOM rather than the `periodTotal` this render was
    // built with — dragging a star into the jar bumps #sqk-collected-count
    // in place (bumpCollectedStat) without a full re-render, so the
    // closure's periodTotal would otherwise go stale by one star.
    jarTap.addEventListener('click', () => {
      const current = document.getElementById('sqk-collected-count').textContent;
      window.SqSounds.speak(`${current} stars ${periodSpokenPhrase[period]}!`);
      this.playJarTap(jarTap);
    });

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
    this.showScene(theme.scene);
    this.restartAnimation(jarEl, 'sqk-jar-gulp');

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
    this.restartAnimation(el.parentElement, 'sqk-stat-pop');
  }

  // Re-triggers a one-shot CSS animation class even if it's already on.
  restartAnimation(el, cls) {
    if (!el || window.SqSounds.reducedMotion) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // Tapping the jar: it wiggles and glows, a fountain of stars pops out of
  // the lid, and the background turns into the next scene in
  // SQK_SCENE_ORDER — a different little world on every tap.
  playJarTap(jarEl) {
    window.SqSounds.magic();
    this.restartAnimation(jarEl, 'sqk-jar-tapped');
    this.jarSceneIndex = ((this.jarSceneIndex ?? -1) + 1) % SQK_SCENE_ORDER.length;
    this.showScene(SQK_SCENE_ORDER[this.jarSceneIndex]);
    this.spawnJarFountain(jarEl);
  }

  spawnJarFountain(jarEl) {
    if (window.SqSounds.reducedMotion) return;
    const r = jarEl.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + 10;
    const emojis = ['⭐', '🌟', '✨', '💫'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'sqk-fountain-particle';
      p.textContent = emojis[i % emojis.length];
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 220)}px`);
      p.style.setProperty('--dy', `${-Math.round(90 + Math.random() * 130)}px`);
      p.style.setProperty('--delay', `${(i * 0.03).toFixed(2)}s`);
      p.style.fontSize = `${18 + Math.random() * 16}px`;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1400);
    }
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

  // The Achievements tab: unlocked-but-unscratched rewards on top as big
  // wobbling gift cards (any goal period — weekly, monthly, yearly — and
  // always shown, whatever period filter is picked), then every reward
  // already scratched open, filtered Today/Week/Month/Year/All by when it
  // was revealed — not when the goal was created or which goal period it
  // was for, since a Yearly goal revealed today still belongs in "Today".
  async renderAchievements() {
    try {
      const res = await window.sqApi.goalHistory(this.kid.id);
      this.achievementGoals = res.goals || [];
      this.pendingRewards = res.pending || [];
    } catch (err) { /* keeps whatever was loaded last */ }
    if (!this.achievementPeriod) this.achievementPeriod = 'week';
    this.renderAchievementsList();
    if (this.pendingRewards.length) {
      window.SqSounds.speak(this.pendingRewards.length === 1
        ? 'You have a surprise waiting! Tap the gift to scratch it!'
        : `You have ${this.pendingRewards.length} surprises waiting! Tap a gift to scratch it!`);
    }
  }

  filterGoalsByPeriod(goals, period) {
    if (period === 'all') return goals;
    const dateOf = (g) => sqkDate(g.revealed_at || g.redeemed_at || g.created_at);
    const now = new Date();
    if (period === 'day') {
      const today = now.toDateString();
      return goals.filter((g) => dateOf(g).toDateString() === today);
    }
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
    return goals.filter((g) => dateOf(g).getTime() >= cutoff.getTime());
  }

  formatAchievementDate(s) {
    const d = sqkDate(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Shared by renderJar() and renderAchievementsList() — a real tab bar,
  // not a separate screen reached via an icon button, so switching between
  // the jar and past rewards feels like one place, not a detour. A pulsing
  // gift badge on Achievements says a scratch card is waiting there.
  viewTabsHtml(activeView) {
    const waiting = this.pendingRewards.length;
    return `
      <div class="sqk-view-tabs">
        <button class="sqk-view-tab ${activeView === 'jar' ? 'active' : ''}" data-view="jar">🫙 Jar</button>
        <button class="sqk-view-tab ${activeView === 'achievements' ? 'active' : ''}" data-view="achievements">
          🏆 Achievements${waiting ? ` <span class="sqk-tab-badge">🎁${waiting > 1 ? waiting : ''}</span>` : ''}
        </button>
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
      .sort((a, b) => sqkDate(b.revealed_at || b.redeemed_at) - sqkDate(a.revealed_at || a.redeemed_at));
    const pending = this.pendingRewards || [];

    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-jar-screen">
        ${this.backdropHtml()}
        <div class="sqk-topbar">
          <button class="sqk-switch-kid-btn" id="sqk-switch-kid">🔄 ${this.esc(this.kid.name)}</button>
          <div class="sqk-topbar-right">
            ${this.soundToggleHtml()}
            <button class="sqk-exit-btn" id="sqk-exit-btn" title="Back to parent">🏠</button>
          </div>
        </div>

        ${this.viewTabsHtml('achievements')}

        ${pending.length ? `
          <div class="sqk-pending-rewards">
            <p class="sqk-pending-rewards-title">🎉 Surprise waiting! Tap to scratch! 🎉</p>
            ${pending.map((g, i) => `
              <button class="sqk-gift-card sqk-bounce-in" data-pending-goal-id="${g.id}" style="--delay:${i * 0.1}s">
                <span class="sqk-gift-emoji">🎁</span>
                <span class="sqk-gift-info">
                  <span class="sqk-gift-title">${goalPeriodLabel[g.period] || ''} goal done!</span>
                  <span class="sqk-gift-meta">⭐ ${g.target_stars} stars · Scratch me! 👆</span>
                </span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div class="sqk-period-tabs">
          ${Object.keys(periodLabels).map((p) => `<button class="sqk-period-btn ${p === period ? 'active' : ''}" data-achievement-period="${p}">${periodLabels[p]}</button>`).join('')}
        </div>

        <div class="sqk-achievements-list">
          ${filtered.length === 0
            ? `<p class="sqk-empty-hint">${pending.length ? 'Scratch your gift to add it here! 🏆' : `No rewards unlocked ${periodEmptyPhrase[period]}. Keep collecting stars! ⭐`}</p>`
            : filtered.map((g, i) => `
              <button class="sqk-achievement-card sqk-bounce-in" data-reward-text="${this.esc(g.reward_secret || '')}" style="--delay:${i * 0.07}s">
                <span class="sqk-achievement-emoji">${g.reward_secret_emoji || '🎁'}</span>
                <span class="sqk-achievement-info">
                  <span class="sqk-achievement-text">${this.esc(g.reward_secret || '')}</span>
                  <span class="sqk-achievement-meta">${goalPeriodLabel[g.period] || ''} goal · ${this.formatAchievementDate(g.revealed_at || g.redeemed_at)}</span>
                </span>
                <span class="sqk-achievement-trophy">🏆</span>
              </button>
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
    this.mountEl.querySelectorAll('[data-pending-goal-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const goal = pending.find((g) => g.id === btn.dataset.pendingGoalId);
        if (goal) { window.SqSounds.chime(); this.openScratch(goal); }
      });
    });
    this.mountEl.querySelectorAll('[data-reward-text]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.SqSounds.speak(btn.dataset.rewardText || 'You did it!');
        this.restartAnimation(btn, 'sqk-card-wiggle');
      });
    });
  }

  openScratch(goal) {
    this.scratchGoal = goal;
    this.renderScratch();
  }

  renderScratch() {
    const goal = this.scratchGoal;
    this.mountEl.innerHTML = `
      <div class="sqk-screen sqk-scratch-screen">
        ${this.backdropHtml()}
        <div class="sqk-topbar">
          <button class="sqk-back-btn" id="sqk-scratch-later">← Later</button>
          ${this.soundToggleHtml()}
        </div>
        <div class="sqk-scratch-stage">
          <div class="sqk-sunburst" aria-hidden="true"></div>
          <h1 class="sqk-who-title">🎉 You did it! 🎉</h1>
          <div class="sqk-scratch-wrap">
            <div class="sqk-scratch-reveal" id="sqk-reveal-content">
              <span class="sqk-reveal-emoji">${goal.reward_secret_emoji || '🎁'}</span>
            </div>
            <canvas id="sqk-scratch-canvas" class="sqk-scratch-canvas"></canvas>
          </div>
          <p class="sqk-scratch-hint">👆 Scratch with your finger!</p>
        </div>
      </div>
    `;
    document.getElementById('sqk-scratch-later').addEventListener('click', () => this.renderAchievements());
    this.bindSoundToggle();
    window.SqSounds.celebrate();
    window.SqSounds.speak('You did it! Scratch the card to see your surprise!');
    this.showScene('party');
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
    grad.addColorStop(0.5, '#f472b6');
    grad.addColorStop(1, '#a78bfa');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Sprinkle of stars on the foil so it looks like a real scratch card.
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 18; i++) {
      ctx.fillText(i % 2 ? '⭐' : '✨', Math.random() * canvas.width, 16 + Math.random() * (canvas.height - 16));
    }
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
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
    // The faded canvas still sits on top of the card — let taps through
    // to the "Yay!" button underneath.
    canvas.style.pointerEvents = 'none';
    window.SqSounds.celebrate();
    const theme = SQK_CELEBRATION_THEMES[Math.floor(Math.random() * SQK_CELEBRATION_THEMES.length)];
    if (theme.mode === 'firework') this.spawnFireworks(theme.emojis);
    else this.spawnPageConfetti(theme.emojis);
    this.showScene(theme.scene);

    let goal = this.scratchGoal;
    try {
      ({ goal } = await window.sqApi.revealGoal(goal.id));
    } catch (err) { /* non-fatal for the kid-facing view */ }
    // Move it from "waiting" to "opened" locally so the Achievements tab
    // and the jar's tab badge update even before the next refetch.
    this.pendingRewards = this.pendingRewards.filter((g) => g.id !== goal.id);
    if (!this.achievementGoals.some((g) => g.id === goal.id)) this.achievementGoals.unshift(goal);
    if (this.goals[goal.period] && this.goals[goal.period].id === goal.id) {
      this.goals[goal.period] = { ...this.goals[goal.period], ...goal };
      if (this.goalPeriod === goal.period) this.goal = this.goals[goal.period];
    }
    this.scratchGoal = goal;

    setTimeout(() => {
      const revealEl = document.getElementById('sqk-reveal-content');
      if (!revealEl) return;
      const hint = this.mountEl.querySelector('.sqk-scratch-hint');
      if (hint) hint.style.visibility = 'hidden';
      revealEl.innerHTML = `
        <span class="sqk-reveal-emoji sqk-reveal-pop">${goal.reward_secret_emoji || '🎁'}</span>
        <p class="sqk-reveal-text">${this.esc(goal.reward_secret || '')}</p>
        <button class="btn btn-primary" id="sqk-scratch-done">Yay! 🎉</button>
      `;
      window.SqSounds.speak(goal.reward_secret ? `You won: ${goal.reward_secret}!` : 'You unlocked your reward!');
      document.getElementById('sqk-scratch-done').addEventListener('click', () => {
        if (this.pendingRewards.length) this.openScratch(this.pendingRewards[0]);
        else this.renderAchievements();
      });
    }, 500);
  }

}

window.StarQuestKid = StarQuestKid;
