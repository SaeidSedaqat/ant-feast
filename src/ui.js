// HTML overlay: HUD, the upgrade side panel (one list, left side), pop-up toasts, phone pad and the ?dev=1 panel.
(function () {
  const $ = (id) => document.getElementById(id);
  const cache = {};
  function set(el, key, html) { if (cache[key] !== html) { cache[key] = html; el.innerHTML = html; } }
  const fmtTime = (s) => { s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
  const IC = '<i class="ic"></i>';
  const fmt = (n) => {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e5) return Math.floor(n / 1e3) + 'K';
    return n.toLocaleString();
  };
  const SECTIONS = { scout: 'Scout', ants: 'Ants', colony: 'Colony' };

  AF.fmt = fmt;
  AF.ui = {
    init(scene) {
      this.scene = scene;
      this.rows = {};
      $('ver').textContent = 'v' + AF.config.version;
      $('bMute').textContent = AF.audio.muted ? 'Sound off' : 'Sound on';
      $('bMute').onclick = () => { $('bMute').textContent = AF.audio.toggle() ? 'Sound off' : 'Sound on'; };
      $('bReset').onclick = () => { if (confirm('Start over? Your progress will be erased.')) scene.resetGame(); };
      $('bAgain').onclick = () => scene.resetGame();
      $('bKeep').onclick = () => { $('win').hidden = true; this.keepGoing = true; };
      $('bZin').onclick = () => scene.zoomBy(1.25);
      $('bZout').onclick = () => scene.zoomBy(0.8);
      $('bPanel').onclick = () => this.openPanel(!this.panelOpen);
      this.openPanel(window.innerWidth >= 900 && !(window.matchMedia && matchMedia('(pointer: coarse)').matches));
      // keep keyboard focus off buttons so Space bites instead of re-clicking
      document.addEventListener('mouseup', (e) => { if (e.target.closest && e.target.closest('button')) setTimeout(() => document.activeElement && document.activeElement.blur && document.activeElement.blur(), 0); });
      this.initPad();
      if (new URLSearchParams(location.search).get('dev') === '1') this.initDev(scene);
    },

    openPanel(on) {
      this.panelOpen = on;
      $('side').hidden = !on;
      $('bPanel').classList.toggle('on', on);
    },
    // one section (title + rows) per kind of upgrade, made in a fixed order so late rows land in their own section
    group(t) {
      if (!this.groups) {
        this.groups = {};
        for (const k in SECTIONS) {
          const h = document.createElement("div"); h.className = "sec"; h.textContent = SECTIONS[k];
          const g = document.createElement("div");
          $("p_all").append(h, g); this.groups[k] = g;
        }
      }
      return this.groups[t] || this.groups.colony;
    },
    // css px of the screen's left side covered by the panel (the camera shifts the view right of it)
    panelWidth() {
      if (!this.panelOpen) return 0;
      const r = $('side').getBoundingClientRect();
      return r.width > window.innerWidth * 0.6 ? 0 : r.width + 8;
    },

    // On-screen controls for phones: shown on touch screens only.
    initPad() {
      AF.pad = AF.pad || {};
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

    initDev(scene) {
      const d = $('dev'); d.hidden = false;
      const L = AF.config.cake;
      const items = [
        ['1×', () => scene.dev('speed', 1)], ['5×', () => scene.dev('speed', 5)], ['20×', () => scene.dev('speed', 20)],
        ['+1K', () => scene.dev('crumbs', 1e3)], ['+100K', () => scene.dev('crumbs', 1e5)], ['+10M', () => scene.dev('crumbs', 1e7)],
        ['Sponge', () => scene.dev('layer', L.rows - L.candles.rows - L.frosting)], ['Jam', () => scene.dev('layer', L.bands.jam)],
        ['Choc', () => scene.dev('layer', L.bands.chocolate)], ['Cream', () => scene.dev('layer', L.bands.cream)],
        ['Biscuit', () => scene.dev('layer', L.bands.biscuit)], ['Almost', () => scene.dev('layer', 1)],
        ['Unlock', () => scene.dev('unlock')],
      ];
      d.innerHTML = '<b>DEV</b>';
      for (const [t, f] of items) { const b = document.createElement('button'); b.textContent = t; b.onclick = f; d.appendChild(b); }
    },

    // bottom edge (css px) of the top bar
    topHeight() { return $('top').getBoundingClientRect().bottom; },

    // height (css px) taken by the phone pad at the bottom
    barHeight() {
      const p = $('pad');
      if (p.hidden) return 0;
      return window.innerHeight - p.getBoundingClientRect().top;
    },

    // rows: {tab, id, head} | {tab, id, title, desc, lv, price (null = max), block (text), show}
    renderRows(rows, crumbs) {
      let any = 0;
      for (const r of rows) {
        let el = this.rows[r.id];
        if (!el) {
          el = document.createElement(r.head ? 'div' : 'button');
          el.className = r.head ? 'hd' : 'up';
          if (!r.head) el.onclick = () => this.scene.buy(r.id);
          this.group(r.tab).appendChild(el);
          this.rows[r.id] = el;
        }
        el.hidden = r.show === false;
        if (el.hidden) continue;
        if (r.head) { set(el, r.id, r.head); continue; }
        const right = r.block ? `<span class="pr no">${r.block}</span>` : r.price == null ? '<span class="pr no">MAX</span>' : `<span class="pr">${IC}${fmt(r.price)}</span>`;
        set(el, r.id, `<span class="nm"><b>${r.title}</b> <em>${r.lv || ''}</em><small>${r.desc}</small></span>${right}`);
        const off = !!r.block || r.price == null || crumbs < r.price;
        el.disabled = off;
        if (!off) any++;
      }
      set($('bPanel'), 'bp', `Upgrades${any ? ` <i class="n">${any}</i>` : ''}`);
    },

    update(v) {
      set($('crumbs'), 'c', `${IC}${fmt(v.crumbs)}`);
      set($('eaten'), 'e', `<span>Cake eaten</span><span class="track"><span class="fillbar" style="width:${v.eaten}%"></span></span><b>${v.eaten}%</b>`);
      set($('colony'), 'a', v.colony);
      $('colony').hidden = !v.colony;
      set($('layer'), 'l', v.layer);
      $('layer').hidden = !v.layer;
      set($('boosts'), 'b', v.boosts);
      $('boosts').hidden = !v.boosts;
      set($('time'), 'time', fmtTime(v.time));
      this.renderRows(v.rows, v.crumbs);
      const tb = Math.round($('top').getBoundingClientRect().bottom + 6) + 'px'; // the top bar can wrap to two rows
      if ($('side').style.top !== tb) $('side').style.top = tb;
    },

    hint(text) {
      const h = $('hint');
      if (!text) { h.hidden = true; return; }
      h.hidden = false;
      set(h, 'h', text);
    },

    // pop-up message that fades away
    toast(html, gold) {
      const box = $('toasts'), el = document.createElement('div');
      el.className = 'toast' + (gold ? ' gold' : '');
      el.innerHTML = html;
      box.appendChild(el);
      while (box.children.length > 4) box.firstChild.remove();
      setTimeout(() => el.classList.add('out'), 3600);
      setTimeout(() => el.remove(), 4100);
    },

    showWin(time) {
      $('winTime').textContent = fmtTime(time);
      $('win').hidden = false;
    },
  };
})();
