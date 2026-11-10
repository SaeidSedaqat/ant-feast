// All tuning values live here. World units: the table surface is y = 0, up is negative y.
window.AF = window.AF || {};
AF.config = {
  version: '0.0.95',
  saveKey: 'antfeast-save-v2',
  display: { maxPixelRatio: 2 },

  world: { left: -680, right: 1100, nestX: 0, nestRadius: 16 },

  cell: 6, fallG: 900,
  // the dishes on the table, left to right: bread, (nest), cake, grapes. Trails are built in dishOrder.
  dishOrder: ['cake', 'bread', 'grapes'],
  dishes: {
    cake: { name: 'cake', x0: 200, cols: 80, rows: 44, cherryRows: 6, plateH: 3, platePad: 30, plate: 0xd9dee6 },
    bread: { name: 'bread', x0: -598, cols: 56, rows: 30, plateH: 4, platePad: 30, plate: 0xa8743f, crustRows: 2, crust: 2 },
    grapes: { name: 'grapes', x0: 760, x1: 1060, plateH: 4, rim: 12, plate: 0xe9eef2, n: 8, r: 18, hp: 90, push: 46, friction: 34 },
  },

  antLength: 10, // world units

  scout: { speed: 90, climb: 80, biteTime: 0.18, capPerPower: 8, scale: 1.4 },
  ant: { speed: 62, climb: 52, biteTime: 0.45, scale: 1, gap: 12 },
  soldier: { speed: 50, climb: 42, biteTime: 0.5, scale: 1.35, cap: 6, bite: 2, strength: 3 },

  costs: {
    jawsBase: 25, jawsGrowth: 2, jawsMax: 7,
    trails: { cake: 40, bread: 260, grapes: 700 },
    antBase: 10, antGrowth: 1.075, antMax: 60,
    soldierBase: 90, soldierGrowth: 1.3, soldierMax: 12,
    speed: { base: 40, growth: 1.55, max: 6 },   // +20% walking speed per level
    carry: { base: 30, growth: 1.6, max: 6 },    // carry 2 per level
    bite: { base: 60, growth: 1.8, max: 5 },     // cells per bite = level
  },

  camera: {
    startDiv: 260,      // start zoom (css px per world unit) = min(screen w, h) / startDiv
    minStartZoom: 1.6,
    lead: 70,           // camera looks this far ahead of the scout (toward the food) at the start
    antsForFullZoom: 40,
  },
};
