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
    this.levelName = 'Small Fish';

    // Hook state
    this.hook = {
      x: this.width / 2,
      y: 60,
      startY: 60,
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

    // Level up notification banner
    this.levelUpBanner = null;

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
    this.hook.maxDepth = this.height * 0.85;

    this.initSeaweed();
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

    // Ambient bubbles
    this.bubbles = [];
    for (let i = 0; i < 25; i++) {
      this.bubbles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: 1.5 + Math.random() * 3.5,
        speed: 0.4 + Math.random() * 0.8,
        wobble: Math.random() * Math.PI * 2,
        alpha: 0.2 + Math.random() * 0.4
      });
    }

    this.initSeaweed();
  }

  initSeaweed() {
    this.seaweed = [];
    const count = Math.floor(this.width / 60);
    for (let i = 0; i < count; i++) {
      this.seaweed.push({
        x: i * 60 + Math.random() * 20,
        height: 80 + Math.random() * 120,
        blades: 3 + Math.floor(Math.random() * 3),
        phase: Math.random() * Math.PI * 2,
        speed: 0.02 + Math.random() * 0.02
      });
    }
  }

  setupListeners() {
    window.addEventListener('resize', () => this.resizeCanvas());

    // Single gameplay action: Click or Touch
    const handleAction = (e) => {
      // Prevent action if clicking UI elements / modals
      if (e.target.closest('#ui-overlay') && !e.target.closest('#game-touch-area')) {
        return;
      }
      if (this.state === 'PLAYING') {
        this.triggerHook();
      }
    };

    window.addEventListener('pointerdown', (e) => {
      // Ignore if clicking on interactive UI buttons
      if (e.target.tagName === 'BUTTON' || e.target.closest('.modal-card') || e.target.closest('.hud-btn')) {
        return;
      }
      window.soundManager.init();
      handleAction(e);
    });
  }

  startNewGame(challengeContext = null) {
    this.state = 'PLAYING';
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.levelName = 'Small Fish';
    this.fishList = [];
    this.catchesLog = [];
    this.startTime = Date.now();
    this.activeChallenge = challengeContext;

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

  updateHUD() {
    if (window.uiManager) {
      window.uiManager.updateHUD({
        score: this.score,
        bestScore: this.bestScore,
        lives: this.lives,
        level: this.level,
        levelName: this.levelName
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
      canvasWidth: this.width,
      canvasHeight: this.height
    });

    this.fishList.push(fish);
  }

  checkLevelUp() {
    let newLevel = 1;
    let name = 'Small Fish';

    if (this.score >= 500) {
      newLevel = 5;
      name = 'Bioluminescent Abyss';
    } else if (this.score >= 300) {
      newLevel = 4;
      name = 'Shark Waters';
    } else if (this.score >= 150) {
      newLevel = 3;
      name = 'Large Sea Creatures';
    } else if (this.score >= 50) {
      newLevel = 2;
      name = 'Medium Fish';
    }

    if (newLevel > this.level) {
      this.level = newLevel;
      this.levelName = name;
      this.maxFishCount = 6 + (this.level - 1);
      window.soundManager.playLevelUp();

      // Show level up banner
      this.levelUpBanner = {
        level: this.level,
        name: this.levelName,
        timer: 120 // 2 seconds at 60fps
      };

      this.updateHUD();
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'MENU') return;

    // Update Bubbles
    for (const b of this.bubbles) {
      b.y -= b.speed;
      b.wobble += 0.05;
      b.x += Math.sin(b.wobble) * 0.4;
      if (b.y < -10) {
        b.y = this.height + 10;
        b.x = Math.random() * this.width;
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
      fish.update(dt, this.width, this.height);

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

    // Level up banner timer
    if (this.levelUpBanner) {
      this.levelUpBanner.timer--;
      if (this.levelUpBanner.timer <= 0) {
        this.levelUpBanner = null;
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

  async handleGameOver() {
    this.state = 'GAMEOVER';
    window.soundManager.playGameOver();

    const durationSeconds = (Date.now() - this.startTime) / 1000;

    // Submit score to backend with telemetry audit
    let result = { bestScore: this.bestScore, isNewBest: false };
    if (window.apiClient && window.apiClient.token) {
      try {
        result = await window.apiClient.submitScore(this.score, durationSeconds, this.catchesLog);
        if (result.bestScore) {
          this.bestScore = result.bestScore;
        }
      } catch (err) {
        console.error('Score submission error:', err);
      }
    } else {
      // Local fallback
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        result.isNewBest = true;
      }
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

    // 8. Draw Level Up Notification Overlay
    if (this.levelUpBanner) {
      this.drawLevelUpBanner();
    }
  }

  drawBiomeBackground() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.height);

    switch (this.level) {
      case 1: // Shallow Reef
        grad.addColorStop(0, '#00b4d8');
        grad.addColorStop(0.4, '#0077b6');
        grad.addColorStop(1, '#03045e');
        break;
      case 2: // Mid Ocean
        grad.addColorStop(0, '#0077b6');
        grad.addColorStop(0.5, '#03045e');
        grad.addColorStop(1, '#020122');
        break;
      case 3: // Deep Azure
        grad.addColorStop(0, '#03045e');
        grad.addColorStop(0.6, '#020122');
        grad.addColorStop(1, '#000814');
        break;
      case 4: // Shark Waters
        grad.addColorStop(0, '#020122');
        grad.addColorStop(0.5, '#08121e');
        grad.addColorStop(1, '#01050a');
        break;
      case 5: // Bioluminescent Abyss
        grad.addColorStop(0, '#06101e');
        grad.addColorStop(0.5, '#02060d');
        grad.addColorStop(1, '#000205');
        break;
      default:
        grad.addColorStop(0, '#00b4d8');
        grad.addColorStop(1, '#03045e');
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

    // Ocean floor ground silhouette
    this.ctx.fillStyle = '#010a14';
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    for (let x = 0; x <= this.width; x += 40) {
      const y = this.height - 30 - Math.sin(x * 0.01) * 15;
      this.ctx.lineTo(x, y);
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.closePath();
    this.ctx.fill();

    // Seaweed waving
    const time = Date.now() * 0.002;
    for (const sw of this.seaweed) {
      const wave = Math.sin(time + sw.phase) * 15;
      this.ctx.strokeStyle = '#005f73';
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
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.hook.x, 0);
    this.ctx.lineTo(this.hook.x, this.hook.y);
    this.ctx.stroke();

    // Metallic Hook Graphic
    const hx = this.hook.x;
    const hy = this.hook.y;

    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    // Hook Eyelet
    this.ctx.beginPath();
    this.ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    this.ctx.stroke();

    // Hook Shank & Curve
    this.ctx.beginPath();
    this.ctx.moveTo(hx, hy + 4);
    this.ctx.lineTo(hx, hy + 22);
    this.ctx.arc(hx - 8, hy + 22, 8, 0, Math.PI);
    this.ctx.lineTo(hx - 16, hy + 14);
    this.ctx.stroke();

    // Barb tip
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.moveTo(hx - 16, hy + 14);
    this.ctx.lineTo(hx - 20, hy + 16);
    this.ctx.lineTo(hx - 14, hy + 18);
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

  drawLevelUpBanner() {
    if (!this.levelUpBanner) return;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 15, 30, 0.85)';
    this.ctx.fillRect(0, this.height * 0.38, this.width, 110);

    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, this.height * 0.38, this.width, 110);

    this.ctx.textAlign = 'center';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 12;

    this.ctx.fillStyle = '#ffea00';
    this.ctx.font = '900 28px "Outfit", sans-serif';
    this.ctx.fillText('LEVEL UP!', this.width / 2, this.height * 0.44);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '600 20px "Outfit", sans-serif';
    this.ctx.fillText(`🌊 LEVEL ${this.levelUpBanner.level}: ${this.levelUpBanner.name.toUpperCase()} 🌊`, this.width / 2, this.height * 0.49);

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
