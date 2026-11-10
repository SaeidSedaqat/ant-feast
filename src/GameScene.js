// The game: the scout (player), the Giant Cake, the colony's ants (instinct jobs, pheromone flags, squads),
// upgrades, autosave and the ?dev=1 tools.
(function () {
  const C = AF.config;
  const TYPES = ['worker', 'strong', 'flying', 'squad'];
  const HARD = { chocolate: 1, biscuit: 1 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

  // how well each ant type handles each layer (multiplies bite work)
  function effOf(type) {
    if (type === 'strong') return (k) => (HARD[k] ? 3 : 1);
    if (type === 'flying') return (k) => (k === 'frosting' || k === 'sprinkle' || k === 'candle' ? 2 : HARD[k] ? 0.5 : 1);
    if (type === 'squad') return (k) => (HARD[k] ? 1.5 : 1);
    return (k) => (HARD[k] ? 0.5 : k === 'candle' ? 0.7 : 1);
  }
  const EFF = {}; TYPES.forEach((t) => { EFF[t] = effOf(t); });

  class GameScene extends Phaser.Scene {
    constructor() { super('game'); }

    create() {
      const s = AF.save.load() || {};
      this.st = this.freshState(s);
      AF.makeTextures(this);
      this.buildScenery();

      const cake = this.cake = new AF.GiantCake(this, s.cake);
      cake.drawStand(this.add.graphics().setDepth(4));

      const sx = typeof s.scoutX === 'number' && isFinite(s.scoutX) ? clamp(s.scoutX, C.world.left, C.world.right) : 40;
      const sc = this.scout = new AF.Walker(this, cake, sx, { speed: C.scout.speed, climb: C.scout.climb, texture: 'scout', scale: C.scout.scale, depth: 20, foot: 3.5 });
      sc.load = Math.max(0, s.scoutLoad | 0); sc.loadVal = Math.max(0, +s.scoutVal || sc.load);
      if (typeof s.scoutH === 'number' && isFinite(s.scoutH)) sc.h = clamp(s.scoutH, cake.surfaceAt(sc.x), C.world.ceiling);
      sc.air = sc.h > sc.S(sc.x) + 0.5; sc.vy = 0;
      this.marker = this.add.image(0, 0, 'marker').setDepth(21);
      this.scentArrow = this.add.image(0, 0, 'marker').setDepth(21).setTint(0x8aff9a).setVisible(false);
      this.biteT = 0; this.biteWas = false; this.chompT = 0; this.rallyT = 0;

      this.ants = []; this.seq = 0;
      this.claim = new Uint16Array((cake.cols >> 2) + 2);
      for (const t of TYPES) { const n = Math.max(0, this.st.counts[t] | 0); this.st.counts[t] = 0; for (let i = 0; i < n; i++) this.spawn(t, i); }

      this.flagImg = this.add.image(0, 0, 'flag').setOrigin(6 / 32, 1).setDepth(19).setTint(0xff5a8a).setVisible(false);
      this.flagG = this.add.graphics().setDepth(6);
      this.sniffG = this.add.graphics().setDepth(6);
      this.selRing = this.add.image(0, 0, 'ring').setDepth(19).setTint(0x7ad0ff).setVisible(false);
      this.selSquad = null; this.drawT = 0;
      this.parts = 0; this.gain = 0; this.gainT = 0; this.lastKind = null;
      this.devSpeed = 1; this.uz = 1;

      this.applyScoutLook();
      this.setupInput();
      AF.ui.init(this);
      this.uiT = 0; this.saveT = 0; this.zCur = 0;

      const persist = () => this.persist();
      window.addEventListener('pagehide', persist);
      document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

      if (this.st.won) AF.ui.showWin(this.st.time);
      this.refreshUI();
      this.updateCamera(0, true);
      if (window.AFLoaded) setTimeout(() => window.AFLoaded(), 60);
    }

    freshState(s) {
      const st = { crumbs: 0, time: 0, won: false, hint: 0, flagUsed: false, up: {}, tu: {}, counts: {}, boosts: { speed: 0, bite: 0, carry: 0 }, flag: null };
      for (const k of Object.keys(C.up)) st.up[k] = C.up[k].start;
      for (const t of TYPES) { st.tu[t] = { speed: 1, carry: 1, bite: 1 }; st.counts[t] = 0; }
      if (s.v !== 3) return st;
      st.crumbs = Math.max(0, +s.crumbs || 0); st.time = Math.max(0, +s.time || 0);
      st.won = !!s.won; st.hint = s.hint | 0; st.flagUsed = !!s.flagUsed;
      if (s.up) for (const k of Object.keys(st.up)) if (typeof s.up[k] === 'number') st.up[k] = clamp(s.up[k] | 0, 0, C.up[k].max);
      if (s.tu) for (const t of TYPES) if (s.tu[t]) for (const k of ['speed', 'carry', 'bite']) if (typeof s.tu[t][k] === 'number') st.tu[t][k] = clamp(s.tu[t][k] | 0, 1, C.typeUp[k].max);
      if (s.counts) for (const t of TYPES) st.counts[t] = Math.max(0, s.counts[t] | 0);
      if (s.boosts) for (const k of Object.keys(st.boosts)) st.boosts[k] = Math.max(0, +s.boosts[k] || 0);
      return st;
    }

    buildScenery() {
      const t = this.add.graphics().setDepth(2);
      t.fillStyle(0xe8d6b4, 1).fillRect(-3000, -8, 15000, 8);
      t.fillStyle(0xffffff, 0.25).fillRect(-3000, -8, 15000, 1.5);
      this.add.tileSprite(4500, 0, 15000, 1800, 'gingham').setOrigin(0.5, 0).setDepth(2).setTileScale(0.3);
      const sh = this.add.graphics().setDepth(3);
      sh.fillStyle(0x000000, 0.16).fillRect(-3000, 0, 15000, 5);
      const nx = C.world.nestX;
      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0xb48a5c, 1).fillEllipse(nx - 17, -1.5, 9, 4).fillEllipse(nx + 17, -1.5, 9, 4).fillEllipse(nx + 22, -1, 5, 2.5);
      g.fillStyle(0x1a0c05, 1).fillEllipse(nx, -2.5, 26, 7);
      g.fillStyle(0x000000, 1).fillEllipse(nx, -2, 18, 4);
    }

    // ---------- input ----------
    setupInput() {
      const kb = this.input.keyboard;
      if (kb) this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,B,R');
      AF.pad = AF.pad || {};
      this.padWas = {};
      this.input.on('pointerdown', (p) => this.tap(p));
      this.input.on('wheel', (p, o, dx, dy) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
    }

    readInput() {
      const k = this.keys, p = AF.pad;
      const d = (o) => !!(o && o.isDown);
      const jd = (o) => !!(o && Phaser.Input.Keyboard.JustDown(o));
      const pe = (n) => { const on = !!p[n], was = this.padWas[n]; this.padWas[n] = on; return on && !was; };
      if (this.st.won && !AF.ui.keepGoing) return { dx: 0 };
      const left = (k && (d(k.LEFT) || d(k.A))) || p.left, right = (k && (d(k.RIGHT) || d(k.D))) || p.right;
      const upPress = (k && (jd(k.UP) | jd(k.W))) || pe('up');
      return {
        dx: (right ? 1 : 0) - (left ? 1 : 0),
        bite: (k && d(k.SPACE)) || p.bite,
        up: (k && (d(k.UP) || d(k.W))) || p.up, upPress,
        down: (k && (d(k.DOWN) || d(k.S))) || p.down,
        chomp: (k && jd(k.B)) || pe('chomp'),
        rally: (k && jd(k.R)) || pe('rally'),
      };
    }

    // tap the world: select a squad, send the selected squad, or plant a pheromone flag
    tap(p) {
      if (this.st.won) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y), x = wp.x, h = -wp.y;
      const z = this.cameras.main.zoom, near = Math.max(10, (22 * AF.DPR) / z);
      let hit = null, hd = near;
      for (const a of this.ants) if (a.type === 'squad') {
        const d = Math.hypot(a.w.x - x, a.w.h + 4 - h);
        if (d < hd) { hd = d; hit = a; }
      }
      if (hit) { this.selSquad = this.selSquad === hit ? null : hit; AF.audio.blip(900); if (this.selSquad) AF.ui.toast('Squad selected: tap a spot on the cake to dig there'); return; }
      if (this.selSquad) {
        const c = this.cake.colAt(x);
        if (c < 0 || this.cake.h[c] === 0) { AF.ui.toast('Tap a spot on the cake'); return; }
        const a = this.selSquad; a.target = c; this.selSquad = null;
        this.retarget(a); this.ring(this.cake.colCenter(c), -this.cake.topH(c));
        AF.audio.blip(760);
        return;
      }
      this.placeFlag(x, 0);
    }

    placeFlag(x, extra) {
      const st = this.st;
      st.flag = { x: clamp(x, this.cake.x0, this.cake.x1 - 1), t: this.flagTime(), r: this.flagRadius() + (extra || 0) };
      st.flagUsed = true;
      for (const a of this.ants) if (a.type !== 'squad' && (a.state === 'out' || a.state === 'dig') && a.w.load < this.stats(a.type).carry * 0.5) this.retarget(a);
      this.ring(st.flag.x, -this.cake.surfaceAt(st.flag.x) - 8);
      this.drawFlagRange();
      AF.audio.blip(820);
    }
    flagTime() { return 10 + 5 * this.st.up.flagTime; }
    flagRadius() { return 40 + 30 * this.st.up.flagPow; }

    zoomBy(f) { this.uz = clamp(this.uz * f, 0.15, 4); }

    // ---------- stats ----------
    boostMul(k) { return this.st.boosts[k] > 0 ? C.boosts[k] : 1; }
    valMul() { return 1 + 0.25 * (this.st.up.value - 1); }
    nestCap() { return C.nestBase + C.nestPer * (this.st.up.nest - 1); }
    units() { let n = 0; for (const t of TYPES) n += this.st.counts[t] * (t === 'squad' ? 5 : 1); return n; }
    unlocked(t) { return t === 'worker' || this.st.up['unlock.' + t] > 0; }
    squadMembers() { return 4 + this.st.up.squadSize; }
    stats(t) {
      const T = C.types[t], u = this.st.tu[t], sp = (1 + 0.2 * (u.speed - 1)) * this.boostMul('speed');
      const trail = t === 'flying' ? 1 : 1 + 0.1 * (this.st.up.trails - 1);
      let bite = T.bite * (1 + 0.5 * (u.bite - 1)) * this.boostMul('bite');
      let carry = Math.round(T.carry * (1 + 0.6 * (u.carry - 1)) * this.boostMul('carry'));
      if (t === 'squad') { bite *= this.squadMembers(); carry *= this.squadMembers(); }
      return { speed: T.speed * sp * trail, climb: T.climb * sp * trail, bite, carry, biteTime: T.biteTime };
    }
    scoutCap() { return C.scout.capPerJaw * this.st.up.jaws * this.boostMul('carry'); }

    upPrice(key) {
      const u = C.up[key], lv = this.st.up[key];
      if (lv >= u.max) return null;
      if (u.costs) return u.costs[lv - u.start];
      return Math.ceil(u.base * Math.pow(u.g, lv - u.start));
    }
    typePrice(t, k) {
      const u = C.typeUp[k], lv = this.st.tu[t][k];
      if (lv >= u.max) return null;
      return Math.ceil(u.base * C.types[t].costMul * Math.pow(u.g, lv - u.start));
    }
    hirePrice(t) { const T = C.types[t]; return Math.ceil(T.hire * Math.pow(T.hireG, this.st.counts[t])); }

    // ---------- buying ----------
    buy(id) {
      const st = this.st;
      let price = null, apply = null;
      if (id.startsWith('hire.')) {
        const t = id.slice(5), T = C.types[t];
        if (!this.unlocked(t) || (T.max && st.counts[t] >= T.max)) return;
        if (this.units() + (t === 'squad' ? 5 : 1) > this.nestCap()) { AF.ui.toast('The nest is full. Grow it in Colony'); return; }
        price = this.hirePrice(t); apply = () => { this.spawn(t, 0); if (st.hint < 3) st.hint = 3; };
      } else if (id.startsWith('type.')) {
        const [, t, k] = id.split('.');
        price = this.typePrice(t, k); apply = () => { st.tu[t][k]++; };
      } else if (C.up[id]) {
        price = this.upPrice(id);
        apply = () => {
          st.up[id]++;
          if (id.startsWith('unlock.')) { const t = id.slice(7); AF.ui.toast(`<b>${C.types[t].name}s unlocked!</b> Hire them in the Ants tab`, true); }
          if (id === 'wings') { this.applyScoutLook(); AF.ui.toast(['', 'Wings: press ▲ / Up to hop', 'Wings: hold ▲ / Up to glide', 'Wings: fly with ▲ ▼ / Up Down'][st.up.wings], true); }
          if (id === 'squadSize') for (const a of this.ants) if (a.type === 'squad') this.buildMembers(a);
        };
      }
      if (price == null || st.crumbs < price || !apply) return;
      st.crumbs -= price;
      apply();
      AF.audio.blip(780);
      this.refreshUI();
      this.persist();
    }

    applyScoutLook() {
      const sc = this.scout;
      sc.key = this.st.up.wings > 0 ? 'scoutw' : 'scout';
      sc.spr.setTexture(sc.key + sc.frame);
      sc.speed = C.scout.speed * (1 + 0.15 * (this.st.up.legs - 1));
      sc.climb = C.scout.climb * (1 + 0.15 * (this.st.up.legs - 1));
    }

    // ---------- ants ----------
    spawn(t, i) {
      const T = C.types[t], s = this.stats(t);
      const w = new AF.Walker(this, this.cake, C.world.nestX - (i || 0) * 0.5, { speed: s.speed, climb: s.climb, texture: T.tex, scale: T.scale, depth: t === 'flying' ? 14 : 12 });
      w.capacity = s.carry; w.loadVal = 0;
      const a = { type: t, w, state: 'home', D: 0, tc: -1, biteT: Math.random() * 0.3, seq: this.seq++, target: null, ph: null, cruise: 0, members: null };
      if (t === 'squad') this.buildMembers(a);
      this.ants.push(a);
      this.st.counts[t]++;
      return a;
    }

    buildMembers(a) {
      if (a.members) for (const m of a.members) m.destroy();
      a.members = [];
      const n = this.squadMembers() - 1, T = C.types.squad;
      for (let i = 0; i < n; i++) a.members.push(this.add.image(0, 0, 'squad0').setOrigin(0.5, 0.96).setScale((C.antLength / AF.ANT_TEX_W) * T.scale * 0.85).setDepth(11.9));
    }

    setTarget(a, c) {
      if (a.tc >= 0) this.claim[a.tc >> 2] = Math.max(0, this.claim[a.tc >> 2] - 1);
      a.tc = c;
      if (c >= 0) this.claim[c >> 2]++;
    }

    retarget(a) {
      if (a.state === 'back') return;
      this.setTarget(a, this.pick(a));
      a.state = a.tc >= 0 ? 'out' : 'home';
      if (a.type === 'flying') this.planFlight(a, a.tc >= 0 ? this.cake.colCenter(a.tc) : C.world.nestX);
    }

    // Instinct: weigh value, how well this ant handles the layer, distance and climbing, and crowding.
    pick(a) {
      const cake = this.cake, cols = cake.cols, H = cake.h, t = a.type, eff = EFF[t], nest = C.world.nestX;
      if (t === 'squad' && a.target != null) {
        for (let d = 0; d < 6; d++) for (const c of [a.target - d, a.target + d]) if (c >= 0 && c < cols && H[c] > 0) { a.target = c; return c; }
        a.target = null;
      }
      let lo = 0, hi = cols - 1;
      const f = this.st.flag;
      if (f && t !== 'squad') {
        const l2 = cake.colAt(f.x - f.r), h2 = cake.colAt(f.x + f.r);
        const L = l2 < 0 ? 0 : l2, R = h2 < 0 ? cols - 1 : h2;
        let any = false;
        for (let c = L; c <= R; c++) if (H[c] > 0) { any = true; break; }
        if (any) { lo = L; hi = R; }
      }
      const stepC = Math.max(1, Math.floor((hi - lo + 1) / 140));
      let best = -1, bs = -1;
      for (let c0 = lo; c0 <= hi; c0 += stepC) {
        // within each sample bucket, the tallest column (eat the high cells first, no narrow shafts)
        let c = -1;
        for (let k = c0; k < Math.min(hi + 1, c0 + stepC); k++) if (H[k] > 0 && (c < 0 || H[k] > H[c])) c = k;
        if (c < 0) continue;
        const kind = cake.topKind(c), L = C.layers[kind];
        const top = cake.topH(c), x = cake.colCenter(c);
        let v = L.value * eff(kind) / L.hard;
        let cost;
        if (t === 'flying') { v *= 1 + top / 250; cost = 1 + (x - nest) / 2500; }
        else cost = 1 + ((x - nest) + top * 1.5) / 400;
        if (L.sticky && t !== 'squad') v *= 0.6;
        const cl = this.claim[c >> 2] - (a.tc >= 0 && a.tc >> 2 === c >> 2 ? 1 : 0);
        const crowd = t === 'squad' ? 1 + 4 * cl : 1 + 1.5 * cl;
        const sc = v / cost / crowd * (0.9 + 0.2 * Math.random());
        if (sc > bs) { bs = sc; best = c; }
      }
      return best;
    }

    // flyers go up, across above the cake, then land (and the same way home)
    planFlight(a, tx) {
      const cake = this.cake, w = a.w;
      const c1 = cake.colAt(Math.min(w.x, tx)), c2 = cake.colAt(Math.max(w.x, tx));
      let top = 0;
      const lo = c1 < 0 ? 0 : c1, hi = c2 < 0 ? (Math.max(w.x, tx) > cake.x1 ? cake.cols - 1 : -1) : c2;
      for (let c = lo; c <= hi; c += 2) top = Math.max(top, cake.topH(c));
      a.cruise = Math.max(w.h, top + 14 + Math.random() * 10);
      a.ph = 'rise'; a.fx = tx;
    }

    flyStep(a, th, dt) {
      const w = a.w, sp = w.speed * dt;
      w.mode = 'walk'; w.moving = true;
      if (a.ph === 'rise') { w.h = Math.min(a.cruise, w.h + sp); if (w.h >= a.cruise - 0.01) a.ph = 'cruise'; return false; }
      if (a.ph === 'cruise') {
        const dx = a.fx - w.x;
        w.flip = dx < 0;
        if (Math.abs(dx) <= sp) { w.x = a.fx; a.ph = 'land'; } else w.x += Math.sign(dx) * sp;
        return false;
      }
      if (a.ph === 'land') {
        if (w.h - th <= sp) { w.h = th; a.ph = null; return true; }
        w.h -= sp; return false;
      }
      return true;
    }

    updateAnts(dt) {
      const cake = this.cake, st = this.st, nest = C.world.nestX, gap = C.ant.gap, sc = this.scout;
      const TS = {}; for (const t of TYPES) TS[t] = this.stats(t);
      const aura = st.up.aura > 0 ? 1 + 0.1 * st.up.aura : 1;
      const outs = [], backs = [];
      for (const a of this.ants) {
        if (a.type === 'flying') continue;
        a.D = (a.w.x - nest) + a.w.h;
        if (a.state === 'out' && a.tc >= 0 && cake.colCenter(a.tc) > a.w.x) outs.push(a);
        else if (a.state === 'back') backs.push(a);
      }
      outs.sort((p, q) => q.D - p.D);
      backs.sort((p, q) => p.D - q.D);
      for (let i = 0; i < outs.length; i++) outs[i].lim = i ? outs[i - 1].D - gap - outs[i].D : Infinity;
      for (let i = 0; i < backs.length; i++) backs[i].lim = i ? backs[i].D - (backs[i - 1].D + gap) : Infinity;

      for (const a of this.ants) {
        const w = a.w, s = TS[a.type], fly = a.type === 'flying';
        let mul = 1;
        if (aura > 1 && Math.abs(w.x - sc.x) < 60 && Math.abs(w.h - sc.h) < 60) mul = aura;
        let sticky = 1;
        if (!fly && a.type !== 'squad') {
          const c = cake.colAt(w.x);
          if (c >= 0 && Math.abs(w.h - cake.topH(c)) < 1 && cake.topKind(c) === 'jam') sticky = C.layers.jam.sticky;
        }
        w.speed = s.speed * mul * sticky; w.climb = s.climb * mul * sticky; w.capacity = s.carry;

        if (a.state === 'home') { this.retarget(a); if (a.state === 'home') { w.moving = false; w.render(dt); this.drawMembers(a); continue; } }
        if (a.state === 'out' && (a.tc < 0 || cake.h[a.tc] === 0)) this.retarget(a);

        if (a.state === 'out') {
          const tx = cake.colCenter(a.tc);
          let arrived;
          if (fly) arrived = this.flyStep(a, cake.topH(a.tc), dt);
          else arrived = w.step(tx, dt, a.lim === undefined ? Infinity : a.lim);
          a.lim = undefined;
          if (arrived) { a.state = 'dig'; a.biteT = 0; }
        } else if (a.state === 'dig') {
          if (fly) { w.h = Math.max(cake.surfaceAt(w.x), w.h - w.climb * dt); w.moving = false; } else w.step(cake.colCenter(a.tc), dt);
          if (cake.h[a.tc] === 0) {
            if (w.load > 0) this.goHome(a); else this.retarget(a);
          } else if (Math.abs(w.h - cake.topH(a.tc)) < 1) {
            a.biteT += dt;
            if (a.biteT >= s.biteTime) {
              a.biteT = 0;
              const res = cake.eat(a.tc, s.bite * mul, Math.max(0, s.carry - w.load), EFF[a.type]);
              if (res.n) {
                w.load += res.n; w.loadVal += res.value; w.color = res.color; this.lastKind = res.kind;
                if (Math.random() < 0.3) this.spray(w.x, -w.h - 2, res.color, 1);
              }
              if (res.item) this.foundItem(res.item);
              if (w.load >= s.carry) this.goHome(a);
            }
          }
        } else if (a.state === 'back') {
          let home;
          if (fly) home = this.flyStep(a, 0, dt);
          else home = w.step(nest, dt, a.lim === undefined ? Infinity : a.lim);
          a.lim = undefined;
          if (home && w.h < 1) {
            const v = w.loadVal * this.valMul();
            st.crumbs += v; this.gain += v;
            w.load = 0; w.loadVal = 0;
            a.state = 'home';
          }
        }
        if (fly) { w.rot = 0; }
        w.render(dt);
        if (fly) w.spr.setPosition(w.x, -w.h).setRotation(0);
        this.drawMembers(a);
      }
    }

    goHome(a) {
      this.setTarget(a, -1);
      a.state = 'back';
      if (a.type === 'flying') this.planFlight(a, C.world.nestX);
    }

    drawMembers(a) {
      if (!a.members) return;
      const w = a.w, dir = w.flip ? 1 : -1;
      a.members.forEach((m, i) => {
        const ring = i % 2 ? 1 : -1;
        const x = w.x + dir * (4 + 3 * Math.floor(i / 2)) + ring * 1.5;
        const h = Math.max(this.cake.surfaceAt(x), Math.min(w.h, this.cake.surfaceAt(x) + 3));
        const fr = w.frame ^ (i & 1);
        m.setTexture('squad' + fr).setPosition(x, -h).setFlipX(w.flip).setRotation(w.mode === 'walk' ? 0 : w.rot * 0.5);
      });
      if (this.selSquad === a) this.selRing.setVisible(true).setPosition(w.x, -w.h - 4).setScale(0.35 + 0.04 * Math.sin(this.time.now / 120));
    }

    foundItem(it) {
      const def = C.items[it.key], st = this.st;
      const burst = Math.round(def.burst * this.valMul());
      st.crumbs += burst;
      const ks = def.boost === 'all' ? ['speed', 'bite', 'carry'] : [def.boost];
      for (const k of ks) st.boosts[k] = Math.max(st.boosts[k], def.time);
      const x = this.cake.colCenter(it.c + 1), y = -(this.cake.base + (it.r + 1.5) * C.cell);
      this.ring(x, y); this.ring(x, y - 6);
      const col = (def.color[0] << 16) | (def.color[1] << 8) | def.color[2];
      this.spray(x, y, col, 14); this.spray(x, y, 0xffe08a, 10);
      this.floater(x, y - 8, '+' + AF.fmt(burst), 20);
      const bt = def.boost === 'all' ? 'everything' : def.boost;
      AF.ui.toast(`<b>${def.name}!</b> +${AF.fmt(burst)} crumbs · ${bt} boost ${def.time}s`, true);
      AF.audio.blip(990); AF.audio.blip(1320);
    }

    // ---------- scout ----------
    updateScout(dt) {
      const sc = this.scout, st = this.st, cake = this.cake, inp = this.readInput(), wings = st.up.wings;
      sc.capacity = this.scoutCap();
      if (!sc.air && inp.upPress && wings > 0) { sc.air = true; sc.vy = Math.sqrt(2 * C.scout.gravity * C.scout.hop); }
      if (sc.air) {
        const dx = inp.dx || 0;
        if (dx) {
          sc.flip = dx < 0;
          const nx = clamp(sc.x + dx * sc.speed * dt, C.world.left, C.world.right);
          if (cake.surfaceAt(nx + dx * sc.half * 0.6) <= sc.h) sc.x = nx;
        }
        const g = C.scout.gravity;
        if (wings >= 3) {
          const tv = inp.up ? C.scout.fly : inp.down ? -C.scout.fly : -15;
          sc.vy += (tv - sc.vy) * Math.min(1, dt * 6);
        } else {
          sc.vy -= g * dt;
          if (wings >= 2 && inp.up && sc.vy < -C.scout.glide) sc.vy = -C.scout.glide;
        }
        sc.h += sc.vy * dt;
        if (sc.h > C.world.ceiling) { sc.h = C.world.ceiling; sc.vy = Math.min(0, sc.vy); }
        const s = sc.S(sc.x);
        if (sc.h <= s) { sc.h = s; sc.air = false; sc.vy = 0; }
        sc.mode = 'walk'; sc.moving = true; sc.rot += (0 - sc.rot) * Math.min(1, dt * 16);
      } else sc.drive({ dx: inp.dx || 0 }, dt);

      if (inp.bite && !sc.air) {
        if (!this.biteWas) { this.biteT = 0; this.scoutBite(); }
        else { this.biteT += dt; if (this.biteT >= C.scout.biteTime) { this.biteT = 0; this.scoutBite(); } }
      }
      this.biteWas = !!inp.bite;
      this.chompT -= dt; this.rallyT -= dt;
      if (inp.chomp && st.up.bigbite > 0) this.bigBite();
      if (inp.rally && st.up.rally > 0) {
        if (this.rallyT > 0) AF.ui.toast(`Rally ready in ${Math.ceil(this.rallyT)}s`);
        else { this.rallyT = Math.max(5, 20 - 2 * st.up.rally); this.placeFlag(sc.x, 20 * st.up.rally); AF.ui.toast('Rally! Ants follow your scent'); }
      }

      // drop off at the nest
      if (sc.load > 0 && Math.abs(sc.x - C.world.nestX) <= C.world.nestRadius && sc.h < 1) {
        const v = Math.round(sc.loadVal * this.valMul());
        sc.load = 0; sc.loadVal = 0;
        st.crumbs += v;
        this.floater(sc.x, -14, '+' + AF.fmt(v), 18);
        AF.audio.blip(660);
        if (st.hint < 2) st.hint = 2;
      }

      sc.render(dt);
      if (sc.air) { sc.ox = 0; sc.spr.setPosition(sc.x, -sc.h); }
      const z = this.cameras.main.zoom;
      const ms = (16 * AF.DPR) / (32 * z);
      const bob = Math.sin(this.time.now / 180) * 3 * AF.DPR / z;
      this.marker.setScale(Math.max(ms, 0.2)).setPosition(sc.x, -sc.h - 13 - (10 * AF.DPR) / z + bob);
      this.updateScent(ms);
    }

    // columns the scout's jaws reach: under it and right in front of its head
    jawCols() {
      const sc = this.scout, cake = this.cake, face = sc.flip ? -1 : 1;
      const mid = cake.colAt(sc.x), head = cake.colAt(sc.x + face * (sc.half + 1));
      const out = [];
      for (const c of [mid - 1, mid, mid + 1, head]) {
        if (c < 0 || c >= cake.cols || out.indexOf(c) >= 0 || cake.h[c] === 0) continue;
        const top = cake.topH(c);
        if (top > sc.h + 0.5 || top < sc.h - C.cell * 1.5) continue;
        out.push(c);
      }
      return out;
    }

    scoutBite() {
      const sc = this.scout, cake = this.cake, st = this.st;
      if (sc.load >= sc.capacity) return;
      const cand = this.jawCols();
      if (!cand.length) return;
      let best = cand[0];
      for (const c of cand) if (cake.h[c] > cake.h[best]) best = c;
      const res = cake.eat(best, st.up.jaws * this.boostMul('bite'), sc.capacity - sc.load, null);
      if (res.n) {
        sc.load += res.n; sc.loadVal += res.value; sc.color = res.color; this.lastKind = res.kind;
        this.spray(cake.colCenter(best), -cake.topH(best) - 2, res.color, 3);
        if (st.hint === 0) st.hint = 1;
      }
      AF.audio.chomp();
      if (res.item) this.foundItem(res.item);
    }

    bigBite() {
      if (this.chompT > 0) { AF.ui.toast(`Big bite ready in ${Math.ceil(this.chompT)}s`); return; }
      const sc = this.scout, cake = this.cake, lv = this.st.up.bigbite;
      const mid = cake.colAt(sc.x + (sc.flip ? -1 : 1) * sc.half * 0.5);
      if (mid < 0 && !this.jawCols().length) return;
      let total = 0;
      for (let c = mid - 1; c <= mid + 1; c++) {
        if (c < 0 || c >= cake.cols || cake.h[c] === 0) continue;
        const top = cake.topH(c);
        if (top > sc.h + C.cell * 2 || top < sc.h - C.cell * 3) continue;
        const res = cake.eat(c, 6 * lv * this.st.up.jaws, 2 + lv, null);
        total += res.value;
        if (res.n) this.spray(cake.colCenter(c), -cake.topH(c) - 2, res.color, 4);
        if (res.item) this.foundItem(res.item);
      }
      if (!total) return;
      this.chompT = C.scout.chompCd;
      const v = Math.round(total * this.valMul());
      this.st.crumbs += v;
      this.floater(sc.x, -sc.h - 12, 'CHOMP +' + AF.fmt(v), 16);
      this.cameras.main.shake(120, 0.004);
      AF.audio.chomp(); AF.audio.blip(300);
    }

    nearestItem(maxD) {
      const sc = this.scout, cake = this.cake;
      let best = null, bd = maxD;
      for (const it of cake.items) {
        if (it.found) continue;
        const x = cake.colCenter(it.c + 1), h = cake.base + (it.r + 1.5) * C.cell;
        const d = Math.hypot(x - sc.x, h - sc.h);
        if (d < bd) { bd = d; best = { x, h, d }; }
      }
      return best;
    }

    updateScent(ms) {
      const lv = this.st.up.scent, ar = this.scentArrow, sc = this.scout;
      if (!lv) { ar.setVisible(false); return; }
      const it = this.nearestItem(200 + 250 * lv);
      if (!it) { ar.setVisible(false); return; }
      const dx = it.x - sc.x, dy = -(it.h - sc.h), a = Math.atan2(dy, dx), r = 16;
      ar.setVisible(true).setScale(Math.max(ms * 0.8, 0.15)).setRotation(a - Math.PI / 2)
        .setPosition(sc.x + Math.cos(a) * r, -sc.h - 5 + Math.sin(a) * r).setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 150));
    }

    // ---------- flags, sniffer ----------
    drawFlagRange() {
      const g = this.flagG, f = this.st.flag, cake = this.cake;
      g.clear();
      if (!f) return;
      g.fillStyle(0xff5a8a, 0.55);
      for (let x = f.x - f.r; x <= f.x + f.r; x += 4) g.fillCircle(x, -cake.surfaceAt(x) - 1, 0.9);
    }

    drawSniff() {
      const g = this.sniffG, cake = this.cake, lv = this.st.up.sniffer + (this.sniffAll ? 99 : 0);
      g.clear();
      if (!lv) return;
      const pulse = 0.35 + 0.25 * Math.sin(this.time.now / 250);
      for (const it of cake.items) {
        if (it.found) continue;
        const depth = cake.h[it.c + 1] - (it.r + 2);
        if (depth > 10 * lv) continue;
        const def = C.items[it.key], col = (def.color[0] << 16) | (def.color[1] << 8) | def.color[2];
        const x = cake.colCenter(it.c + 1), y = -(cake.base + (it.r + 1.5) * C.cell);
        g.lineStyle(1.5, col, pulse + 0.2).strokeCircle(x, y, 10);
        g.lineStyle(1, 0xffffff, pulse).strokeCircle(x, y, 13);
      }
    }

    // ---------- main loop ----------
    update(time, delta) {
      const raw = Math.min(delta / 1000, 0.05);
      const st = this.st;
      let steps = this.devSpeed > 1 ? Math.min(this.devSpeed, 20) : 1;
      for (let i = 0; i < steps; i++) this.tick(raw);
      this.cake.flush();
      this.updateCamera(raw, false);
      this.drawT += raw;
      if (this.drawT > 0.25) { this.drawT = 0; this.drawFlagRange(); this.drawSniff(); }
      this.uiT += raw;
      if (this.uiT > 0.1) { this.uiT = 0; this.refreshUI(); }
      this.saveT += raw;
      if (this.saveT > 3) { this.saveT = 0; this.persist(); }
      if (!this.selSquad || this.ants.indexOf(this.selSquad) < 0) this.selRing.setVisible(false);
      if (st.flag) {
        const f = st.flag;
        this.flagImg.setVisible(true).setPosition(f.x, -this.cake.surfaceAt(f.x)).setScale(16 / 48).setAlpha(f.t < 3 ? 0.4 + 0.6 * ((this.time.now / 150) & 1) : 1);
      } else this.flagImg.setVisible(false);
    }

    tick(dt) {
      const st = this.st;
      if (!st.won) st.time += dt;
      for (const k of Object.keys(st.boosts)) if (st.boosts[k] > 0) st.boosts[k] = Math.max(0, st.boosts[k] - dt);
      if (st.flag) { st.flag.t -= dt; if (st.flag.t <= 0) { st.flag = null; this.drawFlagRange(); } }
      this.updateScout(dt);
      this.updateAnts(dt);
      this.gainT += dt;
      if (this.gainT > 1) { if (this.gain > 0) this.floater(C.world.nestX + 14, -10, '+' + AF.fmt(this.gain), 13); this.gain = 0; this.gainT = 0; }
      // endgame: the last scattered crumbs (≤1%, a single row) would take ages one trip at a time, so the colony sweeps them up
      if (!st.won && this.cake.left > 0 && this.cake.left <= this.cake.total * 0.01) {
        const n = this.cake.left;
        this.cake.cutTo(0);
        st.crumbs += n; this.gain += n;
        AF.ui.toast(`<b>Sweep!</b> The colony grabs the last ${AF.fmt(n)} crumbs`, true);
      }
      if (!st.won && this.cake.left <= 0) {
        st.won = true;
        this.persist();
        AF.audio.blip(990);
        this.time.delayedCall(600, () => AF.ui.showWin(st.time));
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
      const z = this.cameras.main.zoom, s = Math.max(0.6, (40 * AF.DPR) / (64 * z));
      const r = this.add.image(x, y, 'ring').setDepth(25).setTint(0xffd25a).setScale(s * 0.15);
      this.tweens.add({ targets: r, scale: s, alpha: 0, duration: 500, ease: 'Cubic.out', onComplete: () => r.destroy() });
    }

    // ---------- camera ----------
    // Starts close on the scout and eases out to frame the colony's work as it grows; +/- and the wheel zoom.
    updateCamera(dt, instant) {
      const cam = this.cameras.main, k = C.camera, DPR = AF.DPR, cake = this.cake;
      const W = this.scale.width, H = this.scale.height;
      const cssW = W / DPR, cssH = H / DPR;
      const portrait = cssH > cssW;
      const panel = AF.ui.panelWidth();
      const viewW = Math.max(200, cssW - panel);
      const groundCss = Math.max(80, (cssH - AF.ui.barHeight()) * (portrait ? 0.72 : 0.85));

      let fr = C.world.nestX + 80, ft = 60;
      for (const a of this.ants) fr = Math.max(fr, a.w.x + 40);
      fr = Math.max(fr, this.scout.x + 40);
      fr = Math.min(fr, cake.x1 + 60);
      const fl = C.world.nestX - 60;
      for (let c = 0; c < cake.cols; c += 8) if (cake.colCenter(c) <= fr) ft = Math.max(ft, cake.topH(c) + 30);
      const zStart = portrait ? Math.max(2.2, cssW / k.portraitDiv) : Math.max(k.minStartZoom, Math.min(viewW, cssH) / k.startDiv);
      const zFit = Math.min(viewW / (fr - fl), (groundCss * 0.92) / ft);
      const units = this.units();
      const p = units > 0 ? 0.25 + 0.75 * Math.pow(Math.min(1, units / 40), 0.7) : 0;
      // auto zoom never goes so far out that ants become specks; the − button can still go further
      const zAuto = Math.max(Math.min(zStart, zStart * Math.pow(zFit / zStart, p)), Math.min(zStart, 1.1));
      const zT = zAuto * this.uz * DPR;

      if (instant || !this.zCur) this.zCur = zT;
      else this.zCur += (zT - this.zCur) * Math.min(1, dt * 3);
      const z = this.zCur;

      const half = (viewW * DPR) / 2 / z, lead = Math.min(k.lead, half * 0.35);
      let cx = Phaser.Math.Linear(this.scout.x + lead * (this.scout.flip ? -1 : 1), (fl + fr) / 2, p * Math.min(1, this.uz));
      cx = clamp(cx, this.scout.x - half * 0.8, this.scout.x + half * 0.8);
      cx = clamp(cx, C.world.left + half, Math.max(C.world.left + half, C.world.right - half));
      cx += (panel * DPR) / z / 2; // the panel covers the right: shift so the view centers left of it
      let cy = (H / 2 - groundCss * DPR) / z;
      cy = Math.min(cy, -this.scout.h + (0.25 * H) / z);

      if (instant || this.cx === undefined) { this.cx = cx; this.cy = cy; }
      else {
        const a = Math.min(1, dt * 5);
        this.cx += (cx - this.cx) * a; this.cy += (cy - this.cy) * a;
      }
      cam.setZoom(z);
      cam.centerOn(this.cx, this.cy);
    }

    // ---------- UI ----------
    rows() {
      const st = this.st, rows = [], up = st.up;
      const lvTxt = (lv, start) => (lv > start || start > 0 ? 'Lv ' + lv : '');
      const U = (tab, id, title, desc, show) => rows.push({ tab, id, title, desc, lv: lvTxt(up[id], C.up[id].start), price: this.upPrice(id), show });
      const sc = this.scoutCap();
      U('scout', 'legs', 'Legs', `Scout walks and climbs faster (+15% each)`);
      U('scout', 'jaws', 'Jaws', `Bite harder and carry more (${Math.round(sc)} now)`);
      U('scout', 'bigbite', 'Big bite', up.bigbite ? `B / CHOMP: bite a chunk straight into the bank (every ${C.scout.chompCd}s)` : 'Unlock a huge chomp (B key)');
      U('scout', 'aura', 'Leader aura', `Ants near the scout work ${up.aura ? '+' + up.aura * 10 + '%' : 'faster'}`);
      U('scout', 'scent', 'Treat scent', 'An arrow points to the nearest hidden treat' + (up.scent ? ` (range ${200 + 250 * up.scent})` : ''));
      U('scout', 'rally', 'Rally', up.rally ? `R / RALLY: plant a big flag where the scout stands` : 'Call ants to the scout (R key)');
      const wn = ['Hop (▲ / Up)', 'Glide (hold ▲)', 'Fly (▲ ▼)'];
      rows.push({ tab: 'scout', id: 'wings', title: 'Wings', desc: up.wings < 3 ? 'Next: ' + wn[up.wings] : 'Fly anywhere with ▲ ▼', lv: up.wings ? 'Lv ' + up.wings : '', price: this.upPrice('wings') });

      const cap = this.nestCap(), used = this.units();
      for (const t of TYPES) {
        const T = C.types[t];
        if (!this.unlocked(t)) continue;
        const s = this.stats(t), n = st.counts[t];
        const what = { worker: 'Soft layers. Weak on chocolate and biscuit', strong: 'Cracks chocolate and biscuit 3× faster', flying: 'Flies to the top: frosting, sprinkles, candles', squad: `${this.squadMembers()} ants dig one spot, ignore sticky jam. Tap it, then tap the cake` }[t];
        rows.push({ tab: 'ants', id: 'h_' + t, head: `${T.name}s <span>${n}${T.max ? '/' + T.max : ''}</span>` });
        const full = used + (t === 'squad' ? 5 : 1) > cap;
        rows.push({ tab: 'ants', id: 'hire.' + t, title: 'Hire ' + T.name.toLowerCase(), desc: what, lv: '', price: T.max && n >= T.max ? null : this.hirePrice(t), block: full ? 'Nest full' : null });
        rows.push({ tab: 'ants', id: `type.${t}.speed`, title: 'Speed', desc: `${Math.round(s.speed)} walk`, lv: 'Lv ' + st.tu[t].speed, price: this.typePrice(t, 'speed') });
        rows.push({ tab: 'ants', id: `type.${t}.carry`, title: 'Carry', desc: `${s.carry} crumbs a trip`, lv: 'Lv ' + st.tu[t].carry, price: this.typePrice(t, 'carry') });
        rows.push({ tab: 'ants', id: `type.${t}.bite`, title: 'Bite', desc: `${(Math.round(s.bite * 10) / 10)} bite power`, lv: 'Lv ' + st.tu[t].bite, price: this.typePrice(t, 'bite') });
      }

      U('colony', 'nest', 'Bigger nest', `Room for ${cap} ants (${cap + C.nestPer} next)`);
      U('colony', 'value', 'Crumb value', `Every crumb is worth ×${this.valMul().toFixed(2)}`);
      const ul = (t, desc) => rows.push({ tab: 'colony', id: 'unlock.' + t, title: 'Unlock ' + C.types[t].name.toLowerCase() + 's', desc, lv: '', price: this.upPrice('unlock.' + t), block: up['unlock.' + t] ? 'Owned' : null });
      ul('strong', 'They crack the hard chocolate shell and biscuit');
      ul('flying', 'They fly straight to the top, sprinkles and candles');
      ul('squad', 'Teams of 5 that dig where you send them');

      U('tools', 'flagPow', 'Flag power', `Tap the cake to plant a flag. Ants within ${this.flagRadius()} go there`);
      U('tools', 'flagTime', 'Flag time', `A flag lasts ${this.flagTime()}s`);
      U('tools', 'squadSize', 'Squad size', `${this.squadMembers()} ants in each squad`, this.unlocked('squad'));
      U('tools', 'trails', 'Scent trails', `Walking ants +${10 * (up.trails - 1)}% speed`);
      U('tools', 'sniffer', 'Sniffer', up.sniffer ? `Shows treats up to ${10 * up.sniffer} cells deep` : 'Reveal hidden treats near the surface');
      return rows;
    }

    refreshUI() {
      const st = this.st, cake = this.cake, sc = this.scout, touch = AF.ui.touch;
      const b = st.boosts, bs = [];
      for (const k of ['speed', 'bite', 'carry']) if (b[k] > 0) bs.push(`${cap1(k)} ×${C.boosts[k]} <b>${Math.ceil(b[k])}s</b>`);
      const units = this.units();
      let kind = null;
      const c = cake.colAt(sc.x);
      if (c >= 0 && cake.h[c] > 0 && Math.abs(sc.h - cake.topH(c)) < 3) kind = cake.topKind(c);
      kind = kind || this.lastKind;
      const L = kind && C.layers[kind];
      AF.ui.update({
        crumbs: st.crumbs,
        eaten: cake.left > 0 ? Math.min(99, Math.floor((1 - cake.left / cake.total) * 100)) : 100,
        colony: units ? `Ants ${units}/${this.nestCap()}` : '',
        layer: L ? `${L.name}${L.sticky ? ' (sticky)' : L.hard >= 3 ? ' (hard)' : ''}` : '',
        boosts: bs.join(' · '),
        time: st.time,
        rows: this.rows(),
        pad: { up: st.up.wings > 0, chomp: st.up.bigbite > 0, rally: st.up.rally > 0 },
      });
      const dn = document.querySelector('#pad [data-k="down"]'); if (dn) dn.hidden = st.up.wings < 3;

      let h = '';
      const hard = this.lastKind === 'chocolate' || this.lastKind === 'biscuit';
      if (st.won) h = '';
      else if (st.hint === 0) h = touch ? 'Walk with ◀ ▶ to the Giant Cake, climb it and press BITE' : 'Walk with ← → to the Giant Cake, climb it and bite with Space';
      else if (sc.load >= sc.capacity && st.hint < 2) h = 'Your jaws are full! Carry the crumbs back to the nest hole';
      else if (st.hint === 1) h = 'Keep biting, then carry the crumbs back to the nest hole';
      else if (units === 0) h = st.crumbs >= this.hirePrice('worker') ? 'Hire a worker ant in Upgrades → Ants' : 'Bring crumbs home to hire worker ants';
      else if (!st.flagUsed && units >= 2) h = 'Tap the cake to plant a pheromone flag: ants dig there';
      else if (hard && !this.unlocked('strong')) h = 'The chocolate shell is hard. Unlock strong ants in Colony';
      AF.ui.hint(h);
    }

    // ---------- save / dev ----------
    persist() {
      if (this.resetting) return;
      const st = this.st, sc = this.scout;
      AF.save.write({
        v: 3, crumbs: st.crumbs, time: st.time, won: st.won, hint: st.hint, flagUsed: st.flagUsed,
        up: st.up, tu: st.tu, counts: st.counts, boosts: st.boosts,
        scoutX: Math.round(sc.x * 10) / 10, scoutH: Math.round(sc.h * 10) / 10, scoutLoad: sc.load, scoutVal: sc.loadVal,
        cake: this.cake.encode(),
      });
    }

    resetGame() {
      this.resetting = true;
      AF.save.clear();
      location.reload();
    }

    dev(cmd, arg) {
      const st = this.st;
      if (cmd === 'speed') this.devSpeed = arg;
      else if (cmd === 'crumbs') st.crumbs += arg;
      else if (cmd === 'layer') {
        this.cake.cutTo(arg);
        for (const it of this.cake.items) if (it.r + 1 >= arg) it.found = true;
      } else if (cmd === 'unlock') {
        for (const t of ['strong', 'flying', 'squad']) st.up['unlock.' + t] = 1;
        st.up.wings = 3; st.up.bigbite = Math.max(1, st.up.bigbite); st.up.rally = Math.max(1, st.up.rally); st.up.scent = Math.max(1, st.up.scent);
        st.up.nest = Math.max(st.up.nest, 10);
        this.applyScoutLook();
      } else if (cmd === 'sniff') this.sniffAll = !this.sniffAll;
      AF.ui.toast('dev: ' + cmd + (arg !== undefined ? ' ' + arg : ''));
      this.refreshUI();
    }
  }

  AF.GameScene = GameScene;
})();
