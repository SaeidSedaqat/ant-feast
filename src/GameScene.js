// The game loop: scout control, biting, carrying, nest deposits, upgrades, trail ants and soldiers, camera.
(function () {
  const C = AF.config, K = C.costs;
  const jawsCost = (lvl) => Math.round(K.jawsBase * Math.pow(K.jawsGrowth, lvl - 1));
  const antCost = (n) => Math.round(K.antBase * Math.pow(K.antGrowth, n));
  const soldierCost = (n) => Math.round(K.soldierBase * Math.pow(K.soldierGrowth, n));
  const upCost = (k, lvl) => Math.round(K[k].base * Math.pow(K[k].growth, lvl - 1));
  const UPS = ['speed', 'carry', 'bite'];

  class GameScene extends Phaser.Scene {
    constructor() { super('game'); }

    create() {
      const s = AF.save.load() || {};
      const tr = s.trails || {}, up = s.up || {};
      this.st = {
        crumbs: Math.max(0, +s.crumbs || 0),
        jaws: Math.min(K.jawsMax, Math.max(1, s.jaws | 0)),
        trails: { cake: !!tr.cake, bread: !!tr.bread, grapes: !!tr.grapes },
        up: {},
        time: +s.time || 0,
        won: !!s.won,
        hint: s.hint | 0,
      };
      for (const k of UPS) this.st.up[k] = Math.min(K[k].max, Math.max(1, up[k] | 0));

      AF.makeTextures(this);
      this.buildScenery();
      this.table = new AF.Table(this, s.dishes);
      const plates = this.add.graphics().setDepth(4);
      for (const d of this.table.list) d.drawPlate(plates);

      const sx = typeof s.scoutX === 'number' && isFinite(s.scoutX) ? Phaser.Math.Clamp(s.scoutX, C.world.left, C.world.right) : 30;
      const sc = this.scout = new AF.Walker(this, this.table, sx, { speed: C.scout.speed, climb: C.scout.climb, texture: 'scout', scale: C.scout.scale, depth: 20, foot: 3.5 });
      sc.load = Math.max(0, s.scoutLoad | 0);
      sc.capacity = this.scoutCap();
      if (typeof s.scoutH === 'number' && isFinite(s.scoutH)) sc.h = Math.max(this.table.surfaceAt(sc.x), s.scoutH);
      this.marker = this.add.image(0, 0, 'marker').setDepth(21);
      this.biteT = 0; this.biteWas = false; this.hardT = 0;

      this.ants = []; this.seq = 0;
      if (this.anyTrail()) {
        const n = Math.min(K.antMax, Math.max(0, s.ants | 0)), m = Math.min(K.soldierMax, Math.max(0, s.soldiers | 0));
        for (let i = 0; i < n; i++) this.spawnAnt('ant', -i * C.ant.gap * 0.5);
        for (let i = 0; i < m; i++) this.spawnAnt('soldier', -i * C.ant.gap * 0.5);
      }

      this.trailG = this.add.graphics().setDepth(6);
      this.trailT = 0;
      this.parts = 0;
      this.antGain = 0; this.antGainT = 0;
      this.paths = { 1: this.newPath(1), '-1': this.newPath(-1) };

      this.setupInput();
      AF.ui.init(this);
      this.uiT = 0; this.saveT = 0;
      this.zCur = 0;

      const persist = () => this.persist();
      window.addEventListener('pagehide', persist);
      document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

      if (this.st.won) AF.ui.showWin(this.st.time);
      this.refreshUI();
      this.updateCamera(0, true);
      if (window.AFLoaded) this.time.delayedCall(60, () => window.AFLoaded());
    }

    anyTrail() { const t = this.st.trails; return t.cake || t.bread || t.grapes; }
    count(kind) { let n = 0; for (const a of this.ants) if (a.kind === kind) n++; return n; }
    nextTrail() { for (const k of C.dishOrder) if (!this.st.trails[k]) return k; return null; }

    // ---------- scenery ----------
    buildScenery() {
      const far = this.add.graphics().setDepth(1);
      const haze = 0x8c6f73;
      far.fillStyle(haze, 0.2);
      // big covered platters far behind, for later
      far.fillEllipse(420, -8, 1100, 40);
      far.beginPath(); far.arc(420, -14, 420, Math.PI, 0, false); far.closePath(); far.fillPath();
      far.fillCircle(420, -444, 24);
      far.fillStyle(haze, 0.4);
      // soup bowl with steam, far right
      far.beginPath(); far.arc(1250, -78, 70, 0, Math.PI, false); far.closePath(); far.fillPath();
      far.fillRect(1220, -16, 60, 8);
      far.lineStyle(3, haze, 0.35);
      for (let i = 0; i < 3; i++) {
        far.beginPath(); far.moveTo(1225 + i * 25, -88);
        for (let k = 1; k <= 6; k++) far.lineTo(1225 + i * 25 + Math.sin(k * 1.3 + i) * 6, -88 - k * 10);
        far.strokePath();
      }
      // a jug, far left
      far.fillRoundedRect(-900, -150, 90, 150, 20); far.fillRect(-880, -175, 50, 30);

      // tabletop band (seen nearly edge-on) and the cloth hanging toward us
      const t = this.add.graphics().setDepth(2);
      t.fillStyle(0xe8d6b4, 1).fillRect(-4000, -8, 9000, 8);
      t.fillStyle(0xffffff, 0.25).fillRect(-4000, -8, 9000, 1.5);
      this.add.tileSprite(500, 0, 9000, 900, 'gingham').setOrigin(0.5, 0).setDepth(2).setTileScale(0.3);
      const sh = this.add.graphics().setDepth(3);
      sh.fillStyle(0x000000, 0.16).fillRect(-4000, 0, 9000, 5);

      // nest hole with a few dug-out grains
      const nx = C.world.nestX;
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0xb48a5c, 1).fillEllipse(nx - 17, -1.5, 9, 4).fillEllipse(nx + 17, -1.5, 9, 4).fillEllipse(nx + 22, -1, 5, 2.5);
      g.fillStyle(0x1a0c05, 1).fillEllipse(nx, -2.5, 26, 7);
      g.fillStyle(0x000000, 1).fillEllipse(nx, -2, 18, 4);
    }

    // ---------- input ----------
    // Keyboard on PC, on-screen pad on phones. No mouse/tap movement.
    setupInput() {
      const kb = this.input.keyboard;
      if (kb) this.keys = kb.addKeys('LEFT,RIGHT,A,D,SPACE');
      AF.pad = AF.pad || { left: false, right: false, bite: false };
    }

    readInput() {
      const k = this.keys, p = AF.pad;
      const d = (o) => !!(o && o.isDown);
      if (this.st.won) return { dx: 0, bite: false };
      const left = (k && (d(k.LEFT) || d(k.A))) || p.left, right = (k && (d(k.RIGHT) || d(k.D))) || p.right;
      return { dx: (right ? 1 : 0) - (left ? 1 : 0), bite: (k && d(k.SPACE)) || p.bite };
    }

    // Bite the food right under/in front of the scout. Crust needs strong enough jaws.
    scoutBite() {
      const sc = this.scout, st = this.st;
      if (sc.load >= sc.capacity) return;
      const n = Math.min(st.jaws, sc.capacity - sc.load), str = st.jaws;
      const face = sc.flip ? -1 : 1;
      const d = this.table.dishAt(sc.x) || this.table.dishAt(sc.x + face * (sc.half + 2));
      if (!d) return;
      let eaten = 0, color = 0, tooHard = false;
      if (d.grapes) {
        const g = d.grapeNear(sc.x + face * sc.half * 0.5, sc.h, sc.half + 3);
        if (!g) return;
        const r = d.bite(g, n, Math.sign(g.x - sc.x) || face);
        eaten = r.n; color = r.color;
      } else {
        const mid = d.colAt(sc.x), headC = d.colAt(sc.x + face * (sc.half + 1));
        if (mid < 0 && headC < 0) return;
        const cand = [];
        for (const c of [mid - 1, mid, mid + 1, headC]) if (c >= 0 && c < d.cols && cand.indexOf(c) < 0) cand.push(c);
        for (let k = 0; k < n; k++) {
          let best = -1;
          for (const c of cand) {
            const top = d.topH(c);
            if (d.h[c] <= 0 || top > sc.h + 0.5 || top < sc.h - d.cell * 1.5) continue; // only food right under its jaws
            if (!d.edible(c, str)) { tooHard = true; continue; }
            const side = (c - mid) * face;
            if (best < 0 || d.h[c] > d.h[best] || (d.h[c] === d.h[best] && side > (best - mid) * face)) best = c;
          }
          if (best < 0) break;
          color = d.remove(best, d.h[best] - 1); eaten++;
        }
      }
      if (!eaten) {
        if (tooHard && this.hardT <= 0) { this.hardT = 2.5; this.floater(sc.x, -sc.h - 10, 'Too hard!', 14); AF.audio.blip(220); }
        return;
      }
      sc.load += eaten; sc.color = color;
      this.spray(sc.x + face * 6, -sc.h - 3, color, 3);
      AF.audio.chomp();
      if (st.hint === 0) st.hint = 1;
    }

    // ---------- economy ----------
    scoutCap() { return C.scout.capPerPower * this.st.jaws; }
    unitStats(kind) {
      const u = this.st.up, spd = 1 + 0.25 * (u.speed - 1);
      if (kind === 'soldier') {
        const s = C.soldier;
        return { speed: s.speed * spd, climb: s.climb * spd, cap: s.cap + 3 * (u.carry - 1), bite: s.bite + (u.bite - 1), str: s.strength, biteTime: s.biteTime };
      }
      const a = C.ant;
      return { speed: a.speed * spd, climb: a.climb * spd, cap: a.cap + 3 * (u.carry - 1), bite: u.bite, str: 1, biteTime: a.biteTime };
    }
    applyStats() {
      for (const a of this.ants) {
        const s = this.unitStats(a.kind);
        a.w.speed = s.speed; a.w.climb = s.climb; a.w.capacity = s.cap; a.s = s;
      }
    }

    prices() {
      const st = this.st, nt = this.nextTrail();
      return {
        jaws: st.jaws >= K.jawsMax ? null : jawsCost(st.jaws),
        trail: nt ? K.trails[nt] : null,
        ant: this.count('ant') >= K.antMax ? null : antCost(this.count('ant')),
        soldier: this.count('soldier') >= K.soldierMax ? null : soldierCost(this.count('soldier')),
        speed: st.up.speed >= K.speed.max ? null : upCost('speed', st.up.speed),
        carry: st.up.carry >= K.carry.max ? null : upCost('carry', st.up.carry),
        bite: st.up.bite >= K.bite.max ? null : upCost('bite', st.up.bite),
      };
    }

    buy(kind) {
      const st = this.st;
      if (st.won) return;
      const c = this.prices()[kind];
      if (c == null || st.crumbs < c) return;
      if ((kind === 'ant' || kind === 'soldier' || UPS.indexOf(kind) >= 0) && !st.trails.cake) return;
      if (kind === 'soldier' && !st.trails.bread) return;
      st.crumbs -= c;
      if (kind === 'jaws') {
        st.jaws++;
        this.scout.capacity = this.scoutCap();
        this.ring(this.scout.x, -this.scout.h - 6);
        AF.audio.blip(880);
      } else if (kind === 'trail') {
        const k = this.nextTrail();
        st.trails[k] = true;
        if (k === 'cake') this.spawnAnt('ant', 0); // the first trail ant comes with the trail
        this.trailT = 99;
        AF.audio.blip(520);
      } else if (kind === 'ant' || kind === 'soldier') {
        this.spawnAnt(kind, 0);
        AF.audio.blip(kind === 'ant' ? 700 : 400);
      } else {
        st.up[kind]++;
        this.applyStats();
        AF.audio.blip(780);
      }
      this.refreshUI();
      this.persist();
    }

    // New ants wait at the nest and pick a dish to work on.
    spawnAnt(kind, dx) {
      const x = C.world.nestX + dx;
      const sol = kind === 'soldier', s = this.unitStats(kind);
      const w = new AF.Walker(this, this.table, x, {
        speed: s.speed, climb: s.climb, texture: sol ? 'soldier' : 'ant', scale: sol ? C.soldier.scale : C.ant.scale,
        depth: (sol ? 16 : 15) + Math.random() * 0.5,
      });
      w.capacity = s.cap;
      this.ants.push({ w, kind, s, state: 'home', dish: null, seq: ++this.seq, bseq: 0, biteT: 0, D: 0, pair: null, grape: null });
    }

    // ---------- loop ----------
    update(_t, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      const st = this.st;
      if (!st.won) st.time += dt;
      this.hardT -= dt;
      this.updateScout(dt);
      this.updateAnts(dt);
      this.table.update(dt);
      this.table.flush();

      this.trailT += dt;
      if (this.trailT > 0.2) { this.trailT = 0; this.drawTrail(); }

      if (this.antGain > 0) {
        this.antGainT += dt;
        if (this.antGainT > 1) { this.floater(C.world.nestX + 14, -10, '+' + this.antGain, 13); this.antGain = 0; this.antGainT = 0; }
      }

      if (!st.won && this.table.left <= 0) {
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

    // ---------- path distance from the nest along the food's outline, per direction ----------
    // Slot k spans u in [o + 6k, o + 6k + 6) where u is the distance from the nest outward.
    newPath(dir) {
      const cell = C.cell, nest = C.world.nestX;
      const edge = dir > 0 ? C.world.right : C.world.left;
      // slot borders line up with the dishes' cells (x0 = 2 mod 6)
      const first = dir > 0 ? Math.ceil((nest - 2) / cell) * cell + 2 : Math.floor((nest - 2) / cell) * cell + 2;
      const o = Math.abs(first - nest);
      const n = Math.ceil((Math.abs(edge - nest) - o) / cell) + 2;
      return { dir, o, n, S: new Float64Array(n + 1), L: new Float64Array(n + 1), P: new Float64Array(n + 1) };
    }

    buildPath(p) {
      const cell = C.cell, nest = C.world.nestX, t = this.table;
      let d = p.o, prev = 0;
      for (let k = 0; k < p.n; k++) {
        const s = t.surfaceAt(nest + p.dir * (p.o + cell * k + cell / 2));
        p.S[k] = s; p.L[k] = d; p.P[k] = prev;
        d += Math.abs(s - prev) + cell; prev = s;
      }
      p.S[p.n] = 0; p.L[p.n] = d; p.P[p.n] = prev;
    }

    pathD(x, h, dir) {
      const p = this.paths[dir], cell = C.cell;
      const u = dir * (x - C.world.nestX);
      if (u < p.o) return Math.max(0, u) + h;
      const k = Math.min(p.n - 1, Math.floor((u - p.o) / cell)), within = u - p.o - cell * k, s = p.S[k];
      if (h > s + 0.5) { // on a wall: the far wall (into the next slot) or the near one (back toward the nest)
        const far = p.S[k + 1] >= h - 0.5, near = p.P[k] >= h - 0.5;
        if (far && (!near || cell - within < within)) return p.L[k + 1] + (h - s); // climbing into the next slot
        return p.L[k] + Math.max(0, p.P[k] - h) + within; // dropping into this slot
      }
      return p.L[k] + Math.abs(s - p.P[k]) + within;
    }

    // ---------- trail ants ----------
    // Can this unit eat anything on dish d?
    canEat(a, d) {
      if (d.left <= 0) return false;
      if (d.grapes) return true;
      for (let c = 0; c < d.cols; c++) if (d.edible(c, a.s.str)) return true;
      return false;
    }

    // At the nest: pick the trail with the fewest workers per share of what is left. Soldiers go for the crust.
    pickDish(a) {
      const t = this.table, st = this.st, counts = {};
      for (const b of this.ants) if (b.dish && b !== a) counts[b.dish] = (counts[b.dish] || 0) + (b.kind === 'soldier' ? 2 : 1);
      let best = null, bs = Infinity;
      for (const d of t.list) {
        if (!st.trails[d.key] || !this.canEat(a, d)) continue;
        let score = (counts[d.key] || 0) / Math.max(0.15, Math.sqrt(d.left / d.total));
        if (a.kind === 'soldier' && d.key === 'bread') score -= 1000; // soldiers crack the crust first
        if (score < bs) { bs = score; best = d.key; }
      }
      return best;
    }

    updateAnts(dt) {
      const t = this.table, nest = C.world.nestX, gap = C.ant.gap;
      this.buildPath(this.paths[1]); this.buildPath(this.paths[-1]);
      const dirOf = (a) => (a.dish ? t.dishes[a.dish].dir : (a.w.x >= nest ? 1 : -1));
      for (const a of this.ants) {
        a.dir = dirOf(a);
        a.D = this.pathD(a.w.x, a.w.h, a.dir);
        if (a.state === 'out' && !this.canEat(a, t.dishes[a.dish])) this.goHome(a);
      }

      // ----- at home: choose a trail -----
      for (const a of this.ants) {
        if (a.state !== 'home') continue;
        a.dish = this.pickDish(a);
        if (a.dish) { a.state = 'out'; a.seq = ++this.seq; a.biteT = 0; a.dir = t.dishes[a.dish].dir; a.D = this.pathD(a.w.x, a.w.h, a.dir); }
        else { a.w.step(nest + ((a.seq % 7) - 3) * 2, dt); if (!a.w.moving) a.w.settle(dt); }
      }

      // ----- spots on the grid dishes: each worker takes its own pair of columns -----
      for (const d of t.list) {
        if (d.grapes) continue;
        const outs = this.ants.filter((a) => a.state === 'out' && a.dish === d.key).sort((p, q) => p.seq - q.seq);
        if (!outs.length) continue;
        const pairs = Math.ceil(d.cols / 2);
        const pairOk = (k, a) => d.edible(2 * k, a.s.str) || (2 * k + 1 < d.cols && d.edible(2 * k + 1, a.s.str));
        const pairHard = (k) => d.topHard(2 * k) > 1 || d.topHard(2 * k + 1) > 1;
        const owned = new Set();
        for (const a of outs) if (a.pair != null && pairOk(a.pair, a) && !owned.has(a.pair)) owned.add(a.pair); else a.pair = null;
        for (const a of outs) {
          if (a.pair != null) continue;
          const c = d.colAt(a.w.x);
          const here = c < 0 ? ((a.w.x < d.x0) ? 0 : pairs - 1) : c >> 1;
          const sol = a.kind === 'soldier';
          let best = -1, bScore = Infinity;
          for (let k = 0; k < pairs; k++) {
            if (owned.has(k) || !pairOk(k, a)) continue;
            const score = Math.abs(k - here) + (sol && !pairHard(k) ? 1000 : 0);
            if (score < bScore) { bScore = score; best = k; }
          }
          if (best >= 0) { a.pair = best; owned.add(best); }
        }
      }

      // ----- grapes: spread over the grapes -----
      const gd = t.dishes.grapes;
      for (const g of gd.grapes) g.ants = 0;
      for (const a of this.ants) if (a.state === 'out' && a.dish === 'grapes' && a.grape && a.grape.hp > 0) a.grape.ants++; else a.grape = null;
      for (const a of this.ants) {
        if (a.state !== 'out' || a.dish !== 'grapes' || a.grape) continue;
        let best = null, bs = Infinity;
        for (const g of gd.grapes) {
          if (g.hp <= 0) continue;
          const s = g.ants * 400 + Math.abs(g.x - a.w.x);
          if (s < bs) { bs = s; best = g; }
        }
        if (best) { a.grape = best; best.ants++; }
      }

      // ----- out-going ants walk single file per direction until they reach their dish -----
      for (const dir of [1, -1]) {
        const out = this.ants.filter((a) => a.state === 'out' && a.dir === dir).sort((p, q) => p.seq - q.seq);
        let prevD = null;
        for (const a of out) {
          const d = t.dishes[a.dish], w = a.w;
          const edge = dir > 0 ? d.x0 : d.x1;
          const transit = dir * (w.x - edge) < 0;
          let tx, biting = false;
          if (d.grapes) {
            const g = a.grape;
            if (g) {
              const r = d.rad(g), side = w.x < g.x ? -1 : 1;
              tx = g.x + side * (r + w.reach + 0.5);
              if (Math.abs(w.x - g.x) - r <= w.reach + 2 && w.h <= d.base + 2 * r + 1) biting = true;
            } else tx = d.center;
          } else if (a.pair != null) {
            const c0 = 2 * a.pair, c1 = Math.min(d.cols - 1, c0 + 1);
            const e0 = d.edible(c0, a.s.str), e1 = d.edible(c1, a.s.str);
            a.tc = e0 && e1 ? (d.h[c1] > d.h[c0] ? c1 : c0) : (e0 ? c0 : c1);
            tx = d.colCenter(a.tc);
          } else tx = edge - dir * 6;

          const lim = prevD !== null && transit ? prevD - gap - a.D : undefined;
          if (!biting) { w.step(tx, dt, lim); if (!w.moving) w.settle(dt); }
          else { w.settle(dt); w.flip = a.grape.x < w.x; }
          a.D = this.pathD(w.x, w.h, dir);
          prevD = transit ? a.D : null;

          // bite while standing on its spot
          const onSpot = !d.grapes && a.pair != null && !w.moving && Math.abs(w.x - tx) < 0.5 && Math.abs(w.h - d.surfaceAt(w.x)) < 0.5;
          if (biting || onSpot) {
            w.mode = 'walk';
            a.biteT += dt;
            if (a.biteT >= a.s.biteTime) {
              a.biteT = 0;
              const room = w.capacity - w.load;
              const r = d.grapes ? d.bite(a.grape, Math.min(a.s.bite, room), Math.sign(a.grape.x - w.x) || dir)
                : d.eat(a.tc, Math.min(a.s.bite, room), a.s.str);
              if (r.n > 0) {
                w.load += r.n; w.color = r.color;
                if (Math.random() < (a.kind === 'soldier' ? 0.7 : 0.3)) this.spray(w.x + (w.flip ? -3 : 3), -w.h - 2, r.color, a.kind === 'soldier' ? 2 : 1);
                if (Math.random() < 0.08) AF.audio.chomp();
              }
              if (w.load >= w.capacity || (r.n === 0 && w.load > 0)) this.goHome(a);
            }
          } else a.biteT = 0;
        }
      }

      // ----- returning queue per direction (ordered by how close to the nest) -----
      for (const dir of [1, -1]) {
        const back = this.ants.filter((a) => a.state === 'back' && a.dir === dir).sort((p, q) => p.D - q.D || p.bseq - q.bseq);
        let prevD = null;
        for (const a of back) {
          const w = a.w;
          const lim = prevD === null ? Infinity : a.D - (prevD + gap);
          const home = w.step(nest, dt, lim);
          if (!w.moving) w.settle(dt);
          a.D = this.pathD(w.x, w.h, dir);
          prevD = a.D;
          if (home) {
            if (w.load > 0) { this.st.crumbs += w.load; this.antGain += w.load; w.load = 0; }
            a.state = 'home'; a.dish = null; a.pair = null; a.grape = null;
          }
        }
      }

      for (const a of this.ants) a.w.render(dt);
    }

    goHome(a) { a.state = 'back'; a.bseq = ++this.seq; a.pair = null; a.grape = null; }

    drawTrail() {
      const g = this.trailG; g.clear();
      const t = this.table, nest = C.world.nestX;
      for (const d of t.list) {
        if (!this.st.trails[d.key] || d.left <= 0) continue;
        let end;
        if (d.grapes) {
          let best = null;
          for (const gr of d.grapes) if (gr.hp > 0 && (best === null || Math.abs(gr.x - nest) < Math.abs(best - nest))) best = gr.x;
          end = best - d.dir * (d.def.r + 4);
        } else end = d.colCenter(d.headCol(d.dir));
        const dir = d.dir;
        g.fillStyle(d.key === 'bread' ? 0xffc27a : d.key === 'grapes' ? 0xe0b0ff : 0xffe08a, 0.85);
        let prev = 0;
        for (let x = nest + dir * 8; dir * (end - x) >= 0; x += dir * 5) {
          const s = t.surfaceAt(x);
          if (s > prev + 4) for (let y = prev + 3; y < s; y += 5) g.fillCircle(x - dir * 2.5, -y, 0.9);
          g.fillCircle(x, -s - 0.8, 0.9);
          prev = s;
        }
        // flag on the bite front
        const top = t.surfaceAt(end);
        g.fillStyle(0x5a2c00, 1).fillRect(end - 0.5, -top - 16, 1, 16);
        g.fillStyle(0xffd25a, 1).fillTriangle(end + 0.5 * dir, -top - 16, end + 9 * dir, -top - 13, end + 0.5 * dir, -top - 10);
      }
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
    // Starts close on the scout; zooms out to show the nest and every dish with a trail as the colony grows.
    updateCamera(dt, instant) {
      const cam = this.cameras.main, k = C.camera, DPR = AF.DPR;
      const W = this.scale.width, H = this.scale.height;
      const cssW = W / DPR, cssH = H / DPR;
      const portrait = cssH > cssW;
      const groundCss = Math.max(80, (cssH - AF.ui.barHeight()) * (portrait ? 0.72 : 0.8));

      let fl = C.world.nestX - 70, fr = C.world.nestX + 70, ft = 60;
      for (const d of this.table.list) {
        if (!this.st.trails[d.key]) continue;
        fl = Math.min(fl, d.plateL - 20); fr = Math.max(fr, d.plateR + 20);
        ft = Math.max(ft, d.grapes ? d.base + 2 * d.def.r + 30 : d.base + d.rows * d.cell + 30);
      }
      // portrait screens are narrow: frame the start by width so the scout is big, not a speck
      const zStart = portrait ? Math.max(2.2, cssW / k.portraitDiv) : Math.max(k.minStartZoom, Math.min(cssW, cssH) / k.startDiv);
      const zFit = Math.min(cssW / (fr - fl), (groundCss * 0.92) / ft);
      const units = this.count('ant') + 2 * this.count('soldier');
      const p = this.anyTrail() ? 0.15 + 0.85 * Math.pow(Math.min(1, units / k.antsForFullZoom), 0.8) : 0;
      const zT = Math.min(zStart, zStart * Math.pow(zFit / zStart, p)) * DPR;

      if (instant || !this.zCur) this.zCur = zT;
      else this.zCur += (zT - this.zCur) * Math.min(1, dt * 2.5);
      const z = this.zCur;

      // horizontal: follow the scout, drifting to the whole-scene view as the colony grows
      const half = W / 2 / z, lead = Math.min(k.lead, half * 0.35);
      let cx = Phaser.Math.Linear(this.scout.x + lead * (this.scout.flip ? -1 : 1), (fl + fr) / 2, p);
      // keep the scout on screen
      cx = Phaser.Math.Clamp(cx, this.scout.x - half * 0.8, this.scout.x + half * 0.8);
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
      const st = this.st, t = this.table, pr = this.prices(), nt = this.nextTrail();
      AF.ui.update({
        crumbs: st.crumbs,
        eaten: t.left > 0 ? Math.min(99, Math.floor((1 - t.left / t.total) * 100)) : 100,
        ants: this.count('ant'), soldiers: this.count('soldier'),
        jaws: st.jaws, up: st.up, prices: pr, nextTrail: nt, trails: st.trails, time: st.time,
      });
      const touch = AF.ui.touch, sc = this.scout, b = t.dishes.bread;
      let h = '';
      if (st.won) h = '';
      else if (st.hint === 0) h = touch ? 'Walk with ◀ ▶ up onto the cake, then press BITE' : 'Walk with ← → up onto the cake, then bite with Space';
      else if (sc.load >= sc.capacity && st.hint < 2) h = 'Your jaws are full! Carry the crumbs back to the nest hole';
      else if (st.hint === 1) h = 'Keep biting, then carry the crumbs back to the nest hole';
      else if (!st.trails.cake) h = st.crumbs >= K.trails.cake ? 'Build a trail so other ants can join in!' : 'Stronger jaws bite more · a trail costs ' + K.trails.cake;
      else if (this.count('ant') < 3) h = 'Hire more ants. They march the trail on their own';
      else if (!st.trails.bread && st.crumbs >= K.trails.bread) h = 'Build a trail to the bread on the left!';
      else if (st.trails.bread && this.count('soldier') === 0 && b.left > 0) h = 'Bread crust is too hard for workers. Hire a soldier ant!';
      else if (st.trails.bread && !st.trails.grapes && st.crumbs >= K.trails.grapes) h = 'Build a trail to the grapes on the right!';
      AF.ui.hint(h);
    }

    persist() {
      if (this.resetting) return;
      const st = this.st;
      AF.save.write({
        crumbs: st.crumbs, jaws: st.jaws, trails: st.trails, up: st.up,
        ants: this.count('ant'), soldiers: this.count('soldier'), time: st.time, won: st.won, hint: st.hint,
        scoutX: Math.round(this.scout.x * 10) / 10, scoutH: Math.round(this.scout.h * 10) / 10,
        scoutLoad: this.scout.load, dishes: this.table.encode(),
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
