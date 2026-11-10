// The whole prototype loop: scout control, biting, carrying, nest deposits, upgrades, trail ants, camera.
(function () {
  const C = AF.config;
  const jawsCost = (lvl) => Math.round(C.costs.jawsBase * Math.pow(C.costs.jawsGrowth, lvl - 1));
  const antCost = (n) => Math.round(C.costs.antBase * Math.pow(C.costs.antGrowth, n));

  class GameScene extends Phaser.Scene {
    constructor() { super('game'); }

    create() {
      const s = AF.save.load() || {};
      this.st = {
        crumbs: Math.max(0, +s.crumbs || 0),
        jaws: Math.min(C.costs.jawsMax, Math.max(1, s.jaws | 0)),
        trail: !!s.trail,
        time: +s.time || 0,
        won: !!s.won,
        hint: s.hint | 0,
      };
      AF.makeTextures(this);
      this.buildScenery();
      this.food = new AF.Food(this, s.heights);

      const sx = typeof s.scoutX === 'number' && isFinite(s.scoutX) ? Phaser.Math.Clamp(s.scoutX, C.world.left, C.world.right) : 30;
      this.scout = new AF.Walker(this, this.food, sx, { speed: C.scout.speed, climb: C.scout.climb, texture: 'scout', scale: C.scout.scale, depth: 20 });
      this.scout.load = Math.max(0, s.scoutLoad | 0);
      this.scout.capacity = this.scoutCap();
      this.marker = this.add.image(0, 0, 'marker').setDepth(21);
      this.target = this.scout.x; this.biting = false; this.biteT = 0;

      this.ants = [];
      const n = this.st.trail ? Math.max(0, s.ants | 0) : 0;
      for (let i = 0; i < n; i++) this.spawnAnt(-Math.random() * 14);

      this.trailG = this.add.graphics().setDepth(6);
      this.trailT = 0;
      this.parts = 0;
      this.antGain = 0; this.antGainT = 0;

      this.setupInput();
      AF.ui.init(this);
      this.uiT = 0; this.saveT = 0;
      this.zCur = 0; // set on first camera update

      const persist = () => this.persist();
      window.addEventListener('pagehide', persist);
      document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

      if (this.st.won) AF.ui.showWin(this.st.time);
      this.refreshUI();
      this.updateCamera(0, true);
    }

    // ---------- scenery ----------
    buildScenery() {
      const far = this.add.graphics().setDepth(1);
      const haze = 0x8c6f73;
      far.fillStyle(haze, 0.2);
      // the massive final dish: a towering covered platter far behind
      far.fillEllipse(470, -8, 980, 40);
      far.beginPath(); far.arc(470, -14, 380, Math.PI, 0, false); far.closePath(); far.fillPath();
      far.fillCircle(470, -404, 22);
      far.fillStyle(haze, 0.55);
      // grapes
      const gx = -150;
      for (let row = 0; row < 6; row++) {
        const cnt = 6 - row;
        for (let i = 0; i < cnt; i++) far.fillCircle(gx + (i - (cnt - 1) / 2) * 13, -14 - row * 12 - (row ? 0 : 0), 7.5);
      }
      far.fillRect(gx - 1.5, -100, 3, 20);
      // bread loaf
      far.fillEllipse(-420, -40, 170, 80); far.fillRect(-505, -40, 170, 32);
      // soup bowl with steam
      far.beginPath(); far.arc(800, -78, 70, 0, Math.PI, false); far.closePath(); far.fillPath();
      far.fillRect(770, -16, 60, 8);
      far.lineStyle(3, haze, 0.4);
      for (let i = 0; i < 3; i++) {
        far.beginPath(); far.moveTo(775 + i * 25, -88);
        for (let k = 1; k <= 6; k++) far.lineTo(775 + i * 25 + Math.sin(k * 1.3 + i) * 6, -88 - k * 10);
        far.strokePath();
      }
      // roast
      far.fillEllipse(1110, -40, 200, 90); far.fillEllipse(1110, -10, 260, 20);

      // tabletop band (seen nearly edge-on) and the cloth hanging toward us
      const t = this.add.graphics().setDepth(2);
      t.fillStyle(0xe8d6b4, 1).fillRect(-3000, -8, 7000, 8);
      t.fillStyle(0xffffff, 0.25).fillRect(-3000, -8, 7000, 1.5);
      this.add.tileSprite(500, 0, 7000, 900, 'gingham').setOrigin(0.5, 0).setDepth(2).setTileScale(0.3);
      const sh = this.add.graphics().setDepth(3);
      sh.fillStyle(0x000000, 0.16).fillRect(-3000, 0, 7000, 5);

      // nest hole with a few dug-out grains
      const nx = C.world.nestX;
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0xb48a5c, 1).fillEllipse(nx - 17, -1.5, 9, 4).fillEllipse(nx + 17, -1.5, 9, 4).fillEllipse(nx + 22, -1, 5, 2.5);
      g.fillStyle(0x1a0c05, 1).fillEllipse(nx, -2.5, 26, 7);
      g.fillStyle(0x000000, 1).fillEllipse(nx, -2, 18, 4);

      // plate under the cake
      const f = C.food, pl = f.x0 - f.platePad, pw = f.cols * f.cell + 2 * f.platePad;
      g.fillStyle(0xd9dee6, 1).fillRoundedRect(pl, -f.plateH, pw, f.plateH, 1.4);
      g.fillStyle(0xffffff, 1).fillRect(pl + 2, -f.plateH, pw - 4, 1.2);
    }

    // ---------- input ----------
    setupInput() {
      this.input.on('pointerdown', (p) => {
        if (this.st.won) return;
        const w = this.cameras.main.getWorldPoint(p.x, p.y);
        this.tapAt(w.x);
      });
      const kb = this.input.keyboard;
      if (kb) {
        this.keys = kb.addKeys('LEFT,RIGHT,A,D,SPACE');
        this.keyHeld = false;
      }
    }

    tapAt(wx) {
      const f = this.food;
      if (Math.abs(wx - C.world.nestX) < 30) { this.target = C.world.nestX; this.biting = false; return; }
      let col = f.colAt(wx);
      if (col >= 0 && f.h[col] === 0) col = this.nearestFilled(col, 3);
      if (col >= 0 && this.scout.load < this.scout.capacity) {
        this.target = f.colCenter(col); this.biting = true; this.biteT = 0; return;
      }
      this.target = Phaser.Math.Clamp(wx, C.world.left, C.world.right);
      this.biting = false;
    }

    nearestFilled(col, range) {
      const f = this.food;
      for (let d = 0; d <= range; d++) {
        if (col - d >= 0 && f.h[col - d] > 0) return col - d;
        if (col + d < f.cols && f.h[col + d] > 0) return col + d;
      }
      return -1;
    }

    handleKeys() {
      const k = this.keys;
      if (!k || this.st.won) return;
      const left = k.LEFT.isDown || k.A.isDown, right = k.RIGHT.isDown || k.D.isDown;
      if (left !== right) {
        this.target = Phaser.Math.Clamp(this.scout.x + (left ? -40 : 40), C.world.left, C.world.right);
        this.biting = false; this.keyHeld = true;
      } else if (this.keyHeld) { this.keyHeld = false; this.target = this.scout.x; }
      if (Phaser.Input.Keyboard.JustDown(k.SPACE)) {
        const f = this.food, sc = this.scout;
        let col = f.colAt(sc.x);
        if (col < 0 || f.h[col] === 0) col = f.colAt(sc.x + (sc.flip ? -1 : 1) * f.cell);
        if (col >= 0) col = this.nearestFilled(col, 2);
        if (Math.abs(sc.x - C.world.nestX) < 30) { this.target = C.world.nestX; this.biting = false; }
        else if (col >= 0 && sc.load < sc.capacity) { this.target = f.colCenter(col); this.biting = true; this.biteT = 0; }
      }
    }

    // ---------- economy ----------
    scoutCap() { return C.scout.capPerPower * this.st.jaws; }
    antCap() { return C.ant.capPerPower * this.st.jaws; }

    buy(kind) {
      const st = this.st;
      if (st.won) return;
      if (kind === 'jaws') {
        if (st.jaws >= C.costs.jawsMax) return;
        const c = jawsCost(st.jaws); if (st.crumbs < c) return;
        st.crumbs -= c; st.jaws++;
        this.scout.capacity = this.scoutCap();
        for (const a of this.ants) a.w.capacity = this.antCap();
        this.ring(this.scout.x, -this.scout.h - 6);
        AF.audio.blip(880);
      } else if (kind === 'trail') {
        if (st.trail || st.crumbs < C.costs.trail) return;
        st.crumbs -= C.costs.trail; st.trail = true;
        this.spawnAnt(0); // the first trail ant comes with the trail
        this.trailT = 99;
        AF.audio.blip(520);
      } else if (kind === 'ant') {
        if (!st.trail) return;
        const c = antCost(this.ants.length); if (st.crumbs < c) return;
        st.crumbs -= c; this.spawnAnt(0);
        AF.audio.blip(700);
      }
      this.refreshUI();
      this.persist();
    }

    spawnAnt(dx) {
      const sp = 0.9 + Math.random() * 0.2;
      const w = new AF.Walker(this, this.food, C.world.nestX + dx, { speed: C.ant.speed * sp, climb: C.ant.climb * sp, texture: 'ant', scale: C.ant.scale, depth: 15 + Math.random() * 0.5 });
      w.capacity = this.antCap();
      this.ants.push({ w, state: 'out', off: Math.floor(Math.random() * 3), biteT: Math.random() * 0.3, home: (Math.random() - 0.5) * 8 });
    }

    // ---------- loop ----------
    update(_t, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      const st = this.st;
      if (!st.won) st.time += dt;
      this.handleKeys();
      this.updateScout(dt);
      this.updateAnts(dt);
      this.food.flush();

      this.trailT += dt;
      if (this.trailT > 0.2) { this.trailT = 0; this.drawTrail(); }

      if (this.antGain > 0) {
        this.antGainT += dt;
        if (this.antGainT > 1) { this.floater(C.world.nestX + 14, -10, '+' + this.antGain, 13); this.antGain = 0; this.antGainT = 0; }
      }

      if (!st.won && this.food.left <= 0) {
        st.won = true; this.biting = false;
        this.persist();
        AF.audio.blip(990);
        this.time.delayedCall(600, () => AF.ui.showWin(st.time));
      }

      this.updateCamera(dt, false);

      this.uiT += dt;
      if (this.uiT > 0.1) { this.uiT = 0; this.refreshUI(); }
      this.saveT += dt;
      if (this.saveT > 3) { this.saveT = 0; this.persist(); }
    }

    updateScout(dt) {
      const sc = this.scout, f = this.food, st = this.st;
      const arrived = sc.step(this.target, dt);

      if (this.biting && arrived) {
        this.biteT += dt;
        if (this.biteT >= C.scout.biteTime) {
          this.biteT = 0;
          if (sc.load >= sc.capacity) this.biting = false;
          else {
            let col = f.colAt(sc.x);
            const r = f.eat(col, Math.min(st.jaws, sc.capacity - sc.load), C.scout.biteSpread);
            if (r.n > 0) {
              sc.load += r.n; sc.color = r.color;
              this.spray(sc.x + (sc.flip ? -5 : 5), -sc.h - 3, r.color, 3);
              AF.audio.chomp();
              if (st.hint === 0) st.hint = 1;
              if (sc.load >= sc.capacity) this.biting = false;
            } else {
              col = this.nearestFilled(col < 0 ? f.colAt(this.target) : col, 6);
              if (col >= 0) this.target = f.colCenter(col); else this.biting = false;
            }
          }
        }
      }

      // drop off at the nest
      if (sc.load > 0 && Math.abs(sc.x - C.world.nestX) <= C.world.nestRadius && sc.h < 1) {
        const n = sc.load; sc.load = 0;
        st.crumbs += n;
        this.floater(sc.x, -14, '+' + n, 18);
        AF.audio.blip(660);
        if (st.hint < 2) st.hint = 2;
      }

      sc.render(dt);
      const z = this.cameras.main.zoom;
      const ms = (16 * AF.DPR) / (32 * z);
      const bob = Math.sin(this.time.now / 180) * 3 * AF.DPR / z;
      this.marker.setScale(Math.max(ms, 0.2)).setPosition(sc.x, -sc.h - 13 - (10 * AF.DPR) / z + bob);
    }

    updateAnts(dt) {
      const f = this.food, head = f.headCol(), nest = C.world.nestX;
      for (const a of this.ants) {
        const w = a.w;
        if (a.state === 'out') {
          if (head < 0) { a.state = 'back'; }
          else {
            const col = Math.min(f.cols - 1, head + a.off);
            if (w.step(f.colCenter(col), dt)) {
              a.biteT += dt;
              if (a.biteT >= C.ant.biteTime) {
                a.biteT = 0;
                const r = f.eat(f.colAt(w.x), Math.min(this.st.jaws, w.capacity - w.load), C.ant.biteSpread);
                if (r.n > 0) {
                  w.load += r.n; w.color = r.color;
                  if (Math.random() < 0.3) this.spray(w.x + (w.flip ? -3 : 3), -w.h - 2, r.color, 1);
                  if (Math.random() < 0.08) AF.audio.chomp();
                }
                if (w.load >= w.capacity || (r.n === 0 && w.load > 0)) a.state = 'back';
                else if (r.n === 0) a.off = Math.floor(Math.random() * 3);
              }
            }
          }
        }
        if (a.state === 'back') {
          if (w.step(nest + a.home, dt)) {
            if (w.load > 0) { this.st.crumbs += w.load; this.antGain += w.load; w.load = 0; }
            if (head >= 0) { a.state = 'out'; a.off = Math.floor(Math.random() * 3); }
          }
        }
        w.render(dt);
      }
    }

    drawTrail() {
      const g = this.trailG; g.clear();
      if (!this.st.trail) return;
      const f = this.food, head = f.headCol();
      if (head < 0) return;
      const end = f.colCenter(head);
      g.fillStyle(0xffe08a, 0.85);
      let prev = f.surfaceAt(C.world.nestX);
      for (let x = C.world.nestX + 8; x <= end; x += 5) {
        const s = f.surfaceAt(x);
        if (s > prev + 4) for (let y = prev + 3; y < s; y += 5) g.fillCircle(x - 2.5, -y, 0.9);
        g.fillCircle(x, -s - 0.8, 0.9);
        prev = s;
      }
      // flag on the bite front
      const top = f.surfaceAt(end);
      g.fillStyle(0x5a2c00, 1).fillRect(end - 0.5, -top - 16, 1, 16);
      g.fillStyle(0xffd25a, 1).fillTriangle(end + 0.5, -top - 16, end + 9, -top - 13, end + 0.5, -top - 10);
    }

    // ---------- effects ----------
    spray(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        if (this.parts > 120) return;
        this.parts++;
        const d = this.add.image(x, y, 'dot').setTint(color).setScale(0.22 + Math.random() * 0.12).setDepth(18);
        const tx = x + (Math.random() - 0.5) * 12, ty = y - 2 - Math.random() * 6;
        this.tweens.add({
          targets: d, x: tx, y: ty, duration: 180, ease: 'Quad.out',
          onComplete: () => this.tweens.add({
            targets: d, x: tx + (tx - x) * 0.4, y: ty + 9, alpha: 0, duration: 260, ease: 'Quad.in',
            onComplete: () => { d.destroy(); this.parts--; },
          }),
        });
      }
    }

    floater(x, y, text, cssPx) {
      const z = this.cameras.main.zoom;
      const t = this.add.text(x, y, text, {
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', fontSize: '32px', fontStyle: 'bold',
        color: '#fff3c4', stroke: '#4a2400', strokeThickness: 7,
      }).setOrigin(0.5, 1).setDepth(30).setScale((cssPx * AF.DPR) / (32 * z));
      this.tweens.add({ targets: t, y: y - (36 * AF.DPR) / z, alpha: 0, duration: 1000, ease: 'Cubic.out', onComplete: () => t.destroy() });
    }

    ring(x, y) {
      const r = this.add.image(x, y, 'ring').setDepth(25).setTint(0xffd25a).setScale(0.1);
      this.tweens.add({ targets: r, scale: 0.6, alpha: 0, duration: 450, ease: 'Cubic.out', onComplete: () => r.destroy() });
    }

    // ---------- camera ----------
    updateCamera(dt, instant) {
      const cam = this.cameras.main, k = C.camera, DPR = AF.DPR;
      const W = this.scale.width, H = this.scale.height;
      const cssW = W / DPR, cssH = H / DPR;
      const portrait = cssH > cssW;
      const groundCss = Math.max(80, (cssH - AF.ui.barHeight()) * (portrait ? 0.72 : 0.8));

      const zStart = Math.max(k.minStartZoom, Math.min(cssW, cssH) / k.startDiv);
      const zFit = Math.min(cssW / (k.fitRight - k.fitLeft), (groundCss * 0.92) / k.fitTop);
      const p = this.st.trail ? 0.15 + 0.85 * Math.pow(Math.min(1, this.ants.length / k.antsForFullZoom), 0.8) : 0;
      const zT = zStart * Math.pow(zFit / zStart, p) * DPR;

      if (instant || !this.zCur) this.zCur = zT;
      else this.zCur += (zT - this.zCur) * Math.min(1, dt * 2.5);
      const z = this.zCur;

      // horizontal: follow the scout, drifting to the whole-scene view as the colony grows
      let cx = Phaser.Math.Linear(this.scout.x + k.lead, (k.fitLeft + k.fitRight) / 2, p);
      const half = W / 2 / z;
      if (C.world.right - C.world.left <= 2 * half) cx = (C.world.left + C.world.right) / 2;
      else cx = Phaser.Math.Clamp(cx, C.world.left + half, C.world.right - half);
      // vertical: table line at groundCss, but lift the view if the scout climbs high
      let cy = (H / 2 - groundCss * DPR) / z;
      cy = Math.min(cy, -this.scout.h + (0.2 * H) / z);

      if (instant || this.cx === undefined) { this.cx = cx; this.cy = cy; }
      else {
        const a = Math.min(1, dt * 5);
        this.cx += (cx - this.cx) * a; this.cy += (cy - this.cy) * a;
      }
      cam.setZoom(z);
      cam.centerOn(this.cx, this.cy);
    }

    // ---------- UI / save ----------
    refreshUI() {
      const st = this.st, f = this.food;
      AF.ui.update({
        crumbs: st.crumbs,
        cakePct: f.left > 0 ? Math.max(1, Math.round((f.left / f.total) * 100)) : 0,
        ants: this.ants.length, jaws: st.jaws, jawsMax: st.jaws >= C.costs.jawsMax, jawsCost: jawsCost(st.jaws),
        trail: st.trail, trailCost: C.costs.trail, antCost: antCost(this.ants.length), time: st.time,
      });
      const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      let h = '';
      if (st.won) h = '';
      else if (st.hint === 0) h = touch ? 'Tap the cake to walk over and bite it' : 'Click the cake to walk over and bite it (or use ← → and Space)';
      else if (this.scout.load >= this.scout.capacity && st.hint < 2) h = 'Your jaws are full! Tap the nest hole to drop the crumbs';
      else if (st.hint === 1) h = 'Keep biting, then carry the crumbs back to the nest hole';
      else if (!st.trail) h = st.crumbs >= C.costs.trail ? 'Build a trail so other ants can join in!' : 'Stronger jaws bite more · a trail costs ' + C.costs.trail;
      else if (this.ants.length < 3) h = 'Hire more ants. They march the trail on their own';
      AF.ui.hint(h);
    }

    persist() {
      if (this.resetting) return;
      const st = this.st;
      AF.save.write({
        crumbs: st.crumbs, jaws: st.jaws, trail: st.trail, ants: this.ants.length, time: st.time, won: st.won, hint: st.hint,
        scoutX: Math.round(this.scout.x * 10) / 10, scoutLoad: this.scout.load, heights: this.food.h,
      });
    }

    resetGame() {
      this.resetting = true;
      AF.save.clear();
      location.reload();
    }
  }

  AF.GameScene = GameScene;
})();
