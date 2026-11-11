// All tuning values live here. World units: the table surface is y = 0, up is negative y.
window.AF = window.AF || {};
AF.config = {
  version: '0.0.211',
  saveKey: 'antfeast-save-v3',
  display: { maxPixelRatio: 2 },

  // the nest is left of the Giant Cake; ceiling = the highest the scout can be
  world: { left: -420, right: 1900, nestX: 0, nestRadius: 16, ceiling: 2500, exitGap: 0.2 },

  cell: 6,
  antLength: 10, // world units

  // The Giant Cake: a quarter of the width of the first Giant Cake. Rows/cols are cells; layers are listed bottom-up in `bands`.
  cake: {
    x0: 150, cols: 250, rows: 220, stand: 6, standPad: 40,
    shoulder: 8,       // rounded top edge of each tier, in columns
    // stacked tiers, bottom-up: [inset in columns on each side, top row]. Each tier is narrower, so ants climb
    // step by step over the ledges. The last top must equal rows - candles.rows.
    tiers: [[0, 92], [33, 140], [65, 180]],
    ledge: 7,          // frosting thickness on the lower tiers' ledges
    // filling stripes inside the upper tiers: [from row, to row, layer]. The bottom tier uses `bands`.
    tierBands: [[100, 106, 'cream'], [114, 120, 'jam'], [146, 150, 'chocolate'], [155, 160, 'cream']],
    coat: 3,           // frosting coat on the sides
    frosting: 16,      // frosting thickness on top
    sprinkle: 0.07,    // share of frosting cells that are sprinkles
    candles: { n: 5, w: 3, rows: 40 },
    bands: { biscuit: 25, cream: 55, chocolate: 70, jam: 84 }, // row where each layer ends; sponge up to the frosting
    tile: 32, tileRows: 64, px: 0.5, // render tiles (cells) and canvas pixels per world unit
  },

  // hard = bite work per cell, value = crumbs per cell, sticky = walking speed on it
  layers: {
    frosting: { name: 'Frosting', hard: 1, value: 1, color: [246, 182, 202] },
    sponge: { name: 'Sponge', hard: 1, value: 1, color: [233, 184, 114] },
    jam: { name: 'Jam', hard: 1.5, value: 2, sticky: 0.45, color: [178, 34, 56] },
    chocolate: { name: 'Chocolate shell', hard: 4, value: 3, color: [96, 54, 32] },
    cream: { name: 'Cream filling', hard: 1, value: 4, color: [255, 243, 224] },
    biscuit: { name: 'Biscuit base', hard: 3, value: 3, color: [200, 146, 84] },
    candle: { name: 'Candle', hard: 2, value: 10, color: [120, 170, 240] },
    sprinkle: { name: 'Sprinkles', hard: 1, value: 5, color: [250, 214, 80] },
    item: { name: 'Treat', hard: 1, value: 8, color: [255, 255, 255] },
  },

  // hidden treats: a burst of crumbs (times crumb value) and a timed boost for the whole colony
  items: {
    banana: { name: 'Banana slice', n: 3, layer: 'sponge', burst: 400, boost: 'speed', time: 30, color: [250, 226, 120] },
    cherry: { name: 'Cherry', n: 2, layer: 'cream', burst: 2500, boost: 'bite', time: 30, color: [205, 24, 46] },
    chunk: { name: 'Chocolate chunk', n: 2, layer: 'biscuit', burst: 6000, boost: 'carry', time: 30, color: [70, 38, 20] },
    treasure: { name: 'Golden ring', n: 1, layer: 'biscuit', burst: 60000, boost: 'all', time: 60, color: [255, 205, 50] },
  },
  boosts: { speed: 1.5, bite: 2, carry: 2 },

  scout: { speed: 90, climb: 80, biteTime: 0.18, cap: 15, capMax: 300, scale: 1.4 },

  // ant types: traits, not roles. hire = first price, hireG = growth, costMul scales their stat upgrades
  types: {
    worker: { name: 'Worker', speed: 80, climb: 70, carry: 4, bite: 1, biteTime: 0.3, hire: 8, hireG: 1.06, costMul: 1, tex: 'ant', scale: 1 },
    strong: { name: 'Strong ant', speed: 62, climb: 54, carry: 6, bite: 1, biteTime: 0.32, hire: 45, hireG: 1.08, costMul: 2.5, tex: 'strong', scale: 1.3, max: 50 },
    squad: { name: 'Squad', speed: 72, climb: 64, carry: 5, bite: 1.3, biteTime: 0.3, hire: 500, hireG: 1.25, costMul: 10, tex: 'squad', scale: 1.1, max: 10 },
  },

  // upgrades: price of the next level = base * g^(level - start); `costs` lists fixed prices instead
  up: {
    legs: { base: 15, g: 1.6, max: 10, start: 1 },
    jaws: { base: 12, g: 1.65, max: 10, start: 1 },
    nest: { base: 100, g: 1.4, max: Infinity, start: 1 },
    value: { base: 120, g: 1.9, max: Infinity, start: 1 },
    'unlock.strong': { costs: [200], max: 1, start: 0 },
    'unlock.squad': { costs: [2500], max: 1, start: 0 },
  },
  typeUp: { // per ant type, times the type's costMul
    speed: { base: 25, g: 1.55, max: 10, start: 1 },
    carry: { base: 20, g: 1.55, max: 10, start: 1 },
    bite: { base: 30, g: 1.6, max: 10, start: 1 },
  },
  nestBase: 15, nestPer: 15, // ants the nest holds: base + per * (level - 1)

  camera: {
    startDiv: 260,      // start zoom (css px per world unit) = min(screen w, h) / startDiv
    portraitDiv: 150,   // portrait: start zoom = screen width / portraitDiv
    minStartZoom: 1.6,
    maxZoom: 2,         // the + button and the wheel zoom in at most this much past the auto zoom
  },
};
