// The cake: a 2D pile of cells. Ants eat the top cell of a column; the cells above a bitten one fall down.
// h[c] is the skyline (highest solid cell + 1) that the trail ants walk over.
// Cells are painted on a canvas texture; eaten cells are cleared.
(function () {
  const C = AF.config;

  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const rgb = (c, k) => `rgb(${Math.min(255, Math.round(c[0] * k))},${Math.min(255, Math.round(c[1] * k))},${Math.min(255, Math.round(c[2] * k))})`;
  const toInt = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

  const SPONGE = [233, 184, 114], CREAM = [255, 243, 224], JAM = [178, 34, 56];
  const FROST = [246, 182, 202], CHERRY = [196, 24, 44];
  const SPRINKLES = [[90, 160, 230], [250, 214, 80], [120, 200, 120], [255, 255, 255]];

  class Food {
    constructor(scene, saved) {
      const f = C.food;
      this.cell = f.cell; this.cols = f.cols; this.rows = f.rows;
      this.body = f.rows - f.cherryRows;
      this.x0 = f.x0; this.x1 = f.x0 + f.cols * f.cell;
      this.base = f.plateH;
      this.plateL = this.x0 - f.platePad; this.plateR = this.x1 + f.platePad;
      this.full = this.shape();

      const n = this.cols * this.rows;
      // g: 1 = solid. o: the row the cell started on + 1 (its colour travels with it when it falls), 0 = empty.
      this.g = new Uint8Array(n); this.o = new Uint8Array(n);
      for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.full[c]; r++) { this.g[r * this.cols + c] = 1; this.o[r * this.cols + c] = r + 1; }
      saved = saved || {};
      const clear = (i) => { this.g[i] = 0; this.o[i] = 0; };
      if (typeof saved.cells === 'string' && saved.cells.length === n && saved.cellsV === 2) {
        for (let i = 0; i < n; i++) {
          const v = saved.cells.charCodeAt(i) - 48;
          if (v <= 0 || v > this.rows) clear(i); else { this.g[i] = 1; this.o[i] = v; }
        }
      } else if (typeof saved.cells === 'string' && saved.cells.length === n) { // older saves: 0/1 per cell
        for (let i = 0; i < n; i++) if (saved.cells.charCodeAt(i) !== 49) clear(i);
      } else if (Array.isArray(saved.heights) && saved.heights.length === this.cols) { // older saves: column heights
        for (let c = 0; c < this.cols; c++) for (let r = Math.max(0, saved.heights[c] | 0); r < this.rows; r++) clear(r * this.cols + c);
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
      this.tex = scene.textures.addCanvas('cake', cv);
      this.dirty = true;
      this.img = scene.add.image(this.x0, -this.base, 'cake').setOrigin(0, 1).setScale(1 / this.px).setDepth(5);
    }

    shape() {
      const out = new Array(this.cols), r = 7, body = this.body;
      const cx = (this.cols - 1) / 2, cr = 3.4;
      for (let i = 0; i < this.cols; i++) {
        const e = Math.min(i, this.cols - 1 - i);
        let h = body;
        if (e < r) { const dx = r - e - 0.5; h = body - Math.round(r - Math.sqrt(Math.max(0, r * r - dx * dx))); }
        const d = Math.abs(i - cx);
        if (d < cr) h = body + Math.min(this.rows - body, Math.round(Math.sqrt(cr * cr - d * d) * 1.75));
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
        const s = hash(c, r + 1000);
        if (s < 0.07) return SPRINKLES[Math.floor(hash(r, c) * SPRINKLES.length)];
        return FROST;
      }
      const band = r % 13;
      if (band === 10 || band === 11) return CREAM;
      if (band === 12) return JAM;
      return SPONGE;
    }

    // Paint cell (c, r), drawn `dy` world units above its grid spot (while falling).
    paint(c, r, dy) {
      const or = this.o[r * this.cols + c] - 1;
      const col = this.color(c, or);
      let k = 0.94 + hash(c, or) * 0.12;
      if (col === CHERRY) {
        const cx = (this.cols - 1) / 2;
        if (c < cx && or > this.body + 2) k *= 1.25;
      }
      this.ctx.fillStyle = rgb(col, k);
      this.ctx.fillRect(c * this.cs, Math.round((this.rows - 1 - r) * this.cs - (dy || 0) * this.px), this.cs, this.cs);
    }

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
      const G = C.food.fallG;
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
    solid(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < this.rows && this.g[r * this.cols + c] === 1; }
    rowAt(h) { return Math.floor((h - this.base) / this.cell); }
    topOf(r) { return this.base + (r + 1) * this.cell; }
    colAt(x) {
      if (x < this.x0 || x >= this.x1) return -1;
      return Math.floor((x - this.x0) / this.cell);
    }
    colCenter(c) { return this.x0 + (c + 0.5) * this.cell; }
    // x of the face of column c that an ant on side -d sees (d = +1: wall is to the ant's right)
    faceX(c, d) { return this.x0 + (d > 0 ? c : c + 1) * this.cell; }

    retop(c) {
      let r = this.rows - 1;
      while (r >= 0 && !this.g[r * this.cols + c]) r--;
      this.h[c] = r + 1;
    }

    // Skyline height (what trail ants walk on).
    surfaceAt(x) {
      const c = this.colAt(x);
      if (c >= 0) return this.base + this.h[c] * this.cell;
      if (x >= this.plateL && x <= this.plateR) return this.base;
      return 0;
    }

    // The support directly under feet at height h (top of the highest solid cell not above h).
    groundAt(x, h) {
      const c = this.colAt(x);
      if (c >= 0) {
        let r = Math.min(this.rows - 1, Math.floor((h + 0.01 - this.base) / this.cell) - 1);
        for (; r >= 0; r--) if (this.g[r * this.cols + c]) return this.topOf(r);
        return this.base;
      }
      if (x >= this.plateL && x <= this.plateR) return this.base;
      return 0;
    }

    headCol() {
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


    // Trail-ant bite: removes the top cell of the highest column around `col`.
    eat(col, n, spread) {
      let eaten = 0, color = 0xe9b872;
      if (col < 0) return { n: 0, color };
      for (let k = 0; k < n; k++) {
        let best = -1;
        for (let j = Math.max(0, col - spread); j <= Math.min(this.cols - 1, col + spread); j++) {
          if (this.h[j] <= 0) continue;
          if (best < 0 || this.h[j] > this.h[best] || (this.h[j] === this.h[best] && Math.abs(j - col) < Math.abs(best - col))) best = j;
        }
        if (best < 0) break;
        color = this.remove(best, this.h[best] - 1);
        eaten++;
      }
      return { n: eaten, color };
    }

    encode() {
      const parts = [];
      for (let i = 0; i < this.o.length; i += 1024) parts.push(String.fromCharCode.apply(null, Array.from(this.o.subarray(i, i + 1024), (v) => 48 + v)));
      return parts.join('');
    }
  }

  AF.Food = Food;
})();
