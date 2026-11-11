// Procedural textures (no image files yet): ants, crumbs, scout marker, tablecloth tile.
(function () {
  const S = 2; // ants are drawn at twice their layout size so they stay sharp when the camera is close
  const ANT_W = 96 * S, ANT_H = 48 * S, FRAMES = 2; // a plain two-pose walk

  // lighten (f > 0) or darken (f < 0) a #rrggbb colour
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => { const v = (n >> s) & 255; return Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f); };
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // One leg: thigh up and out from the hip, shin down to the foot. t is the leg's place in the walk cycle:
  // the first half it stands and pushes back, the second half it lifts and swings forward.
  function leg(g, hip, restX, t, footY, col, line, w) {
    const a = 4;
    let fx, lift = 0;
    if (t < 0.5) fx = restX + a - 4 * a * t;
    else { fx = restX - a + 4 * a * (t - 0.5); lift = Math.sin((t - 0.5) * 2 * Math.PI) * 3.6; }
    const fy = footY - lift;
    const kx = hip[0] + (fx - hip[0]) * 0.55, ky = hip[1] - 6 - lift * 0.4;
    const path = () => {
      g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kx, ky);
      g.quadraticCurveTo((kx + fx) / 2 + (fx > hip[0] ? 1.6 : -1.6), (ky + fy) / 2, fx, fy);
      g.lineTo(fx + 2, fy + 0.3);
    };
    if (line) { g.strokeStyle = line; g.lineWidth = w + 1.3; path(); g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; path(); g.stroke();
  }

  function drawAnt(g, frame, base, hiHex, big) {
    const pal = { body: base, hi: hiHex, dark: shade(base, -0.45), line: shade(base, -0.65), far: shade(base, -0.35) };
    g.scale(S, S);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const p = frame / FRAMES;
    const hips = [[55, 28], [50, 29.5], [45, 28]], rest = [70, 50, 29], off = [0, 0.5, 0];
    const wig = 0;

    // far side: legs half a cycle behind the near ones, and one antenna
    for (let i = 0; i < 3; i++) leg(g, [hips[i][0] + 1.5, hips[i][1] - 1], rest[i] + 3, (p + off[i] + 0.5) % 1, 45.4, pal.far, null, 2.1);
    g.strokeStyle = pal.far; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(68, 15); g.lineTo(72, 5 - wig); g.lineTo(82, 4 - wig * 1.6); g.stroke();

    const seg = (x, y, rx, ry, rot) => {
      const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.55, 0.5, x, y, Math.max(rx, ry) * 1.15);
      gr.addColorStop(0, pal.hi); gr.addColorStop(0.45, pal.body); gr.addColorStop(1, pal.dark);
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
      g.strokeStyle = pal.line; g.lineWidth = 1.1; g.stroke();
    };
    const ell = (x, y, rx, ry, rot, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill(); };

    // abdomen (with its plates), waist, thorax, head
    seg(22, 25, 18, 12.5, -0.15);
    g.save();
    g.beginPath(); g.ellipse(22, 25, 17.4, 11.9, -0.15, 0, Math.PI * 2); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1.5;
    for (const sx of [13, 21, 29]) { g.beginPath(); g.moveTo(sx, 10); g.quadraticCurveTo(sx + 6, 25, sx, 40); g.stroke(); }
    g.restore();
    seg(39, 27, 4.5, 3.5, 0);
    seg(50, 25, 9.5, 6.5, -0.1);
    if (big) seg(68, 21, 13, 11, 0); else seg(67, 22, 10.5, 9, 0);

    // gloss
    g.globalAlpha = 0.5;
    ell(16, 18, 6.5, 2.3, -0.3, '#ffffff');
    ell(48, 21, 3.2, 1.2, -0.1, '#ffffff');
    ell(big ? 63 : 63.5, big ? 14 : 16.5, 4, 1.7, -0.2, '#ffffff');
    g.globalAlpha = 1;

    // near legs, over the body
    for (let i = 0; i < 3; i++) leg(g, hips[i], rest[i], (p + off[i]) % 1, 46.4, pal.body, pal.line, 2.5);

    // jaws
    g.strokeStyle = pal.line;
    if (big) { // strong ant: long crossing jaws
      g.lineWidth = 4.6;
      g.beginPath(); g.moveTo(77, 24); g.quadraticCurveTo(93, 24, 90, 34); g.stroke();
      g.beginPath(); g.moveTo(77, 29); g.quadraticCurveTo(90, 36, 82, 40); g.stroke();
      g.strokeStyle = pal.body; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(78, 24); g.quadraticCurveTo(92, 24.5, 89.6, 33); g.stroke();
    } else { g.lineWidth = 2.8; g.beginPath(); g.moveTo(74.5, 26.5); g.quadraticCurveTo(83, 28.5, 79.5, 33.5); g.stroke(); }

    // eye
    const ex = big ? 73 : 71.5, ey = big ? 18 : 19;
    ell(ex, ey, 3.3, 3.3, 0, '#ffffff');
    ell(ex + 0.9, ey + 0.3, 1.8, 1.8, 0, '#140a06');
    ell(ex + 1.5, ey - 0.5, 0.6, 0.6, 0, '#ffffff');

    // near antenna
    g.strokeStyle = pal.line; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(71, 15); g.lineTo(77, 6 + wig); g.lineTo(88.5, 7.5 + wig * 1.6); g.stroke();
    g.strokeStyle = pal.body; g.lineWidth = 2;
    g.beginPath(); g.moveTo(71, 15); g.lineTo(77, 6 + wig); g.lineTo(88.5, 7.5 + wig * 1.6); g.stroke();
  }

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
      mk(scene, 'ant' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#3a2014', '#a06a46'));
      mk(scene, 'scout' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#b85a10', '#ffd27a'));
      mk(scene, 'strong' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#7a1c14', '#e6765e', true));
      mk(scene, 'squad' + f, ANT_W, ANT_H, (g) => drawAnt(g, f, '#274a72', '#86b6ea'));
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
