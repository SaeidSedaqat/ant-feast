// HTML overlay for the HUD and shop buttons (crisp text at any size, easy portrait/landscape layout).
(function () {
  const $ = (id) => document.getElementById(id);
  const cache = {};
  function set(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }
  const fmtTime = (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
  const IC = '<i class="ic"></i>';
  const fmt = (n) => Math.floor(n).toLocaleString();

  AF.ui = {
    init(scene) {
      this.scene = scene;
      $('ver').textContent = 'v' + AF.config.version;
      for (const k of ['jaws', 'trail', 'ant', 'soldier', 'speed', 'carry', 'bite']) {
        $('b' + k[0].toUpperCase() + k.slice(1)).onclick = () => scene.buy(k);
      }
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
      AF.pad = AF.pad || { left: false, right: false, bite: false };
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

    // one shop button: title, detail line, price (null = maxed)
    btn(id, show, title, detail, price, crumbs) {
      const b = $(id);
      b.hidden = !show;
      if (!show) return;
      set(b, id, `<b>${title}</b><span>${detail}${price == null ? ' · MAX' : ` · ${IC}${fmt(price)}`}</span>`);
      b.disabled = price == null || crumbs < price;
    },

    update(v) {
      const p = v.prices, c = v.crumbs, tr = v.trails;
      set($('crumbs'), 'c', `${IC}${fmt(c)}`);
      set($('eaten'), 'e', `<span>Table eaten</span><span class="track"><span class="fillbar" style="width:${v.eaten}%"></span></span><b>${v.eaten}%</b>`);
      const parts = [];
      if (v.ants) parts.push(`${v.ants} ant${v.ants === 1 ? '' : 's'}`);
      if (v.soldiers) parts.push(`${v.soldiers} soldier${v.soldiers === 1 ? '' : 's'}`);
      set($('colony'), 'a', parts.join(' · '));
      $('colony').hidden = !parts.length;

      this.btn('bJaws', true, 'Stronger Jaws', `Lv ${v.jaws}`, p.jaws, c);
      this.btn('bTrail', !!v.nextTrail, 'Build Trail', `nest → ${v.nextTrail || ''}`, p.trail, c);
      this.btn('bAnt', tr.cake, 'Hire Ant', `${v.ants} working`, p.ant, c);
      this.btn('bSoldier', tr.bread, 'Hire Soldier', `cracks crust · ${v.soldiers}`, p.soldier, c);
      this.btn('bSpeed', tr.cake, 'Ant Speed', `Lv ${v.up.speed}`, p.speed, c);
      this.btn('bCarry', tr.cake, 'Ant Carry', `Lv ${v.up.carry}`, p.carry, c);
      this.btn('bBite', tr.cake, 'Ant Bite', `Lv ${v.up.bite}`, p.bite, c);

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
