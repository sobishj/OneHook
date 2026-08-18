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
    this.baseSpeed = this.rawSpeed * levelScale;

    // Spatial properties
    this.direction = Math.random() > 0.5 ? 1 : -1; // 1 = right, -1 = left
    this.x = this.direction === 1 ? -this.width - 20 : config.canvasWidth + this.width + 20;
    this.y = config.y || Math.random() * (config.canvasHeight * 0.65) + (config.canvasHeight * 0.22);
    this.targetY = this.y;

    this.vx = this.direction * (this.baseSpeed + Math.random() * 0.3);
    this.vy = 0;

    this.swimPhase = Math.random() * Math.PI * 2;
    this.swimSpeed = 0.10 + (this.baseSpeed * 0.02);

    this.isCaught = false;
    this.strugglePhase = 0;

    // Direction shift timer for sharks & erratic fish
    this.nextTurnTime = Date.now() + 2000 + Math.random() * 3000;
  }

  updateLevel(newLevel) {
    this.level = newLevel;
    const levelScale = 1 + (this.level - 1) * 0.35;
    this.baseSpeed = this.rawSpeed * levelScale;
    this.vx = this.direction * (this.baseSpeed + Math.random() * 0.3);
    this.swimSpeed = 0.10 + (this.baseSpeed * 0.02);
  }

  update(dt, canvasWidth, canvasHeight) {
    if (this.isCaught) {
      this.strugglePhase += 0.4;
      return;
    }

    this.swimPhase += this.swimSpeed;

    // Organic vertical sine bobbing
    this.y += Math.sin(this.swimPhase * 0.7) * 0.4;

    // Erratic turn logic for sharks and fast species
    if (this.isErratic && Date.now() > this.nextTurnTime) {
      this.direction *= -1;
      this.vx = this.direction * (this.baseSpeed + Math.random() * 1.5);
      this.nextTurnTime = Date.now() + 1500 + Math.random() * 2500;
    }

    this.x += this.vx;

    // Smoothly drift toward targetY if set
    if (Math.abs(this.y - this.targetY) > 2) {
      this.y += (this.targetY - this.y) * 0.02;
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
      if (this.direction === -1) {
        ctx.scale(-1, 1);
      }
      // Slight pitch based on vertical motion
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
    // Tail
    ctx.fillStyle = '#ff6600';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 5, 0);
    ctx.lineTo(-w / 2 - 12 + tailWiggle, -h / 2 + 2);
    ctx.lineTo(-w / 2 - 12 + tailWiggle, h / 2 - 2);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = '#ff7700';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Stripes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w * 0.15, -h * 0.45, w * 0.12, h * 0.9);
    ctx.fillRect(w * 0.15, -h * 0.35, w * 0.1, h * 0.7);

    // Stripe Outlines
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w * 0.15, -h * 0.45, w * 0.12, h * 0.9);

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.32, -h * 0.15, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBlueTang(ctx, w, h, tailWiggle) {
    // Tail (Yellow)
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 14 + tailWiggle, -h / 2);
    ctx.lineTo(-w / 2 - 14 + tailWiggle, h / 2);
    ctx.fill();

    // Body (Deep Blue)
    ctx.fillStyle = '#1e50ff';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark Accent Stripe
    ctx.fillStyle = '#0b1640';
    ctx.beginPath();
    ctx.ellipse(-w * 0.05, 0, w * 0.3, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.15, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawYellowSailfin(ctx, w, h, tailWiggle) {
    // Large top fin
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -h * 0.4);
    ctx.lineTo(0, -h * 0.9);
    ctx.lineTo(w * 0.2, -h * 0.4);
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 12 + tailWiggle, -h / 3);
    ctx.lineTo(-w / 2 - 12 + tailWiggle, h / 3);
    ctx.fill();

    // Body
    ctx.fillStyle = '#ffae00';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAngelfish(ctx, w, h, tailWiggle) {
    // Elegant fins
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.4);
    ctx.lineTo(-w * 0.2, -h * 1.1);
    ctx.lineTo(w * 0.2, -h * 0.4);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-w * 0.1, h * 0.4);
    ctx.lineTo(-w * 0.2, h * 1.1);
    ctx.lineTo(w * 0.2, h * 0.4);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#66aaff';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 15 + tailWiggle, -h / 2);
    ctx.lineTo(-w / 2 - 15 + tailWiggle, h / 2);
    ctx.fill();

    // Diamond Body
    ctx.fillStyle = '#e0f0ff';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    ctx.fill();

    // Stripes
    ctx.fillStyle = '#2255aa';
    ctx.fillRect(-w * 0.2, -h * 0.4, w * 0.1, h * 0.8);
    ctx.fillRect(w * 0.05, -h * 0.3, w * 0.08, h * 0.6);

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRedSnapper(ctx, w, h, tailWiggle) {
    // Tail
    ctx.fillStyle = '#cc2233';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 16 + tailWiggle, -h * 0.45);
    ctx.lineTo(-w / 2 - 16 + tailWiggle, h * 0.45);
    ctx.fill();

    // Body
    ctx.fillStyle = '#ff3344';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal Fin
    ctx.fillStyle = '#aa1122';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.4);
    ctx.lineTo(0, -h * 0.8);
    ctx.lineTo(w * 0.2, -h * 0.4);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.12, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.32, -h * 0.12, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBarracuda(ctx, w, h, tailWiggle) {
    // Long sleek silver body
    ctx.fillStyle = '#99aabb';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 15 + tailWiggle, -h * 0.4);
    ctx.lineTo(-w / 2 - 15 + tailWiggle, h * 0.4);
    ctx.fill();

    // Main Body
    ctx.fillStyle = '#ccddee';
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark stripes along back
    ctx.fillStyle = '#445566';
    for (let i = -0.3; i <= 0.2; i += 0.12) {
      ctx.fillRect(w * i, -h * 0.45, w * 0.04, h * 0.35);
    }

    // Eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.38, -h * 0.1, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSwordfish(ctx, w, h, tailWiggle) {
    // Powerful tail
    ctx.fillStyle = '#1c3144';
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, 0);
    ctx.lineTo(-w * 0.35 - 20 + tailWiggle, -h * 0.7);
    ctx.lineTo(-w * 0.35 - 20 + tailWiggle, h * 0.7);
    ctx.fill();

    // Dorsal Fin
    ctx.fillStyle = '#0f1d2a';
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.4);
    ctx.lineTo(0, -h * 1.2);
    ctx.lineTo(w * 0.2, -h * 0.4);
    ctx.fill();

    // Body
    ctx.fillStyle = '#2b4c6f';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.38, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sword (Bill)
    ctx.fillStyle = '#d0e0f0';
    ctx.beginPath();
    ctx.moveTo(w * 0.3, -h * 0.1);
    ctx.lineTo(w * 0.65, 0);
    ctx.lineTo(w * 0.3, h * 0.1);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.2, -h * 0.15, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.22, -h * 0.15, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMantaRay(ctx, w, h, tailWiggle) {
    // Long tail whip
    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, 0);
    ctx.quadraticCurveTo(-w * 0.5, tailWiggle, -w * 0.7, tailWiggle * 1.5);
    ctx.stroke();

    // Wing flapping animation
    const wingFlap = Math.sin(this.swimPhase * 0.8) * 8;

    // Body & Wings
    ctx.fillStyle = '#2d3b4e';
    ctx.beginPath();
    ctx.moveTo(w * 0.35, 0);
    ctx.quadraticCurveTo(0, -h * 0.9 - wingFlap, -w * 0.3, -h * 0.2);
    ctx.lineTo(-w * 0.3, h * 0.2);
    ctx.quadraticCurveTo(0, h * 0.9 + wingFlap, w * 0.35, 0);
    ctx.fill();

    // White belly highlights on horn tips
    ctx.fillStyle = '#eef5ff';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.25, 3, 0, Math.PI * 2);
    ctx.arc(w * 0.3, h * 0.25, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShark(ctx, w, h, tailWiggle) {
    // Powerful Tail Fin
    ctx.fillStyle = '#3a4a58';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, 0);
    ctx.lineTo(-w * 0.38 - 25 + tailWiggle, -h * 0.8);
    ctx.lineTo(-w * 0.38 - 10 + tailWiggle, 0);
    ctx.lineTo(-w * 0.38 - 25 + tailWiggle, h * 0.6);
    ctx.fill();

    // Iconic Dorsal Fin
    ctx.fillStyle = '#2c3945';
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.4);
    ctx.lineTo(w * 0.05, -h * 1.1);
    ctx.lineTo(w * 0.25, -h * 0.35);
    ctx.fill();

    // Main Body
    ctx.fillStyle = '#4c5c6c';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.42, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Underbelly
    ctx.fillStyle = '#e0e8f0';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.15, w * 0.38, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gills
    ctx.strokeStyle = '#222d36';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.05 + i * 5, 0, 8, Math.PI * 0.7, Math.PI * 1.3);
      ctx.stroke();
    }

    // Fierce Eye
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Sharp Teeth
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h * 0.1);
    ctx.lineTo(w * 0.35, h * 0.18);
    ctx.lineTo(w * 0.38, h * 0.1);
    ctx.fill();
  }

  drawJellyfish(ctx, w, h, tailWiggle) {
    // Pulse animation
    const pulse = Math.sin(this.swimPhase * 1.5) * 4;

    // Glowing Outer Dome
    ctx.fillStyle = 'rgba(255, 100, 200, 0.6)';
    ctx.beginPath();
    ctx.arc(0, -pulse, w / 2, Math.PI, 0);
    ctx.quadraticCurveTo(0, pulse, -w / 2, -pulse);
    ctx.fill();

    // Bioluminescent Core
    ctx.fillStyle = 'rgba(255, 220, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(0, -pulse - 5, w / 4, 0, Math.PI * 2);
    ctx.fill();

    // Wavy Tentacles
    ctx.strokeStyle = 'rgba(255, 150, 220, 0.7)';
    ctx.lineWidth = 2;
    for (let i = -w * 0.35; i <= w * 0.35; i += w * 0.18) {
      ctx.beginPath();
      ctx.moveTo(i, -pulse);
      ctx.quadraticCurveTo(i + tailWiggle, h * 0.8, i - tailWiggle, h * 1.4);
      ctx.stroke();
    }
  }

  drawGoldenFish(ctx, w, h, tailWiggle) {
    // Sparkling aura
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 15;

    // Tail
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 - 18 + tailWiggle, -h * 0.6);
    ctx.lineTo(-w / 2 - 18 + tailWiggle, h * 0.6);
    ctx.fill();

    // Body
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, '#ffbb00');
    grad.addColorStop(0.5, '#fff2a3');
    grad.addColorStop(1, '#ff9900');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.28, -h * 0.12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.12, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWhale(ctx, w, h, tailWiggle) {
    // Massive Tail Fluke
    ctx.fillStyle = '#1c2d42';
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.lineTo(-w * 0.4 - 30 + tailWiggle, -h * 0.9);
    ctx.lineTo(-w * 0.4 - 20, 0);
    ctx.lineTo(-w * 0.4 - 30 + tailWiggle, h * 0.9);
    ctx.fill();

    // Huge Body
    ctx.fillStyle = '#283e58';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.45, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly Grooves
    ctx.fillStyle = '#8ca6c4';
    ctx.beginPath();
    ctx.ellipse(w * 0.05, h * 0.2, w * 0.35, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(w * 0.3, -h * 0.1, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(w * 0.31, -h * 0.1, 2, 0, Math.PI * 2);
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
