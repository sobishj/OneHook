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

    // Dashboard State
    this.selectedGameId = 'one-hook';
    this.selectedPanelTab = 'play';
    this.selectedLbTime = 'today';
    this.selectedFullLbScope = 'global';
    this.selectedFullLbTime = 'today';
    this.selectedChSubTab = 'friends';
    this.cachedFriendsForPanel = [];
    this.favoritedGames = new Set(['one-hook']);

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
    this.friendPickerModal = document.getElementById('friend-picker-modal');
    this.sendChallengeModal = document.getElementById('send-challenge-modal');
    this.challengeModal = document.getElementById('challenge-modal');
    this.gameOverModal = document.getElementById('game-over-modal');

    // Target friend and score
    this.pendingEmail = null;
    this.pendingNewEmail = null;
    this.targetChallengeFriend = null;
    this.targetChallengeScore = 0;
    this.activeChallengeScoreForFriends = null;
    this.activeChallengeScoreForPicker = 0;
    this.cachedFriendsForPicker = [];
    this.cachedChallengesForPicker = [];
    this.pendingChallengeFromNewGame = false;
    this.pendingChallengeTargetFriend = null;
    this.lastMatchScore = 0;

    // Toasts
    this.toastContainer = document.getElementById('toast-container');

    // Temporary storage for auth flow
    this.pendingEmail = '';

    // PWA Elements
    this.pwaInstallBtn = document.getElementById('pwa-install-btn');
    this.homeInstallCard = document.getElementById('home-install-card');
    this.homeInstallBtn = document.getElementById('home-install-btn');
    this.pwaInstallBanner = document.getElementById('pwa-install-banner');
    this.pwaBannerInstallBtn = document.getElementById('pwa-banner-install-btn');
    this.pwaBannerDismissBtn = document.getElementById('pwa-banner-dismiss-btn');
    this.pwaInstallModal = document.getElementById('pwa-install-modal');
    this.closePwaModalBtn = document.getElementById('close-pwa-modal-btn');
    this.pwaModalDirectInstallBtn = document.getElementById('pwa-modal-direct-install-btn');
    this.pwaDesktopInstallBtn = document.getElementById('pwa-desktop-install-action-btn');
    this.deferredInstallPrompt = null;

    this.initListeners();
    this.initPWA();
    this.renderFeaturedGames();
    this.renderGameDetailsPanel();
    this.initRouting();
  }

  initListeners() {
    // Logo Brand Home Navigation
    const brandLogo = document.getElementById('nav-brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('click', () => this.showHomeScreen());
    }

    // Sidebar Navigation Buttons
    const navHome = document.getElementById('nav-item-home');
    if (navHome) {
      navHome.addEventListener('click', () => this.showHomeScreen());
    }

    const navFriends = document.getElementById('nav-item-friends');
    if (navFriends) {
      navFriends.addEventListener('click', () => this.openFriendsModal('list'));
    }

    const navProfile = document.getElementById('nav-item-profile');
    if (navProfile) {
      navProfile.addEventListener('click', () => this.openAuthModal());
    }

    const sidebarUserCard = document.getElementById('sidebar-user-card');
    if (sidebarUserCard) {
      sidebarUserCard.addEventListener('click', () => this.openAuthModal());
    }

    // Mobile Sidebar Toggle & Backdrop
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebarEl = document.getElementById('sidebar-nav');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    const toggleSidebar = (forceClose = false) => {
      if (!sidebarEl) return;
      if (forceClose) {
        sidebarEl.classList.remove('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.add('hidden');
      } else {
        const isOpen = sidebarEl.classList.toggle('open');
        if (sidebarBackdrop) {
          if (isOpen) sidebarBackdrop.classList.remove('hidden');
          else sidebarBackdrop.classList.add('hidden');
        }
      }
    };

    if (mobileToggle) {
      mobileToggle.addEventListener('click', () => toggleSidebar());
    }

    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => toggleSidebar(true));
    }

    // Auto-close sidebar drawer when navigating on mobile
    [navHome, navFriends, navProfile].forEach(btn => {
      if (btn) btn.addEventListener('click', () => {
        if (window.innerWidth <= 768) toggleSidebar(true);
      });
    });

    // Game Details Panel Tabs
    const tabPlay = document.getElementById('panel-tab-play');
    if (tabPlay) tabPlay.addEventListener('click', () => this.setPanelTab('play'));

    const tabLb = document.getElementById('panel-tab-leaderboard');
    if (tabLb) tabLb.addEventListener('click', () => this.setPanelTab('leaderboard'));

    const tabCh = document.getElementById('panel-tab-challenges');
    if (tabCh) tabCh.addEventListener('click', () => this.setPanelTab('challenges'));

    // View All Buttons inside subcards
    const lbViewAll = document.getElementById('panel-lb-view-all-btn');
    if (lbViewAll) lbViewAll.addEventListener('click', () => this.setPanelTab('leaderboard'));

    const chViewAll = document.getElementById('panel-ch-view-all-btn');
    if (chViewAll) chViewAll.addEventListener('click', () => this.setPanelTab('challenges'));

    // Panel Action Buttons
    const panelPlayNowBtn = document.getElementById('panel-play-now-btn');
    if (panelPlayNowBtn) {
      panelPlayNowBtn.addEventListener('click', () => this.launchGame(this.selectedGameId));
    }

    const panelShareBtn = document.getElementById('panel-share-btn');
    if (panelShareBtn) {
      panelShareBtn.addEventListener('click', () => this.handleShareGame());
    }

    const panelFavBtn = document.getElementById('panel-fav-btn');
    if (panelFavBtn) {
      panelFavBtn.addEventListener('click', () => this.handleToggleFavorite());
    }

    const panelChHeroBtn = document.getElementById('panel-ch-hero-btn');
    if (panelChHeroBtn) {
      panelChHeroBtn.addEventListener('click', () => this.openFriendPickerModal());
    }

    const btnCreateFriendCh = document.getElementById('btn-create-friend-challenge');
    if (btnCreateFriendCh) {
      btnCreateFriendCh.addEventListener('click', () => this.openFriendPickerModal());
    }

    // Challenges Subtabs Bar
    document.querySelectorAll('.scope-tab-btn[data-ch-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.chTab;
        if (tab) this.setChallengesSubTab(tab);
      });
    });

    // Panel Challenges Friend Search
    const panelChSearch = document.getElementById('panel-ch-friend-search');
    if (panelChSearch) {
      panelChSearch.addEventListener('input', (e) => {
        this.filterPanelFriends(e.target.value);
      });
    }

    // Subcard Time Filter Pills
    document.querySelectorAll('.time-pill-btn[data-time]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const timeVal = e.currentTarget.dataset.time;
        this.selectedLbTime = timeVal;
        document.querySelectorAll('.time-pill-btn[data-time]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.renderPanelLeaderboardSnippet();
      });
    });

    // Full Leaderboard Scope & Time Tabs
    const fullGlobalTab = document.getElementById('panel-full-lb-global-tab');
    if (fullGlobalTab) {
      fullGlobalTab.addEventListener('click', () => {
        this.selectedFullLbScope = 'global';
        if (fullGlobalTab) fullGlobalTab.classList.add('active');
        const friendsTab = document.getElementById('panel-full-lb-friends-tab');
        if (friendsTab) friendsTab.classList.remove('active');
        this.renderFullLeaderboardView();
      });
    }

    const fullFriendsTab = document.getElementById('panel-full-lb-friends-tab');
    if (fullFriendsTab) {
      fullFriendsTab.addEventListener('click', () => {
        this.selectedFullLbScope = 'friends';
        if (fullFriendsTab) fullFriendsTab.classList.add('active');
        if (fullGlobalTab) fullGlobalTab.classList.remove('active');
        this.renderFullLeaderboardView();
      });
    }

    document.querySelectorAll('.time-pill-btn[data-full-time]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const timeVal = e.currentTarget.dataset.fullTime;
        this.selectedFullLbTime = timeVal;
        document.querySelectorAll('.time-pill-btn[data-full-time]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.renderFullLeaderboardView();
      });
    });

    // Exit HUD to Hub
    if (this.exitToHubBtn) {
      this.exitToHubBtn.addEventListener('click', () => this.showHomeScreen());
    }

    // Header Navigation Buttons (for legacy / shortcuts)
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

    // Profile Edit Listeners (Username & Email Change)
    const btnEditUsername = document.getElementById('btn-edit-username');
    if (btnEditUsername) {
      btnEditUsername.addEventListener('click', () => {
        const box = document.getElementById('profile-edit-username-box');
        const input = document.getElementById('profile-new-username-input');
        if (box) {
          const isHidden = box.classList.contains('hidden');
          if (isHidden) {
            box.classList.remove('hidden');
            if (input && window.apiClient.user) input.value = window.apiClient.user.username;
            setTimeout(() => input && input.focus(), 50);
          } else {
            box.classList.add('hidden');
          }
        }
        const emailBox = document.getElementById('profile-edit-email-box');
        if (emailBox) emailBox.classList.add('hidden');
      });
    }

    const btnCancelEditUsername = document.getElementById('btn-cancel-edit-username');
    if (btnCancelEditUsername) {
      btnCancelEditUsername.addEventListener('click', () => {
        const box = document.getElementById('profile-edit-username-box');
        if (box) box.classList.add('hidden');
      });
    }

    const btnSaveUsername = document.getElementById('btn-save-username');
    if (btnSaveUsername) {
      btnSaveUsername.addEventListener('click', () => this.handleSaveUsername());
    }

    const newUsernameInput = document.getElementById('profile-new-username-input');
    if (newUsernameInput) {
      newUsernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleSaveUsername();
      });
    }

    const btnEditEmail = document.getElementById('btn-edit-email');
    if (btnEditEmail) {
      btnEditEmail.addEventListener('click', () => {
        const box = document.getElementById('profile-edit-email-box');
        const input = document.getElementById('profile-new-email-input');
        if (box) {
          const isHidden = box.classList.contains('hidden');
          if (isHidden) {
            box.classList.remove('hidden');
            document.getElementById('profile-email-step-input').classList.remove('hidden');
            document.getElementById('profile-email-step-otp').classList.add('hidden');
            if (input) input.value = '';
            setTimeout(() => input && input.focus(), 50);
          } else {
            box.classList.add('hidden');
          }
        }
        const usernameBox = document.getElementById('profile-edit-username-box');
        if (usernameBox) usernameBox.classList.add('hidden');
      });
    }

    const btnCancelEditEmail = document.getElementById('btn-cancel-edit-email');
    if (btnCancelEditEmail) {
      btnCancelEditEmail.addEventListener('click', () => {
        const box = document.getElementById('profile-edit-email-box');
        if (box) box.classList.add('hidden');
      });
    }

    const btnCancelEmailOtp = document.getElementById('btn-cancel-email-otp');
    if (btnCancelEmailOtp) {
      btnCancelEmailOtp.addEventListener('click', () => {
        const box = document.getElementById('profile-edit-email-box');
        if (box) box.classList.add('hidden');
      });
    }

    const btnSendEmailOtp = document.getElementById('btn-send-email-otp');
    if (btnSendEmailOtp) {
      btnSendEmailOtp.addEventListener('click', () => this.handleRequestEmailChange());
    }

    const btnResendNewEmailOtp = document.getElementById('btn-resend-new-email-otp');
    if (btnResendNewEmailOtp) {
      btnResendNewEmailOtp.addEventListener('click', () => this.handleRequestEmailChange());
    }

    const btnVerifyNewEmail = document.getElementById('btn-verify-new-email');
    if (btnVerifyNewEmail) {
      btnVerifyNewEmail.addEventListener('click', () => this.handleVerifyEmailChange());
    }

    const newEmailInput = document.getElementById('profile-new-email-input');
    if (newEmailInput) {
      newEmailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleRequestEmailChange();
      });
    }

    const emailOtpInput = document.getElementById('profile-email-otp-input');
    if (emailOtpInput) {
      emailOtpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleVerifyEmailChange();
      });
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

    // Challenges Hub Tabs & Actions
    const closeChBtn = document.getElementById('close-challenges-btn');
    if (closeChBtn) closeChBtn.addEventListener('click', () => this.closeModal(this.challengesModal));

    const chHeroBtn = document.getElementById('ch-hero-challenge-btn');
    if (chHeroBtn) chHeroBtn.addEventListener('click', () => this.openFriendPickerModal());

    const chTabInc = document.getElementById('ch-tab-incoming');
    if (chTabInc) chTabInc.addEventListener('click', () => this.renderIncomingChallengesTab());

    const chTabWon = document.getElementById('ch-tab-won');
    if (chTabWon) chTabWon.addEventListener('click', () => this.renderWonChallengesTab());

    const chTabLost = document.getElementById('ch-tab-lost');
    if (chTabLost) chTabLost.addEventListener('click', () => this.renderLostChallengesTab());

    const chTabSent = document.getElementById('ch-tab-sent');
    if (chTabSent) chTabSent.addEventListener('click', () => this.renderSentChallengesTab());

    const chTabHist = document.getElementById('ch-tab-history');
    if (chTabHist) chTabHist.addEventListener('click', () => this.renderHistoryChallengesTab());

    // Friend Picker Modal Handlers
    const closeFpBtn = document.getElementById('close-friend-picker-btn');
    if (closeFpBtn) closeFpBtn.addEventListener('click', () => this.closeModal(this.friendPickerModal));

    const fpSearchInput = document.getElementById('fp-search-input');
    if (fpSearchInput) {
      fpSearchInput.addEventListener('input', (e) => this.filterFriendPicker(e.target.value));
    }

    // Send Challenge Modal Handlers
    const closeSendChBtn = document.getElementById('close-send-challenge-btn');
    if (closeSendChBtn) closeSendChBtn.addEventListener('click', () => this.closeModal(this.sendChallengeModal));

    const cancelSendChBtn = document.getElementById('cancel-send-challenge-btn');
    if (cancelSendChBtn) cancelSendChBtn.addEventListener('click', () => this.closeModal(this.sendChallengeModal));

    const confirmSendChBtn = document.getElementById('confirm-send-challenge-btn');
    if (confirmSendChBtn) confirmSendChBtn.addEventListener('click', () => this.confirmSendChallenge());

    const sendChNewGameBtn = document.getElementById('send-ch-new-game-btn');
    if (sendChNewGameBtn) {
      sendChNewGameBtn.addEventListener('click', () => {
        if (!this.targetChallengeFriend) return;
        this.pendingChallengeTargetFriend = {
          id: this.targetChallengeFriend.id,
          username: this.targetChallengeFriend.username
        };
        this.closeModal(this.sendChallengeModal);
        this.launchGame('one-hook');
      });
    }

    // Retry Challenge from Game Over Modal
    const retryChBtn = document.getElementById('retry-challenge-btn');
    if (retryChBtn) {
      retryChBtn.addEventListener('click', () => {
        this.closeModal(this.gameOverModal);
        if (this.lastFailedChallengeContext) {
          this.startIncomingChallenge(
            this.lastFailedChallengeContext.id,
            this.lastFailedChallengeContext.username,
            this.lastFailedChallengeContext.scoreToBeat
          );
        }
      });
    }

    // Challenge Friends with current match score from Game Over Modal
    const goChallengeFriendsBtn = document.getElementById('go-challenge-friends-btn');
    if (goChallengeFriendsBtn) {
      goChallengeFriendsBtn.addEventListener('click', () => {
        if (!window.apiClient.user) {
          this.openAuthModal();
          return;
        }
        this.closeModal(this.gameOverModal);
        this.openFriendsModal('list', this.lastMatchScore);
      });
    }

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
  // GAME HUB - REUSABLE GAME CARDS & GAME-SPECIFIC DETAILS PANEL
  // =========================================================================
  renderFeaturedGames() {
    const grid = document.getElementById('games-grid');
    if (!grid || !window.GAMES_DATA) return;

    grid.innerHTML = window.GAMES_DATA.map(game => this.createGameCardHtml(game)).join('');
  }

  createGameCardHtml(game) {
    const isNew = game.badge === 'NEW';
    const badgeClass = isNew ? 'badge-new' : 'badge-soon';
    const isSelected = this.selectedGameId === game.id;
    const selectedClass = isSelected ? 'selected' : '';

    const stats = game.stats || { topScore: '--', players: '0', challengesCount: 0 };
    const userBest = (game.id === 'one-hook' && window.apiClient && window.apiClient.user)
      ? (window.apiClient.user.best_score || stats.topScore)
      : stats.topScore;

    // Star Quest lives on its own separate page (not an in-page panel like
    // One Hook), so its card navigates via a normal link instead of
    // uiManager.selectGame(). This is the ONLY place that branches on
    // game.id in this function — everything else about the card template
    // stays shared and untouched.
    const isStarQuest = game.id === 'star-quest';
    const playClick = isStarQuest ? "window.location.href='/star-quest'" : `uiManager.launchGame('${game.id}')`;
    const cardClick = isStarQuest ? "window.location.href='/star-quest'" : `uiManager.selectGame('${game.id}')`;

    const actionButtons = game.isPlayable
      ? `
        <div class="game-card-actions-row">
          <button class="btn-card-action btn-play" onclick="event.stopPropagation(); ${playClick}">
            ▶ Play Now
          </button>
          ${isStarQuest ? '' : `
          <div class="card-extra-actions">
            <button class="btn-card-extra btn-extra-lb" onclick="event.stopPropagation(); uiManager.openLeaderboardModal('global')" title="Leaderboard">
              🏆 Leaderboard
            </button>
            <button class="btn-card-extra btn-extra-ch" onclick="event.stopPropagation(); uiManager.openChallengesModal('incoming')" title="Challenges">
              🎯 Challenges
            </button>
          </div>`}
        </div>
      `
      : `
        <div class="game-card-actions-row">
          <button class="btn-card-action btn-soon" disabled>Coming Soon</button>
        </div>
      `;

    return `
      <article class="game-card ${selectedClass}" data-game-id="${game.id}" onclick="${cardClick}">
        <div class="game-card-art-wrap">
          <img src="${game.image}" alt="${game.title}" class="game-card-art" loading="lazy">
          <span class="game-card-badge ${badgeClass}">${game.badge}</span>
        </div>
        <div class="game-card-body">
          <h3 class="game-card-title">${game.title}</h3>
          <p class="game-card-desc">${game.description}</p>
          <div class="game-stats-row">
            <div class="stat-item">
              <span>🏆</span>
              <span class="stat-val">${userBest}</span>
              <small style="color: #64748b; margin-left: 2px;">Top Score</small>
            </div>
            <div class="stat-item">
              <span>👥</span>
              <span class="stat-val">${stats.players}</span>
              <small style="color: #64748b; margin-left: 2px;">Players</small>
            </div>
            <div class="stat-item">
              <span>🎯</span>
              <span class="stat-val">${stats.challengesCount}</span>
              <small style="color: #64748b; margin-left: 2px;">Challenges</small>
            </div>
          </div>
          <div class="game-card-actions">
            ${actionButtons}
          </div>
        </div>
      </article>
    `;
  }

  selectGame(gameId) {
    this.selectedGameId = gameId;
    this.renderFeaturedGames();
    this.renderGameDetailsPanel();
  }

  setPanelTab(tabName) {
    this.selectedPanelTab = tabName;

    // Update tab header buttons
    const tabs = ['play', 'leaderboard', 'challenges'];
    tabs.forEach(t => {
      const btn = document.getElementById(`panel-tab-${t}`);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }

      const view = document.getElementById(`panel-view-${t}`);
      if (view) {
        if (t === tabName) view.classList.remove('hidden');
        else view.classList.add('hidden');
      }
    });

    // Render corresponding tab view
    if (tabName === 'play') {
      this.renderPanelPlayView();
    } else if (tabName === 'leaderboard') {
      this.renderFullLeaderboardView();
    } else if (tabName === 'challenges') {
      this.renderFullChallengesView();
    }
  }

  renderGameDetailsPanel() {
    const game = window.GAMES_DATA ? window.GAMES_DATA.find(g => g.id === this.selectedGameId) : null;
    if (!game) return;

    // Header updates
    const thumbEl = document.getElementById('panel-game-thumb');
    if (thumbEl) thumbEl.src = game.image;

    const titleEl = document.getElementById('panel-game-title');
    if (titleEl) titleEl.textContent = game.title;

    const subEl = document.getElementById('panel-game-sub');
    if (subEl) subEl.textContent = game.subtitle || game.description;

    const favBtn = document.getElementById('panel-fav-btn');
    if (favBtn) {
      if (this.favoritedGames.has(game.id)) {
        favBtn.classList.add('active');
        favBtn.innerHTML = '❤️';
      } else {
        favBtn.classList.remove('active');
        favBtn.innerHTML = '♡';
      }
    }

    // Play view & full views
    this.renderPanelPlayView();
    if (this.selectedPanelTab === 'leaderboard') {
      this.renderFullLeaderboardView();
    } else if (this.selectedPanelTab === 'challenges') {
      this.renderFullChallengesView();
    }
  }

  renderPanelPlayView() {
    const game = window.GAMES_DATA ? window.GAMES_DATA.find(g => g.id === this.selectedGameId) : null;
    if (!game) return;

    // 1. Your Best Score
    const bestNumEl = document.getElementById('panel-best-score-num');
    let userScore = 0;
    if (window.apiClient && window.apiClient.user && game.id === 'one-hook') {
      userScore = window.apiClient.user.best_score || 0;
    } else {
      userScore = parseInt(localStorage.getItem('onehook_best_score') || '0', 10);
    }
    if (bestNumEl) bestNumEl.textContent = userScore.toLocaleString();

    const playBtn = document.getElementById('panel-play-now-btn');
    if (playBtn) {
      if (game.isPlayable) {
        playBtn.innerHTML = `<span class="play-icon-glyph">▶</span> Play Now`;
        playBtn.removeAttribute('disabled');
        playBtn.style.opacity = '1';
        playBtn.style.cursor = 'pointer';
      } else {
        playBtn.innerHTML = `Coming Soon`;
        playBtn.setAttribute('disabled', 'true');
        playBtn.style.opacity = '0.6';
        playBtn.style.cursor = 'not-allowed';
      }
    }

    // 2. Leaderboard Snippet
    this.renderPanelLeaderboardSnippet();

    // 3. Challenges / Level Progression Snippet
    this.renderPanelChallengesSnippet();
  }

  async renderPanelLeaderboardSnippet() {
    const container = document.getElementById('panel-lb-rows-container');
    if (!container) return;

    container.innerHTML = `<div class="loading-spinner" style="padding: 10px; font-size: 0.8rem; color: #64748b; text-align: center;">Loading leaderboard...</div>`;

    const game = window.GAMES_DATA ? window.GAMES_DATA.find(g => g.id === this.selectedGameId) : null;
    if (!game || !game.isPlayable) {
      container.innerHTML = `<div style="padding: 14px; font-size: 0.8rem; color: #64748b; text-align: center;">Leaderboard opens when game launches.</div>`;
      return;
    }

    try {
      const res = await window.apiClient.getGlobalLeaderboard();
      const list = res.leaderboard || [];

      if (list.length === 0) {
        container.innerHTML = `<div style="padding: 14px; font-size: 0.8rem; color: #64748b; text-align: center;">No scores recorded yet. Be the first!</div>`;
        return;
      }

      const loggedUser = window.apiClient ? window.apiClient.user : null;
      let html = '';
      list.slice(0, 4).forEach((item, index) => {
        let rankIcon = `#${index + 1}`;
        if (index === 0) rankIcon = '🥇';
        else if (index === 1) rankIcon = '🥈';
        else if (index === 2) rankIcon = '🥉';

        const isYou = loggedUser && item.username.toLowerCase() === loggedUser.username.toLowerCase();
        const displayName = isYou ? `${item.username} (You)` : item.username;
        const rowClass = isYou ? 'lb-snippet-row user-row' : 'lb-snippet-row';

        html += `
          <div class="${rowClass}">
            <div class="lb-snippet-left">
              <span class="lb-rank-badge">${rankIcon}</span>
              <span class="lb-user-name">${displayName}</span>
            </div>
            <span class="lb-user-score">${(item.best_score || item.score || 0).toLocaleString()}</span>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div style="padding: 10px; font-size: 0.78rem; color: #94a3b8; text-align: center;">Scores update after first game.</div>`;
    }
  }

  renderPanelChallengesSnippet() {
    const container = document.getElementById('panel-ch-rows-container');
    if (!container) return;

    const game = window.GAMES_DATA ? window.GAMES_DATA.find(g => g.id === this.selectedGameId) : null;
    if (!game) return;

    const challenges = game.challenges || [];
    if (challenges.length === 0) {
      container.innerHTML = `<div style="padding: 14px; font-size: 0.8rem; color: #64748b; text-align: center;">Challenges coming soon!</div>`;
      return;
    }

    let html = '';
    challenges.slice(0, 3).forEach(ch => {
      const progressPercent = ch.max > 0 ? Math.min(100, Math.round((ch.progress / ch.max) * 100)) : 0;

      html += `
        <div class="ch-snippet-row">
          <div class="ch-icon-box" style="background: ${ch.iconBg || '#0284c7'};">
            ${ch.icon}
          </div>
          <div class="ch-details-col">
            <div class="ch-title-row">
              <span>${ch.title}</span>
            </div>
            <div class="ch-desc-text">${ch.desc}</div>
            <div class="ch-progress-wrap">
              <div class="ch-progress-bar">
                <div class="ch-progress-fill" style="width: ${progressPercent}%;"></div>
              </div>
              <span class="ch-progress-text">${ch.progress}/${ch.max}</span>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async renderFullLeaderboardView() {
    const container = document.getElementById('panel-full-lb-container');
    if (!container) return;

    const isFriends = this.selectedFullLbScope === 'friends';

    if (isFriends && (!window.apiClient || !window.apiClient.user)) {
      container.innerHTML = `
        <div style="padding: 32px; text-align: center; color: #64748b;">
          <p style="margin-bottom: 12px; font-size: 0.95rem; color: #0f172a; font-weight: 700;">Sign in to compete with your friends on the leaderboard!</p>
          <button class="btn btn-primary btn-sm" onclick="uiManager.openAuthModal()">SIGN IN / REGISTER</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="loading-spinner" style="padding: 24px; text-align: center; color: #64748b;">Loading leaderboard...</div>`;

    try {
      const res = isFriends
        ? await window.apiClient.getFriendsLeaderboard()
        : await window.apiClient.getGlobalLeaderboard();

      const list = res.leaderboard || [];
      if (list.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 32px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 6px;">🏆</div>
            <strong style="color: #0f172a;">No scores recorded yet!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Play a game of One Hook to set the first score!</span>
          </div>
        `;
        return;
      }

      const loggedUser = window.apiClient ? window.apiClient.user : null;
      let html = `<table class="lb-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 0.75rem; text-align: left;">
            <th style="padding: 10px 14px;">RANK</th>
            <th style="padding: 10px 14px;">PLAYER</th>
            <th style="padding: 10px 14px; text-align: right;">BEST SCORE</th>
          </tr>
        </thead>
        <tbody>`;

      list.forEach((item, index) => {
        let rankIcon = `#${index + 1}`;
        if (index === 0) rankIcon = '🥇 1';
        else if (index === 1) rankIcon = '🥈 2';
        else if (index === 2) rankIcon = '🥉 3';

        const isYou = loggedUser && item.username.toLowerCase() === loggedUser.username.toLowerCase();
        const displayName = isYou ? `${item.username} (YOU)` : item.username;
        const rowStyle = isYou
          ? 'background: #e0f2fe; font-weight: 800; color: #0369a1;'
          : 'border-bottom: 1px solid #f1f5f9; color: #1e293b;';

        html += `
          <tr style="${rowStyle}">
            <td style="padding: 10px 14px; font-weight: 800;">${rankIcon}</td>
            <td style="padding: 10px 14px;">👤 ${displayName}</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #0284c7;">${(item.best_score || item.score || 0).toLocaleString()}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state" style="padding: 24px; text-align: center;">Failed to load leaderboard: ${err.message}</div>`;
    }
  }

  renderFullChallengesView() {
    const heroScoreEl = document.getElementById('panel-ch-hero-score');
    let userBest = 0;
    if (window.apiClient && window.apiClient.user) {
      userBest = window.apiClient.user.best_score || 0;
    } else {
      userBest = parseInt(localStorage.getItem('onehook_best_score') || '0', 10);
    }

    if (heroScoreEl) {
      heroScoreEl.textContent = `${userBest.toLocaleString()} pts`;
    }

    this.setChallengesSubTab(this.selectedChSubTab || 'friends');
    this.refreshChallengeBadges();
  }

  async refreshChallengeBadges() {
    if (!window.apiClient || !window.apiClient.user) return;
    try {
      const res = await window.apiClient.getChallengesList().catch(() => null);
      if (!res) return;

      const incomingBadge = document.getElementById('panel-ch-incoming-badge');
      const incomingCount = (res.incoming || []).length;
      if (incomingBadge) {
        if (incomingCount > 0) {
          incomingBadge.textContent = incomingCount;
          incomingBadge.classList.remove('hidden');
        } else {
          incomingBadge.classList.add('hidden');
        }
      }

      const wonBadge = document.getElementById('panel-ch-won-badge');
      const wonCount = (res.won || []).length;
      if (wonBadge) {
        if (wonCount > 0) {
          wonBadge.textContent = wonCount;
          wonBadge.classList.remove('hidden');
        } else {
          wonBadge.classList.add('hidden');
        }
      }

      const lostBadge = document.getElementById('panel-ch-lost-badge');
      const lostCount = (res.lost || []).length;
      if (lostBadge) {
        if (lostCount > 0) {
          lostBadge.textContent = lostCount;
          lostBadge.classList.remove('hidden');
        } else {
          lostBadge.classList.add('hidden');
        }
      }

      const sentBadge = document.getElementById('panel-ch-sent-badge');
      const sentCount = (res.sent || []).length;
      if (sentBadge) {
        if (sentCount > 0) {
          sentBadge.textContent = sentCount;
          sentBadge.classList.remove('hidden');
        } else {
          sentBadge.classList.add('hidden');
        }
      }
    } catch (err) {
      console.warn('Failed to refresh challenge badges:', err);
    }
  }

  setChallengesSubTab(subTabName) {
    this.selectedChSubTab = subTabName;

    // Toggle sub-tab active classes
    document.querySelectorAll('.panel-ch-subtabs-bar .scope-tab-btn').forEach(btn => {
      if (btn.dataset.chTab === subTabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hide all subviews and show the selected one
    document.querySelectorAll('#panel-view-challenges .ch-subview').forEach(view => {
      view.classList.add('hidden');
    });

    const targetView = document.getElementById(`ch-subview-${subTabName}`);
    if (targetView) targetView.classList.remove('hidden');

    if (subTabName === 'friends') {
      this.renderPanelFriendsSubTab();
    } else if (subTabName === 'incoming') {
      this.renderPanelIncomingSubTab();
    } else if (subTabName === 'won') {
      this.renderPanelWonSubTab();
    } else if (subTabName === 'lost') {
      this.renderPanelLostSubTab();
    } else if (subTabName === 'sent') {
      this.renderPanelSentSubTab();
    }
  }

  async renderPanelFriendsSubTab() {
    const grid = document.getElementById('panel-ch-friends-grid');
    if (!grid) return;

    if (!window.apiClient || !window.apiClient.user) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: span 2; padding: 28px; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 8px;">👤</div>
          <strong style="color: #0f172a;">Sign in to Challenge Friends</strong><br>
          <span style="color: #64748b; font-size: 0.85rem;">Create a player profile to add friends, send challenges, and compete!</span><br>
          <button class="btn btn-sm btn-primary" onclick="uiManager.openAuthModal()" style="margin-top: 12px;">Sign In / Register</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = `<div class="loading-spinner" style="grid-column: span 2; padding: 20px; text-align: center; color: #64748b;">Loading friends...</div>`;

    try {
      const [fRes, chRes] = await Promise.all([
        window.apiClient.getFriendsList().catch(() => ({ friends: [] })),
        window.apiClient.getChallengesList().catch(() => ({ challenges: [] }))
      ]);

      const friendsList = fRes.friends || [];
      const challengesList = chRes.challenges || [];

      this.cachedFriendsForPanel = friendsList;
      this.cachedChallengesForPanel = challengesList;
      this.renderPanelFriendsList(friendsList);
    } catch (err) {
      grid.innerHTML = `<div class="error-state" style="grid-column: span 2;">Failed to load friends: ${err.message}</div>`;
    }
  }

  renderPanelFriendsList(friends) {
    const grid = document.getElementById('panel-ch-friends-grid');
    if (!grid) return;

    if (!friends || friends.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: span 2; padding: 28px; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 8px;">👥</div>
          <strong style="color: #0f172a;">No friends added yet!</strong><br>
          <span style="color: #64748b; font-size: 0.85rem;">Find friends by username to challenge them to a match!</span><br>
          <button class="btn btn-sm btn-primary" onclick="uiManager.openFriendsModal('find')" style="margin-top: 12px;">➕ Find & Add Friends</button>
        </div>
      `;
      return;
    }

    const myBest = (window.apiClient && window.apiClient.user)
      ? (window.apiClient.user.best_score || 0)
      : parseInt(localStorage.getItem('onehook_best_score') || '0', 10);

    let html = '';
    friends.forEach(f => {
      const initials = (f.username || 'F').substring(0, 2).toUpperCase();
      const bestScore = f.best_score || 0;
      const isBeatMe = bestScore > myBest;

      const isPending = (this.cachedChallengesForPanel || []).some(
        ch => ch.opponent_id === f.id && ch.challenger_score === myBest && ch.status === 'PENDING'
      );

      let actionBtnHtml = '';
      if (isPending) {
        actionBtnHtml = `<button class="btn btn-sm" disabled style="background: #f1f5f9; color: #94a3b8; border: 1px solid #cbd5e1; cursor: not-allowed;">⏳ Pending</button>`;
      } else if (isBeatMe && myBest > 0) {
        actionBtnHtml = `<button class="btn btn-sm btn-yellow-play" onclick="uiManager.selectFriendToChallenge('${f.id}', '${f.username}', ${bestScore})">🔥 Beat Me</button>`;
      } else {
        actionBtnHtml = `<button class="btn btn-sm btn-challenge" onclick="uiManager.selectFriendToChallenge('${f.id}', '${f.username}', ${bestScore})">⚔️ Challenge</button>`;
      }

      html += `
        <div class="panel-friend-card">
          <div class="panel-friend-info">
            <div class="panel-friend-avatar">${initials}</div>
            <div class="panel-friend-details">
              <span class="panel-friend-name">${f.username}</span>
              <span class="panel-friend-score">🏆 Best: <strong>${bestScore.toLocaleString()} pts</strong></span>
            </div>
          </div>
          <div>
            ${actionBtnHtml}
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  }

  filterPanelFriends(query) {
    if (!this.cachedFriendsForPanel) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderPanelFriendsList(this.cachedFriendsForPanel);
      return;
    }
    const filtered = this.cachedFriendsForPanel.filter(f =>
      (f.username || '').toLowerCase().includes(q)
    );
    this.renderPanelFriendsList(filtered);
  }

  async renderPanelIncomingSubTab() {
    const container = document.getElementById('panel-ch-incoming-list');
    if (!container) return;

    if (!window.apiClient || !window.apiClient.user) {
      container.innerHTML = `
        <div style="padding: 28px; text-align: center; color: #64748b;">
          <p style="margin-bottom: 10px; color: #0f172a; font-weight: 700;">Sign in to see incoming challenges from friends!</p>
          <button class="btn btn-primary btn-sm" onclick="uiManager.openAuthModal()">SIGN IN / REGISTER</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Loading incoming challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      const incoming = res.incoming || [];

      if (incoming.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 24px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 6px;">🛡️</div>
            <strong style="color: #0f172a;">No unattempted incoming challenges!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">When friends challenge your score, they'll show up here!</span>
          </div>
        `;
        return;
      }

      let html = '';
      incoming.forEach(ch => {
        html += `
          <div class="panel-friend-card" style="border-left: 4px solid #0284c7;">
            <div class="panel-friend-info">
              <div class="panel-friend-avatar" style="background: #fef3c7; color: #d97706; border-color: #f59e0b;">⚔️</div>
              <div class="panel-friend-details">
                <span class="panel-friend-name">From <strong>${ch.challengerUsername}</strong></span>
                <span class="panel-friend-score">Score to beat: <strong style="color: #0284c7; font-size: 1rem;">${ch.challengerScore.toLocaleString()} pts</strong></span>
              </div>
            </div>
            <button class="btn btn-sm btn-yellow-play" onclick="uiManager.startIncomingChallenge('${ch.id}', '${ch.challengerUsername}', ${ch.challengerScore})">
              ⚔️ ACCEPT & PLAY
            </button>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load incoming challenges: ${err.message}</div>`;
    }
  }

  async renderPanelWonSubTab() {
    const container = document.getElementById('panel-ch-won-list');
    if (!container) return;

    if (!window.apiClient || !window.apiClient.user) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b;">Sign in to view your challenge victories!</div>`;
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Loading won challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      const won = res.won || [];

      if (won.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 24px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 6px;">🏆</div>
            <strong style="color: #0f172a;">No won challenges yet!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Accept incoming challenges and beat their target scores to earn victories!</span>
          </div>
        `;
        return;
      }

      let html = '';
      won.forEach(ch => {
        html += `
          <div class="panel-friend-card" style="border-left: 4px solid #10b981;">
            <div class="panel-friend-info">
              <div class="panel-friend-avatar" style="background: #d1fae5; color: #059669; border-color: #34d399;">🏆</div>
              <div class="panel-friend-details">
                <span class="panel-friend-name">Victory vs <strong>${ch.challengerUsername}</strong></span>
                <span class="panel-friend-score">Your Score: <strong style="color: #059669;">${ch.opponentScore ? ch.opponentScore.toLocaleString() : 'Won'} pts</strong> (Beat ${ch.challengerScore.toLocaleString()})</span>
              </div>
            </div>
            <button class="btn btn-sm btn-challenge" onclick="uiManager.openSendChallengeModal('${ch.challengerId}', '${ch.challengerUsername}')">
              ⚔️ Rematch
            </button>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load won challenges: ${err.message}</div>`;
    }
  }

  async renderPanelLostSubTab() {
    const container = document.getElementById('panel-ch-lost-list');
    if (!container) return;

    if (!window.apiClient || !window.apiClient.user) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b;">Sign in to view your challenges!</div>`;
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Loading lost challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      const lost = res.lost || [];

      if (lost.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 24px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 6px;">✨</div>
            <strong style="color: #0f172a;">No failed challenges!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">All your completed challenges were successful.</span>
          </div>
        `;
        return;
      }

      let html = '';
      lost.forEach(ch => {
        html += `
          <div class="panel-friend-card" style="border-left: 4px solid #ef4444;">
            <div class="panel-friend-info">
              <div class="panel-friend-avatar" style="background: #fee2e2; color: #dc2626; border-color: #f87171;">❌</div>
              <div class="panel-friend-details">
                <span class="panel-friend-name">Lost vs <strong>${ch.challengerUsername}</strong></span>
                <span class="panel-friend-score">Target to beat: <strong style="color: #ef4444;">${ch.challengerScore.toLocaleString()} pts</strong></span>
              </div>
            </div>
            <button class="btn btn-sm btn-yellow-play" onclick="uiManager.startIncomingChallenge('${ch.id}', '${ch.challengerUsername}', ${ch.challengerScore})">
              🔄 Retry Now
            </button>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load lost challenges: ${err.message}</div>`;
    }
  }

  async renderPanelSentSubTab() {
    const container = document.getElementById('panel-ch-sent-list');
    if (!container) return;

    if (!window.apiClient || !window.apiClient.user) {
      container.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b;">Sign in to view sent challenges!</div>`;
      return;
    }

    container.innerHTML = `<div class="loading-spinner">Loading sent challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      const sent = res.sent || [];

      if (sent.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 24px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 6px;">📤</div>
            <strong style="color: #0f172a;">No sent challenges pending!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Challenge your friends from the Friends tab to see them here.</span>
          </div>
        `;
        return;
      }

      let html = '';
      sent.forEach(ch => {
        html += `
          <div class="panel-friend-card">
            <div class="panel-friend-info">
              <div class="panel-friend-avatar">📤</div>
              <div class="panel-friend-details">
                <span class="panel-friend-name">To <strong>${ch.opponentUsername}</strong></span>
                <span class="panel-friend-score">Your Score: <strong>${ch.challengerScore.toLocaleString()} pts</strong></span>
              </div>
            </div>
            <span class="status-pill status-pending">⏳ Waiting</span>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load sent challenges: ${err.message}</div>`;
    }
  }

  handleShareGame() {
    const game = window.GAMES_DATA ? window.GAMES_DATA.find(g => g.id === this.selectedGameId) : null;
    const title = game ? game.title : 'SprintGames';
    const shareUrl = window.location.origin + (game ? game.route : '/');

    if (navigator.share) {
      navigator.share({
        title: `Play ${title} on SprintGames!`,
        text: `Check out ${title} - can you beat my high score?`,
        url: shareUrl
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.showToast(`🔗 Link copied to clipboard for ${title}!`, 'success');
      }).catch(() => {
        this.showToast(`Share URL: ${shareUrl}`, 'info');
      });
    } else {
      this.showToast(`Share URL: ${shareUrl}`, 'info');
    }
  }

  handleToggleFavorite() {
    const favBtn = document.getElementById('panel-fav-btn');
    if (this.favoritedGames.has(this.selectedGameId)) {
      this.favoritedGames.delete(this.selectedGameId);
      if (favBtn) {
        favBtn.classList.remove('active');
        favBtn.innerHTML = '♡';
      }
      this.showToast('Removed from favorites', 'info');
    } else {
      this.favoritedGames.add(this.selectedGameId);
      if (favBtn) {
        favBtn.classList.add('active');
        favBtn.innerHTML = '❤️';
      }
      this.showToast('Added to your favorite games! ⭐', 'success');
    }
  }

  launchGame(gameId, challengeContext = null) {
    if (gameId === 'one-hook') {
      this.isRoutingBypass = true;
      window.location.hash = '/games/one-hook';
      this.homeScreen.classList.add('hidden');
      if (this.portalNav) this.portalNav.classList.add('hidden');
      this.showInGameHUD();
      if (window.game) {
        window.game.startNewGame(challengeContext);
      }
      setTimeout(() => { this.isRoutingBypass = false; }, 200);
    } else {
      this.showToast('🎮 Game coming soon to SprintGames!', 'info');
    }
  }

  initRouting() {
    const checkRoute = () => {
      if (this.isRoutingBypass) return; // Prevent overwriting active challenge context on launch
      const path = window.location.hash || window.location.pathname;
      if (path.includes('/games/one-hook')) {
        if (!window.game || window.game.state === 'MENU') {
          this.launchGame('one-hook');
        }
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
    const sidebarNameEl = document.getElementById('sidebar-username');
    const sidebarLevelEl = document.getElementById('sidebar-user-level');
    const sidebarBestEl = document.getElementById('sidebar-best-score');

    if (user) {
      if (this.userBadge) {
        this.userBadge.innerHTML = `👤 <strong>${user.username}</strong> (Best: ${user.best_score || 0})`;
      }
      if (sidebarNameEl) sidebarNameEl.textContent = user.username;
      if (sidebarBestEl) sidebarBestEl.textContent = `Best: ${(user.best_score || 0).toLocaleString()}`;
      
      // Calculate dynamic level based on best score
      let playerLevel = 1;
      const score = user.best_score || 0;
      if (score >= 2000) playerLevel = 15;
      else if (score >= 1500) playerLevel = 12;
      else if (score >= 1000) playerLevel = 10;
      else if (score >= 500) playerLevel = 6;
      else if (score >= 300) playerLevel = 4;
      else if (score >= 150) playerLevel = 3;
      else if (score >= 50) playerLevel = 2;
      
      if (sidebarLevelEl) sidebarLevelEl.textContent = `Level ${playerLevel}`;

      const profileBestEl = document.getElementById('profile-best-score-display');
      if (profileBestEl) {
        profileBestEl.textContent = (user.best_score || 0).toLocaleString();
      }
      if (window.game) {
        window.game.bestScore = user.best_score || 0;
      }
      this.checkPendingNotifications();
    } else {
      const localBest = parseInt(localStorage.getItem('onehook_best_score') || '0', 10);
      if (this.userBadge) {
        this.userBadge.innerHTML = `👤 <span>Sign In</span>`;
      }
      if (sidebarNameEl) sidebarNameEl.textContent = 'Guest';
      if (sidebarLevelEl) sidebarLevelEl.textContent = 'Sign In';
      if (sidebarBestEl) sidebarBestEl.textContent = `Best: ${localBest.toLocaleString()}`;
    }

    this.renderFeaturedGames();
    this.renderGameDetailsPanel();
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

      // Challenges Badges
      const incCount = chRes.stats ? (chRes.stats.incomingCount || 0) : 0;
      const wonCount = chRes.stats ? (chRes.stats.wonCount || 0) : 0;
      const lostCount = chRes.stats ? (chRes.stats.lostCount || 0) : 0;
      const sentCount = chRes.stats ? (chRes.stats.sentCount || 0) : 0;
      const chBadge = document.getElementById('challenges-pending-badge');
      const chTabBadge = document.getElementById('ch-tab-incoming-badge');
      const chTabWonBadge = document.getElementById('ch-tab-won-badge');
      const chTabLostBadge = document.getElementById('ch-tab-lost-badge');
      const chTabSentBadge = document.getElementById('ch-tab-sent-badge');

      if (incCount > 0) {
        if (chBadge) { chBadge.textContent = incCount; chBadge.classList.remove('hidden'); }
        if (chTabBadge) { chTabBadge.textContent = incCount; chTabBadge.classList.remove('hidden'); }
      } else {
        if (chBadge) chBadge.classList.add('hidden');
        if (chTabBadge) chTabBadge.classList.add('hidden');
      }

      if (wonCount > 0) {
        if (chTabWonBadge) { chTabWonBadge.textContent = wonCount; chTabWonBadge.classList.remove('hidden'); }
      } else {
        if (chTabWonBadge) chTabWonBadge.classList.add('hidden');
      }

      if (lostCount > 0) {
        if (chTabLostBadge) { chTabLostBadge.textContent = lostCount; chTabLostBadge.classList.remove('hidden'); }
      } else {
        if (chTabLostBadge) chTabLostBadge.classList.add('hidden');
      }

      if (sentCount > 0) {
        if (chTabSentBadge) { chTabSentBadge.textContent = sentCount; chTabSentBadge.classList.remove('hidden'); }
      } else {
        if (chTabSentBadge) chTabSentBadge.classList.add('hidden');
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

  // ==========================================
  // PWA (Progressive Web App) Installation
  // ==========================================
  initPWA() {
    // 1. Capture beforeinstallprompt event (Android Chrome, Edge, etc.)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      this.updatePWAVisibility();
    });

    // 2. Track successful installation
    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.updatePWAVisibility();
      this.showToast('🎉 SprintGames installed to your Home Screen!', 'success');
    });

    // 3. Attach click listeners to install buttons
    if (this.pwaInstallBtn) {
      this.pwaInstallBtn.addEventListener('click', () => this.handlePWAInstallClick());
    }

    if (this.homeInstallBtn) {
      this.homeInstallBtn.addEventListener('click', () => this.handlePWAInstallClick());
    }

    if (this.pwaBannerInstallBtn) {
      this.pwaBannerInstallBtn.addEventListener('click', () => this.handlePWAInstallClick());
    }

    if (this.pwaBannerDismissBtn) {
      this.pwaBannerDismissBtn.addEventListener('click', () => this.dismissPWABanner());
    }

    if (this.closePwaModalBtn) {
      this.closePwaModalBtn.addEventListener('click', () => this.closeModal(this.pwaInstallModal));
    }

    if (this.pwaModalDirectInstallBtn) {
      this.pwaModalDirectInstallBtn.addEventListener('click', () => this.executeNativeInstallPrompt());
    }

    if (this.pwaDesktopInstallBtn) {
      this.pwaDesktopInstallBtn.addEventListener('click', () => this.executeNativeInstallPrompt());
    }

    // 4. Initial visibility check
    this.updatePWAVisibility();
  }

  isAppInstalledOrStandalone() {
    const isStandaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator && window.navigator.standalone === true;
    return Boolean(isStandaloneMedia || isIOSStandalone);
  }

  updatePWAVisibility() {
    if (this.isAppInstalledOrStandalone()) {
      if (this.pwaInstallBtn) this.pwaInstallBtn.classList.add('hidden');
      if (this.homeInstallCard) this.homeInstallCard.classList.add('hidden');
      if (this.pwaInstallBanner) this.pwaInstallBanner.classList.add('hidden');
      return;
    }

    // Non-installed: show install buttons across all mobile & desktop browsers
    if (this.pwaInstallBtn) {
      this.pwaInstallBtn.classList.remove('hidden');
    }

    if (this.homeInstallCard) {
      this.homeInstallCard.classList.remove('hidden');
    }

    // On mobile devices, show floating bottom banner if not dismissed during current session
    const isDismissed = sessionStorage.getItem('sprintgames_pwa_dismissed') === 'true';
    if (!isDismissed && this.pwaInstallBanner) {
      if (window.innerWidth <= 768) {
        setTimeout(() => {
          if (!this.isAppInstalledOrStandalone() && sessionStorage.getItem('sprintgames_pwa_dismissed') !== 'true') {
            this.pwaInstallBanner.classList.remove('hidden');
          }
        }, 800);
      }
    }
  }

  dismissPWABanner() {
    sessionStorage.setItem('sprintgames_pwa_dismissed', 'true');
    if (this.pwaInstallBanner) {
      this.pwaInstallBanner.classList.add('hidden');
    }
  }

  async handlePWAInstallClick() {
    if (this.deferredInstallPrompt) {
      try {
        this.deferredInstallPrompt.prompt();
        const choiceResult = await this.deferredInstallPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          this.deferredInstallPrompt = null;
          this.updatePWAVisibility();
          if (this.pwaInstallModal) this.closeModal(this.pwaInstallModal);
        }
      } catch (err) {
        console.warn('[PWA] Native prompt error:', err);
        this.openPWAInstallModal();
      }
    } else {
      this.openPWAInstallModal();
    }
  }

  async executeNativeInstallPrompt() {
    if (this.deferredInstallPrompt) {
      try {
        this.deferredInstallPrompt.prompt();
        const choiceResult = await this.deferredInstallPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          this.deferredInstallPrompt = null;
          this.updatePWAVisibility();
          if (this.pwaInstallModal) this.closeModal(this.pwaInstallModal);
        }
      } catch (err) {
        console.warn('[PWA] Direct install prompt error:', err);
      }
    } else {
      this.showToast('Please follow the steps shown below on your browser.', 'info');
    }
  }

  openPWAInstallModal() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);

    const nativeSection = document.getElementById('pwa-native-prompt-section');
    const iosSection = document.getElementById('pwa-ios-instructions');
    const androidSection = document.getElementById('pwa-android-instructions');
    const desktopSection = document.getElementById('pwa-desktop-instructions');

    if (nativeSection) nativeSection.classList.add('hidden');
    if (iosSection) iosSection.classList.add('hidden');
    if (androidSection) androidSection.classList.add('hidden');
    if (desktopSection) desktopSection.classList.add('hidden');

    if (this.deferredInstallPrompt && nativeSection) {
      nativeSection.classList.remove('hidden');
    } else if (isIOS && iosSection) {
      iosSection.classList.remove('hidden');
    } else if (isAndroid && androidSection) {
      androidSection.classList.remove('hidden');
    } else if (desktopSection) {
      desktopSection.classList.remove('hidden');
    }

    if (this.pwaInstallModal) {
      this.openModal(this.pwaInstallModal);
    }
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

  async handleSaveUsername() {
    const input = document.getElementById('profile-new-username-input');
    const newUsername = input ? input.value.trim() : '';

    if (!newUsername) {
      this.showToast('Please enter a username', 'error');
      if (input) input.focus();
      return;
    }

    const btn = document.getElementById('btn-save-username');
    if (btn) btn.disabled = true;

    try {
      const res = await window.apiClient.updateUsername(newUsername);
      this.showToast(res.message || 'Username updated successfully!', 'success');
      document.getElementById('profile-username-display').textContent = res.user.username;
      const box = document.getElementById('profile-edit-username-box');
      if (box) box.classList.add('hidden');
      this.refreshUserBadge();
    } catch (err) {
      this.showToast(err.message || 'Failed to update username', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async handleRequestEmailChange() {
    const input = document.getElementById('profile-new-email-input');
    const newEmail = input ? input.value.trim() : '';

    if (!newEmail) {
      this.showToast('Please enter a valid new email address', 'error');
      if (input) input.focus();
      return;
    }

    const btn = document.getElementById('btn-send-email-otp');
    if (btn) btn.disabled = true;

    try {
      const res = await window.apiClient.requestEmailChange(newEmail);
      this.pendingNewEmail = res.newEmail;
      this.showToast(res.message || 'Verification code sent to your new email!', 'success');
      document.getElementById('profile-new-email-masked').textContent = res.maskedEmail || this.maskEmail(res.newEmail);
      document.getElementById('profile-email-step-input').classList.add('hidden');
      document.getElementById('profile-email-step-otp').classList.remove('hidden');
      const otpInput = document.getElementById('profile-email-otp-input');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }
    } catch (err) {
      this.showToast(err.message || 'Failed to request email change', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async handleVerifyEmailChange() {
    const otpInput = document.getElementById('profile-email-otp-input');
    const code = otpInput ? otpInput.value.trim() : '';

    if (!this.pendingNewEmail || !code) {
      this.showToast('Please enter the 6-digit verification code', 'error');
      if (otpInput) otpInput.focus();
      return;
    }

    const btn = document.getElementById('btn-verify-new-email');
    if (btn) btn.disabled = true;

    try {
      const res = await window.apiClient.verifyEmailChange(this.pendingNewEmail, code);
      this.showToast(res.message || 'Email updated successfully!', 'success');
      document.getElementById('profile-email-display').textContent = res.maskedEmail || this.maskEmail(res.user.email);
      const box = document.getElementById('profile-edit-email-box');
      if (box) box.classList.add('hidden');
      document.getElementById('profile-email-step-otp').classList.add('hidden');
      document.getElementById('profile-email-step-input').classList.remove('hidden');
      this.refreshUserBadge();
    } catch (err) {
      this.showToast(err.message || 'Failed to verify email change', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
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
      container.innerHTML = `<div class="empty-state">Please sign in to view your friends leaderboard. <br><br> <button class="btn btn-secondary" onclick="uiManager.closeModal(uiManager.leaderboardModal); uiManager.openAuthModal();">Sign In</button></div>`;
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
  openFriendsModal(tab = 'list', scoreForChallenge = null) {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }
    this.activeChallengeScoreForFriends = (typeof scoreForChallenge === 'number' && scoreForChallenge > 0) ? scoreForChallenge : null;
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

      const matchScoreParam = this.activeChallengeScoreForFriends ? this.activeChallengeScoreForFriends : 'null';
      let html = `<div class="friends-grid">`;
      res.friends.forEach((f) => {
        html += `
          <div class="friend-card">
            <div class="friend-info">
              <span class="friend-name">👤 ${f.username}</span>
              <span class="friend-score">Best: <strong>${f.best_score.toLocaleString()}</strong></span>
            </div>
            <button class="btn btn-challenge" onclick="uiManager.openSendChallengeModal('${f.id}', '${f.username}', ${matchScoreParam})">
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
      const incoming = res.requests || [];
      const sent = res.sent || [];

      if (incoming.length === 0 && sent.length === 0) {
        container.innerHTML = `<div class="empty-state">No pending friend requests</div>`;
        return;
      }

      let html = '';

      if (incoming.length > 0) {
        html += `<p class="requests-section-label">📥 Incoming</p><div class="friends-grid">`;
        incoming.forEach((req) => {
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
      }

      if (sent.length > 0) {
        html += `<p class="requests-section-label" style="margin-top:14px;">📤 Sent</p><div class="friends-grid">`;
        sent.forEach((req) => {
          html += `
            <div class="friend-card">
              <div class="friend-info">
                <span class="friend-name">👤 ${req.receiver_username}</span>
                <span class="friend-score">Best: ${req.receiver_score.toLocaleString()}</span>
              </div>
              <button class="btn btn-sm btn-secondary" onclick="uiManager.cancelRequest('${req.id}')">CANCEL</button>
            </div>
          `;
        });
        html += `</div>`;
      }

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

  async cancelRequest(requestId) {
    try {
      const res = await window.apiClient.cancelFriendRequest(requestId);
      this.showToast(res.message, 'success');
      this.renderPendingRequestsTab();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // CHALLENGES FLOW & MODAL MANAGEMENT
  // =========================================================================

  openFriendPickerModal(score = null) {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }

    const scoreToSend = (typeof score === 'number' && score > 0)
      ? score
      : (window.apiClient.user.best_score || 0);

    this.activeChallengeScoreForPicker = scoreToSend;

    const scoreEl = document.getElementById('fp-selected-score');
    if (scoreEl) {
      scoreEl.textContent = `${scoreToSend.toLocaleString()} pts`;
    }

    const searchInput = document.getElementById('fp-search-input');
    if (searchInput) searchInput.value = '';

    this.closeModal(this.challengesModal);
    this.closeModal(this.gameOverModal);
    this.openModal(this.friendPickerModal);
    this.loadFriendsForPicker();
  }

  async loadFriendsForPicker() {
    const container = document.getElementById('fp-friends-container');
    if (!container) return;
    container.innerHTML = `<div class="loading-spinner">Loading friends...</div>`;

    try {
      const [friendsRes, chRes] = await Promise.all([
        window.apiClient.getFriendsList().catch(() => ({ friends: [] })),
        window.apiClient.getChallengesList().catch(() => ({ challenges: [] }))
      ]);

      this.cachedFriendsForPicker = friendsRes.friends || [];
      this.cachedChallengesForPicker = chRes.challenges || [];
      this.renderFriendPickerList(this.cachedFriendsForPicker);
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load friends: ${err.message}</div>`;
    }
  }

  renderFriendPickerList(friends) {
    const container = document.getElementById('fp-friends-container');
    if (!container) return;

    if (!friends || friends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div style="font-size: 2rem; margin-bottom: 8px;">👥</div>
          <strong style="color: #0f172a;">No friends found!</strong><br>
          <span style="color: #64748b; font-size: 0.85rem;">Add friends from the Friends tab to challenge them!</span>
        </div>
      `;
      return;
    }

    let html = '';
    friends.forEach((f) => {
      const initials = (f.username || 'F').substring(0, 2).toUpperCase();
      const isPending = this.cachedChallengesForPicker.some(
        ch => ch.opponent_id === f.id &&
              ch.challenger_score === this.activeChallengeScoreForPicker &&
              ch.status === 'PENDING'
      );
      const isBeatMe = (f.best_score || 0) > this.activeChallengeScoreForPicker;

      let actionBtnHtml = '';
      if (isPending) {
        actionBtnHtml = `<button class="btn btn-sm" disabled style="background: #f1f5f9; color: #94a3b8; border: 1.5px solid #cbd5e1; cursor: not-allowed; opacity: 0.85;">⏳ Pending</button>`;
      } else if (isBeatMe) {
        actionBtnHtml = `<button class="btn btn-sm btn-yellow-play" onclick="uiManager.selectFriendToChallenge('${f.id}', '${f.username}', ${f.best_score || 0})">🔥 Beat Me</button>`;
      } else {
        actionBtnHtml = `<button class="btn btn-sm btn-challenge" onclick="uiManager.selectFriendToChallenge('${f.id}', '${f.username}', ${f.best_score || 0})">⚔️ Challenge</button>`;
      }

      html += `
        <div class="fp-friend-card">
          <div class="fp-user-info">
            <div class="fp-avatar">${initials}</div>
            <div class="fp-details">
              <span class="fp-name">${f.username}</span>
            </div>
          </div>
          <div>
            ${actionBtnHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  filterFriendPicker(query) {
    if (!this.cachedFriendsForPicker) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderFriendPickerList(this.cachedFriendsForPicker);
      return;
    }
    const filtered = this.cachedFriendsForPicker.filter(f =>
      (f.username || '').toLowerCase().includes(q)
    );
    this.renderFriendPickerList(filtered);
  }

  selectFriendToChallenge(friendId, friendUsername, friendBestScore) {
    this.targetChallengeFriend = { id: friendId, username: friendUsername };
    this.targetChallengeScore = this.activeChallengeScoreForPicker;

    const nameEl = document.getElementById('send-ch-opponent-name');
    const scoreEl = document.getElementById('send-ch-my-score');
    const opponentShortEl = document.getElementById('send-ch-opponent-shortname');
    const opponentBestEl = document.getElementById('send-ch-opponent-best');
    const btnScoreValEl = document.getElementById('send-ch-btn-score-val');

    if (nameEl) nameEl.textContent = friendUsername;
    if (scoreEl) scoreEl.textContent = `${this.activeChallengeScoreForPicker.toLocaleString()} pts`;
    if (opponentShortEl) opponentShortEl.textContent = friendUsername.toUpperCase();
    if (opponentBestEl) opponentBestEl.textContent = `${(friendBestScore || 0).toLocaleString()} pts`;
    if (btnScoreValEl) btnScoreValEl.textContent = `${this.activeChallengeScoreForPicker.toLocaleString()} pts`;

    this.closeModal(this.friendPickerModal);
    this.openModal(this.sendChallengeModal);
  }

  openSendChallengeModal(friendId, friendUsername, customScore = null) {
    if (!window.apiClient.user) {
      this.openAuthModal();
      return;
    }

    const scoreToSend = (typeof customScore === 'number' && customScore > 0)
      ? customScore
      : (window.apiClient.user.best_score || 0);

    this.activeChallengeScoreForPicker = scoreToSend;
    this.selectFriendToChallenge(friendId, friendUsername, 0);
  }

  async confirmSendChallenge() {
    if (!this.targetChallengeFriend) return;

    const btn = document.getElementById('confirm-send-challenge-btn');
    if (btn) btn.disabled = true;

    try {
      const res = await window.apiClient.createChallenge(this.targetChallengeFriend.id, this.targetChallengeScore);
      this.showToast(res.message || `⚔️ Challenge sent to ${this.targetChallengeFriend.username}!`, 'success');
      this.closeModal(this.sendChallengeModal);
      this.checkPendingNotifications();
      this.openChallengesModal('sent');
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

    const heroScoreEl = document.getElementById('ch-hero-score');
    if (heroScoreEl) {
      heroScoreEl.textContent = (window.apiClient.user.best_score || 0).toLocaleString();
    }

    this.openModal(this.challengesModal);
    if (tab === 'incoming') {
      this.renderIncomingChallengesTab();
    } else if (tab === 'won') {
      this.renderWonChallengesTab();
    } else if (tab === 'lost') {
      this.renderLostChallengesTab();
    } else if (tab === 'sent') {
      this.renderSentChallengesTab();
    } else {
      this.renderHistoryChallengesTab();
    }
  }

  async renderIncomingChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.add('active');
    document.getElementById('ch-tab-won').classList.remove('active');
    document.getElementById('ch-tab-lost').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.remove('hidden');
    document.getElementById('ch-section-won').classList.add('hidden');
    document.getElementById('ch-section-lost').classList.add('hidden');
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
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🛡️</div>
            <strong style="color: #0f172a; font-size: 1rem;">No unattempted challenges!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Check the <strong>Lost / Retry</strong> tab to retry challenges you haven't beaten yet.</span>
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
                <span class="ch-badge badge-incoming">⚔️ NEW CHALLENGE</span>
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

  async renderWonChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.remove('active');
    document.getElementById('ch-tab-won').classList.add('active');
    document.getElementById('ch-tab-lost').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-won').classList.remove('hidden');
    document.getElementById('ch-section-lost').classList.add('hidden');
    document.getElementById('ch-section-sent').classList.add('hidden');
    document.getElementById('ch-section-history').classList.add('hidden');

    const container = document.getElementById('ch-won-container');
    container.innerHTML = `<div class="loading-spinner">Loading won challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      this.checkPendingNotifications();

      const wonChallenges = res.won || [];

      if (wonChallenges.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🏆</div>
            <strong style="color: #0f172a; font-size: 1rem;">No victories yet!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Play any incoming or lost challenge and score higher than your friend to claim a victory!</span>
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      wonChallenges.forEach((ch) => {
        const opponentName = ch.isIncoming ? ch.challengerUsername : ch.opponentUsername;
        html += `
          <div class="challenge-card completed win">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge badge-won">🏆 VICTORY</span>
                <h4 class="ch-name">Defeated <strong>${opponentName}</strong></h4>
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
                <span class="lbl">${ch.opponentUsername} (Final Score)</span>
                <span class="val highlight" style="color: #059669;">${(ch.opponentScore || 0).toLocaleString()} pts</span>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load won challenges: ${err.message}</div>`;
    }
  }

  async renderLostChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.remove('active');
    document.getElementById('ch-tab-won').classList.remove('active');
    document.getElementById('ch-tab-lost').classList.add('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-won').classList.add('hidden');
    document.getElementById('ch-section-lost').classList.remove('hidden');
    document.getElementById('ch-section-sent').classList.add('hidden');
    document.getElementById('ch-section-history').classList.add('hidden');

    const container = document.getElementById('ch-lost-container');
    container.innerHTML = `<div class="loading-spinner">Loading retryable challenges...</div>`;

    try {
      const res = await window.apiClient.getChallengesList();
      this.checkPendingNotifications();

      const lostChallenges = res.lost || [];

      if (lostChallenges.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🎯</div>
            <strong style="color: #0f172a; font-size: 1rem;">No missed challenges!</strong><br>
            <span style="color: #64748b; font-size: 0.85rem;">Challenges where you haven't yet beaten the target will appear here so you can keep retrying.</span>
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      lostChallenges.forEach((ch) => {
        html += `
          <div class="challenge-card completed loss">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge badge-lost">❌ TRY AGAIN</span>
                <h4 class="ch-name">From <strong>${ch.challengerUsername}</strong></h4>
              </div>
              <span class="ch-date">${this.formatRelativeTime(ch.createdAt)}</span>
            </div>
            <div class="ch-score-comparison">
              <div class="ch-compare-box">
                <span class="lbl">${ch.challengerUsername} (Target to Beat)</span>
                <span class="val" style="color: #dc2626;">${ch.challengerScore.toLocaleString()} pts</span>
              </div>
              <div class="ch-compare-vs">VS</div>
              <div class="ch-compare-box">
                <span class="lbl">Your Best Attempt</span>
                <span class="val highlight">${(ch.opponentScore || 0).toLocaleString()} pts</span>
              </div>
            </div>
            <button class="btn btn-yellow-play btn-full ch-action-btn" onclick="uiManager.startIncomingChallenge('${ch.id}', '${ch.challengerUsername}', ${ch.challengerScore})">
              🔄 RETRY & BEAT ${ch.challengerScore.toLocaleString()} PTS
            </button>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = `<div class="error-state">Failed to load retry challenges: ${err.message}</div>`;
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
    document.getElementById('ch-tab-won').classList.remove('active');
    document.getElementById('ch-tab-lost').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.add('active');
    document.getElementById('ch-tab-history').classList.remove('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-won').classList.add('hidden');
    document.getElementById('ch-section-lost').classList.add('hidden');
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
            Go to <strong>Friends</strong> tab or finish a game match and click <strong>⚔️ CHALLENGE</strong>.
          </div>
        `;
        return;
      }

      let html = `<div class="challenge-list">`;
      sent.forEach((ch) => {
        const hasAttempted = ch.opponentScore !== null && ch.opponentScore !== undefined;
        const opponentWon = hasAttempted && (ch.opponentScore > ch.challengerScore || ch.winnerId === ch.opponentId);
        const isDefending = hasAttempted && !opponentWon;

        let badgeClass = 'badge-waiting';
        let badgeText = '⏳ PENDING';
        let cardClass = 'sent';
        let statusTagHtml = `<div class="ch-status-tag">⏳ Pending friend attempt</div>`;

        if (opponentWon) {
          badgeClass = 'badge-lost';
          badgeText = '💥 BEATEN';
          cardClass = 'completed loss';
          statusTagHtml = `<div class="ch-status-tag" style="background: #fee2e2; color: #dc2626;">💥 Friend beat your score with ${ch.opponentScore.toLocaleString()} pts</div>`;
        } else if (isDefending) {
          badgeClass = 'badge-won';
          badgeText = '🛡️ DEFENDING';
          cardClass = 'completed win';
          statusTagHtml = `<div class="ch-status-tag" style="background: #ecfdf5; color: #059669;">🛡️ Friend attempted (${ch.opponentScore.toLocaleString()} pts) — Undefeated!</div>`;
        }

        html += `
          <div class="challenge-card ${cardClass}">
            <div class="ch-card-header">
              <div class="ch-user-info">
                <span class="ch-badge ${badgeClass}">${badgeText}</span>
                <h4 class="ch-name">Challenged <strong>${ch.opponentUsername}</strong></h4>
              </div>
              <span class="ch-date">${this.formatRelativeTime(ch.createdAt)}</span>
            </div>
            <div class="ch-score-comparison">
              <div class="ch-compare-box">
                <span class="lbl">Your Score to Beat</span>
                <span class="val highlight">${ch.challengerScore.toLocaleString()} pts</span>
              </div>
              <div class="ch-compare-vs">VS</div>
              <div class="ch-compare-box">
                <span class="lbl">${ch.opponentUsername}'s Best Attempt</span>
                <span class="val" style="${hasAttempted ? (opponentWon ? 'color: #dc2626;' : 'color: #059669;') : 'color: #94a3b8;'}">
                  ${hasAttempted ? ch.opponentScore.toLocaleString() + ' pts' : 'Not played yet'}
                </span>
              </div>
            </div>
            <div class="ch-details-row" style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
              ${statusTagHtml}
              ${!hasAttempted ? `<button class="btn btn-sm btn-danger" style="padding: 5px 12px; font-size: 0.75rem; border-radius: 8px;" onclick="uiManager.withdrawChallenge('${ch.id}', '${ch.opponentUsername}')">↩️ Withdraw</button>` : ''}
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

  async withdrawChallenge(challengeId, opponentUsername) {
    if (!confirm(`Are you sure you want to withdraw the challenge sent to ${opponentUsername}?`)) {
      return;
    }

    try {
      const res = await window.apiClient.withdrawChallenge(challengeId);
      this.showToast(res.message || 'Challenge withdrawn successfully', 'info');
      this.checkPendingNotifications();
      this.renderSentChallengesTab();
    } catch (err) {
      this.showToast(err.message || 'Failed to withdraw challenge', 'error');
    }
  }

  async renderHistoryChallengesTab() {
    document.getElementById('ch-tab-incoming').classList.remove('active');
    document.getElementById('ch-tab-won').classList.remove('active');
    document.getElementById('ch-tab-lost').classList.remove('active');
    document.getElementById('ch-tab-sent').classList.remove('active');
    document.getElementById('ch-tab-history').classList.add('active');

    document.getElementById('ch-section-incoming').classList.add('hidden');
    document.getElementById('ch-section-won').classList.add('hidden');
    document.getElementById('ch-section-lost').classList.add('hidden');
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
    this.lastMatchScore = data.score || 0;
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

    // Challenge Friends button vs Guest CTA
    const goChFriendsBtn = document.getElementById('go-challenge-friends-btn');
    const goGuestCta = document.getElementById('go-guest-cta');
    const isLoggedIn = !!window.apiClient.user;

    if (isLoggedIn) {
      // Show challenge button, hide guest CTA
      if (goGuestCta) goGuestCta.classList.add('hidden');
      if (goChFriendsBtn) {
        if (data.score > 0) {
          goChFriendsBtn.classList.remove('hidden');
          goChFriendsBtn.textContent = `⚔️ Challenge Friends (${data.score.toLocaleString()} pts)`;
          goChFriendsBtn.onclick = () => {
            this.openFriendPickerModal(data.score);
          };
        } else {
          goChFriendsBtn.classList.add('hidden');
        }
      }
    } else {
      // Hide challenge button, show guest CTA
      if (goChFriendsBtn) goChFriendsBtn.classList.add('hidden');
      if (goGuestCta) goGuestCta.classList.remove('hidden');
    }

    // Challenge mode result banner & retry button
    const chBanner = document.getElementById('go-challenge-result-banner');
    const retryBtn = document.getElementById('retry-challenge-btn');

    if (data.challengeResult) {
      chBanner.classList.remove('hidden');
      if (data.challengeResult.won) {
        window.soundManager.playLevelUp();
        if (retryBtn) retryBtn.classList.add('hidden');
        chBanner.innerHTML = `
          <div class="challenge-win">
            🏆 <h3 style="margin-bottom: 4px;">CHALLENGE WON!</h3>
            <p>You scored <strong>${data.challengeResult.scoreAchieved.toLocaleString()} pts</strong> and beat <strong>${data.challengeResult.challengerUsername}</strong>'s target of ${data.challengeResult.targetScore.toLocaleString()} pts!</p>
          </div>
        `;
      } else {
        this.lastFailedChallengeContext = {
          id: data.challengeResult.challengeId || (window.game && window.game.activeChallenge ? window.game.activeChallenge.id : null),
          username: data.challengeResult.challengerUsername,
          scoreToBeat: data.challengeResult.targetScore
        };
        if (retryBtn) retryBtn.classList.remove('hidden');
        chBanner.innerHTML = `
          <div class="challenge-loss">
            😤 <h3 style="margin-bottom: 4px;">CHALLENGE MISSED</h3>
            <p>You scored <strong>${data.challengeResult.scoreAchieved.toLocaleString()} pts</strong> (Target: ${data.challengeResult.targetScore.toLocaleString()} pts).<br>You can keep retrying!</p>
          </div>
        `;
      }
      this.checkPendingNotifications();
    } else {
      if (retryBtn) retryBtn.classList.add('hidden');
      chBanner.classList.add('hidden');
    }

    // If game was launched to challenge a specific friend from confirmation modal:
    if (this.pendingChallengeTargetFriend) {
      const targetFriend = this.pendingChallengeTargetFriend;
      this.pendingChallengeTargetFriend = null;
      if (data.score > 0) {
        window.apiClient.createChallenge(targetFriend.id, data.score)
          .then((res) => {
            this.showToast(res.message || `⚔️ Challenge sent to ${targetFriend.username} with ${data.score.toLocaleString()} pts!`, 'success');
            this.checkPendingNotifications();
          })
          .catch((err) => {
            this.showToast(err.message || 'Failed to send challenge', 'error');
          });
      }
    }

    // If game was launched from "New Game" in Challenges Hub, immediately prompt Friend Picker!
    if (this.pendingChallengeFromNewGame) {
      this.pendingChallengeFromNewGame = false;
      if (data.score > 0) {
        this.openFriendPickerModal(data.score);
        return;
      }
    }

    this.openModal(this.gameOverModal);
  }
}

window.uiManager = new UIManager();

