// All tuning values live here. World units: the table surface is y = 0, up is negative y.
window.AF = window.AF || {};
AF.config = {
  version: '0.0.84',
  saveKey: 'antfeast-save-v1',
  display: { maxPixelRatio: 2 },

  world: { left: -220, right: 920, nestX: 0, nestRadius: 16 },

  // the cake: a pile of cells on a plate. Cells above a bitten one fall down to fill the gap.
  food: { x0: 200, cols: 80, rows: 44, cherryRows: 6, cell: 6, plateH: 3, platePad: 30, fallG: 900 },

  antLength: 10, // world units

  scout: { speed: 90, climb: 80, biteTime: 0.18, capPerPower: 8, scale: 1.4, biteSpread: 2 },
  ant: { speed: 70, climb: 60, biteTime: 0.4, capPerPower: 2, scale: 1, biteSpread: 1, gap: 12 },

  costs: { jawsBase: 25, jawsGrowth: 2, jawsMax: 7, trail: 40, antBase: 10, antGrowth: 1.07 },

  camera: {
    startDiv: 260,      // start zoom (css px per world unit) = min(screen w, h) / startDiv
    minStartZoom: 1.6,
    lead: 70,           // camera looks this far ahead of the scout (toward the food) at the start
    fitLeft: -70, fitRight: 760, fitTop: 300, // area that must fit once the colony is big
    antsForFullZoom: 40,
  },
};
