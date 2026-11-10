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
