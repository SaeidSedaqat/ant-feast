// Save/load (localStorage) and tiny synthesized sounds.
(function () {
  const C = AF.config;

  AF.save = {
    load() {
      try { const s = JSON.parse(localStorage.getItem(C.saveKey)); return s && typeof s === 'object' ? s : null; } catch (e) { return null; }
    },
    write(obj) { try { localStorage.setItem(C.saveKey, JSON.stringify(obj)); } catch (e) { /* storage blocked */ } },
    clear() { try { localStorage.removeItem(C.saveKey); } catch (e) { /* ignore */ } },
  };

  let ctx = null, muted = false;
  try { muted = localStorage.getItem('antfeast-muted') === '1'; } catch (e) { /* ignore */ }
  let noise = null;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  AF.audio = {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('antfeast-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      return muted;
    },
    chomp() {
      if (muted || !ctx) return;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(); src.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 900; f.Q.value = 1.5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      src.connect(f).connect(g).connect(ctx.destination); src.start(t); src.stop(t + 0.08);
    },
    blip(pitch) {
      if (muted || !ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(pitch || 660, t); o.frequency.exponentialRampToValueAtTime((pitch || 660) * 1.5, t + 0.08);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.16);
    },
  };
})();
