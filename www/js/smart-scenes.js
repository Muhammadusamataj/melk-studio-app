/* Pure preferences and foreground scene scheduler. No protocol builders live here. */
(function (g) {
  'use strict';
  const valid = id => Number.isInteger(id) && id >= 1 && id <= 28;
  const ids = list => Array.isArray(list) ? [...new Set(list.filter(valid))] : [];
  const DEFAULT_QUICK = [1, 16, 11, 6];
  const INTERVALS = [30000, 60000, 300000, 900000];
  function preferences(raw) {
    raw = raw || {};
    return {
      quick: Array.isArray(raw.quick) ? ids(raw.quick).slice(0, 4) : DEFAULT_QUICK.slice(),
      recent: ids(raw.recent).slice(0, 8),
      selected: Array.isArray(raw.selected) ? ids(raw.selected) : DEFAULT_QUICK.slice(),
      interval: INTERVALS.includes(raw.interval) ? raw.interval : 60000,
      order: raw.order === 'shuffle' ? 'shuffle' : 'sequential',
    };
  }
  function create(env) {
    let prefs = preferences(env.preferences), running = false, timer = null, current = null, next = null, generation = 0;
    const schedule = env.setTimeout || setTimeout, clear = env.clearTimeout || clearTimeout;
    const changed = () => { if (env.onChange) env.onChange(snapshot()); };
    const snapshot = () => ({ running, current, next, preferences: preferences(prefs) });
    function choose(after) {
      const pool = prefs.selected;
      if (prefs.order === 'shuffle') {
        const others = pool.filter(id => id !== after), choices = others.length ? others : pool;
        return choices[Math.min(choices.length - 1, Math.floor((env.random || Math.random)() * choices.length))];
      }
      return pool[(pool.indexOf(after) + 1) % pool.length];
    }
    function stop() {
      running = false; generation++; if (timer !== null) clear(timer); timer = null; next = null; changed();
    }
    async function tick(my) {
      timer = null;
      if (!running || my !== generation) return;
      // No catch-up burst after suspend, disconnect or a long blocked event loop.
      if (!env.canRun()) { stop(); return; }
      const id = next;
      try {
        const accepted = await env.send(id);
        if (!running || my !== generation) return;
        if (accepted === false) { stop(); return; }
        current = id; next = choose(current); changed();
        timer = schedule(() => tick(my), prefs.interval);
      } catch (error) { if (my === generation) { stop(); if (env.onError) env.onError(error); } }
    }
    function start() {
      stop(); if (!env.canRun() || !prefs.selected.length) return false;
      running = true; next = choose(null); const my = ++generation; tick(my); return true;
    }
    function configure(raw) { stop(); prefs = preferences(raw); changed(); return snapshot(); }
    return { start, stop, configure, snapshot };
  }
  g.Melk = g.Melk || {};
  g.Melk.smartScenes = { preferences, create, DEFAULT_QUICK, INTERVALS, valid };
})(typeof window !== 'undefined' ? window : globalThis);
