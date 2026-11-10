// The cake: a height map of cells (one height per column). Eating removes the top cell of a column,
// so the food visibly shrinks. Cells are painted on a canvas texture; eaten cells are cleared.
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
      this.h = this.full.slice();
      if (Array.isArray(saved) && saved.length === this.cols) {
        for (let i = 0; i < this.cols; i++) this.h[i] = Math.max(0, Math.min(this.full[i], saved[i] | 0));
      }
      this.total = this.full.reduce((a, b) => a + b, 0);
      this.left = this.h.reduce((a, b) => a + b, 0);

      this.px = 2; // canvas pixels per world unit
      const cs = this.cell * this.px;
      this.cs = cs;
      const cv = document.createElement('canvas');
      cv.width = this.cols * cs; cv.height = this.rows * cs;
      this.ctx = cv.getContext('2d');
      for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.h[c]; r++) this.paint(c, r);
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

    paint(c, r) {
      const col = this.color(c, r);
      let k = 0.94 + hash(c, r) * 0.12;
      if (col === CHERRY) {
        const cx = (this.cols - 1) / 2;
        if (c < cx && r > this.body + 2) k *= 1.25;
      }
      this.ctx.fillStyle = rgb(col, k);
      this.ctx.fillRect(c * this.cs, (this.rows - 1 - r) * this.cs, this.cs, this.cs);
    }

    clear(c, r) {
      this.ctx.clearRect(c * this.cs, (this.rows - 1 - r) * this.cs, this.cs, this.cs);
      this.dirty = true;
    }

    flush() {
      if (this.dirty) { this.tex.refresh(); this.dirty = false; }
    }

    colAt(x) {
      if (x < this.x0 || x >= this.x1) return -1;
      return Math.floor((x - this.x0) / this.cell);
    }

    colCenter(c) { return this.x0 + (c + 0.5) * this.cell; }

    surfaceAt(x) {
      const c = this.colAt(x);
      if (c >= 0) return this.base + this.h[c] * this.cell;
      if (x >= this.plateL && x <= this.plateR) return this.base;
      return 0;
    }

    headCol() {
      for (let i = 0; i < this.cols; i++) if (this.h[i] > 0) return i;
      return -1;
    }

    // Removes up to n cells around column `col` (highest column in the window first).
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
        const r = --this.h[best];
        color = toInt(this.color(best, r));
        this.clear(best, r);
        eaten++;
      }
      this.left -= eaten;
      return { n: eaten, color };
    }
  }

  AF.Food = Food;
})();
