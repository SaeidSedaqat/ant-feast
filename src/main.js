// Boot: full-window transparent canvas at device resolution (capped), re-laid out on resize/rotation.
(function () {
  const DPR = Math.min(window.devicePixelRatio || 1, AF.config.display.maxPixelRatio);
  AF.DPR = DPR;
  const size = () => ({
    w: Math.max(1, Math.round(window.innerWidth * DPR)),
    h: Math.max(1, Math.round(window.innerHeight * DPR)),
  });
  const s = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    transparent: true,
    scale: { mode: Phaser.Scale.NONE, width: s.w, height: s.h, zoom: 1 / DPR },
    input: { activePointers: 2 },
    scene: [AF.GameScene],
  });
  let pending = null;
  const onResize = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const n = size();
      if (n.w !== game.scale.width || n.h !== game.scale.height) game.scale.resize(n.w, n.h);
    }, 60);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  AF.game = game;
})();
