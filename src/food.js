// The feast table: several dishes the ants eat bit by bit.
// GridDish (cake, bread): a 2D pile of cells. Ants eat the top cell of a column; the cells above a bitten
// one fall down. h[c] is the skyline (highest solid cell + 1) that walking ants follow.
// GrapeDish: a platter of grapes that roll away when nibbled and shrink as they are eaten.
// Table: answers "how high is the food at x?" for every dish, so ants can walk over all of them.
(function () {
  const C = AF.config;

  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const rgb = (c, k) => `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`;
  const toInt = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

  class GridDish {
    constructor(scene, key, d, saved) {
      this.key = key; this.def = d; this.name = d.name;
      this.cell = C.cell; this.cols = d.cols; this.rows = d.rows;
      this.x0 = d.x0; this.x1 = d.x0 + d.cols * this.cell;
      this.base = d.plateH;
      this.plateL = this.x0 - d.platePad; this.plateR = this.x1 + d.platePad;
      this.full = this.shape();

      const n = this.cols * this.rows;
      // g: 1 = solid. o: the row the cell started on + 1 (its colour and hardness travel with it when it falls), 0 = empty.
      this.g = new Uint8Array(n); this.o = new Uint8Array(n);
      for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.full[c]; r++) { this.g[r * this.cols + c] = 1; this.o[r * this.cols + c] = r + 1; }
      if (saved && typeof saved === 'string' && saved.length === n) {
        for (let i = 0; i < n; i++) {
          const v = saved.charCodeAt(i) - 48;
          if (v <= 0 || v > this.rows) { this.g[i] = 0; this.o[i] = 0; } else { this.g[i] = 1; this.o[i] = v; }
        }
      }
      this.h = new Array(this.cols);
      for (let c = 0; c < this.cols; c++) { this.compact(c); this.retop(c); }
      this.fall = new Map(); // column -> { row, off, v }: cells from `row` up are drawn `off` units above where they are
      this.total = this.full.reduce((a, b) => a + b, 0);
      this.left = 0;
      for (let i = 0; i < n; i++) this.left += this.g[i];

      this.px = 2; // canvas pixels per world unit
      const cs = this.cell * this.px;
      this.cs = cs;
      const cv = document.createElement('canvas');
      cv.width = this.cols * cs; cv.height = this.rows * cs;
      this.ctx = cv.getContext('2d');
      for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.rows; r++) if (this.g[r * this.cols + c]) this.paint(c, r);
      this.tex = scene.textures.addCanvas('dish-' + key, cv);
      this.dirty = true;
      this.img = scene.add.image(this.x0, -this.base, 'dish-' + key).setOrigin(0, 1).setScale(1 / this.px).setDepth(5);
    }

    get center() { return (this.x0 + this.x1) / 2; }

    // hardness of the cell that started at (c, r): ants need at least this bite strength
    hard() { return 1; }

    // Paint cell (c, r), drawn `dy` world units above its grid spot (while falling).
    paint(c, r, dy) {
      const or = this.o[r * this.cols + c] - 1;
      const col = this.color(c, or);
      const k = this.shade(c, or, col);
      this.ctx.fillStyle = rgb(col, k);
      this.ctx.fillRect(c * this.cs, Math.round((this.rows - 1 - r) * this.cs - (dy || 0) * this.px), this.cs, this.cs);
    }
    shade(c, or) { return 0.94 + hash(c, or) * 0.12; }

    repaintCol(c) {
      const fl = this.fall.get(c);
      this.ctx.clearRect(c * this.cs, 0, this.cs, this.rows * this.cs);
      for (let r = 0; r < this.h[c]; r++) this.paint(c, r, fl && r >= fl.row ? fl.off : 0);
      this.dirty = true;
    }

    // Pack a column's cells down so there are no holes in it.
    compact(c) {
      let w = 0;
      for (let r = 0; r < this.rows; r++) {
        const i = r * this.cols + c;
        if (!this.g[i]) continue;
        if (w !== r) { const j = w * this.cols + c; this.g[j] = 1; this.o[j] = this.o[i]; this.g[i] = 0; this.o[i] = 0; }
        w++;
      }
    }

    // Falling animation: the cells settle quickly with gravity.
    update(dt) {
      if (!this.fall.size) return;
      const G = C.fallG;
      for (const [c, fl] of this.fall) {
        fl.v += G * dt; fl.off -= fl.v * dt;
        if (fl.off <= 0) this.fall.delete(c);
        this.repaintCol(c);
      }
    }

    flush() {
      if (this.dirty) { this.tex.refresh(); this.dirty = false; }
    }

    // ---------- grid lookups ----------
    colAt(x) {
      if (x < this.x0 || x >= this.x1) return -1;
      return Math.floor((x - this.x0) / this.cell);
    }
    colCenter(c) { return this.x0 + (c + 0.5) * this.cell; }
    topH(c) { return this.base + this.h[c] * this.cell; }

    retop(c) {
      let r = this.rows - 1;
      while (r >= 0 && !this.g[r * this.cols + c]) r--;
      this.h[c] = r + 1;
    }

    surfaceAt(x) {
      const c = this.colAt(x);
      if (c >= 0) return this.base + this.h[c] * this.cell;
      if (x >= this.plateL && x <= this.plateR) return this.base;
      return 0;
    }

    // hardness of the top cell of column c (0 = column empty)
    topHard(c) {
      if (c < 0 || c >= this.cols || this.h[c] <= 0) return 0;
      return this.hard(c, this.o[(this.h[c] - 1) * this.cols + c] - 1);
    }
    edible(c, str) { const t = this.topHard(c); return t > 0 && t <= str; }

    // first column with food, seen from the side the trail arrives on (dir +1: from the left)
    headCol(dir) {
      if (dir < 0) { for (let i = this.cols - 1; i >= 0; i--) if (this.h[i] > 0) return i; return -1; }
      for (let i = 0; i < this.cols; i++) if (this.h[i] > 0) return i;
      return -1;
    }

    // Eat cell (c, r). Everything above it in the column drops down one cell.
    remove(c, r) {
      const cols = this.cols, color = toInt(this.color(c, this.o[r * cols + c] - 1));
      for (let rr = r; rr < this.rows - 1; rr++) {
        const i = rr * cols + c, j = i + cols;
        this.g[i] = this.g[j]; this.o[i] = this.o[j];
      }
      const t = (this.rows - 1) * cols + c; this.g[t] = 0; this.o[t] = 0;
      this.left--;
      this.retop(c);
      if (this.h[c] > r) { // the part above falls
        const fl = this.fall.get(c);
        if (fl) { fl.row = Math.min(fl.row, r); fl.off = Math.min(fl.off + this.cell, this.cell * 3); }
        else this.fall.set(c, { row: r, off: this.cell, v: 0 });
      }
      this.repaintCol(c);
      return color;
    }

    // Bite the top of column c: up to n cells, as long as they are not too hard for `str`.
    eat(c, n, str) {
      let eaten = 0, color = 0xe9b872;
      while (eaten < n && this.edible(c, str)) { color = this.remove(c, this.h[c] - 1); eaten++; }
      return { n: eaten, color };
    }

    encode() {
      const parts = [];
      for (let i = 0; i < this.o.length; i += 1024) parts.push(String.fromCharCode.apply(null, Array.from(this.o.subarray(i, i + 1024), (v) => 48 + v)));
      return parts.join('');
    }

    drawPlate(g) {
      const w = this.plateR - this.plateL, hgt = this.base;
      g.fillStyle(this.def.plate, 1).fillRoundedRect(this.plateL, -hgt, w, hgt, Math.min(1.4, hgt / 2));
      g.fillStyle(0xffffff, 0.6).fillRect(this.plateL + 2, -hgt, w - 4, 1.2);
    }
  }

  // ---------- the cake: sponge, cream and jam layers, frosting, sprinkles, a cherry ----------
  const SPONGE = [233, 184, 114], CREAM = [255, 243, 224], JAM = [178, 34, 56];
  const FROST = [246, 182, 202], CHERRY = [196, 24, 44];
  const SPRINKLES = [[90, 160, 230], [250, 214, 80], [120, 200, 120], [255, 255, 255]];

  class Cake extends GridDish {
    shape() {
      const d = this.def, out = new Array(this.cols), r = 7;
      this.body = d.rows - d.cherryRows;
      const body = this.body, cx = (this.cols - 1) / 2, cr = 3.4;
      for (let i = 0; i < this.cols; i++) {
        const e = Math.min(i, this.cols - 1 - i);
        let h = body;
        if (e < r) { const dx = r - e - 0.5; h = body - Math.round(r - Math.sqrt(Math.max(0, r * r - dx * dx))); }
        const dd = Math.abs(i - cx);
        if (dd < cr) h = body + Math.min(this.rows - body, Math.round(Math.sqrt(cr * cr - dd * dd) * 1.75));
        out[i] = h;
      }
      return out;
    }
    color(c, r) {
      if (r >= this.body) return CHERRY;
      const top = Math.min(this.full[c], this.body);
      const drip = hash(c, 7) < 0.35 ? 1 + Math.floor(hash(c, 9) * 4) : 0;
      const edge = Math.min(c, this.cols - 1 - c);
      if (r >= top - 3 - drip || edge === 0) {
        if (hash(c, r + 1000) < 0.07) return SPRINKLES[Math.floor(hash(r, c) * SPRINKLES.length)];
        return FROST;
      }
      const band = r % 13;
      if (band === 10 || band === 11) return CREAM;
      if (band === 12) return JAM;
      return SPONGE;
    }
    shade(c, or, col) {
      let k = 0.94 + hash(c, or) * 0.12;
      if (col === CHERRY && c < (this.cols - 1) / 2 && or > this.body + 2) k *= 1.25;
      return k;
    }
  }

  // ---------- the bread: a soft crumb inside a hard crust ----------
  const CRUST = [178, 106, 46], CRUST_TOP = [150, 82, 34], CRUMB = [246, 230, 196], HOLE = [222, 198, 152];

  class Bread extends GridDish {
    shape() {
      const out = new Array(this.cols), r = 7, n = this.cols;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n * 2 - 1;
        let h = Math.round(17 + 12 * Math.sqrt(Math.max(0, 1 - t * t * 0.85)));
        const e = Math.min(i, n - 1 - i);
        if (e < r) { const dx = r - e - 0.5; h -= Math.round(r - Math.sqrt(Math.max(0, r * r - dx * dx))); }
        out[i] = Math.min(this.rows, h);
      }
      return out;
    }
    isCrust(c, r) {
      const e = Math.min(c, this.cols - 1 - c);
      return r >= this.full[c] - this.def.crustRows || e < 2 || r === 0;
    }
    hard(c, r) { return this.isCrust(c, r) && r > 0 ? this.def.crust : 1; }
    color(c, r) {
      if (this.isCrust(c, r)) return r >= this.full[c] - 1 ? CRUST_TOP : CRUST;
      return hash(c * 3, r * 5) < 0.12 ? HOLE : CRUMB;
    }
  }

  // ---------- the grapes: round, they roll away when nibbled ----------
  class GrapeDish {
    constructor(scene, key, d, saved) {
      this.key = key; this.def = d; this.name = d.name;
      this.x0 = d.x0; this.x1 = d.x1; this.base = d.plateH; this.rim = d.rim;
      this.plateL = this.x0 - 8; this.plateR = this.x1 + 8;
      this.total = d.n * d.hp;
      this.grapes = [];
      const span = (this.x1 - this.x0) / d.n;
      const colors = [0x7d3a8c, 0x9ac24a, 0x6a2c78, 0x8fb840, 0x8a4398, 0xa4c858, 0x74358a];
      for (let i = 0; i < d.n; i++) {
        const s = Array.isArray(saved) && saved[i] ? saved[i] : null;
        const gr = {
          x: s && isFinite(s.x) ? Phaser.Math.Clamp(+s.x, this.x0, this.x1) : this.x0 + span * (i + 0.5),
          hp: s ? Math.max(0, Math.min(d.hp, s.hp | 0)) : d.hp,
          v: 0, ang: hash(i, 3) * 6.28, color: colors[i % colors.length], ants: 0,
        };
        gr.spr = scene.add.image(gr.x, 0, 'grape').setTint(gr.color).setDepth(5);
        gr.shine = scene.add.image(gr.x, 0, 'shine').setDepth(5.1);
        this.grapes.push(gr);
      }
      this.left = this.grapes.reduce((a, g) => a + g.hp, 0);
      this.update(0);
    }

    get center() { return (this.x0 + this.x1) / 2; }
    rad(g) { return g.hp > 0 ? this.def.r * Math.max(0.3, Math.sqrt(g.hp / this.def.hp)) : 0; }

    surfaceAt(x) {
      if (x < this.plateL || x > this.plateR) return 0;
      if (x < this.x0 || x > this.x1) return this.base + this.rim; // the platter's raised rim
      let s = this.base;
      for (const g of this.grapes) {
        if (g.hp <= 0) continue;
        const r = this.rad(g), dx = x - g.x;
        if (dx > -r && dx < r) s = Math.max(s, this.base + r + Math.sqrt(r * r - dx * dx));
      }
      return s;
    }

    // Roll: friction slows them, they bounce off the rim and each other.
    update(dt) {
      const d = this.def, alive = this.grapes.filter((g) => g.hp > 0);
      for (const g of alive) {
        const sp = Math.abs(g.v);
        if (sp > 0) { const nv = Math.max(0, sp - d.friction * dt); g.v = Math.sign(g.v) * nv; }
        g.x += g.v * dt;
        g.ang += (g.v * dt) / Math.max(1, this.rad(g));
        const r = this.rad(g);
        if (g.x - r < this.x0) { g.x = this.x0 + r; g.v = Math.abs(g.v) * 0.5; }
        if (g.x + r > this.x1) { g.x = this.x1 - r; g.v = -Math.abs(g.v) * 0.5; }
      }
      alive.sort((a, b) => a.x - b.x);
      for (let i = 0; i + 1 < alive.length; i++) {
        const a = alive[i], b = alive[i + 1], gap = this.rad(a) + this.rad(b) - (b.x - a.x);
        if (gap > 0) {
          a.x -= gap / 2; b.x += gap / 2;
          if (a.v > b.v) { const t = a.v; a.v = b.v * 0.8; b.v = t * 0.8; }
        }
      }
      for (const g of this.grapes) {
        if (g.hp <= 0) { g.spr.setVisible(false); g.shine.setVisible(false); continue; }
        const r = this.rad(g), y = -(this.base + r);
        g.spr.setPosition(g.x, y).setScale(r / 31).setRotation(g.ang);
        g.shine.setPosition(g.x - r * 0.3, y - r * 0.35).setScale(r / 20);
      }
    }
    flush() {}

    // Nibble grape g: up to n bites; it rolls away from the biter (pushDir).
    bite(g, n, pushDir) {
      const k = Math.min(n, g.hp);
      if (k <= 0) return { n: 0, color: g.color };
      g.hp -= k; this.left -= k;
      const r = this.rad(g) || 1;
      g.v += pushDir * this.def.push * (this.def.r / (r + this.def.r));
      return { n: k, color: g.color };
    }

    // the grape whose side or top is within `reach` of an ant at (x, h)
    grapeNear(x, h, reach) {
      let best = null, bd = Infinity;
      for (const g of this.grapes) {
        if (g.hp <= 0) continue;
        const r = this.rad(g), d = Math.abs(x - g.x) - r;
        if (d <= reach && h <= this.base + 2 * r + 1 && d < bd) { bd = d; best = g; }
      }
      return best;
    }

    encode() { return this.grapes.map((g) => ({ x: Math.round(g.x * 10) / 10, hp: g.hp })); }

    drawPlate(g) {
      const hgt = this.base;
      g.fillStyle(this.def.plate, 1).fillRoundedRect(this.plateL, -hgt, this.plateR - this.plateL, hgt, 1.4);
      g.fillStyle(this.def.plate, 1).fillRoundedRect(this.plateL, -hgt - this.rim, 8, this.rim + 1, 2)
        .fillRoundedRect(this.x1, -hgt - this.rim, 8, this.rim + 1, 2);
      g.fillStyle(0xffffff, 0.6).fillRect(this.plateL + 2, -hgt, this.plateR - this.plateL - 4, 1.2);
    }
  }

  const KINDS = { cake: Cake, bread: Bread, grapes: GrapeDish };

  class Table {
    constructor(scene, saved) {
      saved = saved || {};
      this.dishes = {};
      this.list = [];
      for (const key of C.dishOrder) {
        const d = new KINDS[key](scene, key, C.dishes[key], saved[key]);
        d.dir = Math.sign(d.center - C.world.nestX);
        this.dishes[key] = d; this.list.push(d);
      }
      this.total = this.list.reduce((a, d) => a + d.total, 0);
    }
    get left() { return this.list.reduce((a, d) => a + d.left, 0); }
    dishAt(x) { for (const d of this.list) if (x >= d.plateL && x <= d.plateR) return d; return null; }
    surfaceAt(x) { const d = this.dishAt(x); return d ? d.surfaceAt(x) : 0; }
    update(dt) { for (const d of this.list) d.update(dt); }
    flush() { for (const d of this.list) d.flush(); }
    encode() { const o = {}; for (const d of this.list) o[d.key] = d.encode(); return o; }
  }

  AF.Table = Table;
})();
