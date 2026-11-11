// The Giant Cake: a grid of cells eaten from the top of each column down through its layers.
// Column c holds cells in rows 0 .. h[c]-1 (row 0 sits on the cake stand). Cells never shift, so the
// whole cake state is one height per column (tiny to save).
(function () {
  const C = AF.config, K = C.cake, cell = C.cell;
  const KINDS = ['frosting', 'sponge', 'jam', 'chocolate', 'cream', 'biscuit', 'candle', 'sprinkle', 'item'];
  const KI = {}; KINDS.forEach((k, i) => { KI[k] = i; });
  const LAY = KINDS.map((k) => C.layers[k]);
  const SPR = [[255, 92, 120], [90, 190, 255], [255, 226, 70], [120, 220, 120], [190, 120, 255], [255, 255, 255]];
  const SHAPE = 2; // bump when the cake's shape changes so old saved columns are not applied to it
  const PX = 3; // canvas pixels per cell (nearest filtering keeps them crisp)

  function hash(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const toInt = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

  class GiantCake {
    constructor(scene, saved) {
      this.scene = scene;
      const cols = this.cols = K.cols, rows = this.rows = K.rows;
      this.x0 = K.x0; this.x1 = K.x0 + cols * cell; this.base = K.stand;
      this.plateL = this.x0 - K.standPad; this.plateR = this.x1 + K.standPad;
      this.body = rows - K.candles.rows; // rows of cake body under the candles
      this.full = new Uint16Array(cols);
      this.h = new Uint16Array(cols);
      this.dmg = new Float32Array(cols);
      this.kind = new Uint8Array(cols * rows);
      this.candleCols = [];
      this.buildShape();
      this.placeItems();
      this.total = 0;
      for (let c = 0; c < cols; c++) this.total += this.full[c];
      this.restore(saved);
      this.buildTiles();
    }

    // ---------- shape ----------
    // tier index of a column d columns in from the nearer edge (the highest tier that covers it)
    tierOfD(d) { let i = 0; for (let t = 0; t < K.tiers.length; t++) if (d >= K.tiers[t][0]) i = t; return i; }
    // filling stripe at row r in the upper tiers, or -1 for plain sponge
    tierBand(r) { for (const [a, z, n] of K.tierBands) if (r >= a && r < z) return KI[n]; return -1; }
    // tier index that holds row r
    tierOfRow(r) { for (let t = 0; t < K.tiers.length; t++) if (r < K.tiers[t][1]) return t; return K.tiers.length - 1; }
    // body top row at distance d from the edge, rounded at each tier's shoulder; frost = frosting thickness there
    topAtD(d) {
      const ti = this.tierOfD(d), [inset, top] = K.tiers[ti], sh = K.shoulder, dd = d - inset;
      const frost = ti === K.tiers.length - 1 ? K.frosting : K.ledge;
      if (dd >= sh) return { top, frost, ti };
      const t = (sh - dd) / sh;
      return { top: top - Math.round(sh * (1 - Math.sqrt(1 - t * t))), frost, ti };
    }
    bodyTop(c) { return this.topAtD(Math.min(c, this.cols - 1 - c)).top; }

    buildShape() {
      const cols = this.cols, rows = this.rows, b = K.bands, cd = K.candles;
      const lo = K.tiers[K.tiers.length - 1][0] + K.shoulder + 10, span = cols - 2 * lo; // candles stand on the top tier
      for (let i = 0; i < cd.n; i++) {
        const c0 = lo + Math.round(((i + 1) * span) / (cd.n + 1)) - 1;
        for (let k = 0; k < cd.w; k++) this.candleCols.push(c0 + k);
      }
      for (let c = 0; c < cols; c++) {
        const d = Math.min(c, cols - 1 - c), { top, frost } = this.topAtD(d);
        const candle = this.candleCols.indexOf(c) >= 0;
        this.full[c] = candle ? rows : top;
        for (let r = 0; r < this.full[c]; r++) {
          const side = d - K.tiers[this.tierOfRow(r)][0] < K.coat; // frosting coat on each tier's side
          let k;
          if (r >= top) k = KI.candle;
          else if (r >= top - frost || side) k = hash(c, r * 7 + 1) < K.sprinkle && r >= top - 3 ? KI.sprinkle : KI.frosting;
          else if (r < b.biscuit) k = KI.biscuit;
          else if (r < b.cream) k = KI.cream;
          else if (r < b.chocolate) k = KI.chocolate;
          else if (r < b.jam) k = KI.jam;
          else { k = this.tierBand(r); if (k < 0) k = KI.sponge; }
          this.kind[r * cols + c] = k;
        }
      }
    }

    // Hidden treats: 3x3 blocks at fixed (seeded) spots inside their layer.
    placeItems() {
      this.items = []; this.itemAt = new Map();
      const b = K.bands, margin = K.shoulder + 30;
      const band = { biscuit: [3, b.biscuit - 3], cream: [b.chocolate - 0, b.chocolate], sponge: [b.jam + 4, this.body - K.frosting - 6] };
      band.cream = [b.biscuit + 4, b.cream - 4];
      let seed = 11;
      for (const key of Object.keys(C.items)) {
        const it = C.items[key], rg = band[it.layer];
        for (let i = 0; i < it.n; i++) {
          seed++;
          const r = Math.floor(rg[0] + (rg[1] - rg[0] - 3) * hash(seed, 9));
          // keep it inside the tier at that height, under the frosting
          let m = margin;
          for (let d = 0; d < this.cols / 2; d++) { const t = this.topAtD(d); if (t.top - t.frost - 3 > r + 3 && d - K.tiers[t.ti][0] >= K.shoulder) { m = Math.max(margin, d + 20); break; } }
          const span = this.cols - 2 * m;
          const c = Math.floor(m + span * ((i + 0.2 + 0.6 * hash(seed, 3)) / it.n));
          const idx = this.items.length;
          this.items.push({ key, c, r, found: false });
          for (let dc = 0; dc < 3; dc++) for (let dr = 0; dr < 3; dr++) {
            if ((dc === 0 || dc === 2) && (dr === 0 || dr === 2)) continue; // rounded: a plus shape
            const cc = c + dc, rr = r + dr;
            this.kind[rr * this.cols + cc] = KI.item;
            this.itemAt.set(rr * this.cols + cc, idx);
          }
        }
      }
    }

    restore(s) {
      this.h.set(this.full);
      if (!s || s.shape !== SHAPE) s = null; // a save from an older cake shape starts a fresh cake (crumbs and upgrades stay)
      if (s && Array.isArray(s.h) && s.h.length === this.cols) {
        for (let c = 0; c < this.cols; c++) this.h[c] = Math.max(0, Math.min(this.full[c], s.h[c] | 0));
      }
      if (s && Array.isArray(s.found)) for (const i of s.found) if (this.items[i]) this.items[i].found = true;
      this.left = 0;
      for (let c = 0; c < this.cols; c++) this.left += this.h[c];
    }

    encode() {
      const found = [];
      this.items.forEach((it, i) => { if (it.found) found.push(i); });
      return { shape: SHAPE, h: Array.from(this.h), found };
    }

    // ---------- queries ----------
    colAt(x) { const c = Math.floor((x - this.x0) / cell); return c >= 0 && c < this.cols ? c : -1; }
    colCenter(c) { return this.x0 + (c + 0.5) * cell; }
    topH(c) { return this.base + this.h[c] * cell; }
    surfaceAt(x) {
      const c = this.colAt(x);
      if (c >= 0) return this.base + this.h[c] * cell;
      if (x >= this.plateL && x <= this.plateR) return this.base;
      return 0;
    }
    // what an ant standing on column c sees: the layer of its top cell (null when the column is gone)
    topKind(c) { return this.h[c] > 0 ? KINDS[this.kind[(this.h[c] - 1) * this.cols + c]] : null; }
    layerOfRow(c, r) { return KINDS[this.kind[r * this.cols + c]]; }
    isCandle(c) { return this.candleCols.indexOf(c) >= 0; }
    // deepest layer name reached anywhere (for the HUD)
    layerName(k) { return C.layers[k] ? C.layers[k].name : ''; }

    // Eat from the top of column c. `work` is bite power; each cell needs its layer's hardness worth of
    // work divided by eff(kind). Work left over on a cell carries to the next bite.
    eat(c, work, maxN, eff) {
      const res = { n: 0, value: 0, color: 0xe9b872, item: null, kind: null };
      if (c < 0 || c >= this.cols) return res;
      const cols = this.cols;
      const oldH = this.h[c];
      while (res.n < maxN && this.h[c] > 0) {
        const r = this.h[c] - 1, k = this.kind[r * cols + c];
        const need = LAY[k].hard / (eff ? eff(KINDS[k]) : 1);
        if (this.dmg[c] + work < need) { this.dmg[c] += work; work = 0; break; }
        work -= need - this.dmg[c]; this.dmg[c] = 0;
        this.h[c]--; this.left--; res.n++; res.value += LAY[k].value; res.kind = KINDS[k];
        res.color = toInt(this.cellRGB(c, r, false));
        if (k === KI.item) {
          const it = this.items[this.itemAt.get(r * cols + c)];
          if (it && !it.found) { it.found = true; res.item = it; }
        }
      }
      if (this.h[c] !== oldH) this.repaintTop(c, oldH);
      res.work = work;
      return res;
    }

    // dev: cut every column down to `row`
    cutTo(row) {
      for (let c = 0; c < this.cols; c++) if (this.h[c] > row) { const o = this.h[c]; this.left -= o - row; this.h[c] = row; this.repaintTop(c, o); }
    }

    // ---------- drawing ----------
    cellRGB(c, r, top) {
      const k = this.kind[r * this.cols + c];
      let col = LAY[k].color, m = 0.9 + 0.14 * hash(c, r);
      if (k === KI.sprinkle) { col = SPR[Math.floor(hash(r, c) * SPR.length)]; m = 1; }
      else if (k === KI.item) { const it = this.items[this.itemAt.get(r * this.cols + c)]; col = C.items[it.key].color; m = 0.95 + 0.1 * hash(c, r); }
      else if (k === KI.candle) {
        const fromTop = this.full[c] - 1 - r;
        if (fromTop < 3) col = fromTop === 2 ? [60, 40, 30] : fromTop === 1 ? [255, 150, 40] : [255, 236, 120];
        else col = ((r + c) >> 2) & 1 ? col : [250, 250, 255];
        m = 1;
      }
      if (top) m *= 1.13;
      return [Math.min(255, col[0] * m) | 0, Math.min(255, col[1] * m) | 0, Math.min(255, col[2] * m) | 0];
    }

    buildTiles() {
      const tc = K.tile, tr = K.tileRows;
      this.tw = Math.ceil(this.cols / tc); this.th = Math.ceil(this.rows / tr);
      this.tiles = []; this.dirty = new Set();
      const sc = this.scene;
      for (let ty = 0; ty < this.th; ty++) for (let tx = 0; tx < this.tw; tx++) {
        const key = `cake_${tx}_${ty}`;
        if (sc.textures.exists(key)) sc.textures.remove(key);
        const cv = document.createElement('canvas'); cv.width = tc * PX; cv.height = tr * PX;
        const ctx = cv.getContext('2d');
        const tex = sc.textures.addCanvas(key, cv);
        if (tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        const img = sc.add.image(this.x0 + tx * tc * cell, -(this.base + ty * tr * cell), key)
          .setOrigin(0, 1).setScale(cell / PX).setDepth(5);
        const t = { tx, ty, cv, ctx, tex, img };
        this.tiles.push(t);
        this.paintTile(t);
      }
    }

    tileOf(c, r) { return this.tiles[Math.floor(r / K.tileRows) * this.tw + Math.floor(c / K.tile)]; }

    paintTile(t) {
      const tc = K.tile, tr = K.tileRows, W = tc * PX, H = tr * PX;
      const im = t.ctx.createImageData(W, H), d = im.data;
      for (let lc = 0; lc < tc; lc++) {
        const c = t.tx * tc + lc; if (c >= this.cols) break;
        const hc = this.h[c];
        for (let lr = 0; lr < tr; lr++) {
          const r = t.ty * tr + lr; if (r >= hc) break;
          const rgb = this.cellRGB(c, r, r === hc - 1);
          const py = (tr - 1 - lr) * PX, px = lc * PX;
          for (let yy = 0; yy < PX; yy++) for (let xx = 0; xx < PX; xx++) {
            const o = ((py + yy) * W + px + xx) * 4;
            d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
          }
        }
      }
      t.ctx.putImageData(im, 0, 0);
      t.tex.refresh();
    }

    // column c went from oldH cells down to h[c]: clear the eaten cells, light up the new top cell
    repaintTop(c, oldH) {
      const tr = K.tileRows, nh = this.h[c];
      for (let r = nh; r < oldH; r++) {
        const t = this.tileOf(c, r);
        t.ctx.clearRect((c - t.tx * K.tile) * PX, (tr - 1 - (r - t.ty * tr)) * PX, PX, PX);
        this.dirty.add(t);
      }
      if (nh > 0) {
        const r = nh - 1, t = this.tileOf(c, r), rgb = this.cellRGB(c, r, true);
        t.ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        t.ctx.fillRect((c - t.tx * K.tile) * PX, (tr - 1 - (r - t.ty * tr)) * PX, PX, PX);
        this.dirty.add(t);
      }
    }

    flush() {
      if (!this.dirty.size) return;
      for (const t of this.dirty) t.tex.refresh();
      this.dirty.clear();
    }

    drawStand(g) {
      const w = this.plateR - this.plateL;
      g.fillStyle(0x8a6a8c, 0.35).fillEllipse((this.plateL + this.plateR) / 2, -1, w + 20, 6);
      g.fillStyle(0xe6e9f0, 1).fillRoundedRect(this.plateL, -this.base, w, this.base, 3);
      g.fillStyle(0xffffff, 0.7).fillRect(this.plateL + 4, -this.base + 1, w - 8, 1.2);
      g.fillStyle(0xb8bcc8, 1).fillRect(this.plateL + 6, -1.5, w - 12, 1.5);
    }
  }

  GiantCake.KINDS = KINDS;
  AF.GiantCake = GiantCake;
})();
