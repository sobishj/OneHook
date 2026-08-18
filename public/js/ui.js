class UIManager {
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
    this.challengeModal = document.getElementById('challenge-modal');
    this.gameOverModal = document.getElementById('game-over-modal');

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
    document.getElementById('auth-submit-btn').addEventListener('click', () => this.handleAuthSubmit());
    document.getElementById('otp-verify-btn').addEventListener('click', () => this.handleOtpVerify());
    document.getElementById('auth-logout-btn').addEventListener('click', () => this.handleLogout());

    const backBtn = document.getElementById('otp-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        document.getElementById('auth-step-register').classList.remove('hidden');
        document.getElementById('auth-step-otp').classList.add('hidden');
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

    // Challenge Modal
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

    // Auto load session user
    this.refreshUserBadge();
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
      if (window.game) {
        window.game.bestScore = user.best_score || 0;
      }
      this.checkPendingNotifications();
    } else if (this.userBadge) {
      this.userBadge.innerHTML = `👤 <span>Sign In</span>`;
    }
  }

  async checkPendingNotifications() {
    if (!window.apiClient || !window.apiClient.user) return;
    try {
      const res = await window.apiClient.getPendingRequests();
      const count = res.requests ? res.requests.length : 0;
      const frBadge = document.getElementById('friends-pending-badge');
      const reqBadge = document.getElementById('requests-tab-badge');

      if (count > 0) {
        if (frBadge) { frBadge.textContent = count; frBadge.classList.remove('hidden'); }
        if (reqBadge) { reqBadge.textContent = count; reqBadge.classList.remove('hidden'); }
      } else {
        if (frBadge) frBadge.classList.add('hidden');
        if (reqBadge) reqBadge.classList.add('hidden');
      }
    } catch (e) {}
  }

  showHomeScreen() {
    window.location.hash = '/';
    if (this.portalNav) this.portalNav.classList.remove('hidden');
    this.homeScreen.classList.remove('hidden');
    this.hudScreen.classList.add('hidden');
    this.refreshUserBadge();
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
    this.hudLevel.textContent = `LEVEL ${data.level}`;

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
  openAuthModal() {
    const user = window.apiClient.user;
    if (user) {
      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.add('hidden');
      document.getElementById('auth-step-profile').classList.remove('hidden');

      document.getElementById('profile-username-display').textContent = user.username;
      document.getElementById('profile-email-display').textContent = user.email;
      document.getElementById('profile-best-score-display').textContent = (user.best_score || 0).toLocaleString();
    } else {
      document.getElementById('auth-step-register').classList.remove('hidden');
      document.getElementById('auth-step-otp').classList.add('hidden');
      document.getElementById('auth-step-profile').classList.add('hidden');
    }
    this.openModal(this.authModal);
  }

  handleLogout() {
    window.apiClient.logout();
    this.refreshUserBadge();
    this.closeModal(this.authModal);
    this.showToast('Logged out successfully', 'info');
  }

  async handleAuthSubmit() {
    const username = document.getElementById('auth-username').value.trim();
    const email = document.getElementById('auth-email').value.trim();

    if (!username || !email) {
      this.showToast('Please enter both username and email', 'error');
      return;
    }

    try {
      const res = await window.apiClient.register(username, email);
      this.pendingEmail = res.email;

      this.showToast(res.message || 'Verification code sent to your email!', 'success');

      const otpInput = document.getElementById('otp-code-input');
      if (otpInput) {
        otpInput.value = '';
        otpInput.focus();
      }

      document.getElementById('auth-step-register').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.remove('hidden');
      document.getElementById('otp-sent-email').textContent = res.email;
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
      this.showToast(`Welcome aboard, ${res.user.username}!`, 'success');
      this.closeModal(this.authModal);
      this.refreshUserBadge();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleResendOtp() {
    if (!this.pendingEmail) {
      this.showToast('Please enter your email again', 'error');
      document.getElementById('auth-step-register').classList.remove('hidden');
      document.getElementById('auth-step-otp').classList.add('hidden');
      return;
    }

    try {
      const username = document.getElementById('auth-username').value.trim() || 'Ethan';
      const res = await window.apiClient.register(username, this.pendingEmail);
      this.showToast('A new verification code has been sent to your email!', 'success');
      const otpInput = document.getElementById('otp-code-input');
      if (otpInput) {
        otpInput.value = '';
        otpInput.focus();
      }
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
            <button class="btn btn-challenge" onclick="uiManager.openChallengeModal('${f.id}', '${f.username}', ${f.best_score})">
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

  // Challenge Flow
  openChallengeModal(opponentId, username, bestScore) {
    this.selectedChallengeOpponent = {
      id: opponentId,
      username,
      scoreToBeat: bestScore
    };

    document.getElementById('ch-opponent-name').textContent = username;
    document.getElementById('ch-score-target').textContent = bestScore.toLocaleString();
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
            🏆 <h3>YOU BEAT ${data.challengeResult.opponentUsername.toUpperCase()}!</h3>
            <p>You: <strong>${data.challengeResult.scoreAchieved.toLocaleString()}</strong> | ${data.challengeResult.opponentUsername}: ${data.challengeResult.targetScore.toLocaleString()}</p>
          </div>
        `;
      } else {
        chBanner.innerHTML = `
          <div class="challenge-loss">
            😤 <h3>SO CLOSE!</h3>
            <p>You: <strong>${data.challengeResult.scoreAchieved.toLocaleString()}</strong> | Target: ${data.challengeResult.targetScore.toLocaleString()}</p>
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
