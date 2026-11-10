// All tuning values live here. World units: the table surface is y = 0, up is negative y.
window.AF = window.AF || {};
AF.config = {
  version: '0.0.157',
  saveKey: 'antfeast-save-v3',
  display: { maxPixelRatio: 2 },

  // the nest is left of the Giant Cake; ceiling = how high the scout can fly
  world: { left: -420, right: 6480, nestX: 0, nestRadius: 16, ceiling: 2500 },

  cell: 6,
  antLength: 10, // world units
  ant: { gap: 12 }, // spacing of ants walking single file

  // The Giant Cake: about 100 times the old cake. Rows/cols are cells; layers are listed bottom-up in `bands`.
  cake: {
    x0: 150, cols: 1000, rows: 220, stand: 6, standPad: 40,
    shoulder: 22,      // rounded top edge, in columns
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
    banana: { name: 'Banana slice', n: 8, layer: 'sponge', burst: 400, boost: 'speed', time: 30, color: [250, 226, 120] },
    cherry: { name: 'Cherry', n: 6, layer: 'cream', burst: 2500, boost: 'bite', time: 30, color: [205, 24, 46] },
    chunk: { name: 'Chocolate chunk', n: 6, layer: 'biscuit', burst: 6000, boost: 'carry', time: 30, color: [70, 38, 20] },
    treasure: { name: 'Golden ring', n: 1, layer: 'biscuit', burst: 60000, boost: 'all', time: 60, color: [255, 205, 50] },
  },
  boosts: { speed: 1.5, bite: 2, carry: 2 },

  scout: { speed: 90, climb: 80, biteTime: 0.18, capPerJaw: 8, scale: 1.4, gravity: 650, hop: 55, glide: 45, fly: 140, chompCd: 3 },

  // ant types: traits, not roles. hire = first price, hireG = growth, costMul scales their stat upgrades
  types: {
    worker: { name: 'Worker', speed: 80, climb: 70, carry: 4, bite: 1, biteTime: 0.3, hire: 12, hireG: 1.09, costMul: 1, tex: 'ant', scale: 1 },
    strong: { name: 'Strong ant', speed: 62, climb: 54, carry: 6, bite: 1, biteTime: 0.32, hire: 90, hireG: 1.12, costMul: 4, tex: 'strong', scale: 1.3 },
    flying: { name: 'Flying ant', speed: 120, climb: 120, carry: 3, bite: 1, biteTime: 0.3, hire: 220, hireG: 1.13, costMul: 10, tex: 'flyer', scale: 1.05 },
    squad: { name: 'Squad', speed: 72, climb: 64, carry: 5, bite: 1.3, biteTime: 0.3, hire: 1500, hireG: 1.35, costMul: 25, tex: 'squad', scale: 1.1, max: 10 },
  },

  // upgrades: price of the next level = base * g^(level - start); `costs` lists fixed prices instead
  up: {
    legs: { base: 30, g: 1.8, max: 12, start: 1 },
    jaws: { base: 25, g: 1.9, max: 12, start: 1 },
    bigbite: { base: 150, g: 2.3, max: 6, start: 0 },
    aura: { base: 400, g: 2.1, max: 8, start: 0 },
    scent: { base: 250, g: 2.1, max: 6, start: 0 },
    rally: { base: 600, g: 2.2, max: 6, start: 0 },
    wings: { costs: [800, 6000, 40000], max: 3, start: 0 },
    nest: { base: 40, g: 1.5, max: 30, start: 1 },
    value: { base: 250, g: 2.2, max: 15, start: 1 },
    'unlock.strong': { costs: [600], max: 1, start: 0 },
    'unlock.flying': { costs: [3000], max: 1, start: 0 },
    'unlock.squad': { costs: [10000], max: 1, start: 0 },
    flagPow: { base: 80, g: 1.8, max: 10, start: 1 },
    flagTime: { base: 60, g: 1.7, max: 10, start: 1 },
    squadSize: { base: 4000, g: 2.5, max: 5, start: 1 },
    trails: { base: 300, g: 1.9, max: 12, start: 1 },
    sniffer: { base: 1500, g: 2.3, max: 8, start: 0 },
  },
  typeUp: { // per ant type, times the type's costMul
    speed: { base: 50, g: 1.75, max: 15, start: 1 },
    carry: { base: 40, g: 1.75, max: 15, start: 1 },
    bite: { base: 60, g: 1.8, max: 15, start: 1 },
  },
  nestBase: 10, nestPer: 10, // ants the nest holds: base + per * (level - 1)

  camera: {
    startDiv: 260,      // start zoom (css px per world unit) = min(screen w, h) / startDiv
    portraitDiv: 150,   // portrait: start zoom = screen width / portraitDiv
    minStartZoom: 1.6,
    lead: 60,           // camera looks this far ahead of the scout
  },
};
