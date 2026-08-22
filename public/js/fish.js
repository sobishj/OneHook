class Fish {
  constructor(config) {
    this.id = 'fish_' + Math.random().toString(36).substr(2, 9);
    this.species = config.species;
    this.stage = config.stage;
    this.points = config.points;
    this.width = config.width || 40;
    this.height = config.height || 24;
    this.color1 = config.color1 || '#ff7700';
    this.color2 = config.color2 || '#ffffff';
    this.color3 = config.color3 || '#333333';
    this.rawSpeed = config.speed || 1.4;
    this.level = config.level || 1;
    this.isErratic = config.isErratic || false;

    // Speed scales dynamically with level: gentle at level 1, increasing with each level
    const levelScale = 1 + (this.level - 1) * 0.35;
    // Gentle & calm initial speeds like earlier version
    const isMobile = (config.canvasWidth && config.canvasWidth < 768) || (typeof window !== 'undefined' && window.innerWidth < 768);
    const mobileBoost = isMobile ? 1.35 : 1.0;
    this.baseSpeed = this.rawSpeed * levelScale * mobileBoost;

    // Spatial properties
    this.direction = Math.random() > 0.5 ? 1 : -1; // 1 = right, -1 = left
    this.x = this.direction === 1 ? -this.width - 20 : config.canvasWidth + this.width + 20;
    this.y = config.y || Math.random() * (config.canvasHeight * 0.65) + (config.canvasHeight * 0.22);
    this.targetY = this.y;

    this.vx = this.direction * (this.baseSpeed + Math.random() * 0.3);
    this.vy = 0;

    this.swimPhase = Math.random() * Math.PI * 2;
    this.swimSpeed = 0.11 + (this.baseSpeed * 0.02);

    this.isCaught = false;
    this.strugglePhase = 0;

    // Rare natural turning behavior (~12% of fish can turn, most swim straight through)
    this.canTurn = Math.random() < 0.12;
    this.isTurning = false;
    this.turnProgress = 0;
    this.turnsCount = 0;
    this.maxTurns = 1;
    this.facingScaleX = this.direction;
    this.turnCooldown = 220 + Math.floor(Math.random() * 250);
  }

  updateLevel(newLevel) {
    this.level = newLevel;
    const levelScale = 1 + (this.level - 1) * 0.35;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const mobileBoost = isMobile ? 1.35 : 1.0;
    this.baseSpeed = this.rawSpeed * levelScale * mobileBoost;
    this.vx = (this.isTurning ? this.facingScaleX : this.direction) * (this.baseSpeed + Math.random() * 0.3);
    this.swimSpeed = 0.11 + (this.baseSpeed * 0.02);
  }

  scare(scareX, canvasHeight) {
    this.isScared = true;
    this.scareTimer = 60 + Math.random() * 60; // Panic for 1-2 seconds

    if (Math.random() < 0.25) {
      // 25% chance to go back
      this.isTurning = true;
      this.turnProgress = 0;
      this.targetDirection = -this.direction;
    } else {
      // Remaining 75% go downward or upward randomly
      const depthDelta = (Math.random() > 0.5 ? 80 : -80);
      this.targetY = Math.min(canvasHeight * 0.80, Math.max(canvasHeight * 0.20, this.y + depthDelta));
    }
  }

  update(dt, canvasWidth, canvasHeight, engine) {
    const frameScale = Math.min(2.5, Math.max(0.5, (dt || 0.0166) * 60));

    if (this.isCaught) {
      this.strugglePhase += 0.4 * frameScale;
      return;
    }

    if (this.isScared) {
      this.scareTimer -= 1 * frameScale;
      if (this.scareTimer <= 0) {
        this.isScared = false;
      }
    }

    this.swimPhase += this.swimSpeed * (this.isScared ? 2 : 1) * frameScale;

    // Organic vertical sine bobbing
    this.y += Math.sin(this.swimPhase * 0.7) * (this.isScared ? 0.8 : 0.35) * frameScale;

    // Natural smooth turn execution
    if (this.isTurning) {
      this.turnProgress += (this.isScared ? 0.08 : 0.045) * frameScale; // ~22 frames smooth turn (~0.35s)
      
      // Cosine interpolation from current direction to new direction for 3D flip effect
      this.facingScaleX = this.direction * Math.cos(this.turnProgress * Math.PI);
      
      // Speed dips smoothly at turn apex and accelerates out
      const speedMagnitude = Math.max(0.2, Math.abs(this.facingScaleX));
      const currentSpeed = this.baseSpeed * (this.isScared ? 2.5 : 1);
      this.vx = Math.sign(this.facingScaleX || this.targetDirection) * currentSpeed * speedMagnitude;

      if (this.turnProgress >= 1.0) {
        this.direction = this.targetDirection;
        this.facingScaleX = this.direction;
        this.isTurning = false;
        this.turnsCount++;
        this.vx = this.direction * (currentSpeed + Math.random() * 0.2);
      }
    } else {
      this.facingScaleX = this.direction;
      const currentSpeed = this.baseSpeed * (this.isScared ? 2.5 : 1);
      this.vx = this.direction * currentSpeed;

      // Safe & Rare Turning Check: STRICTLY NEVER TURN NEAR THE CENTER TO PREVENT DODGING / CHEATING
      // Center zone [30% - 70%] is 100% turn-free!
      if (this.canTurn && this.turnsCount < this.maxTurns) {
        this.turnCooldown -= 1 * frameScale;

        const inLeftFlank = this.x > 80 && this.x < canvasWidth * 0.30;
        const inRightFlank = this.x > canvasWidth * 0.70 && this.x < canvasWidth - 80;

        // Rare trigger: requires cooldown expired + in outer side flank + rare random roll
        if (this.turnCooldown <= 0 && (inLeftFlank || inRightFlank) && Math.random() < 0.015) {
          // Trigger smooth natural turn
          this.isTurning = true;
          this.turnProgress = 0;
          this.targetDirection = -this.direction;
          
          // Slight vertical depth shift for organic swimming
          const depthDelta = (Math.random() - 0.5) * 40;
          this.targetY = Math.min(canvasHeight * 0.80, Math.max(canvasHeight * 0.24, this.y + depthDelta));
        }
      }
    }

    this.x += this.vx * frameScale;

    // Spawn bubbles when moving fast (scared) or turning
    if (engine && (this.isScared || this.isTurning)) {
      if (Math.random() < (this.isScared ? 0.05 : 0.015)) {
        const fishWidthFactor = this.width / 40; // Normalize size to default
        engine.bubbles.push({
          x: this.direction === 1 ? this.x - this.width/2 : this.x + this.width/2,
          y: this.y + (Math.random() * 10 - 5),
          radius: (1.5 + Math.random() * 2) * fishWidthFactor, // bigger bubbles for bigger fish
          speed: 1.0 + Math.random() * 2.0,
          wobble: Math.random() * Math.PI * 2,
          alpha: 0.4 + Math.random() * 0.3
        });
      }
    }

    // Smoothly drift toward targetY if set
    if (Math.abs(this.y - this.targetY) > 1.5) {
      this.y += (this.targetY - this.y) * 0.025 * frameScale;
    }
  }

  isOffscreen(canvasWidth) {
    if (this.direction === 1 && this.x > canvasWidth + this.width + 100) return true;
    if (this.direction === -1 && this.x < -this.width - 100) return true;
    return false;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.isCaught) {
      // Wiggle violently when caught
      ctx.rotate((Math.sin(this.strugglePhase) * 0.3) + Math.PI / 2);
    } else {
      // Smooth 3D-like scale transition for natural turning
      ctx.scale(this.facingScaleX, 1);

      // Slight pitch based on vertical motion + turning tilt
      const pitch = Math.sin(this.swimPhase * 0.7) * 0.05;
      ctx.rotate(pitch);
    }

    const tailWiggle = Math.sin(this.swimPhase) * 6;
    const w = this.width;
    const h = this.height;

    switch (this.species) {
      case 'clownfish':
        this.drawClownfish(ctx, w, h, tailWiggle);
        break;
      case 'blue_tang':
        this.drawBlueTang(ctx, w, h, tailWiggle);
        break;
      case 'yellow_sailfin':
        this.drawYellowSailfin(ctx, w, h, tailWiggle);
        break;
      case 'angelfish':
        this.drawAngelfish(ctx, w, h, tailWiggle);
        break;
      case 'red_snapper':
        this.drawRedSnapper(ctx, w, h, tailWiggle);
        break;
      case 'barracuda':
        this.drawBarracuda(ctx, w, h, tailWiggle);
        break;
      case 'swordfish':
        this.drawSwordfish(ctx, w, h, tailWiggle);
        break;
      case 'manta_ray':
        this.drawMantaRay(ctx, w, h, tailWiggle);
        break;
      case 'shark':
        this.drawShark(ctx, w, h, tailWiggle);
        break;
      case 'jellyfish':
        this.drawJellyfish(ctx, w, h, tailWiggle);
        break;
      case 'golden_fish':
        this.drawGoldenFish(ctx, w, h, tailWiggle);
        break;
      case 'whale':
        this.drawWhale(ctx, w, h, tailWiggle);
        break;
      default:
        this.drawClownfish(ctx, w, h, tailWiggle);
    }

    ctx.restore();
  }

  drawClownfish(ctx, w, h, tailWiggle) {
    // 1. Fins (Dorsal, Pelvic & Anal) with delicate dark accents
    ctx.fillStyle = '#ff6a00';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, -h * 0.35);
    ctx.quadraticCurveTo(0, -h * 0.72, w * 0.2, -h * 0.3);
    ctx.lineTo(w * 0.08, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pelvic & Anal Fins
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h * 0.35);
    ctx.quadraticCurveTo(0, h * 0.65, w * 0.15, h * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Caudal Fin (Tail Fan with natural undulating wiggle)
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.42, -w * 0.55 + tailWiggle, -h * 0.46);
    ctx.quadraticCurveTo(-w * 0.48 + tailWiggle * 0.5, 0, -w * 0.55 + tailWiggle, h * 0.46);
    ctx.quadraticCurveTo(-w * 0.45, h * 0.42, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Hydrodynamic Body with organic orange gradient
    const bodyGrad = ctx.createRadialGradient(w * 0.1, -h * 0.1, 2, 0, 0, w * 0.55);
    bodyGrad.addColorStop(0, '#ff9638');
    bodyGrad.addColorStop(0.5, '#ff6e00');
    bodyGrad.addColorStop(1, '#e05200');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.bezierCurveTo(-w * 0.35, -h * 0.52, w * 0.2, -h * 0.5, w * 0.42, -h * 0.05);
    ctx.bezierCurveTo(w * 0.45, 0, w * 0.42, h * 0.1, w * 0.38, h * 0.2);
    ctx.bezierCurveTo(w * 0.15, h * 0.52, -w * 0.32, h * 0.45, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Natural Curved White Bands (with subtle dark velvety borders)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.2;

    // Head Band (curving behind the eye)
    ctx.beginPath();
    ctx.moveTo(w * 0.15, -h * 0.44);
    ctx.quadraticCurveTo(w * 0.22, 0, w * 0.12, h * 0.44);
    ctx.lineTo(w * 0.05, h * 0.45);
    ctx.quadraticCurveTo(w * 0.14, 0, w * 0.08, -h * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Middle Band (organic hourglass curve)
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, -h * 0.44);
    ctx.quadraticCurveTo(-w * 0.02, 0, -w * 0.1, h * 0.44);
    ctx.lineTo(-w * 0.17, h * 0.38);
    ctx.quadraticCurveTo(-w * 0.11, 0, -w * 0.15, -h * 0.40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Tail Peduncle Band
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.22);
    ctx.lineTo(-w * 0.32, h * 0.22);
    ctx.lineTo(-w * 0.37, h * 0.18);
    ctx.lineTo(-w * 0.37, -h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Pectoral Fin (undulating translucent side fin)
    const pecWiggle = Math.sin(this.swimPhase * 1.5) * 3.5;
    ctx.fillStyle = 'rgba(255, 145, 45, 0.85)';
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.05);
    ctx.quadraticCurveTo(w * 0.12 + pecWiggle, h * 0.3, -w * 0.05 + pecWiggle, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Realistic Fish Eye (obsidian pupil with amber ring and specular light reflection)
    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.1, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.1, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.26, -h * 0.12, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBlueTang(ctx, w, h, tailWiggle) {
    // 1. Caudal Fin (Yellow crescent tail)
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.45, -w * 0.55 + tailWiggle, -h * 0.5);
    ctx.quadraticCurveTo(-w * 0.46 + tailWiggle * 0.5, 0, -w * 0.55 + tailWiggle, h * 0.5);
    ctx.quadraticCurveTo(-w * 0.45, h * 0.45, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Hydrodynamic Oval Body with rich royal blue gradient
    const tangGrad = ctx.createRadialGradient(w * 0.1, -h * 0.1, 2, 0, 0, w * 0.55);
    tangGrad.addColorStop(0, '#3b82f6');
    tangGrad.addColorStop(0.5, '#1d4ed8');
    tangGrad.addColorStop(1, '#1e3a8a');

    ctx.fillStyle = tangGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.bezierCurveTo(-w * 0.35, -h * 0.55, w * 0.2, -h * 0.52, w * 0.42, -h * 0.05);
    ctx.bezierCurveTo(w * 0.45, 0, w * 0.42, h * 0.1, w * 0.38, h * 0.22);
    ctx.bezierCurveTo(w * 0.15, h * 0.56, -w * 0.32, h * 0.5, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Velvet Black Palette Marking
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h * 0.38);
    ctx.quadraticCurveTo(-w * 0.1, -h * 0.42, -w * 0.35, -h * 0.15);
    ctx.quadraticCurveTo(-w * 0.25, 0, -w * 0.35, h * 0.15);
    ctx.quadraticCurveTo(-w * 0.1, h * 0.38, w * 0.05, h * 0.15);
    ctx.quadraticCurveTo(0, 0, w * 0.1, -h * 0.38);
    ctx.closePath();
    ctx.fill();

    // 4. Realistic Eye
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.26, -h * 0.14, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawYellowSailfin(ctx, w, h, tailWiggle) {
    // 1. High Dorsal & Ventral Fins (Translucent lemon yellow)
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1;

    // Tall Dorsal Fin
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, -h * 0.4);
    ctx.quadraticCurveTo(0, -h * 0.85, w * 0.18, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ventral Fin
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, h * 0.4);
    ctx.quadraticCurveTo(0, h * 0.8, w * 0.18, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Caudal Tail
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.quadraticCurveTo(-w * 0.45, -h * 0.35, -w * 0.52 + tailWiggle, -h * 0.4);
    ctx.quadraticCurveTo(-w * 0.45 + tailWiggle * 0.5, 0, -w * 0.52 + tailWiggle, h * 0.4);
    ctx.quadraticCurveTo(-w * 0.45, h * 0.35, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Disc Body with warm yellow gradient
    const yellowGrad = ctx.createRadialGradient(w * 0.08, -h * 0.05, 2, 0, 0, w * 0.5);
    yellowGrad.addColorStop(0, '#fef08a');
    yellowGrad.addColorStop(0.5, '#eab308');
    yellowGrad.addColorStop(1, '#ca8a04');

    ctx.fillStyle = yellowGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.bezierCurveTo(-w * 0.28, -h * 0.58, w * 0.18, -h * 0.55, w * 0.42, -h * 0.02);
    ctx.bezierCurveTo(w * 0.45, 0, w * 0.42, h * 0.05, w * 0.38, h * 0.15);
    ctx.bezierCurveTo(w * 0.15, h * 0.58, -w * 0.25, h * 0.55, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 4. White Scalpel Spine dot near tail
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-w * 0.28, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Realistic Eye
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(w * 0.26, -h * 0.1, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.26, -h * 0.1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.12, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAngelfish(ctx, w, h, tailWiggle) {
    // 1. Long Elegant Triangular Fins
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1;

    // Tall Dorsal Filament
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.4);
    ctx.lineTo(-w * 0.2, -h * 1.15);
    ctx.lineTo(w * 0.18, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Long Ventral Filament
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h * 0.4);
    ctx.lineTo(-w * 0.2, h * 1.15);
    ctx.lineTo(w * 0.18, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Caudal Tail
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.lineTo(-w * 0.52 + tailWiggle, -h * 0.45);
    ctx.lineTo(-w * 0.52 + tailWiggle, h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Diamond Disc Body (Silver-Azure Gradient)
    const angelGrad = ctx.createLinearGradient(-w * 0.3, 0, w * 0.3, 0);
    angelGrad.addColorStop(0, '#bae6fd');
    angelGrad.addColorStop(0.5, '#f0f9ff');
    angelGrad.addColorStop(1, '#7dd3fc');

    ctx.fillStyle = angelGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.quadraticCurveTo(-w * 0.1, -h * 0.55, w * 0.38, 0);
    ctx.quadraticCurveTo(-w * 0.1, h * 0.55, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Subtle Iridescent Blue Vertical Stripes
    ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, -h * 0.45);
    ctx.lineTo(-w * 0.04, -h * 0.45);
    ctx.lineTo(-w * 0.04, h * 0.45);
    ctx.lineTo(-w * 0.12, h * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h * 0.35);
    ctx.lineTo(w * 0.16, -h * 0.35);
    ctx.lineTo(w * 0.16, h * 0.35);
    ctx.lineTo(w * 0.1, h * 0.35);
    ctx.closePath();
    ctx.fill();

    // 5. Eye
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.08, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.08, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.22, -h * 0.1, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRedSnapper(ctx, w, h, tailWiggle) {
    // 1. Spiny Dorsal Fin
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -h * 0.35);
    ctx.quadraticCurveTo(0, -h * 0.75, w * 0.2, -h * 0.35);
    ctx.closePath();
    ctx.fill();

    // 2. Caudal Fork Tail
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, -h * 0.48);
    ctx.lineTo(-w * 0.45 + tailWiggle * 0.5, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, h * 0.48);
    ctx.closePath();
    ctx.fill();

    // 3. Muscular Crimson Predatory Body
    const snapperGrad = ctx.createRadialGradient(w * 0.1, -h * 0.1, 2, 0, 0, w * 0.5);
    snapperGrad.addColorStop(0, '#f87171');
    snapperGrad.addColorStop(0.5, '#ef4444');
    snapperGrad.addColorStop(1, '#b91c1c');

    ctx.fillStyle = snapperGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.bezierCurveTo(-w * 0.3, -h * 0.5, w * 0.2, -h * 0.45, w * 0.45, -h * 0.05);
    ctx.bezierCurveTo(w * 0.48, 0, w * 0.45, h * 0.1, w * 0.4, h * 0.2);
    ctx.bezierCurveTo(w * 0.15, h * 0.5, -w * 0.25, h * 0.45, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Eye
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 2.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBarracuda(ctx, w, h, tailWiggle) {
    // 1. Forked Caudal Tail
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, -h * 0.45);
    ctx.lineTo(-w * 0.46 + tailWiggle * 0.5, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, h * 0.45);
    ctx.closePath();
    ctx.fill();

    // 2. Long Sleek Silver Torpedo Body
    const barraGrad = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.4);
    barraGrad.addColorStop(0, '#475569');
    barraGrad.addColorStop(0.4, '#cbd5e1');
    barraGrad.addColorStop(1, '#f1f5f9');

    ctx.fillStyle = barraGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.bezierCurveTo(-w * 0.3, -h * 0.4, w * 0.3, -h * 0.3, w * 0.5, 0);
    ctx.bezierCurveTo(w * 0.3, h * 0.3, -w * 0.3, h * 0.4, -w * 0.4, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Subtle Chevron Bars
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = -0.25; i <= 0.2; i += 0.08) {
      ctx.beginPath();
      ctx.moveTo(w * i, -h * 0.25);
      ctx.lineTo(w * (i + 0.03), 0);
      ctx.lineTo(w * i, h * 0.25);
      ctx.stroke();
    }

    // 4. Sharp Eye
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(w * 0.36, -h * 0.08, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.36, -h * 0.08, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.34, -h * 0.1, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSwordfish(ctx, w, h, tailWiggle) {
    // 1. Crescent Tail
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.lineTo(-w * 0.52 + tailWiggle, -h * 0.7);
    ctx.lineTo(-w * 0.42 + tailWiggle * 0.5, 0);
    ctx.lineTo(-w * 0.52 + tailWiggle, h * 0.7);
    ctx.closePath();
    ctx.fill();

    // 2. High Curved Dorsal Sail
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, -h * 0.35);
    ctx.quadraticCurveTo(0, -h * 1.1, w * 0.18, -h * 0.3);
    ctx.closePath();
    ctx.fill();

    // 3. Muscular Streamlined Navy Body
    const swordGrad = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.4);
    swordGrad.addColorStop(0, '#0f172a');
    swordGrad.addColorStop(0.5, '#1e3a8a');
    swordGrad.addColorStop(1, '#e0f2fe');

    ctx.fillStyle = swordGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.bezierCurveTo(-w * 0.25, -h * 0.45, w * 0.2, -h * 0.4, w * 0.35, -h * 0.05);
    ctx.bezierCurveTo(w * 0.25, h * 0.4, -w * 0.25, h * 0.45, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Sharp Sword Bill
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, -h * 0.05);
    ctx.lineTo(w * 0.65, 0);
    ctx.lineTo(w * 0.35, h * 0.05);
    ctx.closePath();
    ctx.fill();

    // 5. Eye
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.1, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.24, -h * 0.1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.22, -h * 0.12, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMantaRay(ctx, w, h, tailWiggle) {
    // 1. Long Whip Tail
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, 0);
    ctx.quadraticCurveTo(-w * 0.45, tailWiggle, -w * 0.68, tailWiggle * 1.5);
    ctx.stroke();

    // 2. Wing Flap Animation
    const wingFlap = Math.sin(this.swimPhase * 0.8) * 8;

    // 3. Diamond Wing Body with smooth shading
    const mantaGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, w * 0.45);
    mantaGrad.addColorStop(0, '#334155');
    mantaGrad.addColorStop(0.7, '#1e293b');
    mantaGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = mantaGrad;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, 0);
    ctx.quadraticCurveTo(0, -h * 0.9 - wingFlap, -w * 0.28, -h * 0.2);
    ctx.lineTo(-w * 0.28, h * 0.2);
    ctx.quadraticCurveTo(0, h * 0.9 + wingFlap, w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Cephalic Horn Highlights
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.2, 2.5, 0, Math.PI * 2);
    ctx.arc(w * 0.3, h * 0.2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShark(ctx, w, h, tailWiggle) {
    // 1. Tail Fin
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.lineTo(-w * 0.56 + tailWiggle, -h * 0.75);
    ctx.lineTo(-w * 0.44 + tailWiggle * 0.5, 0);
    ctx.lineTo(-w * 0.56 + tailWiggle, h * 0.55);
    ctx.closePath();
    ctx.fill();

    // 2. Dorsal Fin
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.08, -h * 0.35);
    ctx.lineTo(w * 0.06, -h * 1.05);
    ctx.lineTo(w * 0.22, -h * 0.32);
    ctx.closePath();
    ctx.fill();

    // 3. Counter-shaded Body (Dark slate top, clean light underbelly)
    const sharkGrad = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.4);
    sharkGrad.addColorStop(0, '#1e293b');
    sharkGrad.addColorStop(0.55, '#475569');
    sharkGrad.addColorStop(1, '#f1f5f9');

    ctx.fillStyle = sharkGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.bezierCurveTo(-w * 0.28, -h * 0.48, w * 0.25, -h * 0.42, w * 0.46, -h * 0.05);
    ctx.bezierCurveTo(w * 0.42, h * 0.15, w * 0.2, h * 0.45, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();

    // 4. Gill Slits
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.08 + i * 4, 0, 6, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
    }

    // 5. Intense Predatory Eye
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawJellyfish(ctx, w, h, tailWiggle) {
    const pulse = Math.sin(this.swimPhase * 1.5) * 4;

    // 1. Translucent Umbrella Dome
    const bellGrad = ctx.createRadialGradient(0, -pulse, 2, 0, -pulse, w * 0.5);
    bellGrad.addColorStop(0, 'rgba(244, 114, 182, 0.85)');
    bellGrad.addColorStop(0.7, 'rgba(236, 72, 153, 0.5)');
    bellGrad.addColorStop(1, 'rgba(192, 132, 252, 0.2)');

    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.arc(0, -pulse, w * 0.45, Math.PI, 0);
    ctx.quadraticCurveTo(0, pulse * 0.5, -w * 0.45, -pulse);
    ctx.closePath();
    ctx.fill();

    // 2. Bioluminescent Core
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(0, -pulse - 4, w * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Flowing Wavy Tentacles
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.75)';
    ctx.lineWidth = 1.8;
    for (let i = -w * 0.3; i <= w * 0.3; i += w * 0.15) {
      ctx.beginPath();
      ctx.moveTo(i, -pulse);
      ctx.quadraticCurveTo(i + tailWiggle, h * 0.7, i - tailWiggle, h * 1.3);
      ctx.stroke();
    }
  }

  drawGoldenFish(ctx, w, h, tailWiggle) {
    // 1. Flowing Golden Tail Fins
    ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.quadraticCurveTo(-w * 0.48, -h * 0.6, -w * 0.6 + tailWiggle, -h * 0.65);
    ctx.quadraticCurveTo(-w * 0.46 + tailWiggle * 0.5, 0, -w * 0.6 + tailWiggle, h * 0.65);
    ctx.quadraticCurveTo(-w * 0.48, h * 0.6, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Shimmering Gold Body
    const goldGrad = ctx.createRadialGradient(w * 0.1, -h * 0.1, 2, 0, 0, w * 0.55);
    goldGrad.addColorStop(0, '#fef08a');
    goldGrad.addColorStop(0.4, '#fbbf24');
    goldGrad.addColorStop(0.8, '#f59e0b');
    goldGrad.addColorStop(1, '#d97706');

    ctx.fillStyle = goldGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.bezierCurveTo(-w * 0.3, -h * 0.52, w * 0.2, -h * 0.48, w * 0.42, -h * 0.05);
    ctx.bezierCurveTo(w * 0.45, 0, w * 0.42, h * 0.1, w * 0.38, h * 0.2);
    ctx.bezierCurveTo(w * 0.15, h * 0.52, -w * 0.28, h * 0.48, -w * 0.35, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.1, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.1, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.26, -h * 0.12, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWhale(ctx, w, h, tailWiggle) {
    // 1. Tail Fluke
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, -h * 0.85);
    ctx.lineTo(-w * 0.46 + tailWiggle * 0.5, 0);
    ctx.lineTo(-w * 0.55 + tailWiggle, h * 0.85);
    ctx.closePath();
    ctx.fill();

    // 2. Massive Hydrodynamic Body
    const whaleGrad = ctx.createLinearGradient(0, -h * 0.45, 0, h * 0.45);
    whaleGrad.addColorStop(0, '#1e293b');
    whaleGrad.addColorStop(0.55, '#334155');
    whaleGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = whaleGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.bezierCurveTo(-w * 0.25, -h * 0.52, w * 0.3, -h * 0.48, w * 0.48, 0);
    ctx.bezierCurveTo(w * 0.3, h * 0.48, -w * 0.25, h * 0.52, -w * 0.38, 0);
    ctx.closePath();
    ctx.fill();

    // 3. Eye
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(w * 0.32, -h * 0.08, 3.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Fish Factory Configs for Stages 1-5
const FISH_SPECIES_CONFIGS = {
  // Stage 1 (Smooth & Gentle starting speeds)
  clownfish: { species: 'clownfish', stage: 1, points: 2, width: 44, height: 26, speed: 1.3 },
  blue_tang: { species: 'blue_tang', stage: 1, points: 3, width: 48, height: 28, speed: 1.5 },
  yellow_sailfin: { species: 'yellow_sailfin', stage: 1, points: 3, width: 46, height: 32, speed: 1.4 },

  // Stage 2
  angelfish: { species: 'angelfish', stage: 2, points: 5, width: 56, height: 42, speed: 1.8 },
  red_snapper: { species: 'red_snapper', stage: 2, points: 7, width: 62, height: 34, speed: 2.1 },
  barracuda: { species: 'barracuda', stage: 2, points: 10, width: 75, height: 26, speed: 2.5 },

  // Stage 3
  swordfish: { species: 'swordfish', stage: 3, points: 18, width: 95, height: 36, speed: 2.9 },
  manta_ray: { species: 'manta_ray', stage: 3, points: 20, width: 90, height: 45, speed: 1.9 },

  // Stage 4
  shark: { species: 'shark', stage: 4, points: 50, width: 115, height: 48, speed: 3.4, isErratic: true },

  // Stage 5
  golden_fish: { species: 'golden_fish', stage: 5, points: 75, width: 65, height: 35, speed: 3.8 },
  jellyfish: { species: 'jellyfish', stage: 5, points: 60, width: 55, height: 60, speed: 1.4 },
  whale: { species: 'whale', stage: 5, points: 100, width: 150, height: 75, speed: 1.6 }
};

window.Fish = Fish;
window.FISH_SPECIES_CONFIGS = FISH_SPECIES_CONFIGS;
