/* Real analyzed frames -> bounded lighting decisions. Input is local PCM analysis, never genre recognition. */
(function (g) {
  'use strict';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number(v) || 0));
  function create() {
    let lastTx = -Infinity, lastRgb = null, lastDJ = -Infinity, lastKey = null, hue = 30, envelope = 0.15;
    function frame(f, o, now) {
      if (!f || !Number.isFinite(Number(f.bass))) return null;
      const bass = clamp(f.bass), energy = clamp(f.energy === undefined ? bass : f.energy);
      const silent = !!f.silence;
      if (o.style === 'dj') {
        if (silent || !f.beat || now - lastDJ < Math.max(4000, o.djInterval * 1000 || 7000)) return null;
        const bank = (o.bank || []).filter(x => x !== lastKey);
        const choices = bank.length ? bank : o.bank || [];
        if (!choices.length) return null;
        const nextKey = choices[Math.floor((o.random || Math.random)() * choices.length)];
        if (nextKey === lastKey) return null;
        lastKey = nextKey; lastDJ = now;
        return { kind: 'native', key: lastKey };
      }
      // Silence gently approaches a low steady level. No random changes or writes at audio sample rate.
      const pulse = o.style === 'pulse' || (o.style === 'smart' && (bass > 0.45 || f.beat));
      let target = silent ? 0.08 : pulse ? 0.12 + bass * 0.72 + (f.beat ? 0.14 : 0) : 0.18 + energy * 0.55;
      envelope += (clamp(target, .08, .94) - envelope) * (target > envelope ? .4 : .12);
      if (!silent && o.style !== 'pulse') hue = (hue + (o.style === 'spectrum' ? 1.2 : 0.3 + clamp(f.treble) * 1.5)) % 360;
      const h = o.style === 'pulse' ? o.hue : hue, s = o.style === 'pulse' ? o.saturation : .85;
      const rgb = [5, 3, 1].map(n => { const k = (n + h / 60) % 6; return Math.round(255 * (envelope - envelope * s * Math.max(0, Math.min(k, 4 - k, 1)))); });
      if (now - lastTx < 125 || (lastRgb && Math.max(...rgb.map((v, i) => Math.abs(v - lastRgb[i]))) < 5)) return null;
      lastTx = now; lastRgb = rgb;
      return { kind: 'color', rgb, level: envelope };
    }
    return { frame };
  }
  g.Melk = g.Melk || {}; g.Melk.smartMusic = { create };
})(typeof window !== 'undefined' ? window : globalThis);
