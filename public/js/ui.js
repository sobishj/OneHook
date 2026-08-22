class UIManager {
  // Mask email for display: sobishjt@gmail.com → s*****jt@g***l.com
  maskEmail(email) {
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

  constructor() {
    // DOM Elements
    this.homeScreen = document.getElementById('home-screen');
    this.hudScreen = document.getElementById('hud-screen');
    this.portalNav = document.getElementById('portal-nav');

    // HUD Elements
    this.hudBest = document.getElementById('hud-best');
    this.hudScore = document.getElementById('hud-score');
    this.hudHearts = document.getElementById('hud-hearts');
    this.hudLevel = document.getElementById('hud-level');
    this.audioBtn = document.getElementById('audio-toggle-btn');
    this.audioNavBtn = document.getElementById('audio-toggle-btn-nav');
    this.exitToHubBtn = document.getElementById('exit-to-hub-btn');

    // User Profile Display
    this.userBadge = document.getElementById('user-profile-badge');

    // Modals
    this.authModal = document.getElementById('auth-modal');
    this.leaderboardModal = document.getElementById('leaderboard-modal');
    this.friendsModal = document.getElementById('friends-modal');
    this.challengesModal = document.getElementById('challenges-modal');
    this.sendChallengeModal = document.getElementById('send-challenge-modal');
    this.challengeModal = document.getElementById('challenge-modal');
    this.gameOverModal = document.getElementById('game-over-modal');

    // Target friend for sending a challenge
    this.targetChallengeFriend = null;

    // Toasts
    this.toastContainer = document.getElementById('toast-container');

    // Temporary storage for auth flow
    this.pendingEmail = '';

    // Active Challenge context
    this.selectedChallengeOpponent = null;

    this.initListeners();
    this.renderFeaturedGames();
    this.initRouting();
  }

  initListeners() {
    // Logo Brand Home Navigation
    const brandLogo = document.getElementById('nav-brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('click', () => this.showHomeScreen());
    }

    // Exit HUD to Hub
    if (this.exitToHubBtn) {
      this.exitToHubBtn.addEventListener('click', () => this.showHomeScreen());
    }

    // Header Navigation Buttons
    const openLbBtn = document.getElementById('open-leaderboard-btn');
    if (openLbBtn) openLbBtn.addEventListener('click', () => this.openLeaderboardModal('global'));

    const openChBtn = document.getElementById('open-challenges-btn');
    if (openChBtn) openChBtn.addEventListener('click', () => this.openChallengesModal('incoming'));

    const openFrBtn = document.getElementById('open-friends-btn');
    if (openFrBtn) openFrBtn.addEventListener('click', () => this.openFriendsModal('list'));

    const openProfileBtn = document.getElementById('open-profile-btn');
    if (openProfileBtn) openProfileBtn.addEventListener('click', () => this.openAuthModal());

    if (this.userBadge) {
      this.userBadge.addEventListener('click', () => this.openAuthModal());
    }

    // Audio Toggles
    const handleAudioToggle = () => {
      const isMuted = window.soundManager.toggleMute();
      const icon = isMuted ? '🔇' : '🔊';
      if (this.audioBtn) this.audioBtn.innerHTML = icon;
      if (this.audioNavBtn) this.audioNavBtn.innerHTML = icon;
    };

    if (this.audioBtn) this.audioBtn.addEventListener('click', handleAudioToggle);
    if (this.audioNavBtn) this.audioNavBtn.addEventListener('click', handleAudioToggle);

    // Auth Modal Handlers
    document.getElementById('close-auth-btn').addEventListener('click', () => this.closeModal(this.authModal));
    
    // Auth Options Navigation
    const optLoginBtn = document.getElementById('opt-login-btn');
    if (optLoginBtn) optLoginBtn.addEventListener('click', () => {
      document.getElementById('auth-step-options').classList.add('hidden');
      document.getElementById('auth-step-login').classList.remove('hidden');
      const input = document.getElementById('auth-login-identifier');
      if (input) input.focus();
    });

    const optRegisterBtn = document.getElementById('opt-register-btn');
    if (optRegisterBtn) optRegisterBtn.addEventListener('click', () => {
      document.getElementById('auth-step-options').classList.add('hidden');
      document.getElementById('auth-step-register').classList.remove('hidden');
      const input = document.getElementById('auth-reg-username');
      if (input) input.focus();
    });

    const backFromLogin = document.getElementById('back-to-opt-from-login');
    if (backFromLogin) backFromLogin.addEventListener('click', () => {
      document.getElementById('auth-step-login').classList.add('hidden');
      document.getElementById('auth-step-options').classList.remove('hidden');
    });

    const backFromReg = document.getElementById('back-to-opt-from-reg');
    if (backFromReg) backFromReg.addEventListener('click', () => {
      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-options').classList.remove('hidden');
    });
    
    // Submit Buttons
    const loginSubmitBtn = document.getElementById('auth-login-submit-btn');
    if (loginSubmitBtn) loginSubmitBtn.addEventListener('click', () => this.handleLoginSubmit());
    
    const regSubmitBtn = document.getElementById('auth-reg-submit-btn');
    if (regSubmitBtn) regSubmitBtn.addEventListener('click', () => this.handleRegisterSubmit());
    
    document.getElementById('otp-verify-btn').addEventListener('click', () => this.handleOtpVerify());
    document.getElementById('auth-logout-btn').addEventListener('click', () => this.handleLogout());

    // Enter Key Listeners on Form Inputs
    const loginIdInput = document.getElementById('auth-login-identifier');
    if (loginIdInput) {
      loginIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleLoginSubmit();
      });
    }

    const regUsernameInput = document.getElementById('auth-reg-username');
    if (regUsernameInput) {
      regUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleRegisterSubmit();
      });
    }

    const regEmailInput = document.getElementById('auth-reg-email');
    if (regEmailInput) {
      regEmailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleRegisterSubmit();
      });
    }

    const otpCodeInput = document.getElementById('otp-code-input');
    if (otpCodeInput) {
      otpCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleOtpVerify();
      });
    }

    const backBtn = document.getElementById('otp-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.getElementById('auth-step-otp').classList.add('hidden');
        document.getElementById('auth-step-options').classList.remove('hidden');
      });
    }

    const resendBtn = document.getElementById('otp-resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => this.handleResendOtp());
    }

    // Leaderboard Tabs
    document.getElementById('lb-tab-global').addEventListener('click', () => this.renderGlobalLeaderboard());
    document.getElementById('lb-tab-friends').addEventListener('click', () => this.renderFriendsLeaderboard());
    document.getElementById('close-lb-btn').addEventListener('click', () => this.closeModal(this.leaderboardModal));

    // Friends Tabs & Search
    document.getElementById('fr-tab-list').addEventListener('click', () => this.renderFriendsListTab());
    document.getElementById('fr-tab-add').addEventListener('click', () => this.renderAddFriendTab());
    document.getElementById('fr-tab-requests').addEventListener('click', () => this.renderPendingRequestsTab());
    document.getElementById('close-friends-btn').addEventListener('click', () => this.closeModal(this.friendsModal));
    document.getElementById('friend-search-btn').addEventListener('click', () => this.handleFriendSearch());

    // Challenges Hub Tabs & Buttons
    const closeChBtn = document.getElementById('close-challenges-btn');
    if (closeChBtn) closeChBtn.addEventListener('click', () => this.closeModal(this.challengesModal));

    const chTabInc = document.getElementById('ch-tab-incoming');
    if (chTabInc) chTabInc.addEventListener('click', () => this.renderIncomingChallengesTab());

    const chTabSent = document.getElementById('ch-tab-sent');
    if (chTabSent) chTabSent.addEventListener('click', () => this.renderSentChallengesTab());

    const chTabHist = document.getElementById('ch-tab-history');
    if (chTabHist) chTabHist.addEventListener('click', () => this.renderHistoryChallengesTab());

    // Send Challenge Modal Handlers
    const closeSendChBtn = document.getElementById('close-send-challenge-btn');
    if (closeSendChBtn) closeSendChBtn.addEventListener('click', () => this.closeModal(this.sendChallengeModal));

    const cancelSendChBtn = document.getElementById('cancel-send-challenge-btn');
    if (cancelSendChBtn) cancelSendChBtn.addEventListener('click', () => this.closeModal(this.sendChallengeModal));

    const confirmSendChBtn = document.getElementById('confirm-send-challenge-btn');
    if (confirmSendChBtn) confirmSendChBtn.addEventListener('click', () => this.confirmSendChallenge());

    // Play Challenge Modal
    document.getElementById('start-challenge-btn').addEventListener('click', () => {
      this.closeModal(this.challengeModal);
      this.launchGame('one-hook', this.selectedChallengeOpponent);
    });
    document.getElementById('close-challenge-btn').addEventListener('click', () => this.closeModal(this.challengeModal));

    // Game Over Restart
    document.getElementById('restart-btn').addEventListener('click', () => {
      this.closeModal(this.gameOverModal);
      if (window.game) {
        window.game.startNewGame();
      }
    });

    document.getElementById('home-from-gameover-btn').addEventListener('click', () => {
      this.closeModal(this.gameOverModal);
      this.showHomeScreen();
    });

    // Auto load session user and sync latest data from server
    this.refreshUserBadge();
    this.initSessionSync();
  }

  async initSessionSync() {
    if (window.apiClient && window.apiClient.token) {
      try {
        const freshUser = await window.apiClient.fetchMe();
        if (freshUser) {
          this.refreshUserBadge();
        }
      } catch (e) {}
    }
  }

  // =========================================================================
  // GAME HUB - REUSABLE GAME CARD COMPONENT RENDERER
  // =========================================================================
  renderFeaturedGames() {
    const grid = document.getElementById('games-grid');
    if (!grid || !window.GAMES_DATA) return;

    grid.innerHTML = window.GAMES_DATA.map(game => this.createGameCardHtml(game)).join('');
  }

  createGameCardHtml(game) {
    const isNew = game.badge === 'NEW';
    const badgeClass = isNew ? 'badge-new' : 'badge-soon';
    
    const playBtn = game.isPlayable
      ? `<button class="btn btn-yellow-play" onclick="uiManager.launchGame('${game.id}')">PLAY</button>`
      : `<button class="btn btn-yellow-play btn-disabled" disabled>SOON</button>`;

    return `
      <article class="game-card" data-game-id="${game.id}">
        <div class="game-card-art-wrap">
          <img src="${game.image}" alt="${game.title}" class="game-card-art" loading="lazy">
          <span class="game-card-badge ${badgeClass}">${game.badge}</span>
        </div>
        <div class="game-card-body">
          <h3 class="game-card-title">${game.title}</h3>
          <p class="game-card-desc">${game.description}</p>
          <div class="game-card-actions">
            ${playBtn}
          </div>
        </div>
      </article>
    `;
  }

  launchGame(gameId, challengeContext = null) {
    if (gameId === 'one-hook') {
      window.location.hash = '/games/one-hook';
      this.homeScreen.classList.add('hidden');
      if (this.portalNav) this.portalNav.classList.add('hidden');
      this.showInGameHUD();
      if (window.game) {
        window.game.startNewGame(challengeContext);
      }
    } else {
      this.showToast('🎮 Game coming soon to SprintGames!', 'info');
    }
  }

  initRouting() {
    const checkRoute = () => {
      const path = window.location.hash || window.location.pathname;
      if (path.includes('/games/one-hook')) {
        this.launchGame('one-hook');
      } else {
        this.showHomeScreen();
      }
    };

    window.addEventListener('hashchange', checkRoute);
    if (window.location.hash.includes('/games/one-hook') || window.location.pathname.includes('/games/one-hook')) {
      checkRoute();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  refreshUserBadge() {
    const user = window.apiClient.user;
    if (user) {
      if (this.userBadge) {
        this.userBadge.innerHTML = `👤 <strong>${user.username}</strong> (Best: ${user.best_score || 0})`;
      }
      const profileBestEl = document.getElementById('profile-best-score-display');
      if (profileBestEl) {
        profileBestEl.textContent = (user.best_score || 0).toLocaleString();
      }
      if (window.game) {
        window.game.bestScore = user.best_score || 0;
      }
      this.checkPendingNotifications();
    } else if (this.userBadge) {
      this.userBadge.innerHTML = `👤 <span>Sign In/ Sign Up</span>`;
    }
  }

  async checkPendingNotifications() {
    if (!window.apiClient || !window.apiClient.user) return;
    try {
      const [frRes, chRes] = await Promise.all([
        window.apiClient.getPendingRequests().catch(() => ({ requests: [] })),
        window.apiClient.getChallengesList().catch(() => ({ stats: {}, incoming: [] }))
      ]);

      // Friends Requests Badge
      const reqCount = frRes.requests ? frRes.requests.length : 0;
      const frBadge = document.getElementById('friends-pending-badge');
      const reqBadge = document.getElementById('requests-tab-badge');
      if (reqCount > 0) {
        if (frBadge) { frBadge.textContent = reqCount; frBadge.classList.remove('hidden'); }
        if (reqBadge) { reqBadge.textContent = reqCount; reqBadge.classList.remove('hidden'); }
      } else {
        if (frBadge) frBadge.classList.add('hidden');
        if (reqBadge) reqBadge.classList.add('hidden');
      }

      // Challenges Badge
      const incCount = chRes.stats ? (chRes.stats.incomingCount || 0) : 0;
      const chBadge = document.getElementById('challenges-pending-badge');
      const chTabBadge = document.getElementById('ch-tab-incoming-badge');
      if (incCount > 0) {
        if (chBadge) { chBadge.textContent = incCount; chBadge.classList.remove('hidden'); }
        if (chTabBadge) { chTabBadge.textContent = incCount; chTabBadge.classList.remove('hidden'); }
      } else {
        if (chBadge) chBadge.classList.add('hidden');
        if (chTabBadge) chTabBadge.classList.add('hidden');
      }

      // Update Header Stats if challenges modal is open
      if (chRes.stats) {
        const statInc = document.getElementById('ch-stat-incoming');
        const statWon = document.getElementById('ch-stat-won');
        const statSent = document.getElementById('ch-stat-sent');
        if (statInc) statInc.textContent = chRes.stats.incomingCount || 0;
        if (statWon) statWon.textContent = chRes.stats.wonCount || 0;
        if (statSent) statSent.textContent = chRes.stats.sentCount || 0;
      }
    } catch (e) {}
  }

  async showHomeScreen() {
    window.location.hash = '/';
    if (this.portalNav) this.portalNav.classList.remove('hidden');
    this.homeScreen.classList.remove('hidden');
    this.hudScreen.classList.add('hidden');
    this.refreshUserBadge();

    if (window.apiClient && window.apiClient.token) {
      try {
        const freshUser = await window.apiClient.fetchMe();
        if (freshUser) {
          this.refreshUserBadge();
        }
      } catch (e) {}
    }

    if (window.game) {
      window.game.state = 'MENU';
    }
  }

  showInGameHUD() {
    this.homeScreen.classList.add('hidden');
    this.hudScreen.classList.remove('hidden');
  }

  updateHUD(data) {
    this.hudBest.textContent = data.bestScore.toLocaleString();
    this.hudScore.textContent = data.score.toLocaleString();
    this.hudLevel.textContent = `LVL ${data.level}`;

    const targetEl = document.getElementById('hud-level-target');
    if (targetEl) {
      if (data.nextLevelScore) {
        targetEl.textContent = `Next: ${data.nextLevelScore}`;
      } else {
        targetEl.textContent = `MAX`;
      }
    }

    let heartsHtml = '';
    for (let i = 0; i < 3; i++) {
      heartsHtml += i < data.lives ? '❤️ ' : '🖤 ';
    }
    this.hudHearts.innerHTML = heartsHtml.trim();

    const attemptsCountEl = document.getElementById('hud-attempts-count');
    if (attemptsCountEl) {
      attemptsCountEl.textContent = `(${data.lives}/3)`;
    }
  }

  showChallengeNotice(challengeContext) {
    const notice = document.getElementById('challenge-hud-notice');
    notice.classList.remove('hidden');
    notice.innerHTML = `⚔️ CHALLENGE MODE: Beat <strong>${challengeContext.username}</strong> (${challengeContext.scoreToBeat} pts)`;
  }

  hideChallengeNotice() {
    const notice = document.getElementById('challenge-hud-notice');
    notice.classList.add('hidden');
  }

  openModal(modal) {
    modal.classList.remove('hidden');
  }

  closeModal(modal) {
    modal.classList.add('hidden');
  }

  // Auth Flow
  async openAuthModal() {
    const user = window.apiClient.user;

    if (user) {
      document.getElementById('auth-step-options').classList.add('hidden');
      document.getElementById('auth-step-login').classList.add('hidden');
      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.add('hidden');
      document.getElementById('auth-step-profile').classList.remove('hidden');

      document.getElementById('profile-username-display').textContent = user.username;
      document.getElementById('profile-email-display').textContent = this.maskEmail(user.email);
      document.getElementById('profile-best-score-display').textContent = (user.best_score || 0).toLocaleString();
      this.openModal(this.authModal);

      // Fetch fresh data in background and update modal fields
      if (window.apiClient && window.apiClient.token) {
        try {
          const freshUser = await window.apiClient.fetchMe();
          if (freshUser) {
            document.getElementById('profile-username-display').textContent = freshUser.username;
            document.getElementById('profile-email-display').textContent = this.maskEmail(freshUser.email);
            document.getElementById('profile-best-score-display').textContent = (freshUser.best_score || 0).toLocaleString();
            this.refreshUserBadge();
          }
        } catch (e) {}
      }
    } else {
      document.getElementById('auth-step-profile').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.add('hidden');
      document.getElementById('auth-step-login').classList.add('hidden');
      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-options').classList.remove('hidden');
      this.openModal(this.authModal);
    }
  }

  handleLogout() {
    window.apiClient.logout();
    this.refreshUserBadge();
    this.closeModal(this.authModal);
    this.showToast('Logged out successfully', 'info');
  }

  async handleLoginSubmit() {
    const identifierInput = document.getElementById('auth-login-identifier');
    const identifier = identifierInput ? identifierInput.value.trim() : '';

    if (!identifier) {
      this.showToast('Please enter your username or email address', 'error');
      if (identifierInput) identifierInput.focus();
      return;
    }

    try {
      const res = await window.apiClient.login(identifier);
      this.pendingEmail = res.email;

      this.showToast(res.message || 'Verification code sent to your email!', 'success');

      const otpInput = document.getElementById('otp-code-input');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }

      document.getElementById('auth-step-login').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.remove('hidden');
      document.getElementById('otp-sent-email').textContent = this.maskEmail(res.email);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleRegisterSubmit() {
    const usernameInput = document.getElementById('auth-reg-username');
    const emailInput = document.getElementById('auth-reg-email');
    
    const username = usernameInput ? usernameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';

    if (!username || !email) {
      this.showToast('Please enter both username and email address', 'error');
      if (!username && usernameInput) usernameInput.focus();
      else if (!email && emailInput) emailInput.focus();
      return;
    }

    try {
      // In the worker, login() actually does "start auth" (handles both register/login).
      // If we pass an email, it creates/finds the user. We need to pass the email.
      // We should ideally update the backend to support setting username on registration,
      // but for now, sending the email to `apiClient.login` works for generating the OTP.
      // Let's pass an object so apiClient can send both if supported.
      const payload = { identifier: email, username: username };
      const res = await window.apiClient.register(username, email);
      this.pendingEmail = res.email;

      this.showToast(res.message || 'Verification code sent to your email!', 'success');

      const otpInput = document.getElementById('otp-code-input');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }

      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.remove('hidden');
      document.getElementById('otp-sent-email').textContent = this.maskEmail(res.email);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleOtpVerify() {
    const code = document.getElementById('otp-code-input').value.trim();
    if (!code) {
      this.showToast('Please enter the 6-digit verification code', 'error');
      return;
    }

    try {
      const res = await window.apiClient.verify(this.pendingEmail, code);
      this.showToast(`Welcome, ${res.user.username}!`, 'success');
      this.closeModal(this.authModal);
      this.refreshUserBadge();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleResendOtp() {
    if (!this.pendingEmail) {
      this.showToast('Please enter your details again', 'error');
      document.getElementById('auth-step-otp').classList.add('hidden');
      document.getElementById('auth-step-input').classList.remove('hidden');
      const input = document.getElementById('auth-identifier');
      if (input) input.focus();
      return;
    }

    try {
      const res = await window.apiClient.login(this.pendingEmail);
      this.showToast(res.message || 'New verification code sent!', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Leaderboard Flow
  openLeaderboardModal(tab = 'global') {
    this.openModal(this.leaderboardModal);
    if (tab === 'global') {
      this.renderGlobalLeaderboard();
    } else {
      this.renderFriendsLeaderboard();
    }
  }

  async renderGlobalLeaderboard() {
    document.getElementById('lb-tab-global').classList.add('active');
    document.getElementById('lb-tab-friends').classList.remove('active');

    const container = document.getElementById('lb-list-container');
    container.innerHTML = `<div class="loading-spinner">Loading Leaderboard...</div>`;

    try {
      const res = await window.apiClient.getGlobalLeaderboard();
      if (!res.leaderboard || res.leaderboard.length === 0) {
        container.innerHTML = `<div class="empty-state">No scores recorded yet. Be the first!</div>`;
        return;
      }

      let html = `<table class="lb-table">
        <thead>
          <tr>
            <th>RANK</th>
            <th>PLAYER</th>
            <th>BEST SCORE</th>
          </tr>
        </thead>
        <tbody>`;

      res.leaderboard.forEach((item) => {
        let rankBadge = item.rank;
        if (item.rank === 1) rankBadge = '🥇 1';
        if (item.rank === 2) rankBadge = '🥈 2';
        if (item.rank === 3) rankBadge = '🥉 3';

        html += `<tr class="${item.isUser ? 'user-highlight' : ''}">
          <td class="rank-col">${rankBadge}</td>
          <td class="username-col">${item.username} ${item.isUser ? '(YOU)' : ''}</td>
          <td class="score-col">${item.score.toLocaleString()}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load leaderboard: ${err.message}</div>`;
    }
  }

  async renderFriendsLeaderboard() {
    document.getElementById('lb-tab-global').classList.remove('active');
    document.getElementById('lb-tab-friends').classList.add('active');

    const container = document.getElementById('lb-list-container');
    if (!window.apiClient.user) {
      container.innerHTML = `<div class="empty-state">Please sign in to view your friends leaderboard. <br><br> <button class="btn btn-secondary" onclick="uiManager.openAuthModal()">Sign In</button></div>`;
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Loading Friends Leaderboard...</div>`;

    try {
      const res = await window.apiClient.getFriendsLeaderboard();
      if (!res.leaderboard || res.leaderboard.length === 0) {
        container.innerHTML = `<div class="empty-state">No friends added yet. Go to Friends tab to add friends!</div>`;
        return;
      }

      let html = `<table class="lb-table">
        <thead>
          <tr>
            <th>RANK</th>
            <th>PLAYER</th>
            <th>BEST SCORE</th>
          </tr>
        </thead>
        <tbody>`;

      res.leaderboard.forEach((item) => {
        let rankBadge = item.rank;
        if (item.rank === 1) rankBadge = '🥇 1';
        if (item.rank === 2) rankBadge = '🥈 2';
        if (item.rank === 3) rankBadge = '🥉 3';

        html += `<tr class="${item.isUser ? 'user-highlight' : ''}">
          <td class="rank-col">${rankBadge}</td>
          <td class="username-col">${item.username} ${item.isUser ? '(YOU)' : ''}</td>
          <td class="score-col">${item.score.toLocaleString()}</td>
        </tr>`;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load friends leaderboard: ${err.message}</div>`;
    }
  }

  // Friends Flow
  openFriendsModal(tab = 'list') {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }
    this.openModal(this.friendsModal);
    if (tab === 'list') {
      this.renderFriendsListTab();
    } else if (tab === 'add') {
      this.renderAddFriendTab();
    } else {
      this.renderPendingRequestsTab();
    }
  }

  async renderFriendsListTab() {
    document.getElementById('fr-tab-list').classList.add('active');
    document.getElementById('fr-tab-add').classList.remove('active');
    document.getElementById('fr-tab-requests').classList.remove('active');

    document.getElementById('fr-section-list').classList.remove('hidden');
    document.getElementById('fr-section-add').classList.add('hidden');
    document.getElementById('fr-section-requests').classList.add('hidden');

    const container = document.getElementById('fr-list-container');
    container.innerHTML = `<div class="loading-spinner">Loading friends...</div>`;

    try {
      const res = await window.apiClient.getFriendsList();
      if (!res.friends || res.friends.length === 0) {
        container.innerHTML = `<div class="empty-state">You haven't added any friends yet.<br><br>Click <strong>+ Add Friend</strong> to search by username!</div>`;
        return;
      }

      let html = `<div class="friends-grid">`;
      res.friends.forEach((f) => {
        html += `
          <div class="friend-card">
            <div class="friend-info">
              <span class="friend-name">👤 ${f.username}</span>
              <span class="friend-score">Best: <strong>${f.best_score.toLocaleString()}</strong></span>
            </div>
            <button class="btn btn-challenge" onclick="uiManager.openSendChallengeModal('${f.id}', '${f.username}')">
              ⚔️ CHALLENGE
            </button>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load friends: ${err.message}</div>`;
    }
  }

  renderAddFriendTab() {
    document.getElementById('fr-tab-list').classList.remove('active');
    document.getElementById('fr-tab-add').classList.add('active');
    document.getElementById('fr-tab-requests').classList.remove('active');

    document.getElementById('fr-section-list').classList.add('hidden');
    document.getElementById('fr-section-add').classList.remove('hidden');
    document.getElementById('fr-section-requests').classList.add('hidden');
  }

  async handleFriendSearch() {
    const input = document.getElementById('friend-search-input');
    const query = input.value.trim();
    const container = document.getElementById('friend-search-results');

    if (!query) {
      this.showToast('Enter a username to search', 'error');
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Searching...</div>`;

    try {
      const res = await window.apiClient.searchUsers(query);
      if (!res.users || res.users.length === 0) {
        container.innerHTML = `<div class="empty-state">No users found matching "${query}"</div>`;
        return;
      }

      let html = `<div class="friends-grid">`;
      res.users.forEach((u) => {
        let actionBtn = '';
        if (u.relationship === 'FRIENDS') {
          actionBtn = `<span class="badge badge-success">Friends</span>`;
        } else if (u.relationship === 'SENT_PENDING') {
          actionBtn = `<span class="badge badge-warning">Request Sent</span>`;
        } else if (u.relationship === 'RECEIVED_PENDING') {
          actionBtn = `<span class="badge badge-info">Pending Approval</span>`;
        } else {
          actionBtn = `<button class="btn btn-sm btn-primary" onclick="uiManager.sendFriendRequest('${u.id}')">+ Add Friend</button>`;
        }

        html += `
          <div class="friend-card">
            <div class="friend-info">
              <span class="friend-name">👤 ${u.username}</span>
              <span class="friend-score">Best: ${u.best_score.toLocaleString()}</span>
            </div>
            ${actionBtn}
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Search error: ${err.message}</div>`;
    }
  }

  async sendFriendRequest(receiverId) {
    try {
      const res = await window.apiClient.sendFriendRequest(receiverId);
      this.showToast(res.message, 'success');
      this.handleFriendSearch(); // Refresh search view
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async renderPendingRequestsTab() {
    document.getElementById('fr-tab-list').classList.remove('active');
    document.getElementById('fr-tab-add').classList.remove('active');
    document.getElementById('fr-tab-requests').classList.add('active');

    document.getElementById('fr-section-list').classList.add('hidden');
    document.getElementById('fr-section-add').classList.add('hidden');
    document.getElementById('fr-section-requests').classList.remove('hidden');

    const container = document.getElementById('fr-requests-container');
    container.innerHTML = `<div class="loading-spinner">Loading requests...</div>`;

    try {
      const res = await window.apiClient.getPendingRequests();
      if (!res.requests || res.requests.length === 0) {
        container.innerHTML = `<div class="empty-state">No pending friend requests</div>`;
        return;
      }

      let html = `<div class="friends-grid">`;
      res.requests.forEach((req) => {
        html += `
          <div class="friend-card">
            <div class="friend-info">
              <span class="friend-name">👤 ${req.sender_username}</span>
              <span class="friend-score">Best: ${req.sender_score.toLocaleString()}</span>
            </div>
            <div class="req-actions">
              <button class="btn btn-sm btn-success" onclick="uiManager.respondRequest('${req.id}', 'ACCEPT')">ACCEPT</button>
              <button class="btn btn-sm btn-danger" onclick="uiManager.respondRequest('${req.id}', 'DECLINE')">DECLINE</button>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load requests: ${err.message}</div>`;
    }
  }

  async respondRequest(requestId, action) {
    try {
      const res = await window.apiClient.respondFriendRequest(requestId, action);
      this.showToast(res.message, 'success');
      this.renderPendingRequestsTab();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // CHALLENGES FLOW & MODAL MANAGEMENT
  // =========================================================================

  openSendChallengeModal(friendId, friendUsername) {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }

    this.targetChallengeFriend = { id: friendId, username: friendUsername };

    const myBest = window.apiClient.user.best_score || 0;
    const nameEl = document.getElementById('send-ch-opponent-name');
    const scoreEl = document.getElementById('send-ch-my-score');

    if (nameEl) nameEl.textContent = friendUsername;
    if (scoreEl) scoreEl.textContent = `${myBest.toLocaleString()} pts`;

    this.openModal(this.sendChallengeModal);
  }

  async confirmSendChallenge() {
    if (!this.targetChallengeFriend) return;

    const btn = document.getElementById('confirm-send-challenge-btn');
    if (btn) btn.disabled = true;

    try {
      const res = await window.apiClient.createChallenge(this.targetChallengeFriend.id);
      this.showToast(res.message || `⚔️ Challenge sent to ${this.targetChallengeFriend.username}!`, 'success');
      this.closeModal(this.sendChallengeModal);
      this.checkPendingNotifications();
    } catch (err) {
      this.showToast(err.message || 'Failed to send challenge', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  openChallengesModal(tab = 'incoming') {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }

    this.openModal(this.challengesModal);
    if (tab === 'incoming') {
      this.renderIncomingChallengesTab();
    } else if (tab === 'sent') {
      this.renderSentChallengesTab();
    } else {
      this.renderHistoryChallengesTab();
    }
  }

  async renderIncomingChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.add('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.remove('hidden');
    document.getElementById('ch-section-sent').classList.add('hidden');
    document.getElementById('ch-section-history').classList.add('hidden');

    const container = document.getElementById('ch-incoming-container');
    container.innerHTML = `<div class="loading-spinner">Loading incoming challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      this.checkPendingNotifications();

      const incoming = res.incoming || [];
      if (incoming.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 8px;">🛡️</div>
            <strong>No active incoming challenges!</strong><br>
            When friends challenge your high score, they will appear here.
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      incoming.forEach((ch) => {
        html += `
          <div class="challenge-card incoming">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge badge-incoming">⚔️ CHALLENGE</span>
                <h4 class="ch-name">From <strong>${ch.challengerUsername}</strong></h4>
              </div>
              <span class="ch-date">${this.formatRelativeTime(ch.createdAt)}</span>
            </div>
            <div class="ch-target-box">
              <span class="ch-target-lbl">SCORE TO BEAT</span>
              <span class="ch-target-val highlight">${ch.challengerScore.toLocaleString()} <small>pts</small></span>
            </div>
            <button class="btn btn-yellow-play btn-full ch-action-btn" onclick="uiManager.startIncomingChallenge('${ch.id}', '${ch.challengerUsername}', ${ch.challengerScore})">
              ⚔️ ACCEPT & PLAY NOW
            </button>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load challenges: ${err.message}</div>`;
    }
  }

  startIncomingChallenge(challengeId, challengerUsername, scoreToBeat) {
    this.closeModal(this.challengesModal);
    this.launchGame('one-hook', {
      id: challengeId,
      username: challengerUsername,
      scoreToBeat: scoreToBeat
    });
  }

  async renderSentChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.add('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-sent').classList.remove('hidden');
    document.getElementById('ch-section-history').classList.add('hidden');

    const container = document.getElementById('ch-sent-container');
    container.innerHTML = `<div class="loading-spinner">Loading sent challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      this.checkPendingNotifications();

      const sent = res.sent || [];
      if (sent.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 8px;">📤</div>
            <strong>No active sent challenges!</strong><br>
            Go to <strong>Friends</strong> tab and click <strong>⚔️ CHALLENGE</strong> on any friend.
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      sent.forEach((ch) => {
        html += `
          <div class="challenge-card sent">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge badge-waiting">⏳ WAITING</span>
                <h4 class="ch-name">Challenged <strong>${ch.opponentUsername}</strong></h4>
              </div>
              <span class="ch-date">${this.formatRelativeTime(ch.createdAt)}</span>
            </div>
            <div class="ch-details-row">
              <div class="ch-stat-mini">
                <span class="lbl">YOUR SCORE TO BEAT</span>
                <span class="val">${ch.challengerScore.toLocaleString()} pts</span>
              </div>
              <div class="ch-status-tag">Pending friend attempt</div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load sent challenges: ${err.message}</div>`;
    }
  }

  async renderHistoryChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.add('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-sent').classList.add('hidden');
    document.getElementById('ch-section-history').classList.remove('hidden');

    const container = document.getElementById('ch-history-container');
    container.innerHTML = `<div class="loading-spinner">Loading completed history...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      const completed = res.completed || [];
      const currentUserId = window.apiClient.user ? window.apiClient.user.id : null;

      if (completed.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 8px;">📜</div>
            <strong>No completed challenge history yet.</strong><br>
            Completed duels between you and your friends will show here.
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      completed.forEach((ch) => {
        const isWinner = ch.winnerId === currentUserId;
        const opponentName = ch.isIncoming ? ch.challengerUsername : ch.opponentUsername;
        const resultClass = isWinner ? 'win' : 'loss';
        const resultBadge = isWinner ? '🏆 YOU WON' : '❌ LOST';

        html += `
          <div class="challenge-card completed ${resultClass}">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge ${isWinner ? 'badge-won' : 'badge-lost'}">${resultBadge}</span>
                <h4 class="ch-name">vs <strong>${opponentName}</strong></h4>
              </div>
              <span class="ch-date">${this.formatRelativeTime(ch.createdAt)}</span>
            </div>
            <div class="ch-score-comparison">
              <div class="ch-compare-box">
                <span class="lbl">${ch.challengerUsername} (Target)</span>
                <span class="val">${ch.challengerScore.toLocaleString()} pts</span>
              </div>
              <div class="ch-compare-vs">VS</div>
              <div class="ch-compare-box">
                <span class="lbl">${ch.opponentUsername} (Score)</span>
                <span class="val highlight">${(ch.opponentScore || 0).toLocaleString()} pts</span>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load history: ${err.message}</div>`;
    }
  }

  formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return '';
    }
  }

  // Challenge Flow
  openChallengeModal(opponentId, username, bestScore) {
    this.selectedChallengeOpponent = {
      id: opponentId,
      username,
      scoreToBeat: bestScore
    };

    document.getElementById('ch-opponent-name').textContent = username;
    document.getElementById('ch-score-target').textContent = (bestScore || 0).toLocaleString();
    this.closeModal(this.friendsModal);
    this.openModal(this.challengeModal);
  }

  // Game Over Modal
  showGameOverModal(data) {
    document.getElementById('go-final-score').textContent = data.score.toLocaleString();
    document.getElementById('go-best-score').textContent = data.bestScore.toLocaleString();
    document.getElementById('go-level-reached').textContent = `LEVEL ${data.level}`;

    const newBestBanner = document.getElementById('go-new-best-banner');
    if (data.isNewBest) {
      newBestBanner.classList.remove('hidden');
      window.soundManager.playLevelUp();
    } else {
      newBestBanner.classList.add('hidden');
    }

    // Challenge mode result banner
    const chBanner = document.getElementById('go-challenge-result-banner');
    if (data.challengeResult) {
      chBanner.classList.remove('hidden');
      if (data.challengeResult.won) {
        chBanner.innerHTML = `
          <div class="challenge-win">
            🏆 <h3>YOU BEAT ${data.challengeResult.challengerUsername ? data.challengeResult.challengerUsername.toUpperCase() : 'YOUR FRIEND'}!</h3>
            <p>You: <strong>${data.challengeResult.scoreAchieved.toLocaleString()}</strong> pts | Target: ${data.challengeResult.targetScore.toLocaleString()} pts</p>
          </div>
        `;
      } else {
        chBanner.innerHTML = `
          <div class="challenge-loss">
            😤 <h3>SO CLOSE!</h3>
            <p>You: <strong>${data.challengeResult.scoreAchieved.toLocaleString()}</strong> pts | Target: ${data.challengeResult.targetScore.toLocaleString()} pts</p>
          </div>
        `;
      }
    } else {
      chBanner.classList.add('hidden');
    }

    this.openModal(this.gameOverModal);
  }
}

window.uiManager = new UIManager();

