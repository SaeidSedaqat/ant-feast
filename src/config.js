// All tuning values live here. World units: the table surface is y = 0, up is negative y.
window.AF = window.AF || {};
AF.config = {
  version: '0.0.106',
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
  ant: { speed: 80, climb: 70, biteTime: 0.3, scale: 1, gap: 12, cap: 3 },
  soldier: { speed: 64, climb: 56, biteTime: 0.35, scale: 1.35, cap: 8, bite: 2, strength: 3 },

  costs: {
    jawsBase: 25, jawsGrowth: 2, jawsMax: 7,
    trails: { cake: 40, bread: 200, grapes: 550 },
    antBase: 10, antGrowth: 1.12, antMax: 60,
    soldierBase: 80, soldierGrowth: 1.4, soldierMax: 12,
    speed: { base: 45, growth: 2, max: 6 },      // +25% walking speed per level
    carry: { base: 40, growth: 2, max: 6 },      // +3 carry per level
    bite: { base: 70, growth: 2.2, max: 5 },     // cells per bite = level
  },

  camera: {
    startDiv: 260,      // start zoom (css px per world unit) = min(screen w, h) / startDiv
    portraitDiv: 150,   // portrait: start zoom = screen width / portraitDiv (closer on the scout)
    minStartZoom: 1.6,
    lead: 70,           // camera looks this far ahead of the scout (toward the food) at the start
    antsForFullZoom: 40,
  },
};
