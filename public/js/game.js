class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Canvas scaling
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;

    // Game state flags
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAMEOVER'
    this.score = 0;
    this.bestScore = 0;
    this.lives = 3;
    this.level = 1;
    this.levelName = 'LEVEL 1';

    // Hook state
    this.hook = {
      x: this.width / 2,
      y: 95,
      startY: 95,
      maxDepth: this.height * 0.85,
      speed: 12,
      reelSpeed: 16,
      state: 'IDLE', // 'IDLE', 'DROPPING', 'RETRACTING', 'CAUGHT'
      caughtFish: null
    };

    // Fish entities & environment
    this.fishList = [];
    this.maxFishCount = 6;
    this.particles = [];
    this.bubbles = [];
    this.floatingTexts = [];
    this.lightRays = [];
    this.seaweed = [];

    // Telemetry for anti-cheat
    this.startTime = 0;
    this.catchesLog = [];

    // Small level up bubble (non-blocking)
    this.levelBubble = null;

    // Active Challenge Mode context
    this.activeChallenge = null;

    this.initEnvironment();
    this.setupListeners();
    this.resizeCanvas();
  }

  resizeCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.scale(this.dpr, this.dpr);

    this.hook.x = this.width / 2;
    this.hook.startY = 95;
    if (this.hook.state === 'IDLE') {
      this.hook.y = 95;
    }
    this.hook.maxDepth = this.height * 0.85;

    this.initDecorations();
  }

  initEnvironment() {
    // Light rays
    this.lightRays = [];
    for (let i = 0; i < 5; i++) {
      this.lightRays.push({
        x: Math.random() * this.width,
        width: 40 + Math.random() * 80,
        angle: -0.1 + Math.random() * 0.2,
        alpha: 0.05 + Math.random() * 0.08,
        speed: 0.002 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2
      });
    }

    this.bubbles = []; // Only empty array, populated later by fish

    this.initDecorations();
  }

  initDecorations() {
    this.seaweed = [];
    let count = Math.floor(this.width / 60);
    for (let i = 0; i < count; i++) {
      this.seaweed.push({
        x: i * 60 + Math.random() * 20,
        height: 80 + Math.random() * 120,
        blades: 3 + Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.02,
        // Vibrant neon/emerald greens
        color: `rgba(${10 + Math.random() * 20}, ${180 + Math.random() * 60}, ${80 + Math.random() * 60}, 0.85)`
      });
    }

    // Small static corals/plants
    this.corals = [];
    count = Math.floor(this.width / 150);
    for (let i = 0; i < count; i++) {
      const branches = [];
      const numBranches = 3 + Math.floor(Math.random() * 4);
      const height = 25 + Math.random() * 35;
      for (let b = 0; b < numBranches; b++) {
        branches.push({
          angle: -Math.PI / 2 + (Math.random() * 1.2 - 0.6),
          len: height * (0.5 + Math.random() * 0.5)
        });
      }
      this.corals.push({
        x: Math.random() * this.width,
        color: Math.random() > 0.5 ? '#f43f5e' : '#f59e0b', // vibrant red-pink or amber
        branches: branches,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Small floor creatures
    this.floorCreatures = [];
    count = Math.floor(this.width / 200);
    for (let i = 0; i < count; i++) {
      this.floorCreatures.push({
        type: Math.random() > 0.5 ? 'crab' : 'starfish',
        x: Math.random() * this.width,
        offsetY: Math.random() * 12,
        scale: 0.6 + Math.random() * 0.4
      });
    }
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Single gameplay action: Click or Touch
    const handleAction = (e) => {
      if (this.state === 'PLAYING') {
        this.triggerHook();
      }
    };

    window.addEventListener('pointerdown', (e) => {
      // Ignore if clicking on interactive UI buttons
      if (e.target.tagName === 'BUTTON' || e.target.closest('.modal-card') || e.target.closest('.hud-btn') || e.target.closest('.btn')) {
        return;
      }
      window.soundManager.init();
      handleAction(e);
    });

    // Spacebar control for dropping hook (bulletproof handler on document & window)
    const handleSpaceKey = (e) => {
      const isSpace =
        e.code === 'Space' ||
        e.key === ' ' ||
        e.key === 'Spacebar' ||
        e.keyCode === 32 ||
        e.which === 32 ||
        (e.key && e.key.toLowerCase().includes('space'));

      if (!isSpace) return;

      // Ignore if user is typing inside an input or textarea
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        return;
      }

      // Ignore if an active modal dialog is open
      const openModal = document.querySelector('.modal-backdrop:not(.hidden)');
      if (openModal) return;

      // Check if HUD / game view is active
      const hudScreen = document.getElementById('hud-screen');
      const isGameViewActive = hudScreen && !hudScreen.classList.contains('hidden');

      if (this.state === 'PLAYING' || isGameViewActive) {
        e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();

        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }

        if (this.state !== 'PLAYING') {
          this.state = 'PLAYING';
        }

        window.soundManager.init();
        this.triggerHook();
      }
    };

    document.addEventListener('keydown', handleSpaceKey, true);
    window.addEventListener('keydown', handleSpaceKey, true);

    window.addEventListener('keyup', (e) => {
      const isSpace =
        e.code === 'Space' ||
        e.key === ' ' ||
        e.key === 'Spacebar' ||
        e.keyCode === 32 ||
        e.which === 32;
      const hudScreen = document.getElementById('hud-screen');
      const isGameViewActive = hudScreen && !hudScreen.classList.contains('hidden');
      if (isSpace && (this.state === 'PLAYING' || isGameViewActive)) {
        e.preventDefault();
      }
    }, true);
  }

  startNewGame(challengeContext = null) {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    this.state = 'PLAYING';
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.levelName = 'LEVEL 1';
    this.fishList = [];
    this.catchesLog = [];
    this.startTime = Date.now();
    this.activeChallenge = challengeContext;

    if (window.apiClient && window.apiClient.user) {
      this.bestScore = window.apiClient.user.best_score || 0;
    }

    this.resetHook();
    this.updateHUD();

    if (window.uiManager) {
      window.uiManager.showInGameHUD();
      if (challengeContext) {
        window.uiManager.showChallengeNotice(challengeContext);
      } else {
        window.uiManager.hideChallengeNotice();
      }
    }
  }

  resetHook() {
    this.hook.y = this.hook.startY;
    this.hook.state = 'IDLE';
    this.hook.caughtFish = null;
  }

  triggerHook() {
    if (this.hook.state === 'IDLE') {
      this.hook.state = 'DROPPING';
      window.soundManager.playDrop();
    }
  }

  getNextLevelScore() {
    if (this.level === 1) return 50;
    if (this.level === 2) return 150;
    if (this.level === 3) return 300;
    if (this.level === 4) return 500;
    return null;
  }

  updateHUD() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }

    if (window.uiManager) {
      window.uiManager.updateHUD({
        score: this.score,
        bestScore: this.bestScore,
        lives: this.lives,
        level: this.level,
        levelName: this.levelName,
        nextLevelScore: this.getNextLevelScore()
      });
    }
  }

  spawnFish() {
    if (this.fishList.length >= this.maxFishCount) return;

    // Available species based on current stage/level
    let availableKeys = ['clownfish', 'blue_tang', 'yellow_sailfin'];

    if (this.level >= 2) {
      availableKeys.push('angelfish', 'red_snapper', 'barracuda');
    }
    if (this.level >= 3) {
      availableKeys.push('swordfish', 'manta_ray');
    }
    if (this.level >= 4) {
      availableKeys.push('shark');
    }
    if (this.level >= 5) {
      availableKeys.push('golden_fish', 'jellyfish', 'whale');
    }

    const key = availableKeys[Math.floor(Math.random() * availableKeys.length)];
    const config = FISH_SPECIES_CONFIGS[key];

    const fish = new Fish({
      ...config,
      level: this.level,
      canvasWidth: this.width,
      canvasHeight: this.height
    });

    this.fishList.push(fish);
  }

  checkLevelUp() {
    let newLevel = 1;

    if (this.score >= 500) {
      newLevel = 5;
    } else if (this.score >= 300) {
      newLevel = 4;
    } else if (this.score >= 150) {
      newLevel = 3;
    } else if (this.score >= 50) {
      newLevel = 2;
    }

    if (newLevel > this.level) {
      this.level = newLevel;
      this.levelName = `LEVEL ${this.level}`;
      this.maxFishCount = 6 + (this.level - 1);
      window.soundManager.playLevelUp();

      // Dynamically accelerate existing swimming fish
      for (const f of this.fishList) {
        if (f.updateLevel) {
          f.updateLevel(this.level);
        }
      }

      // Small, transparent bubble placed off to the side away from the hook & fish
      const sideX = Math.random() > 0.5 ? this.width * 0.15 : this.width * 0.85;
      this.levelBubble = {
        x: Math.max(45, Math.min(this.width - 45, sideX)),
        y: 190,
        radius: 24,
        level: this.level,
        timer: 45 // Fast ~0.75s lifetime before popping
      };

      this.updateHUD();
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'MENU') return;

    // Update Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y -= b.speed;
      b.wobble += 0.05;
      b.x += Math.sin(b.wobble) * 0.4;
      if (b.y < -10) {
        this.bubbles.splice(i, 1);
      }
    }

    // Update Light Rays
    for (const r of this.lightRays) {
      r.phase += r.speed;
      r.alpha = 0.05 + Math.sin(r.phase) * 0.03;
    }

    // Spawn fish periodically
    if (this.state === 'PLAYING' && Math.random() < 0.03) {
      this.spawnFish();
    } else if (this.state === 'MENU' && this.fishList.length < 5 && Math.random() < 0.02) {
      this.spawnFish();
    }

    // Update Fish
    for (let i = this.fishList.length - 1; i >= 0; i--) {
      const fish = this.fishList[i];
      fish.update(dt, this.width, this.height, this);

      if (fish.isOffscreen(this.width) && !fish.isCaught) {
        this.fishList.splice(i, 1);
      }
    }

    // Hook movement logic
    if (this.state === 'PLAYING') {
      this.updateHook();
    }

    // Floating text popups (+5, +10, +50)
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.5;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Particle splash effects
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Small level bubble float & quick pop
    if (this.levelBubble) {
      this.levelBubble.y -= 1.2;
      this.levelBubble.timer--;
      if (this.levelBubble.timer <= 0) {
        this.spawnBubblePop(this.levelBubble.x, this.levelBubble.y);
        this.levelBubble = null;
      }
    }
  }

  updateHook() {
    const h = this.hook;

    if (h.state === 'DROPPING') {
      h.y += h.speed;

      // Check collision with fish
      for (const fish of this.fishList) {
        if (!fish.isCaught) {
          const dx = fish.x - h.x;
          const dy = fish.y - h.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const catchRadius = (fish.width / 2) + 10;

          if (dist < catchRadius) {
            // Catch Fish!
            fish.isCaught = true;
            h.caughtFish = fish;
            h.state = 'RETRACTING';

            // Play sound based on fish stage
            if (fish.species === 'shark') {
              window.soundManager.playCatchShark();
            } else if (fish.stage >= 3) {
              window.soundManager.playCatchLarge();
            } else {
              window.soundManager.playCatchSmall();
            }

            // Spawn catch splash bubbles
            this.spawnCatchParticles(h.x, h.y);

            // Scare the other fish!
            for (const otherFish of this.fishList) {
              if (!otherFish.isCaught) {
                otherFish.scare(h.x, this.height);
              }
            }
            break;
          }
        }
      }

      // Reached max depth -> Miss!
      if (h.y >= h.maxDepth) {
        h.state = 'RETRACTING';
        this.registerMiss();
      }

    } else if (h.state === 'RETRACTING') {
      h.y -= h.reelSpeed;

      if (h.caughtFish) {
        h.caughtFish.x = h.x;
        h.caughtFish.y = h.y + 15;
      }

      // Returned to top start position
      if (h.y <= h.startY) {
        if (h.caughtFish) {
          // Award Score
          const pts = h.caughtFish.points;
          this.score += pts;

          // Telemetry catch log
          this.catchesLog.push({
            type: h.caughtFish.species,
            pts: pts,
            time: (Date.now() - this.startTime) / 1000
          });

          // Floating score text
          this.floatingTexts.push({
            text: `+${pts}`,
            x: h.x,
            y: h.startY + 40,
            alpha: 1.0,
            color: pts >= 50 ? '#ffea00' : (pts >= 15 ? '#00f0ff' : '#ffffff')
          });

          // Remove fish from list
          const idx = this.fishList.indexOf(h.caughtFish);
          if (idx !== -1) {
            this.fishList.splice(idx, 1);
          }

          this.checkLevelUp();
          this.updateHUD();
        }

        this.resetHook();
      }
    }
  }

  registerMiss() {
    this.lives--;
    window.soundManager.playMiss();
    this.updateHUD();

    if (this.lives <= 0) {
      this.handleGameOver();
    }
  }

  spawnCatchParticles(x, y) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 3,
        alpha: 1.0
      });
    }
  }

  spawnBubblePop(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2,
        alpha: 0.8
      });
    }
  }

  async handleGameOver() {
    this.state = 'GAMEOVER';
    window.soundManager.playGameOver();

    const durationSeconds = Math.max(1, (Date.now() - (this.startTime || (Date.now() - 1000))) / 1000);

    let isNewBest = false;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      isNewBest = true;
    }

    let result = { bestScore: this.bestScore, isNewBest };

    // Submit score to backend with telemetry audit
    if (window.apiClient && window.apiClient.token) {
      try {
        const apiRes = await window.apiClient.submitScore(this.score, durationSeconds, this.catchesLog);
        if (apiRes) {
          if (typeof apiRes.bestScore === 'number') {
            this.bestScore = apiRes.bestScore;
            result.bestScore = apiRes.bestScore;
          }
          if (typeof apiRes.isNewBest === 'boolean') {
            result.isNewBest = apiRes.isNewBest;
          }
        }
      } catch (err) {
        console.error('Score submission error:', err);
      }
    }

    // Always ensure session storage is in sync with the new best score
    if (window.apiClient && window.apiClient.user) {
      window.apiClient.user.best_score = this.bestScore;
      localStorage.setItem('onehook_user', JSON.stringify(window.apiClient.user));
    }

    // Complete active challenge if in challenge mode
    let challengeResult = null;
    if (this.activeChallenge && window.apiClient && window.apiClient.token) {
      try {
        challengeResult = await window.apiClient.completeChallenge(this.activeChallenge.id, this.score);
      } catch (err) {
        console.error('Challenge completion error:', err);
      }
    }

    if (window.uiManager) {
      window.uiManager.refreshUserBadge();
      window.uiManager.showGameOverModal({
        score: this.score,
        bestScore: this.bestScore,
        isNewBest: result.isNewBest,
        level: this.level,
        levelName: this.levelName,
        challengeResult
      });
    }
  }

  draw() {
    // 1. Draw Biome Background Gradient based on Level
    this.drawBiomeBackground();

    // 2. Draw Moving Light Rays
    this.drawLightRays();

    // 3. Draw Parallax Seaweed & Seabed
    this.drawSeabed();

    // 4. Draw Swimming Fish
    for (const fish of this.fishList) {
      fish.draw(this.ctx);
    }

    // 5. Draw Fishing Line & Hook
    this.drawHookLine();

    // 6. Draw Ambient Bubbles & Particles
    this.drawBubbles();

    // 7. Draw Floating Score Text
    this.drawFloatingTexts();

    // 8. Draw Small Transparent Level Bubble (Off to side in water)
    if (this.levelBubble) {
      this.drawLevelBubble();
    }
  }

  drawBiomeBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);

    switch (this.level) {
      case 1: // Shallow Reef - Light Tropical Azure
        grad.addColorStop(0, '#7dd3fc');
        grad.addColorStop(0.45, '#38bdf8');
        grad.addColorStop(1, '#0284c7');
        break;
      case 2: // Mid Ocean - Sky Blue
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(0.5, '#0284c7');
        grad.addColorStop(1, '#0369a1');
        break;
      case 3: // Azure Depths
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(0.55, '#0369a1');
        grad.addColorStop(1, '#075985');
        break;
      case 4: // Shark Waters
        grad.addColorStop(0, '#0369a1');
        grad.addColorStop(0.5, '#075985');
        grad.addColorStop(1, '#0c4a6e');
        break;
      case 5: // Deep Abyss
        grad.addColorStop(0, '#075985');
        grad.addColorStop(0.5, '#0c4a6e');
        grad.addColorStop(1, '#082f49');
        break;
      default:
        grad.addColorStop(0, '#7dd3fc');
        grad.addColorStop(1, '#0284c7');
    }

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawLightRays() {
    this.ctx.save();
    for (const ray of this.lightRays) {
      const rayGrad = this.ctx.createLinearGradient(ray.x, 0, ray.x + Math.tan(ray.angle) * this.height, this.height);
      rayGrad.addColorStop(0, `rgba(255, 255, 255, ${ray.alpha * 1.5})`);
      rayGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = rayGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(ray.x, 0);
      this.ctx.lineTo(ray.x + ray.width, 0);
      this.ctx.lineTo(ray.x + ray.width + Math.tan(ray.angle) * this.height, this.height);
      this.ctx.lineTo(ray.x + Math.tan(ray.angle) * this.height, this.height);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawSeabed() {
    this.ctx.save();

    // Ocean floor ground silhouette (Natural Sand)
    this.ctx.fillStyle = '#dcb879';
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    for (let x = 0; x <= this.width; x += 40) {
      const y = this.height - 30 - Math.sin(x * 0.01) * 15;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw vibrant corals (with gentle sway)
    const time = Date.now() * 0.002;
    for (const coral of this.corals) {
      this.ctx.strokeStyle = coral.color;
      this.ctx.lineWidth = 4;
      this.ctx.lineCap = 'round';
      const baseY = this.height - 20;
      const sway = Math.sin(time + coral.phase) * 0.1; // Gentle wave sway
      
      this.ctx.beginPath();
      for (const branch of coral.branches) {
        this.ctx.moveTo(coral.x, baseY);
        const finalAngle = branch.angle + sway;
        this.ctx.lineTo(coral.x + Math.cos(finalAngle) * branch.len, baseY + Math.sin(finalAngle) * branch.len);
      }
      this.ctx.stroke();
    }

    // Draw small sea creatures
    for (const fc of this.floorCreatures) {
      const y = this.height - 18 + fc.offsetY;
      this.ctx.save();
      this.ctx.translate(fc.x, y);
      this.ctx.scale(fc.scale, fc.scale);

      if (fc.type === 'crab') {
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -5, 8, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();
        // Crab eyes
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath(); this.ctx.arc(-3, -10, 2, 0, Math.PI*2); this.ctx.fill();
        this.ctx.beginPath(); this.ctx.arc(3, -10, 2, 0, Math.PI*2); this.ctx.fill();
      } else {
        // Starfish
        this.ctx.fillStyle = '#f59e0b';
        this.ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = (j * 4 * Math.PI) / 5 - Math.PI / 2;
          const r = j % 2 === 0 ? 8 : 3;
          this.ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Seaweed waving (Vibrant Green)
    for (const sw of this.seaweed) {
      const wave = Math.sin(time + sw.phase) * 15;
      this.ctx.strokeStyle = sw.color || '#10b981';
      this.ctx.lineWidth = 6;
      this.ctx.lineCap = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(sw.x, this.height - 20);
      this.ctx.quadraticCurveTo(
        sw.x + wave * 0.5,
        this.height - 20 - sw.height * 0.5,
        sw.x + wave,
        this.height - 20 - sw.height
      );
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawHookLine() {
    this.ctx.save();

    // Fishing line
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.hook.x, 0);
    this.ctx.lineTo(this.hook.x, this.hook.y);
    this.ctx.stroke();

    // Metallic Hook Graphic
    const hx = this.hook.x;
    const hy = this.hook.y;

    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    this.ctx.shadowBlur = 6;
    this.ctx.strokeStyle = '#f0f4f8';
    this.ctx.lineWidth = 4.5;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Hook Eyelet
    this.ctx.beginPath();
    this.ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
    this.ctx.stroke();

    // Hook Shank & Curve
    this.ctx.beginPath();
    this.ctx.moveTo(hx, hy + 4);
    this.ctx.lineTo(hx, hy + 24);
    this.ctx.arc(hx - 9, hy + 24, 9, 0, Math.PI);
    this.ctx.lineTo(hx - 18, hy + 15);
    this.ctx.stroke();

    // Barb tip
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(hx - 18, hy + 15);
    this.ctx.lineTo(hx - 23, hy + 18);
    this.ctx.lineTo(hx - 16, hy + 20);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  drawBubbles() {
    this.ctx.save();
    for (const b of this.bubbles) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    for (const p of this.particles) {
      this.ctx.fillStyle = `rgba(180, 240, 255, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawFloatingTexts() {
    this.ctx.save();
    this.ctx.font = '700 24px "Outfit", sans-serif';
    this.ctx.textAlign = 'center';

    for (const ft of this.floatingTexts) {
      this.ctx.fillStyle = ft.color;
      this.ctx.globalAlpha = ft.alpha;
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 6;
      this.ctx.fillText(ft.text, ft.x, ft.y);
    }
    this.ctx.restore();
  }

  drawLevelBubble() {
    if (!this.levelBubble) return;

    const b = this.levelBubble;
    const alpha = Math.min(1, b.timer / 12);

    this.ctx.save();
    this.ctx.globalAlpha = alpha;

    // Small, elegant glass-like aquatic bubble
    const grad = this.ctx.createRadialGradient(b.x - 5, b.y - 5, 2, b.x, b.y, b.radius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.6, 'rgba(0, 240, 255, 0.12)');
    grad.addColorStop(1, 'rgba(0, 200, 255, 0.3)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(180, 245, 255, 0.65)';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    // Specular shine
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    this.ctx.beginPath();
    this.ctx.arc(b.x - 7, b.y - 7, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Small clean text inside bubble
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '800 11px "Outfit", sans-serif';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 3;
    this.ctx.fillText(`LVL ${b.level}`, b.x, b.y + 1);

    this.ctx.restore();
  }

  run() {
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      this.update(dt);
      this.draw();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

window.GameEngine = GameEngine;
