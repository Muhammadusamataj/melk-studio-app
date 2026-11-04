/* Scene DNA: a small, strictly validated format for sharing scenes, plus a sanitiser for settings imports.
 *
 * Safety rules:
 *  - Shared data can never carry raw BLE bytes. Only known mode/scene ids are accepted.
 *  - A hardware effect is only imported as a hardware effect if the user has verified that effect on THEIR strip.
 *    Otherwise it is imported as a static colour and the user is told why.
 *  - Unknown keys are dropped. Prototype keys are never copied. Sizes, ranges and lengths are bounded. */
(function (g) {
  'use strict';
  const P = (g.Melk && g.Melk.protocol) || null;
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const MAX_TEXT = 8192;
  const BAD = new Set(['__proto__', 'constructor', 'prototype']);
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const fin = (v) => typeof v === 'number' && Number.isFinite(v);
  const clampInt = (v, a, b) => (fin(v) ? Math.min(b, Math.max(a, Math.round(v))) : null);
  const clampNum = (v, a, b) => (fin(v) ? Math.min(b, Math.max(a, v)) : null);
  const text = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max) : '');
  const hex = (v) => (typeof v === 'string' && HEX.test(v) ? v.toUpperCase() : null);
  const knownMode = (id) => !!P && Number.isInteger(id) && P.isKnownMode(id);
  const knownScene = (id) => !!P && Number.isInteger(id) && P.isKnownScene(id);

  function cleanSteps(steps) {
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 32) return null;
    const out = [];
    for (const s of steps) {
      if (!isObj(s)) return null;
      const c = hex(s.c), fade = clampInt(s.fade, 0, 20000), hold = clampInt(s.hold, 0, 20000);
      if (!c || fade === null || hold === null) return null;
      out.push({ c, fade, hold });
    }
    return out;
  }

  /** Check a shared scene (JSON text or object). Returns { ok, errors, notes, scene, seq }. */
  function validateScene(input, ctx) {
    const errors = [], notes = [];
    const fail = (m) => ({ ok: false, errors: [].concat(errors, m || []), notes, scene: null, seq: null });
    let raw = input;
    if (typeof raw === 'string') {
      if (raw.length > MAX_TEXT) return fail('That text is too large to be a scene.');
      try { raw = JSON.parse(raw); } catch (e) { return fail('That text is not valid JSON.'); }
    }
    if (!isObj(raw) || raw.melk !== 'scene' || raw.v !== 1) return fail('This is not a MELK Studio scene (format v1).');
    const name = text(raw.name, 24);
    if (!name) errors.push('The scene has no name.');
    const br = raw.br === undefined ? 80 : clampInt(raw.br, 0, 100);
    if (br === null) errors.push('Brightness must be 0 to 100.');
    let sleep = null;
    if (raw.sleep !== undefined) { sleep = clampInt(raw.sleep, 0, 720); if (sleep === null) errors.push('Sleep timer must be 0 to 720 minutes.'); }
    const note = text(raw.notes, 140);
    const scene = { name, br, note }; if (sleep) scene.sleep = sleep;
    let seq = null;
    const ctxOk = ctx || {};
    switch (raw.type) {
      case 'color': { const c = hex(raw.color); if (!c) errors.push('Colour must look like #FFB347.'); scene.type = 'color'; scene.color = c; break; }
      case 'white': { const w = clampInt(raw.warm, 0, 100); if (w === null) errors.push('White warmth must be 0 to 100.'); scene.type = 'white'; scene.warm = w; break; }
      case 'seq': {
        const steps = cleanSteps(raw.steps), speed = raw.speed === undefined ? 1 : clampNum(raw.speed, 0.25, 4);
        if (!steps) errors.push('Effect steps are invalid (1 to 32 steps, colour and times required).');
        if (speed === null) errors.push('Effect speed must be 0.25 to 4.');
        scene.type = 'seq'; seq = { name, speed, steps };
        notes.push('Phone-driven effect: it only runs while MELK Studio is open.');
        break;
      }
      case 'hardware': {
        const h = raw.hardware;
        if (!isObj(h) || (h.kind !== 'mode' && h.kind !== 'scene') || !Number.isInteger(h.id)) { errors.push('Hardware effect needs a kind (mode or scene) and a number.'); break; }
        const known = h.kind === 'mode' ? knownMode(h.id) : knownScene(h.id);
        if (!known) { errors.push('Hardware ' + h.kind + ' ' + h.id + ' is not in the Magic Lantern list, so it was rejected.'); break; }
        const fallback = hex(raw.fallbackColor) || '#FFB347';
        scene.type = 'color'; scene.color = fallback;
        const verified = typeof ctxOk.isVerified === 'function' && ctxOk.isVerified(h.kind, h.id) === true;
        if (verified) { if (h.kind === 'scene') scene.nativeScene = h.id; else scene.hardwareMode = h.id; notes.push('Hardware ' + h.kind + ' ' + h.id + ' is verified on your strip.'); }
        else notes.push('Hardware ' + h.kind + ' ' + h.id + ' is not verified on your strip, so it was imported as the static colour ' + fallback + '.');
        break;
      }
      default: errors.push('Unknown scene type.');
    }
    if (errors.length) return fail();
    return { ok: true, errors, notes, scene, seq };
  }

  /** Turn one of our scenes into the shareable format. ctx: { seqs, status(kind,id) }. */
  function exportScene(sc, ctx) {
    if (!isObj(sc)) return { ok: false, error: 'No scene.' };
    if (sc.type === 'music' || sc.type === 'mode') return { ok: false, error: 'Music and mode scenes cannot be shared.' };
    const out = { melk: 'scene', v: 1, name: text(sc.name, 24) || 'Scene', br: clampInt(sc.br, 0, 100) === null ? 80 : clampInt(sc.br, 0, 100), requires: { profile: 'melk-fff0' } };
    if (sc.sleep) out.sleep = clampInt(sc.sleep, 0, 720);
    if (sc.note) out.notes = text(sc.note, 140);
    if (Number.isInteger(sc.nativeScene) || Number.isInteger(sc.hardwareMode)) {
      const kind = Number.isInteger(sc.nativeScene) ? 'scene' : 'mode', id = kind === 'scene' ? sc.nativeScene : sc.hardwareMode;
      out.type = 'hardware'; out.hardware = { kind, id }; out.fallbackColor = hex(sc.color) || '#FFB347';
      out.verification = (ctx && ctx.status ? ctx.status(kind, id) : 'UNVERIFIED');
    } else if (sc.type === 'seq') {
      const q = ((ctx && ctx.seqs) || []).find((x) => x.id === sc.seq);
      if (!q) return { ok: false, error: 'The effect behind this scene is missing.' };
      out.type = 'seq'; out.steps = q.steps.map((s) => ({ c: s.c, fade: s.fade, hold: s.hold })); out.speed = q.speed || 1;
    } else if (sc.type === 'white') { out.type = 'white'; out.warm = clampInt(sc.warm, 0, 100) === null ? 50 : clampInt(sc.warm, 0, 100); }
    else { out.type = 'color'; out.color = hex(sc.color) || '#FFB347'; }
    return { ok: true, data: out };
  }

  /* ---------- settings import ---------- */
  const NUM = { h: [0, 360], s: [0, 1], br: [0, 100], speed: [0, 100], warm: [0, 100], flowSec: [5, 3600], fadeMs: [0, 10000], sunCap: [5, 60], dayBr: [0, 100],
    sens: [0, 100], djInterval: [1, 600], autoInterval: [5, 3600], beatGate: [0, 100], beatCooldown: [100, 2000], beatCountView: [0, 1e9], driveCap: [5, 100] };
  const BOOL = ['on', 'auto', 'carSeeded', 'nativeSeeded', 'verifyMigrated', 'sunDim', 'showAll', 'preserveHardware', 'persistentOnly', 'routineEnabled'];
  const ENUM = { sunState: ['day', 'night'], tab: ['color', 'fx', 'music', 'studio'], musicStyle: ['pulse', 'spectrum', 'dj'], autoStyle: ['time', 'modes'], powerProfile: ['current', 'elk'], driveMode: ['driving', 'parked'] };
  const ID = /^[A-Za-z0-9_-]{1,40}$/;

  function plain(v, depth) {            // bounded deep copy of loose data (routines etc.)
    if (depth > 3) return null;
    if (v === null || typeof v === 'boolean' || fin(v)) return v;
    if (typeof v === 'string') return v.length > 200 ? v.slice(0, 200) : v;
    if (Array.isArray(v)) return v.slice(0, 50).map((x) => plain(x, depth + 1));
    if (isObj(v)) { const o = {}; Object.keys(v).slice(0, 50).forEach((k) => { if (!BAD.has(k)) o[k] = plain(v[k], depth + 1); }); return o; }
    return null;
  }
  const numKeyMap = (v, mapVal) => { if (!isObj(v)) return null; const o = {}; for (const k of Object.keys(v)) { if (BAD.has(k) || !/^\d{1,3}$/.test(k) || +k > 255) continue; const m = mapVal(v[k]); if (m !== undefined) o[k] = m; } return o; };

  function internalScene(sc) {
    if (!isObj(sc) || typeof sc.id !== 'string' || !ID.test(sc.id)) return null;
    const type = ['color', 'white', 'seq', 'music', 'mode'].includes(sc.type) ? sc.type : null; if (!type) return null;
    const name = text(sc.name, 24); if (!name) return null;
    const o = { id: sc.id, name, type, br: clampInt(sc.br, 0, 100) === null ? 80 : clampInt(sc.br, 0, 100) };
    if (sc.color !== undefined) { const c = hex(sc.color); if (!c) return null; o.color = c; }
    if (sc.warm !== undefined) { const w = clampInt(sc.warm, 0, 100); if (w === null) return null; o.warm = w; }
    if (sc.seq !== undefined) { if (typeof sc.seq !== 'string' || !ID.test(sc.seq)) return null; o.seq = sc.seq; }
    if (sc.sleep !== undefined) { const s = clampInt(sc.sleep, 0, 720); if (s === null) return null; o.sleep = s; }
    if (sc.nativeScene !== undefined) { if (!knownScene(sc.nativeScene)) return null; o.nativeScene = sc.nativeScene; }
    if (sc.hardwareMode !== undefined) { if (!knownMode(sc.hardwareMode)) return null; o.hardwareMode = sc.hardwareMode; }
    if (sc.mode !== undefined) { if (!knownMode(sc.mode)) return null; o.mode = sc.mode; }
    if (sc.style !== undefined) { if (!['pulse', 'spectrum', 'dj'].includes(sc.style)) return null; o.style = sc.style; }
    if (sc.note !== undefined) o.note = text(sc.note, 140);
    return o;
  }
  function internalSeq(q) {
    if (!isObj(q) || typeof q.id !== 'string' || !ID.test(q.id)) return null;
    const name = text(q.name, 24), steps = cleanSteps(q.steps), speed = q.speed === undefined ? 1 : clampNum(q.speed, 0.25, 4);
    if (!name || !steps || speed === null) return null;
    const o = { id: q.id, name, speed, steps };
    if (q.hardwareMode !== undefined) { if (!knownMode(q.hardwareMode)) return null; o.hardwareMode = q.hardwareMode; }
    return o;
  }

  /** Returns { settings, dropped }. Only validated keys are copied; everything else is reported and ignored. */
  function sanitizeSettings(raw, DEF) {
    const settings = {}, dropped = [];
    if (!isObj(raw)) return { settings, dropped: ['(not an object)'] };
    const allowed = new Set(Object.keys(DEF).concat(['lastHardwareMode', 'vehicles', 'vehicleId', 'favScenes', 'recent']));
    for (const k of Object.keys(raw)) {
      const v = raw[k];
      if (BAD.has(k) || !allowed.has(k)) { dropped.push(k); continue; }
      let ok = true;
      if (NUM[k]) { const n = clampNum(v, NUM[k][0], NUM[k][1]); if (n === null) ok = false; else settings[k] = n; }
      else if (BOOL.includes(k)) { if (typeof v === 'boolean') settings[k] = v; else ok = false; }
      else if (ENUM[k]) { if (ENUM[k].includes(v)) settings[k] = v; else ok = false; }
      else if (k === 'palette') { if (Array.isArray(v) && v.length <= 64 && v.every((x) => hex(x))) settings.palette = v.map(hex); else ok = false; }
      else if (k === 'scenes') { if (v === null) settings.scenes = null; else if (Array.isArray(v) && v.length <= 64) { const a = v.map(internalScene); if (a.every(Boolean)) settings.scenes = a; else ok = false; } else ok = false; }
      else if (k === 'seqs') { if (v === null) settings.seqs = null; else if (Array.isArray(v) && v.length <= 64) { const a = v.map(internalSeq); if (a.every(Boolean)) settings.seqs = a; else ok = false; } else ok = false; }
      else if (k === 'modeNames') { const m = numKeyMap(v, (x) => { const t = text(x, 24); return t || undefined; }); if (m) settings.modeNames = m; else ok = false; }
      else if (['modeHidden', 'modeFav', 'modePersistent', 'nativeTested'].includes(k)) { const m = numKeyMap(v, (x) => (x ? true : undefined)); if (m) settings[k] = m; else ok = false; }
      else if (k === 'verify') {
        if (!isObj(v)) ok = false; else { const o = {}; for (const kk of Object.keys(v)) { if (!/^(mode|scene):\d{1,3}$/.test(kk) || !isObj(v[kk])) continue; const e = {}; ['moves', 'appClose', 'disconnect', 'powerCycle'].forEach((f) => { if (typeof v[kk][f] === 'boolean') e[f] = v[kk][f]; }); e.at = text(v[kk].at, 12); o[kk] = e; } settings.verify = o; }
      }
      else if (k === 'geo') { if (v === null) settings.geo = null; else if (isObj(v) && fin(v.lat) && fin(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180) settings.geo = { lat: Math.round(v.lat * 100) / 100, lon: Math.round(v.lon * 100) / 100 }; else ok = false; }
      else if (k === 'native' || k === 'lastFail' || k === 'nativeLast') { /* runtime state: never imported */ dropped.push(k); }
      else if (k === 'lastHardwareMode') { if (v === null) settings[k] = null; else { const n = clampInt(v, 0, 255); if (n === null) ok = false; else settings[k] = n; } }
      else if (k === 'vehicles') {
        if (v === null) settings.vehicles = null;
        else if (Array.isArray(v) && v.length >= 1 && v.length <= 8) {
          const a = v.map((x) => (isObj(x) && typeof x.id === 'string' && ID.test(x.id) && text(x.name, 24) ? { id: x.id, name: text(x.name, 24), cap: clampInt(x.cap, 5, 100) === null ? 40 : clampInt(x.cap, 5, 100), startup: typeof x.startup === 'string' && (x.startup === 'keep' || ID.test(x.startup)) ? x.startup : 'keep' } : null));
          if (a.every(Boolean)) settings.vehicles = a; else ok = false;
        } else ok = false;
      }
      else if (k === 'vehicleId') { if (typeof v === 'string' && ID.test(v)) settings.vehicleId = v; else ok = false; }
      else if (k === 'favScenes' || k === 'recent') { if (Array.isArray(v) && v.length <= 64 && v.every((x) => typeof x === 'string' && ID.test(x))) settings[k] = v.slice(0, k === 'recent' ? 5 : 64); else ok = false; }
      else if (k === 'routines' || k === 'routineLast') { const c = plain(v, 0); if ((k === 'routines' && Array.isArray(c)) || (k === 'routineLast' && isObj(c))) settings[k] = c; else ok = false; }
      else if (typeof DEF[k] === 'string') { if (typeof v === 'string' && v.length <= 200) settings[k] = v; else ok = false; }
      else ok = false;
      if (!ok) dropped.push(k);
    }
    return { settings, dropped };
  }

  g.Melk = g.Melk || {};
  g.Melk.sceneDna = { validateScene, exportScene, sanitizeSettings };
})(typeof window !== 'undefined' ? window : globalThis);
