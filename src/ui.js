// HTML overlay for the HUD and shop buttons (crisp text at any size, easy portrait/landscape layout).
(function () {
  const $ = (id) => document.getElementById(id);
  const cache = {};
  function set(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }
  const fmtTime = (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };

  AF.ui = {
    init(scene) {
      this.scene = scene;
      $('ver').textContent = 'v' + AF.config.version;
      $('bJaws').onclick = () => scene.buy('jaws');
      $('bTrail').onclick = () => scene.buy('trail');
      $('bAnt').onclick = () => scene.buy('ant');
      $('bMute').textContent = AF.audio.muted ? 'Sound off' : 'Sound on';
      $('bMute').onclick = () => { $('bMute').textContent = AF.audio.toggle() ? 'Sound off' : 'Sound on'; };
      $('bReset').onclick = () => { if (confirm('Start over? Your progress will be erased.')) scene.resetGame(); };
      $('bAgain').onclick = () => scene.resetGame();
      // keep keyboard focus off buttons so Space bites instead of re-clicking
      document.querySelectorAll('#ui button').forEach((b) => b.addEventListener('mouseup', () => b.blur()));
      this.initPad();
    },

    // On-screen controls for phones: shown on touch screens only.
    initPad() {
      AF.pad = AF.pad || { left: false, right: false, up: false, down: false, bite: false };
      const pad = $('pad');
      const show = () => { if (this.touch) return; this.touch = true; pad.hidden = false; };
      this.touch = false;
      if (window.matchMedia && matchMedia('(pointer: coarse)').matches) show();
      window.addEventListener('touchstart', show, { passive: true });
      pad.querySelectorAll('button').forEach((b) => {
        const k = b.dataset.k;
        const on = (e) => { e.preventDefault(); AF.pad[k] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
        const off = (e) => { e.preventDefault(); AF.pad[k] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointercancel', off);
        b.addEventListener('lostpointercapture', off);
        b.addEventListener('contextmenu', (e) => e.preventDefault());
      });
    },

    barHeight() {
      const r = $('bar').getBoundingClientRect();
      return window.innerHeight - r.top;
    },

    update(v) {
      set($('crumbs'), 'c', `<i class="ic"></i>${Math.floor(v.crumbs).toLocaleString()}`);
      set($('cake'), 'k', `Cake left <b>${v.cakePct}%</b>`);
      set($('colony'), 'a', v.ants > 0 ? `${v.ants} ant${v.ants === 1 ? '' : 's'} on the trail` : '');
      $('colony').hidden = v.ants === 0;

      const j = $('bJaws');
      set(j, 'j', v.jawsMax ? `<b>Stronger Jaws</b><span>Lv ${v.jaws} · MAX</span>`
        : `<b>Stronger Jaws</b><span>Lv ${v.jaws} → ${v.jaws + 1} · <i class="ic"></i>${v.jawsCost}</span>`);
      j.disabled = v.jawsMax || v.crumbs < v.jawsCost;

      const t = $('bTrail');
      t.hidden = v.trail;
      set(t, 't', `<b>Build Trail</b><span>nest → cake · <i class="ic"></i>${v.trailCost}</span>`);
      t.disabled = v.crumbs < v.trailCost;

      const a = $('bAnt');
      a.hidden = !v.trail;
      set(a, 'n', `<b>Hire Ant</b><span>${v.ants} working · <i class="ic"></i>${v.antCost}</span>`);
      a.disabled = v.crumbs < v.antCost;

      set($('time'), 'time', fmtTime(v.time));
    },

    hint(text) {
      const h = $('hint');
      if (!text) { h.hidden = true; return; }
      h.hidden = false;
      set(h, 'h', text);
    },

    showWin(time) {
      $('winTime').textContent = fmtTime(time);
      $('win').hidden = false;
    },
  };
})();
