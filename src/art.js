// Procedural textures (no image files yet): ants, crumbs, scout marker, tablecloth tile.
(function () {
  const ANT_W = 96, ANT_H = 48;

  function drawAnt(g, frame, body, hi, big) {
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
    ell(72, 19, 1.5, 1.5, 0, '#000000');
  }

  function mk(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'));
    scene.textures.addCanvas(key, c);
  }

  AF.ANT_TEX_W = ANT_W;

  AF.makeTextures = function (scene) {
    for (let f = 0; f < 2; f++) {
      mk(scene, 'ant' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#2a160e', '#7a4a30'));
      mk(scene, 'scout' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#9a4a0c', '#ffc46b'));
      mk(scene, 'soldier' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#5a1410', '#c0503a', true));
      mk(scene, 'strong' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#5a1410', '#c0503a', true));
      mk(scene, 'squad' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#1e3a5a', '#5a8ac0'));
      const wings = (g, up) => { // translucent wings over the thorax; two beats
        g.fillStyle = 'rgba(220,240,255,0.65)'; g.strokeStyle = 'rgba(120,150,190,0.9)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(40, up ? 8 : 14, 22, up ? 7 : 5, up ? -0.5 : -0.15, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(36, up ? 12 : 17, 16, 4.5, up ? -0.3 : -0.05, 0, Math.PI * 2); g.fill(); g.stroke();
      };
      mk(scene, 'flyer' + f, ANT_W, ANT_H, (g) => { drawAnt(g, f, '#3a2a10', '#a08040'); wings(g, f === 0); });
      mk(scene, 'scoutw' + f, ANT_W, ANT_H, (g) => { drawAnt(g, f, '#9a4a0c', '#ffc46b'); wings(g, f === 0); });
    }
    mk(scene, 'flag', 32, 48, (g) => {
      g.strokeStyle = '#3b1d08'; g.lineWidth = 3; g.beginPath(); g.moveTo(6, 2); g.lineTo(6, 47); g.stroke();
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(7, 3); g.lineTo(30, 10); g.lineTo(7, 19); g.closePath(); g.fill();
    });
    mk(scene, 'crumb', 16, 16, (g) => {
      g.fillStyle = '#ffffff';
      g.beginPath(); g.moveTo(2, 6); g.lineTo(8, 1); g.lineTo(15, 5); g.lineTo(13, 14); g.lineTo(4, 15); g.closePath(); g.fill();
    });
    mk(scene, 'dot', 8, 8, (g) => { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(4, 4, 4, 0, Math.PI * 2); g.fill(); });
    mk(scene, 'marker', 32, 32, (g) => {
      g.fillStyle = '#ffd25a'; g.strokeStyle = '#5a2c00'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(4, 6); g.lineTo(28, 6); g.lineTo(16, 26); g.closePath(); g.fill(); g.stroke();
    });
    mk(scene, 'ring', 64, 64, (g) => { g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.stroke(); });
    mk(scene, 'grape', 64, 64, (g) => { // white so it can be tinted; a dimple shows it rolling
      const gr = g.createRadialGradient(24, 22, 4, 32, 32, 31);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9a9a9a');
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(32, 9, 3.5, 0, Math.PI * 2); g.fill();
    });
    mk(scene, 'shine', 32, 32, (g) => { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.ellipse(16, 16, 9, 5, -0.6, 0, Math.PI * 2); g.fill(); });
    mk(scene, 'gingham', 64, 64, (g) => {
      g.fillStyle = '#f4e7cf'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(190,48,48,0.5)'; g.fillRect(0, 0, 32, 64); g.fillRect(0, 0, 64, 32);
    });
  };
})();
