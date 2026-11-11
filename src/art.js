// Procedural textures (no image files yet): ants, crumbs, scout marker, tablecloth tile.
(function () {
  const S = 2; // ants are drawn at twice their layout size so they stay sharp when the camera is close
  const ANT_W = 96 * S, ANT_H = 48 * S, FRAMES = 2; // a plain two-pose walk

  function drawAnt(g, frame, body, hi, big) {
    g.scale(S, S);
    g.lineCap = 'round'; g.lineJoin = 'round';
    // legs (two poses for the walk cycle)
    g.strokeStyle = body; g.lineWidth = 3.2;
    const hips = [[44, 29], [50, 30], [56, 29]];
    const feet = frame === 0 ? [[30, 46], [52, 47], [74, 46]] : [[38, 46], [46, 47], [66, 46]];
    const knees = frame === 0 ? [[36, 34], [52, 36], [68, 34]] : [[42, 35], [48, 36], [62, 34]];
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(hips[i][0], hips[i][1]);
      g.quadraticCurveTo(knees[i][0], knees[i][1] - 6, feet[i][0], feet[i][1]); g.stroke();
    }
    // antennae
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(70, 15); g.quadraticCurveTo(76, 0, 88, 5); g.stroke();
    g.beginPath(); g.moveTo(67, 15); g.quadraticCurveTo(70, 2, 80, 4); g.stroke();
    const ell = (x, y, rx, ry, rot, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };
    // abdomen, petiole, thorax, head
    ell(22, 25, 18, 12.5, -0.15, body);
    ell(39, 27, 4.5, 3.5, 0, body);
    ell(50, 25, 9.5, 6.5, -0.1, body);
    ell(67, 22, 10.5, 9, 0, body);
    // highlights
    g.globalAlpha = 0.55;
    ell(19, 19, 10, 4.5, -0.2, hi);
    ell(49, 21, 5, 2.2, -0.1, hi);
    ell(65, 16, 5.5, 3, 0, hi);
    g.globalAlpha = 1;
    // mandible
    g.strokeStyle = body; g.lineWidth = 3;
    if (big) { // soldier: oversized head and long crossing jaws
      ell(67, 21, 13, 11, 0, body);
      g.lineWidth = 4.5;
      g.beginPath(); g.moveTo(76, 24); g.quadraticCurveTo(93, 24, 90, 34); g.stroke();
      g.beginPath(); g.moveTo(76, 29); g.quadraticCurveTo(90, 36, 82, 40); g.stroke();
    } else { g.beginPath(); g.moveTo(74, 27); g.quadraticCurveTo(82, 30, 78, 33); g.stroke(); }
    // eye
    ell(71, 19, 2.8, 2.8, 0, '#ffffff');

  function mk(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'));
    scene.textures.addCanvas(key, c);
  }
  const poly = (g, pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); };

  AF.ANT_TEX_W = ANT_W;
  AF.ANT_FRAMES = FRAMES;

  AF.makeTextures = function (scene) {
    for (let f = 0; f < FRAMES; f++) {
      mk(scene, 'ant' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#2a160e', '#7a4a30'));
      mk(scene, 'scout' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#9a4a0c', '#ffc46b'));
      mk(scene, 'strong' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#5a1410', '#c0503a', true));
      mk(scene, 'squad' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#1e3a5a', '#5a8ac0'));
    }
    mk(scene, 'crumb', 32, 32, (g) => { // white so it can be tinted, with a shaded side
      poly(g, [[4, 12], [16, 2], [30, 10], [26, 28], [8, 30]], '#ffffff');
      poly(g, [[30, 10], [26, 28], [8, 30], [18, 17]], 'rgba(0,0,0,0.2)');
      poly(g, [[4, 12], [16, 2], [18, 17]], 'rgba(255,255,255,0.35)');
    });
    mk(scene, 'dot', 8, 8, (g) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(4, 4, 4, 0, Math.PI * 2); g.fill(); });
    mk(scene, 'shadow', 64, 16, (g) => {
      g.scale(1, 0.25);
      const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    mk(scene, 'glow', 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    mk(scene, 'flame', 32, 48, (g) => {
      const gr = g.createRadialGradient(16, 35, 1, 16, 30, 22);
      gr.addColorStop(0, '#fffbe6'); gr.addColorStop(0.3, '#ffe266'); gr.addColorStop(0.75, '#ff9a2a'); gr.addColorStop(1, '#ff5a1a');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(16, 1); g.bezierCurveTo(31, 20, 29, 47, 16, 47); g.bezierCurveTo(3, 47, 1, 20, 16, 1); g.fill();
    });
    mk(scene, 'marker', 32, 32, (g) => {
      const gr = g.createLinearGradient(0, 4, 0, 28);
      gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#ffb52e');
      g.fillStyle = gr; g.strokeStyle = '#5a2c00'; g.lineWidth = 3; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(4, 6); g.lineTo(28, 6); g.lineTo(16, 26); g.closePath(); g.fill(); g.stroke();
    });
    mk(scene, 'ring', 64, 64, (g) => { g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke(); });
    mk(scene, 'gingham', 64, 64, (g) => {
      g.fillStyle = '#f4e7cf'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(190,48,48,0.5)'; g.fillRect(0, 0, 32, 64); g.fillRect(0, 0, 64, 32);
      g.fillStyle = 'rgba(255,255,255,0.07)'; // a hint of woven thread
      for (let i = 0; i < 64; i += 4) { g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
    });
  };
})();
