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
      this.food = new AF.Food(this, s);

      const sx = typeof s.scoutX === 'number' && isFinite(s.scoutX) ? Phaser.Math.Clamp(s.scoutX, C.world.left, C.world.right) : 30;
      const sc = this.scout = new AF.Walker(this, this.food, sx, { speed: C.scout.speed, climb: C.scout.climb, texture: 'scout', scale: C.scout.scale, depth: 20 });
      sc.load = Math.max(0, s.scoutLoad | 0);
      sc.capacity = this.scoutCap();
      if (typeof s.scoutH === 'number' && isFinite(s.scoutH)) {
        sc.h = Math.max(this.food.surfaceAt(sc.x), s.scoutH);
      }
      this.marker = this.add.image(0, 0, 'marker').setDepth(21);
      this.biteT = 0; this.biteWas = false;

      this.ants = []; this.seq = 0;
      const n = this.st.trail ? Math.max(0, s.ants | 0) : 0;
      for (let i = 0; i < n; i++) this.spawnAnt(-i * C.ant.gap);

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
    // Keyboard on PC, on-screen pad on phones. No mouse/tap movement.
    setupInput() {
      const kb = this.input.keyboard;
      if (kb) this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE');
      AF.pad = AF.pad || { left: false, right: false, up: false, down: false, bite: false };
    }

    readInput() {
      const k = this.keys, p = AF.pad;
      const d = (o) => !!(o && o.isDown);
      if (this.st.won) return { dx: 0, dy: 0, bite: false };
      const left = (k && (d(k.LEFT) || d(k.A))) || p.left, right = (k && (d(k.RIGHT) || d(k.D))) || p.right;
      const up = (k && (d(k.UP) || d(k.W))) || p.up, down = (k && (d(k.DOWN) || d(k.S))) || p.down;
      return { dx: (right ? 1 : 0) - (left ? 1 : 0), dy: (up ? 1 : 0) - (down ? 1 : 0), bite: (k && d(k.SPACE)) || p.bite };
    }

    // Bite the top of the cake around the scout: the top cells of the columns under and in front of it
    // that are not higher than its feet (it bites from above, standing on the cake or right beside it).
    scoutBite() {
      const sc = this.scout, f = this.food, st = this.st;
      if (sc.load >= sc.capacity) return;
      const n = Math.min(st.jaws, sc.capacity - sc.load);
      const face = sc.flip ? -1 : 1, mid = f.colAt(sc.x), headC = f.colAt(sc.x + face * (sc.half + 1));
      const cand = [];
      for (const c of [mid - 1, mid, mid + 1, headC]) if (c >= 0 && c < f.cols && cand.indexOf(c) < 0) cand.push(c);
      if (mid < 0 && headC < 0) return;
      let eaten = 0, color = 0;
      for (let k = 0; k < n; k++) {
        let best = -1;
        for (const c of cand) {
          const top = f.base + f.h[c] * f.cell;
          if (f.h[c] <= 0 || top > sc.h + 0.5 || top < sc.h - f.cell * 1.5) continue; // only the cake right under its jaws
          const side = (c - mid) * face;
          if (best < 0 || f.h[c] > f.h[best] || (f.h[c] === f.h[best] && side > (best - mid) * face)) best = c;
        }
        if (best < 0) break;
        color = f.remove(best, f.h[best] - 1); eaten++;
      }
      if (!eaten) return;
      sc.load += eaten; sc.color = color;
      this.spray(sc.x + face * 6, -sc.h - 3, color, 3);
      AF.audio.chomp();
      if (st.hint === 0) st.hint = 1;
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

    // New ants join the back of the outgoing queue at the nest.
    spawnAnt(dx) {
      const x = Math.max(C.world.left + 4, C.world.nestX + dx);
      const w = new AF.Walker(this, this.food, x, { speed: C.ant.speed, climb: C.ant.climb, texture: 'ant', scale: C.ant.scale, depth: 15 + Math.random() * 0.5 });
      w.capacity = this.antCap();
      this.ants.push({ w, state: 'out', seq: ++this.seq, bseq: 0, biteT: 0, D: 0 });
    }

    // ---------- loop ----------
    update(_t, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      const st = this.st;
      if (!st.won) st.time += dt;
      this.updateScout(dt);
      this.updateAnts(dt);
      this.food.update(dt);
      this.food.flush();

      this.trailT += dt;
      if (this.trailT > 0.2) { this.trailT = 0; this.drawTrail(); }

      if (this.antGain > 0) {
        this.antGainT += dt;
        if (this.antGainT > 1) { this.floater(C.world.nestX + 14, -10, '+' + this.antGain, 13); this.antGain = 0; this.antGainT = 0; }
      }

      if (!st.won && this.food.left <= 0) {
        st.won = true;
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
      const sc = this.scout, st = this.st;
      const inp = this.readInput();
      sc.drive(inp, dt);

      // bite: first press bites at once, holding repeats every biteTime
      if (inp.bite) {
        if (!this.biteWas) { this.biteT = 0; this.scoutBite(); }
        else {
          this.biteT += dt;
          if (this.biteT >= C.scout.biteTime) { this.biteT = 0; this.scoutBite(); }
        }
      }
      this.biteWas = inp.bite;

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

    // Path distance along the skyline from the nest, per column: L[c] at column c's left edge
    // (still at the previous height P[c]).
    buildPath() {
      const f = this.food, n = f.cols, cell = f.cell;
      if (!this.L) { this.L = new Float64Array(n + 1); this.P = new Float64Array(n + 1); }
      let d = (f.x0 - C.world.nestX) + f.base, prev = f.base;
      for (let c = 0; c < n; c++) {
        const s = f.base + f.h[c] * cell;
        this.L[c] = d; this.P[c] = prev;
        d += Math.abs(s - prev) + cell; prev = s;
      }
      this.L[n] = d; this.P[n] = prev;
    }

    pathD(x, h) {
      const f = this.food, cell = f.cell, nest = C.world.nestX;
      if (x < f.x0) {
        if (x > f.x0 - 2 && h > f.base + 0.5) return this.L[0] + (h - f.base);
        return x - nest + (x >= f.plateL ? f.base : 0);
      }
      if (x >= f.x1) return 1e6;
      const c = f.colAt(x), left = f.x0 + c * cell, s = f.base + f.h[c] * cell;
      if (h > s + 0.5) {
        const ns = c + 1 < f.cols ? f.base + f.h[c + 1] * cell : f.base;
        if (left + cell - x < 2 && ns >= h - 0.5) return this.L[c + 1] + (h - s); // climbing into the next column
        return this.L[c] + Math.max(0, this.P[c] - h) + (x - left); // dropping into this column
      }
      return this.L[c] + Math.abs(s - this.P[c]) + (x - left);
    }

    // Trail ants walk the trail in single file, but once on the cake each one takes its own free spot
    // (a pair of columns nobody else is eating) and bites there. Returning ants queue on the way home.
    updateAnts(dt) {
      const f = this.food, head = f.headCol(), nest = C.world.nestX, gap = C.ant.gap;
      this.buildPath();
      for (const a of this.ants) {
        a.D = this.pathD(a.w.x, a.w.h);
        if (head < 0 && a.state === 'out') { a.state = 'back'; a.bseq = ++this.seq; a.pair = null; }
      }

      // ----- out-going ants (ordered by join order) -----
      const out = this.ants.filter((a) => a.state === 'out').sort((p, q) => p.seq - q.seq);
      if (out.length) {
        const pairs = Math.ceil(f.cols / 2);
        const pairLeft = (k) => f.h[2 * k] > 0 || (2 * k + 1 < f.cols && f.h[2 * k + 1] > 0);
        const owned = new Set();
        for (const a of out) if (a.pair != null && pairLeft(a.pair) && !owned.has(a.pair)) owned.add(a.pair); else a.pair = null;
        for (const a of out) {
          if (a.pair != null) continue;
          // nearest free spot to where the ant is now
          const here = f.colAt(a.w.x) < 0 ? (a.w.x < f.x0 ? 0 : pairs - 1) : f.colAt(a.w.x) >> 1;
          let best = -1;
          for (let k = 0; k < pairs; k++) if (!owned.has(k) && pairLeft(k) && (best < 0 || Math.abs(k - here) < Math.abs(best - here))) best = k;
          if (best >= 0) { a.pair = best; owned.add(best); }
        }

        let prevD = null;
        for (const a of out) {
          const w = a.w;
          let tc = -1, tx = f.x0 - 6;
          if (a.pair != null) {
            const c0 = 2 * a.pair, c1 = Math.min(f.cols - 1, c0 + 1);
            tc = f.h[c1] > f.h[c0] ? c1 : c0; tx = f.colCenter(tc);
          }
          // single file only on the way to the cake
          const lim = prevD !== null && w.x < f.x0 ? prevD - gap - a.D : undefined;
          w.step(tx, dt, lim);
          if (!w.moving) w.settle(dt);
          a.D = this.pathD(w.x, w.h);
          prevD = w.x < f.x0 ? a.D : null;

          // bite while standing on its spot
          if (tc >= 0 && !w.moving && Math.abs(w.x - tx) < 0.5 && Math.abs(w.h - f.surfaceAt(w.x)) < 0.5) {
            w.mode = 'walk';
            a.biteT += dt;
            if (a.biteT >= C.ant.biteTime) {
              a.biteT = 0;
              const r = f.eat(tc, Math.min(this.st.jaws, w.capacity - w.load), 0);
              if (r.n > 0) {
                w.load += r.n; w.color = r.color;
                if (Math.random() < 0.3) this.spray(w.x + (w.flip ? -3 : 3), -w.h - 2, r.color, 1);
                if (Math.random() < 0.08) AF.audio.chomp();
              }
              if (w.load >= w.capacity || (r.n === 0 && w.load > 0)) { a.state = 'back'; a.bseq = ++this.seq; a.pair = null; }
            }
          } else a.biteT = 0;
        }
      }

      // ----- returning queue (ordered by how close to the nest) -----
      const back = this.ants.filter((a) => a.state === 'back').sort((p, q) => p.D - q.D || p.bseq - q.bseq);
      let prevD = null;
      for (const a of back) {
        const w = a.w;
        const lim = prevD === null ? Infinity : a.D - (prevD + gap);
        const home = w.step(nest, dt, lim);
        if (!w.moving) w.settle(dt);
        a.D = this.pathD(w.x, w.h);
        prevD = a.D;
        if (home) {
          if (w.load > 0) { this.st.crumbs += w.load; this.antGain += w.load; w.load = 0; }
          if (head >= 0) { a.state = 'out'; a.seq = ++this.seq; a.biteT = 0; }
        }
      }

      for (const a of this.ants) a.w.render(dt);
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
      const touch = AF.ui.touch;
      let h = '';
      if (st.won) h = '';
      else if (st.hint === 0) h = touch ? 'Walk with ◀ ▶ up onto the cake, then press BITE' : 'Walk with ← → up onto the cake, then bite with Space';
      else if (this.scout.load >= this.scout.capacity && st.hint < 2) h = 'Your jaws are full! Carry the crumbs back to the nest hole';
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
        scoutX: Math.round(this.scout.x * 10) / 10, scoutH: Math.round(this.scout.h * 10) / 10,
        scoutLoad: this.scout.load, cells: this.food.encode(), cellsV: 2,
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
