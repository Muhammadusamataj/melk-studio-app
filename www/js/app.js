/* MELK Studio — app logic. Talks to the strip through Melk.Link + Melk.protocol. */
(function () {
  'use strict';
  const P = Melk.protocol;
  const link = new Melk.Link();
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- colour helpers ---------- */
  function hsv2rgb(h, s, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  const hex2 = (n) => n.toString(16).padStart(2, '0');
  const rgb2hex = (r, g, b) => ('#' + hex2(r) + hex2(g) + hex2(b)).toUpperCase();
  function hex2rgb(h) {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ---------- state ---------- */
  const AMBIENT = () => [
    { id: 'amb1', name: 'Ambient flow', speed: 1, steps: [['#FF8A3D', 14000, 5000], ['#FF4D7A', 14000, 5000], ['#B14DFF', 14000, 5000], ['#4A5BFF', 14000, 5000], ['#1FC8C0', 14000, 5000], ['#3DDC97', 14000, 5000], ['#FFC15A', 14000, 5000]] },
    { id: 'amb2', name: 'Ambient night', speed: 1, steps: [['#FF6A2B', 18000, 8000], ['#C2245E', 18000, 8000], ['#5B2BB8', 18000, 8000], ['#1F3FBF', 18000, 8000], ['#0E7C86', 18000, 8000]] },
  ].map((q) => ({ id: q.id, name: q.name, speed: q.speed, steps: q.steps.map(([c, fade, hold]) => ({ c, fade, hold })) }));
  const PRESET_SEQS = () => [
    { id: 'p1', name: 'Slow sunset', speed: 1, steps: [['#FF7A18', 3000, 1200], ['#FF2E63', 3000, 1200], ['#5B2A86', 3000, 1200], ['#1B1464', 3000, 1200]] },
    { id: 'p2', name: 'Breathing', speed: 1, steps: [['#FFB347', 2200, 300], ['#2A1500', 2200, 300]] },
    { id: 'p3', name: 'Candle', speed: 1, steps: [['#FF9A2E', 220, 140], ['#FF7A18', 260, 90], ['#FFB347', 200, 180], ['#FF8A24', 240, 110]] },
    { id: 'p4', name: 'Rainbow (phone)', speed: 1, steps: [['#FF0000', 1400, 0], ['#FFE600', 1400, 0], ['#00D26A', 1400, 0], ['#00D1FF', 1400, 0], ['#2F4BFF', 1400, 0], ['#D400FF', 1400, 0]] },
    { id: 'p5', name: 'Party flash', speed: 1, steps: [['#FF0055', 0, 260], ['#00E5FF', 0, 260], ['#FFE600', 0, 260]] },
  ].map((q) => ({ id: q.id, name: q.name, speed: q.speed, steps: q.steps.map(([c, fade, hold]) => ({ c, fade, hold })) }));

  const DEFAULT_SCENES = () => [
    { id: 'relax', name: 'Relax', type: 'seq', seq: 'amb1', br: 55 },
    { id: 'movie', name: 'Movie', type: 'color', color: '#FF9A4D', br: 18 },
    { id: 'reading', name: 'Reading', type: 'white', warm: 15, br: 75 },
    { id: 'dinner', name: 'Dinner', type: 'seq', seq: 'p3', br: 35, nativeScene: 4 },
    { id: 'party', name: 'Party', type: 'music', style: 'spectrum', br: 100 },
    { id: 'focus', name: 'Focus', type: 'white', warm: 80, br: 85 },
    { id: 'morning', name: 'Morning', type: 'color', color: '#FFC15A', br: 60 },
    { id: 'sleep', name: 'Sleep', type: 'seq', seq: 'amb2', br: 12, sleep: 60 },
    { id: 'c-night', name: 'Night drive', type: 'color', color: '#FF9A4D', br: 10 },
    { id: 'c-cruise', name: 'Cruise', type: 'seq', seq: 'amb2', br: 20 },
    { id: 'c-chill', name: 'Parked chill', type: 'seq', seq: 'amb1', br: 40 },
  ];
  const DEF = {
    on: true, h: 33, s: 0.72, br: 80, speed: 50, warm: 50,
    palette: ['#FFB347', '#FF4D6D', '#7C5CFF', '#2EC4B6', '#FFFFFF'],
    flowSec: 60, modeNames: {}, modeHidden: {}, modeFav: {}, seqs: null, scenes: null, auto: false, carSeeded: false, nativeSeeded: false, nativeLast: null, native: null, verify: {}, lastFail: null, verifyMigrated: false, devUnlocked: false, driveMode: 'parked', vehicles: null, vehicleId: 'v1', favScenes: [], recent: [], fadeMs: 1500, sunDim: false, sunCap: 25, geo: null, sunState: 'day', dayBr: 80, showAll: false, tab: 'color', musicStyle: 'smart', musicSource: 'auto', smartScenes: null, nativeSceneFav: [], djBank: [], sens: 60, djInterval: 7, autoStyle: 'time', autoInterval: 45, preserveHardware: false, modePersistent: {'128':true}, persistentOnly: false, powerProfile: 'current', nativeTested: {}, beatGate: 55, beatCooldown: 360, beatCountView: 0, routines: [], routineEnabled: false, routineLast: {},
  };
  let S;
  try { S = Object.assign({}, DEF, JSON.parse(localStorage.getItem('melk.studio.v1') || '{}')); } catch (e) { S = Object.assign({}, DEF); }
  if (S.tab === 'studio') S.tab = 'settings';   // the Studio tab is now Settings
  if (!Array.isArray(S.routines)) S.routines = [];
  if (!S.routineLast || typeof S.routineLast !== 'object') S.routineLast = {};
  if (!S.seqs) S.seqs = AMBIENT().concat(PRESET_SEQS());
  else AMBIENT().reverse().forEach((q) => { if (!S.seqs.some((x) => x.id === q.id)) S.seqs.unshift(q); });
  if (!Array.isArray(S.scenes)) S.scenes = DEFAULT_SCENES();
  if (!S.verify || typeof S.verify !== 'object') S.verify = {};
  if (!S.verifyMigrated) {
    const old = S.modePersistent || { '128': true };   // flags the user set after real power-cycle tests
    Object.keys(old).forEach((k) => { if (old[k] && !S.verify['mode:' + k]) S.verify['mode:' + k] = { moves: true, appClose: true, powerCycle: true, at: 'migrated' }; });
    S.verifyMigrated = true;
  }
  S.seqs.forEach((q) => { if (q.id === 'p4' && q.name === 'Rainbow' && !Number.isInteger(q.hardwareMode)) q.name = 'Rainbow (phone)'; });
  const DEFAULT_VEHICLES = () => [{ id: 'v1', name: 'My car', cap: 40, startup: 'keep' }];
  function normaliseState() {
    if (!Array.isArray(S.vehicles) || !S.vehicles.length) S.vehicles = DEFAULT_VEHICLES();
    if (!S.vehicles.some((v) => v.id === S.vehicleId)) S.vehicleId = S.vehicles[0].id;
    if (!Array.isArray(S.favScenes)) S.favScenes = [];
    if (!Array.isArray(S.recent)) S.recent = [];
    if (S.driveMode !== 'driving') S.driveMode = 'parked';
    if (!S.verify || typeof S.verify !== 'object') S.verify = {};
    if (!Array.isArray(S.routines)) S.routines = [];
    if (!S.routineLast || typeof S.routineLast !== 'object') S.routineLast = {};
    if (!S.modeNames || typeof S.modeNames !== 'object') S.modeNames = {};
    if (!S.modeHidden) S.modeHidden = {}; if (!S.modeFav) S.modeFav = {};
  }
  normaliseState();
  if (!S.nativeSeeded) {
    const d = S.scenes.find((x) => x.id === 'dinner');
    if (d && !Number.isInteger(d.nativeScene)) d.nativeScene = 4;
    S.nativeSeeded = true;
  }
  if (!S.carSeeded) { DEFAULT_SCENES().filter((q) => q.id.indexOf('c-') === 0).forEach((q) => { if (!S.scenes.some((x) => x.id === q.id)) S.scenes.push(q); }); S.carSeeded = true; }
  const save = () => { try { localStorage.setItem('melk.studio.v1', JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };

  // While OFF, suppress any delayed colour/brightness/mode writes left by effects.
  const nativeSend = link.send.bind(link);
  link.send = (bytes, key) => {
    if (!S.on && key !== 'power') return;
    return nativeSend(bytes, key);
  };
  let activeMode = (S.native && S.native.kind === 'mode') ? S.native.id : null;
  let rotation = null, rotationSending = false, musicSession = 0, musicBusy = false;
  let driver = null; // running custom effect or music
  let activeScene = null, curSeqId = null;

  const curRGB = () => hsv2rgb(S.h, S.s, 1);

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- render hero ---------- */
  function paint(rgb, level) {
    const root = document.documentElement.style;
    root.setProperty('--glow', `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
    root.setProperty('--glow-a', String(clamp(level, 0.05, 1)));
  }
  function render() {
    const rgb = curRGB();
    if (!driver) paint(rgb, S.br / 100);
    $('.app').classList.toggle('off', !S.on);
    $('#roHex').textContent = driver ? driver.label : activeMode !== null ? modeLabel(activeMode) : rgb2hex(...rgb);
    $('#roSub').textContent = S.on ? (activeMode !== null ? 'Running on the strip' : driver ? 'Custom effect' : 'Brightness ' + S.br + '%') : 'Strip is off';
    $('#btnPower').setAttribute('aria-pressed', String(S.on));
    $('#btnPower').setAttribute('aria-label', S.on ? 'Turn strip OFF' : 'Turn strip ON');
    $('#carBr').textContent = S.br + '%';
    $('#br').value = S.br; $('#brOut').textContent = S.br + '%';
    $('#rr').value = rgb[0]; $('#gg').value = rgb[1]; $('#bb').value = rgb[2];
    $('#rOut').textContent = rgb[0]; $('#gOut').textContent = rgb[1]; $('#bOut').textContent = rgb[2];
    if (document.activeElement !== $('#hexIn')) $('#hexIn').value = rgb2hex(...rgb);
    placeThumb();
  }

  /* ---------- sending ---------- */
  let lastRGB = [255, 179, 71], sentBr = S.br, fadeT = null, rampT = null;
  function sendRGB(c, key) { lastRGB = c; if (!S.on) return; if (S.native) clearNative(); link.send(P.color(c[0], c[1], c[2]), key || 'color'); }
  // Hardware effects (native modes / scenes) run inside the controller. We remember which one was last
  // commanded so a reconnect or app reopen never overwrites it with a stale static colour.
  function setNative(kind, id) { S.native = { kind, id, at: Date.now() }; save(); }
  function clearNative() { if (S.native) { S.native = null; save(); } }
  function pushColor() { sendRGB(curRGB()); }
  function sendBr(v) { sentBr = v; if (!S.on) return; link.send(P.brightness(v), 'bright'); }
  function cancelRamp() { clearInterval(rampT); rampT = null; }
  function pushBright() { cancelRamp(); sendBr(S.br); }
  const ease = (u) => u * u * (3 - 2 * u);
  function rampBright(to, ms, done) {
    cancelRamp();
    const from = sentBr;
    if (!ms || from === to || !link.ready) { sendBr(to); if (done) done(); return; }
    const t0 = performance.now();
    rampT = setInterval(() => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      sendBr(Math.round(from + (to - from) * ease(u)));
      if (u >= 1) { cancelRamp(); if (done) done(); }
    }, 70);
  }
  function cancelFade() { clearInterval(fadeT); fadeT = null; }
  function fadeColor(to, ms) {
    cancelFade();
    const from = lastRGB.slice();
    if (!ms || !link.ready) { sendRGB(to); return; }
    const t0 = performance.now();
    fadeT = setInterval(() => {
      const u = Math.min(1, (performance.now() - t0) / ms), e = ease(u);
      const c = [0, 1, 2].map((i) => Math.round(from[i] + (to[i] - from[i]) * e));
      sendRGB(c); paint(c, S.br / 100);
      if (u >= 1) cancelFade();
    }, 70);
  }
  // Explicit user-selected power protocol. Never guess or switch automatically.
  function powerPacket(on) {
    if (S.powerProfile === 'elk') return Uint8Array.from(on
      ? [0x7e,0x00,0x04,0x01,0x00,0x00,0x00,0x00,0xef]
      : [0x7e,0x00,0x04,0x00,0x00,0x00,0xff,0x00,0xef]);
    return P.power(on);
  }
  function setPower(on) {
    on = Boolean(on);
    // Do not trust last scene/auto timers to manage physical power.
    if (!on) {
      S.auto = false;
      lastAuto = null;
      stopDriver();
      cancelFade();
      cancelRamp();
      activeScene = null;
      if (typeof sleepT !== 'undefined') {
        clearTimeout(sleepT); clearInterval(sleepTick);
        sleepT = null; sleepTick = null;
      }
      // The current BLE write may already be in flight; discard other queued work.
      if (link.queue) link.queue.length = 0;
    }
    S.on = on;
    // Key power separately, never piggyback it on queued colour/brightness writes.
    link.send(powerPacket(on), 'power');
    if (on) {
      // Avoid a fade timer racing the ON command (especially after a native effect).
      // Brightness follows power ON, with no RGB packet that could cancel hardware mode.
      sentBr = S.br;
      sendBr(S.br);
    }
    render(); save();
    toast(on ? 'Power ON command sent' : 'Power OFF command sent');
  }
  function stopDriver() {
    musicSession++;
    if (musicBusy && window.MelkSmartAudio) MelkSmartAudio.stop();
    if (rotation && !rotationSending) rotation.stop();
    curSeqId = null; cancelFade();
    if (driver) { driver.stop(); driver = null; }
    $$('.card[data-seq]').forEach((c) => c.querySelector('[data-play]').textContent = 'Play');
    $('#flowBtn').textContent = 'Start';
    const mb = $('#musicBtn'); mb.setAttribute('aria-pressed', 'false'); mb.textContent = 'Start listening';
    $('#meter').style.width = '0';
  }
  function setColor(h, s, fromUser) {
    if (fromUser) { stopDriver(); activeMode = null; activeScene = null; renderModes(); renderScenes(); }
    S.h = h; S.s = s; render(); pushColor(); save();
  }
  function setRGB(r, g, b) { const [h, s] = rgb2hsv(r, g, b); setColor(h, s, true); }

  /* ---------- colour wheel ---------- */
  const wheel = $('#wheel'), thumb = $('#thumb');
  (function drawWheel() {
    const n = wheel.width, ctx = wheel.getContext('2d'), img = ctx.createImageData(n, n), R = n / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - R + 0.5, dy = y - R + 0.5, r = Math.hypot(dx, dy), i = (y * n + x) * 4;
      if (r > R) { img.data[i + 3] = 0; continue; }
      let h = Math.atan2(dy, dx) * 180 / Math.PI; if (h < 0) h += 360;
      const c = hsv2rgb(h, Math.min(1, r / (R - 1)), 1);
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  })();
  function placeThumb() {
    const a = S.h * Math.PI / 180, r = S.s * 50; // percent of box radius
    thumb.style.left = (50 + Math.cos(a) * r) + '%';
    thumb.style.top = (50 + Math.sin(a) * r) + '%';
  }
  function wheelPick(e) {
    const b = wheel.getBoundingClientRect(), R = b.width / 2;
    const dx = e.clientX - b.left - R, dy = e.clientY - b.top - R;
    let h = Math.atan2(dy, dx) * 180 / Math.PI; if (h < 0) h += 360;
    setColor(h, clamp(Math.hypot(dx, dy) / R, 0, 1), true);
  }
  let wheelDown = false;
  wheel.addEventListener('pointerdown', (e) => { wheelDown = true; wheel.setPointerCapture(e.pointerId); wheelPick(e); });
  wheel.addEventListener('pointermove', (e) => { if (wheelDown) wheelPick(e); });
  wheel.addEventListener('pointerup', () => { wheelDown = false; });
  wheel.addEventListener('pointercancel', () => { wheelDown = false; });

  /* ---------- sliders ---------- */
  $('#br').addEventListener('input', (e) => { S.br = driveBr(+e.target.value); if (S.br !== +e.target.value) e.target.value = S.br; render(); pushBright(); save(); });
  $('#warm').addEventListener('input', (e) => {
    stopDriver(); activeMode = null; activeScene = null; renderModes(); renderScenes();
    const w = +e.target.value; S.warm = w;
    $('#wOut').textContent = w < 35 ? 'Warm' : w > 65 ? 'Cool' : 'Neutral';
    clearNative(); link.cancel(['color']); link.send(P.whiteTemp(100 - w, w), 'white');
    const rgb = w < 50 ? [255, 255 - (50 - w) * 2.1 | 0, 255 - (50 - w) * 5.2 | 0] : [255 - (w - 50) * 1.6 | 0, 255 - (w - 50) * 0.7 | 0, 255];
    paint(rgb, S.br / 100); save();
  });
  ['rr', 'gg', 'bb'].forEach((id) => $('#' + id).addEventListener('input', () => setRGB(+$('#rr').value, +$('#gg').value, +$('#bb').value)));
  $('#hexIn').addEventListener('input', (e) => { const c = hex2rgb(e.target.value); if (c) setRGB(...c); });
  $('#sp').addEventListener('input', (e) => { S.speed = +e.target.value; $('#spOut').textContent = S.speed + '%'; link.send(P.speed(S.speed), 'speed'); save(); });
  $('#sp').value = S.speed; $('#spOut').textContent = S.speed + '%';

  $('#btnPower').addEventListener('click', () => setPower(!S.on));
  $('#forcePowerOn').addEventListener('click', () => setPower(true));
  $('#forcePowerOff').addEventListener('click', () => setPower(false));

  /* ---------- palette ---------- */
  let palEdit = false;
  function renderPalette() {
    const box = $('#palette'); box.innerHTML = '';
    S.palette.forEach((hex, i) => {
      const b = document.createElement('button');
      b.className = 'sw'; b.style.setProperty('--c', hex); b.type = 'button'; b.setAttribute('aria-label', palEdit ? 'Remove ' + hex : 'Use ' + hex);
      if (palEdit) { const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; b.appendChild(x); }
      b.addEventListener('click', () => {
        if (palEdit) { S.palette.splice(i, 1); save(); renderPalette(); } else setRGB(...hex2rgb(hex));
      });
      box.appendChild(b);
    });
    const add = document.createElement('button');
    add.className = 'sw add'; add.type = 'button'; add.textContent = '+'; add.setAttribute('aria-label', 'Save current colour');
    add.addEventListener('click', () => {
      const hex = rgb2hex(...curRGB());
      if (S.palette.includes(hex)) return toast('Already in your colours');
      S.palette.push(hex); save(); renderPalette(); toast('Saved ' + hex);
    });
    box.appendChild(add);
    $('#palEdit').textContent = palEdit ? 'Done' : 'Edit';
  }
  $('#palEdit').addEventListener('click', () => { palEdit = !palEdit; renderPalette(); });

  /* ---------- built-in modes and strip scenes: the Effects browser ---------- */
  const MC = Melk.modeCatalog;
  function modeLabel(id) { return S.modeNames[id] || P.modeName(id) || 'Mode ' + id; }
  // "Verified" is recorded by the user after a test on their own strip (mode 128 was physically verified on this controller).
  S.modePersistent = S.modePersistent || {'128': true};
  S.persistentOnly = !!S.persistentOnly;
  // View state only (never saved): the chip that is showing, the search text, and which row is selected. "Selected" is not "playing".
  let fxCat = null, fxQuery = '', fxSelKey = null;
  const fxState = () => ({ sceneFav: S.nativeSceneFav || [], names: S.modeNames, fav: S.modeFav, hidden: S.modeHidden, persistent: S.modePersistent, verifyStatus: hwStatus });
  // The strip never confirms which effect it plays, so this is only "the last effect command this app sent".
  const fxSent = () => (S.native && (S.native.kind === 'mode' || S.native.kind === 'scene') ? (S.native.kind === 'mode' ? 'm' : 's') + S.native.id : null);
  function fxInitialCat() { return 'scenes'; }
  function fxEnsureVisible(list, row) {
    if (!row) return;
    const top = row.offsetTop, bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top; else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }
  let fxScrollToSel = false, fxHasRows = false;
  function renderModes() {
    const list = $('#fxList'); if (!list) return;
    const modes = MC.modes(fxState()), scenes = MC.scenes(fxState()), all = modes.concat(scenes), cats = MC.categories(modes, scenes);
    if (fxCat === null) fxCat = fxInitialCat(modes);
    if (!cats.some((c) => c.key === fxCat)) fxCat = 'all';
    const rows = MC.filter(modes, scenes, { cat: fxCat, query: fxQuery, verifiedOnly: !!S.persistentOnly });
    const sent = fxSent(), find = (key) => all.find((e) => e.key === key) || null;
    // The panel always describes a row you can see: keep the selection if it is in the list, otherwise the last-sent effect if listed, otherwise the first row.
    if (rows.length && !rows.some((e) => e.key === fxSelKey)) fxSelKey = (sent && rows.some((e) => e.key === sent) && sent) || rows[0].key;
    else if (!fxSelKey || !find(fxSelKey)) fxSelKey = null;
    const ae = document.activeElement, focusKey = ae && ae.closest && (ae.closest('#fxList') && ae.dataset.key ? 'row:' + ae.dataset.key : ae.closest('#fxCats') && ae.dataset.cat ? 'cat:' + ae.dataset.cat : null);
    const keepScroll = list.scrollTop;

    // chips
    $('#fxCats').innerHTML = cats.map((c) => '<button type="button" role="tab" class="fxCat" data-cat="' + esc(c.key) + '" aria-selected="' + (!fxQuery && c.key === fxCat) + '" tabindex="' + (!fxQuery && c.key === fxCat ? 0 : -1) + '">' + esc(c.label) + (c.key === 'fav' || c.key === 'hidden' ? '<span class="n">' + c.count + '</span>' : '') + '</button>').join('');
    if (fxQuery) { const first = $('#fxCats .fxCat'); if (first) first.tabIndex = 0; }

    // list
    const showGroup = fxQuery || fxCat === 'all' || fxCat === 'fav' || fxCat === 'hidden';
    if (rows.length) {
      list.innerHTML = rows.map((e) => {
        const isSent = sent === e.key, kindWord = e.kind === 'scene' ? 'Scene' : 'Mode';
        const label = kindWord + ' ' + e.id + ', ' + e.name + (showGroup ? ', ' + e.groupLabel : '') + (e.status === 'verified' ? ', verified on your strip' : e.status === 'unsupported' ? ', you recorded that it does not work' : ', not tested') + (e.fav ? ', favourite' : '') + (isSent ? ', last command sent to the strip' : '');
        return '<button type="button" role="option" class="fxRow" data-key="' + e.key + '" aria-selected="' + (e.key === fxSelKey) + '" tabindex="' + (e.key === fxSelKey ? 0 : -1) + '" aria-label="' + esc(label) + '">' +
          '<span class="fxNum" aria-hidden="true">' + e.id + '</span><span class="fxName" aria-hidden="true">' + esc(e.name) + (showGroup ? '<small class="fxGroup">' + esc(e.kind === 'scene' ? 'Strip scene' : e.groupLabel) + '</small>' : '') + '</span>' +
          '<span class="fxMarks" aria-hidden="true">' + (e.fav ? '<span class="mk fav">★</span>' : '') + (e.status === 'verified' ? '<span class="mk ok">✓</span>' : '') + (e.status === 'unsupported' ? '<span class="mk bad">✕</span>' : '') + (isSent ? '<span class="mk sent">SENT</span>' : '') + '</span></button>';
      }).join('');
      if (!rows.some((e) => e.key === fxSelKey)) { const f = list.querySelector('.fxRow'); if (f) f.tabIndex = 0; }
    } else {
      list.innerHTML = '<div class="fxEmpty" role="presentation">' + (fxCat === 'fav' && !fxQuery && !S.persistentOnly ? '<p>No favourites yet. Select an effect and tap Favourite.</p>' : '<p>No effects match.</p><button type="button" class="btn ghost sm" id="fxClear">Clear search and filter</button>') + '</div>';
    }
    list.scrollTop = keepScroll;
    if (fxScrollToSel) { fxEnsureVisible(list, list.querySelector('[aria-selected=true]')); fxScrollToSel = false; }

    // one line that says what the list is
    const total = rows.length;
    $('#fxCount').textContent = total + (total === 1 ? ' effect' : ' effects');
    const grpLabel = (cats.find((c) => c.key === fxCat) || {}).label;
    $('#fxCatNote').textContent = (fxQuery ? total + (total === 1 ? ' match for “' : ' matches for “') + fxQuery.trim() + '” in every group.'
      : fxCat === 'all' ? 'Every numbered mode and all 28 native hardware scenes.'
      : fxCat === 'fav' ? 'Your favourite native modes and scenes.'
      : fxCat === 'scenes' ? 'Native hardware scenes. Custom phone-driven scenes remain in Settings → Scenes.'
      : fxCat === 'hidden' ? 'Modes you hid. Select one and tap Rename to show it again.'
      : 'Magic Lantern’s “' + grpLabel + '” group.') + (S.persistentOnly ? ' Showing only effects you verified.' : '');

    // the selected effect: every control for it lives here
    fxHasRows = rows.length > 0;
    const sel = fxHasRows ? find(fxSelKey) : null, badge = $('#fxSelBadge');   // an empty list means nothing is selected on screen, so Run must not act on a hidden choice
    $('#fxSelName').textContent = sel ? sel.name : 'Choose an effect';
    $('#fxSelMeta').textContent = !sel ? '' : sel.kind === 'scene' ? 'Strip scene ' + sel.id + ' · from Magic Lantern’s Scenes list' : 'Mode ' + sel.id + ' · ' + sel.groupLabel + ' group' + (sel.renamed ? ' · renamed from “' + sel.mlName + '”' : '');
    const st = sel ? sel.status : 'untested';
    badge.textContent = st === 'verified' ? 'VERIFIED' : st === 'unsupported' ? 'DOES NOT WORK' : 'NOT TESTED';
    badge.dataset.s = st === 'verified' ? 'VERIFIED_SUPPORTED' : st === 'unsupported' ? 'UNSUPPORTED' : 'UNVERIFIED';
    $('#fxSelStatus').textContent = !sel ? '' : st === 'verified' ? 'You confirmed this effect on your strip.'
      : st === 'unsupported' ? 'You recorded that this effect does not work on your strip.'
      : 'Not tested on your strip yet. The number and name come from Magic Lantern’s own list, so the command is a known one, but your controller may not play every effect.';
    const sentEntry = sent ? find(sent) : null;
    $('#fxSelSent').textContent = !sentEntry ? 'No effect command has been sent since the strip was last set to a colour.'
      : sentEntry.key === fxSelKey ? 'This is the last effect command sent to the strip. The strip does not confirm what it is playing.'
      : 'Last effect command sent: “' + sentEntry.name + '” (' + (sentEntry.kind === 'scene' ? 'scene ' : 'mode ') + sentEntry.id + '). The strip does not confirm what it is playing.';
    const isMode = !!sel && sel.kind === 'mode';
    $('#fxRun').disabled = !sel; $('#fxFav').hidden = !sel; $('#fxQuick').hidden = !sel || isMode; $('#fxRename').hidden = !isMode; $('#fxSpeedRow').hidden = !isMode;
    $('#fxFav').setAttribute('aria-pressed', String(!!(sel && sel.fav))); $('#fxFav').textContent = (sel && sel.fav ? '★' : '☆') + ' Favourite';
    $('#persistentOnly').checked = !!S.persistentOnly;

    if (focusKey) {
      const [kind, key] = [focusKey.slice(0, 3), focusKey.slice(4)];
      const target = kind === 'row' ? list.querySelector('[data-key="' + key + '"]') : $('#fxCats').querySelector('[data-cat="' + key + '"]');
      if (target) target.focus({ preventScroll: true });
    }
  }
  function runMode(id) {
    if (S.driveMode === 'driving') return toast('Hardware effects are parked-only. Switch Car mode to Parked first.');
    stopDriver(); activeMode = id; activeScene = null; S.lastHardwareMode = id; setNative('mode', id); renderScenes();
    link.cancel(['color']);   // a pending static colour must not land after the effect command
    link.send(P.mode(id), 'mode');
    link.send(P.speed(S.speed), 'speed'); renderModes(); render();
  }
  $('#persistentOnly').addEventListener('change', e => { S.persistentOnly = e.target.checked; save(); renderModes(); });
  // chips: choosing one clears the search; arrow keys move between them
  $('#fxCats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    fxCat = b.dataset.cat; fxQuery = ''; $('#fxSearch').value = ''; renderModes();
    const on = $('#fxCats [data-cat="' + fxCat + '"]'); if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  $('#fxCats').addEventListener('keydown', (e) => {
    const chips = Array.from($('#fxCats').querySelectorAll('[data-cat]')), i = chips.indexOf(document.activeElement); if (i < 0) return;
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? chips.length - 1 : null;
    if (to === null) return; e.preventDefault(); const t = chips[(to + chips.length) % chips.length]; t.focus(); t.click();
  });
  $('#fxSearch').addEventListener('input', (e) => { fxQuery = e.target.value; renderModes(); });
  $('#fxSearch').addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.value) { e.preventDefault(); e.target.value = ''; fxQuery = ''; renderModes(); } });
  // list: tap or arrow keys select (selection follows focus); nothing is sent until "Run on strip"
  $('#fxList').addEventListener('click', (e) => {
    if (e.target.closest('#fxClear')) { fxQuery = ''; $('#fxSearch').value = ''; S.persistentOnly = false; save(); fxCat = 'all'; renderModes(); return; }
    const r = e.target.closest('[data-key]'); if (!r) return; fxSelKey = r.dataset.key; renderModes();
  });
  $('#fxList').addEventListener('keydown', (e) => {
    const rows = Array.from($('#fxList').querySelectorAll('.fxRow')), i = rows.indexOf(document.activeElement); if (i < 0) return;
    const to = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'PageDown' ? i + 8 : e.key === 'PageUp' ? i - 8 : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : null;
    if (to === null) return; e.preventDefault();
    const t = rows[Math.max(0, Math.min(rows.length - 1, to))]; fxSelKey = t.dataset.key; fxScrollToSel = true; renderModes();
    const again = $('#fxList').querySelector('[data-key="' + fxSelKey + '"]'); if (again) again.focus({ preventScroll: true });
  });
  const fxCurrent = () => { const k = fxHasRows ? fxSelKey : null; return k ? (k[0] === 'm' ? { kind: 'mode', id: +k.slice(1) } : { kind: 'scene', id: +k.slice(1) }) : null; };
  $('#fxRun').addEventListener('click', () => {
    const c = fxCurrent(); if (!c) return;
    if (!link.ready) return toast('Connect the strip first.');
    if (c.kind === 'scene') sendNativeScene(c.id); else runMode(c.id);
  });
  $('#fxFav').addEventListener('click', () => {
    const c = fxCurrent(); if (!c) return;
    if (c.kind === 'scene') { const fav = S.nativeSceneFav || []; S.nativeSceneFav = fav.includes(c.id) ? fav.filter(x => x !== c.id) : fav.concat(c.id); save(); renderModes(); return; }
    if (S.modeFav[c.id]) delete S.modeFav[c.id]; else S.modeFav[c.id] = 1;
    save(); renderModes();
  });
  $('#fxRename').addEventListener('click', () => { const c = fxCurrent(); if (c && c.kind === 'mode') editMode(c.id); });
  // Every known mode is a valid choice wherever the app lists modes the user picked or verified (not only the old 128 to 155 guess).
  function modeOptionIds(extra) {
    const s = new Set(); for (let i = P.MODE_FIRST; i <= P.MODE_LAST; i++) s.add(i);
    [S.modePersistent, S.modeFav].forEach((m) => Object.keys(m || {}).forEach((k) => { if (m[k] && P.isKnownMode(+k)) s.add(+k); }));
    if (Number.isInteger(extra) && P.isKnownMode(extra)) s.add(extra);
    return Array.from(s).sort((x, y) => x - y);
  }

  /* ---------- dialog helper ---------- */
  const dlg = $('#dlg'), dlgForm = $('#dlgForm');
  function openDialog(html, onMount) {
    dlgForm.innerHTML = html; if (onMount) onMount(dlgForm);
    if (!dlg.open) dlg.showModal();
  }
  function closeDialog() { if (dlg.open) dlg.close(); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function editMode(id) {
    openDialog(`
      <h3>Mode ${id}: ${esc(P.modeName(id) || '')}</h3>
      <label class="field"><span>Name</span><input class="text" name="n" value="${esc(S.modeNames[id] || '')}" maxlength="24" placeholder="${esc(P.modeName(id) || 'Mode ' + id)}"></label>
      <label class="check"><input type="checkbox" name="f" ${S.modeFav[id] ? 'checked' : ''}><span>Favourite (shown under Favourites and in Car mode)</span></label>
      <label class="check"><input type="checkbox" name="p" ${S.modePersistent[id] ? 'checked' : ''}><span>Verified: this mode survives app close AND power OFF/ON</span></label>
      <label class="check"><input type="checkbox" name="h" ${S.modeHidden[id] ? 'checked' : ''}><span>Hide it from the list</span></label>
      <div class="dlgActs"><button class="btn ghost" value="cancel">Cancel</button><button class="btn main" value="ok" id="okBtn">Save</button></div>`,
    (f) => {
      f.querySelector('#okBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const n = f.n.value.trim(); if (n) S.modeNames[id] = n; else delete S.modeNames[id];
        if (f.f.checked) S.modeFav[id] = 1; else delete S.modeFav[id];
        if (f.h.checked) S.modeHidden[id] = 1; else delete S.modeHidden[id];
        if (f.p.checked) S.modePersistent[id] = true; else delete S.modePersistent[id];
        save(); renderModes(); closeDialog();
      });
    });
  }

  /* ---------- custom effects (sequences) ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  function seqColor(seq, tMs) {
    const k = seq.speed || 1, st = seq.steps;
    const total = st.reduce((a, s) => a + s.fade + s.hold, 0) / k;
    let t = total > 0 ? tMs % total : 0;
    for (let i = 0; i < st.length; i++) {
      const prev = hex2rgb(st[(i + st.length - 1) % st.length].c), cur = hex2rgb(st[i].c);
      const fade = st[i].fade / k, hold = st[i].hold / k;
      if (t < fade) { const u0 = t / fade, u = u0 * u0 * (3 - 2 * u0); return [0, 1, 2].map((j) => Math.round(lerp(prev[j], cur[j], u))); }
      t -= fade;
      if (t < hold) return cur;
      t -= hold;
    }
    return hex2rgb(st[0].c);
  }
  function playSeq(seq) {
    if (S.driveMode === 'driving' && !seqCalm(seq)) return toast('That effect changes too fast for Driving mode.');
    if (!S.on) setPower(true);
    // Opt-in native mode. Only use an ID that the owner has tested on the physical controller.
    // Unlike RGB step loops, a native mode can keep running after the phone disconnects.
    if (Number.isInteger(seq.hardwareMode) && P.isKnownMode(seq.hardwareMode)) {
      stopDriver();
      activeMode = seq.hardwareMode;
      S.lastHardwareMode = activeMode;
      save();
      link.send(P.mode(activeMode), 'mode');
      link.send(P.speed(S.speed), 'speed');
      renderModes(); render(); renderSeqs(seq.id);
      toast(seq.name + ': hardware mode ' + activeMode);
      return;
    }
    stopDriver(); activeMode = null; renderModes();
    if (!seq.steps.length) return toast('Add at least one colour step');
    const t0 = performance.now(), from = lastRGB.slice(), fin = S.fadeMs;
    const id = setInterval(() => {
      const el = performance.now() - t0;
      let c = seqColor(seq, el);
      if (fin && el < fin) { const e = ease(el / fin); c = [0, 1, 2].map((i) => Math.round(from[i] + (c[i] - from[i]) * e)); }
      sendRGB(c); paint(c, S.br / 100);
    }, 70);
    driver = { label: seq.name, stop() { clearInterval(id); } }; curSeqId = seq.id;
    render(); renderSeqs(seq.id);
  }
  function renderSeqs(playingId) {
    const list = $('#seqList'); list.innerHTML = '';
    if (!S.seqs.length) list.innerHTML = '<p class="hint">No effects yet. Press New effect to build one from your colours.</p>';
    S.seqs.forEach((q) => {
      const card = document.createElement('div'); card.className = 'card'; card.dataset.seq = q.id;
      const grad = q.steps.map((s) => `<i style="background:${s.c}"></i>`).join('');
      const hw = Number.isInteger(q.hardwareMode);   // the "stops when the app closes" sentence is said once, above the list
      const modeHint = hw ? `<small>Hardware mode ${q.hardwareMode} · may persist offline</small>` : '';
      card.innerHTML = `<div><b>${esc(q.name)}${hw ? '' : ' <span class="badge">PHONE</span>'}</b><div class="strip">${grad}</div>${modeHint}</div>
        <div class="acts"><button class="btn main" data-play type="button">${playingId === q.id ? 'Playing' : 'Play'}</button><button class="btn ghost" data-edit type="button">Edit</button></div>`;
      card.querySelector('[data-play]').addEventListener('click', () => playSeq(q));
      card.querySelector('[data-edit]').addEventListener('click', () => editSeq(q));
      list.appendChild(card);
    });
  }
  function editSeq(q) {
    const isNew = !q;
    const draft = q ? JSON.parse(JSON.stringify(q)) : { id: 'u' + Date.now(), name: '', speed: 1, steps: S.palette.slice(0, 3).map((c) => ({ c, fade: 1500, hold: 500 })) };
    const stepHtml = (s, i) => `<div class="step" data-i="${i}">
      <input type="color" value="${s.c.toLowerCase()}" aria-label="Colour ${i + 1}">
      <label>Fade in (ms)<input class="text" type="number" min="0" max="20000" step="100" value="${s.fade}" inputmode="numeric"></label>
      <label>Hold (ms)<input class="text" type="number" min="0" max="20000" step="100" value="${s.hold}" inputmode="numeric"></label>
      <button class="rm" type="button" aria-label="Remove step">×</button></div>`;
    const draw = (f) => {
      f.querySelector('.steps').innerHTML = draft.steps.map(stepHtml).join('');
      f.querySelectorAll('.step').forEach((el) => {
        const i = +el.dataset.i, [col, fade, hold] = el.querySelectorAll('input');
        col.addEventListener('input', () => { draft.steps[i].c = col.value.toUpperCase(); });
        fade.addEventListener('input', () => { draft.steps[i].fade = clamp(+fade.value || 0, 0, 20000); });
        hold.addEventListener('input', () => { draft.steps[i].hold = clamp(+hold.value || 0, 0, 20000); });
        el.querySelector('.rm').addEventListener('click', () => { draft.steps.splice(i, 1); draw(f); });
      });
    };
    openDialog(`
      <h3>${isNew ? 'New effect' : 'Edit effect'}</h3>
      <label class="field"><span>Name</span><input class="text" name="n" value="${esc(draft.name)}" maxlength="24" placeholder="Evening glow"></label>
      <label class="field"><span>Hardware mode (optional)</span>
        <select class="text" id="hwMode"><option value="">Phone-driven colours (original)</option>
        ${modeOptionIds(draft.hardwareMode).map(id=>`<option value="${id}" ${draft.hardwareMode===id?'selected':''}>${id} — ${esc(modeLabel(id))}</option>`).join('')}</select></label>
      <p class="hint">Only link a mode after testing its actual animation. A hardware mode may survive power off/on; the colour steps below are not sent when one is selected. This does not save an arbitrary custom pattern to controller memory.</p>
      <div class="field"><span>Colour steps (phone-driven fallback)</span><div class="steps"></div></div>
      <button class="btn ghost" type="button" id="addStep">Add step</button>
      <label class="row"><span>Overall speed</span><output id="skOut">${draft.speed}×</output>
        <input type="range" id="sk" min="0.25" max="4" step="0.25" value="${draft.speed}"></label>
      <div class="dlgActs">
        ${isNew ? '' : '<button class="btn ghost" type="button" id="delSeq">Delete</button>'}
        <button class="btn ghost" value="cancel">Cancel</button><button class="btn main" id="okBtn" value="ok">Save and play</button></div>`,
    (f) => {
      draw(f);
      f.querySelector('#addStep').addEventListener('click', () => {
        const last = draft.steps[draft.steps.length - 1];
        draft.steps.push({ c: S.palette[draft.steps.length % S.palette.length] || '#FFFFFF', fade: last ? last.fade : 1500, hold: last ? last.hold : 500 }); draw(f);
      });
      f.querySelector('#sk').addEventListener('input', (e) => { draft.speed = +e.target.value; f.querySelector('#skOut').textContent = draft.speed + '×'; });
      const del = f.querySelector('#delSeq');
      if (del) del.addEventListener('click', () => { stopDriver(); S.seqs = S.seqs.filter((x) => x.id !== q.id); save(); renderSeqs(); render(); closeDialog(); });
      f.querySelector('#okBtn').addEventListener('click', (e) => {
        e.preventDefault();
        draft.name = f.n.value.trim() || 'My effect';
        const chosen = f.querySelector('#hwMode').value;
        if (chosen) draft.hardwareMode = Number(chosen);
        else delete draft.hardwareMode;
        if (!draft.steps.length && !chosen) return toast('Add at least one colour step');
        const i = S.seqs.findIndex((x) => x.id === draft.id);
        if (i >= 0) S.seqs[i] = draft; else S.seqs.push(draft);
        save(); closeDialog(); renderSeqs(); playSeq(draft);
      });
    });
  }
  $('#seqNew').addEventListener('click', () => editSeq(null));


  /* ---------- colour flow: slow, continuous walk through every hue ---------- */
  const fmtSec = (s) => s < 60 ? s + ' sec' : (s % 60 ? (s / 60).toFixed(1) : s / 60) + ' min';
  function playFlow() {
    if (!S.on) setPower(true);
    stopDriver(); activeMode = null; renderModes();
    const t0 = performance.now(), h0 = S.h;
    const id = setInterval(() => {
      const hue = (h0 + ((performance.now() - t0) / (S.flowSec * 1000)) * 360) % 360;
      const c = hsv2rgb(hue, 1, 1);
      sendRGB(c); paint(c, S.br / 100);
    }, 80);
    driver = { label: 'Colour flow', stop() { clearInterval(id); } };
    $('#flowBtn').textContent = 'Stop'; render();
  }
  $('#flowBtn').addEventListener('click', () => {
    if (driver && driver.label === 'Colour flow') { stopDriver(); render(); pushColor(); } else playFlow();
  });
  $('#flowSec').value = S.flowSec; $('#flowOut').textContent = fmtSec(S.flowSec);
  $('#flowSec').addEventListener('input', (e) => { S.flowSec = +e.target.value; $('#flowOut').textContent = fmtSec(S.flowSec); save(); });

  function setSeg(which) {
    const built = which === 'built';
    $('#segBuilt').setAttribute('aria-pressed', String(built)); $('#segMine').setAttribute('aria-pressed', String(!built));
    $('#fxBuilt').hidden = !built; $('#fxMine').hidden = built;
  }
  $('#segBuilt').addEventListener('click', () => setSeg('built'));
  $('#segMine').addEventListener('click', () => setSeg('mine'));

  /* ---------- music ---------- */
  let musicPausedByHide = false;
  let smartResponse = Melk.smartMusic.create(), silentFrames = 0, manualFast = 0, manualSlow = 0, manualBeatAt = -10000;
  function musicFrame(f) {
    if (!driver || driver.label !== 'Listening…') return;
    const now = performance.now();
    if (f.legacy || S.musicStyle !== 'smart') { const energy = Number(f.bass) || 0; manualFast += (energy - manualFast) * .4; manualSlow += (energy - manualSlow) * .04; const beat = f.legacy ? manualFast - manualSlow > .035 : f.beat; f = { ...f, beat: !!beat && energy > .045 + S.beatGate / 100 * .16 && now - manualBeatAt > S.beatCooldown }; if (f.beat) manualBeatAt = now; }
    $('#musicActiveSource').textContent = f.legacy ? 'Microphone · legacy level analysis' : f.source === 'device' ? 'Device Audio' : 'Microphone';
    $('#musicConnection').textContent = link.state === 'connected' ? 'Bluetooth connected' : link.state === 'demo' ? 'Demo strip' : 'Bluetooth disconnected';
    $('#beatLamp').textContent = f.beat ? '● Beat' : f.silence ? 'Silence · gently holding' : f.bpm && f.confidence >= .65 ? Math.round(f.bpm) + ' BPM (estimate)' : 'Listening';
    for (const band of ['bass', 'mid', 'treble']) { const el = $('#music-' + band); el.value = Number(f[band]) || 0; el.setAttribute('aria-valuetext', f.legacy && band !== 'bass' ? 'Not available on this APK' : Math.round(el.value * 100) + '%'); }
    $('#meter').style.width = Math.round((f.energy || f.bass || 0) * 100) + '%';
    const ctx = $('#musicSpectrum').getContext('2d'); ctx.clearRect(0, 0, 320, 72); ctx.fillStyle = '#f2b544';
    const bins = Array.isArray(f.spectrum) ? f.spectrum : []; bins.slice(0, 16).forEach((v, i) => ctx.fillRect(i * 20 + 2, 72 - v * 70, 15, v * 70));
    if (f.source === 'device' && f.silence) silentFrames++; else silentFrames = 0;
    if (silentFrames > 70) { $('#musicNotice').textContent = 'No capturable audio detected. This can mean silence or an app capture restriction. Microphone fallback is your choice.'; $('#musicFallback').hidden = false; }
    let bank = (S.djBank || []).filter(key => /^s\d+$/.test(key) ? !!P.NATIVE_SCENES[+key.slice(1)] : /^m\d+$/.test(key) && P.isKnownMode(+key.slice(1)));
    if (!bank.length) bank = (S.nativeSceneFav || []).map(id => 's' + id).concat(Object.keys(S.modeFav).filter(id => S.modeFav[id] && P.isKnownMode(+id)).map(id => 'm' + id));
    if (!bank.length) bank = S.smartScenes.quick.map(id => 's' + id);
    // Existing manual sensitivity remains effective for Bass Pulse and Smooth Flow; Smart Auto is automatic.
    const input = S.musicStyle === 'smart' || S.musicStyle === 'dj' ? f : { ...f, bass: Math.min(1, (f.bass || 0) * S.sens / 60), energy: Math.min(1, (f.energy || 0) * S.sens / 60) };
    const decision = smartResponse.frame(input, { style: S.musicStyle, hue: S.h, saturation: S.s, djInterval: S.djInterval, bank }, now);
    if (!decision || !link.ready || S.driveMode === 'driving') return;
    if (decision.kind === 'native') {
      const id = +decision.key.slice(1), kind = decision.key[0] === 's' ? 'scene' : 'mode';
      setNative(kind, id); link.cancel(['color', 'scene', 'mode']); link.send(kind === 'scene' ? P.scene(id) : P.mode(id), kind);
      if (kind === 'mode') link.send(P.speed(S.speed), 'speed');
      $('#djStatus').textContent = 'Last requested: ' + (kind === 'scene' ? P.NATIVE_SCENES[id] : modeLabel(id));
    } else { sendRGB(decision.rgb); paint(decision.rgb, decision.level); }
  }
  async function startMusic() {
    if (musicBusy) return;
    if (S.driveMode === 'driving') return toast('Music effects are parked-only. Switch Car mode to Parked first.');
    if (!link.ready) return toast('Connect the strip first.');
    stopDriver(); musicBusy = true; S.auto = false; save(); activeMode = null; renderModes();
    const token = ++musicSession; smartResponse = Melk.smartMusic.create(); silentFrames = 0; manualFast = manualSlow = 0; manualBeatAt = -10000;
    $('#musicNotice').textContent = 'Waiting for audio permission / capture consent…'; $('#musicBtn').disabled = true;
    try {
      const result = await MelkSmartAudio.start(S.musicSource, f => musicFrame(f), message => { if (driver && driver.label === 'Listening…') { stopDriver(); render(); $('#musicNotice').textContent = message; } });
      if (token !== musicSession || S.driveMode === 'driving') { await MelkSmartAudio.stop(); return; }
      if (!S.on) setPower(true);
      driver = { label: 'Listening…', stop() { musicSession++; MelkSmartAudio.stop(); } };
      $('#musicBtn').setAttribute('aria-pressed', 'true'); $('#musicBtn').textContent = 'Stop listening';
      $('#musicActiveSource').textContent = result.source === 'device' ? 'Device Audio' : 'Microphone';
      $('#musicNotice').textContent = result.legacy ? 'Legacy microphone level analysis. Full FFT and Device Audio require native 1.2.0.' : 'Audio is processed locally. Capture pauses when MELK Studio leaves the foreground.';
      $('#musicFallback').hidden = true; render();
    } catch (e) { $('#musicNotice').textContent = e.message || 'Audio capture unavailable.'; $('#musicFallback').hidden = S.musicSource === 'microphone'; }
    finally { musicBusy = false; $('#musicBtn').disabled = false; }
  }
  $('#musicBtn').addEventListener('click', () => { if (driver && driver.label === 'Listening…') { const dj = S.musicStyle === 'dj'; stopDriver(); render(); if (!dj) pushColor(); } else startMusic(); });
  $('#musicSource').value = S.musicSource;
  $('#musicSource').addEventListener('change', e => { musicSession++; stopDriver(); S.musicSource = e.target.value; save(); $('#musicNotice').textContent = 'Tap Start listening to use the selected source.'; });
  $('#musicFallback').addEventListener('click', () => { S.musicSource = 'microphone'; $('#musicSource').value = 'microphone'; save(); startMusic(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (rotation) rotation.stop(); if (driver && driver.label === 'Listening…') { stopDriver(); musicPausedByHide = true; render(); } }
    else if (musicPausedByHide) { musicPausedByHide = false; $('#musicNotice').textContent = 'Capture paused in the background. Tap Start for a fresh audio session.'; }
  });
  window.addEventListener('pagehide', () => { musicSession++; stopDriver(); MelkSmartAudio.stop(); });
  $('#djInterval').value = S.djInterval;
  $('#djIntervalOut').textContent = S.djInterval + ' s';
  $('#djInterval').addEventListener('input', e => { S.djInterval = +e.target.value; $('#djIntervalOut').textContent = S.djInterval + ' s'; save(); });
  $('#beatGate').value = S.beatGate;
  $('#beatGateOut').textContent = S.beatGate + '%';
  $('#beatGate').addEventListener('input', e => { S.beatGate = +e.target.value; $('#beatGateOut').textContent = S.beatGate + '%'; save(); });
  $('#beatCooldown').value = S.beatCooldown;
  $('#beatCooldownOut').textContent = S.beatCooldown + ' ms';
  $('#beatCooldown').addEventListener('input', e => { S.beatCooldown = +e.target.value; $('#beatCooldownOut').textContent = S.beatCooldown + ' ms'; save(); });
  $('#sen').value = S.sens; $('#senOut').textContent = S.sens + '%';
  $('#sen').addEventListener('input', (e) => { S.sens = +e.target.value; $('#senOut').textContent = S.sens + '%'; save(); });
  $$('[data-ms]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.ms === S.musicStyle));
    b.addEventListener('click', () => { S.musicStyle = b.dataset.ms; $$('[data-ms]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); save(); });
  });

  // Named effects referenced by b1scoito/elk-led-controller/src/effects.rs.
  // Send ONLY as an opt-in diagnostic, not as an automatic replacement for app scenes.
  const nativeEffects = [
    {id: 135, name: "RGB jump"},
    {id: 136, name: "Seven-colour jump"},
    {id: 137, name: "RGB crossfade"},
    {id: 138, name: "Seven-colour crossfade"},
    {id: 139, name: "Red crossfade"},
    {id: 140, name: "Green crossfade"},
    {id: 141, name: "Blue crossfade"},
    {id: 149, name: "Seven-colour blink"},
    {id: 150, name: "Red blink"},
    {id: 151, name: "Green blink"},
    {id: 152, name: "Blue blink"}
  ];
  const nativeSelect = $('#nativeEffectSelect');
  nativeEffects.forEach(effect => {
    const option = document.createElement('option');
    option.value = String(effect.id);
    option.textContent = effect.name + ' (0x' + effect.id.toString(16).toUpperCase() + ')';
    nativeSelect.appendChild(option);
  });
  S.nativeTested = S.nativeTested || {};
  const nativeStatus = $('#nativeEffectStatus');
  function renderNativeStatus() {
    const id = Number(nativeSelect.value);
    nativeStatus.textContent = S.nativeTested[id]
      ? 'User marked offline-tested: app close AND power OFF/ON. No firmware guarantee.'
      : 'Not tested for offline / power-cycle persistence.';
  }
  nativeSelect.addEventListener('change', renderNativeStatus);
  $('#nativeEffectVerified').addEventListener('click', () => {
    const id = Number(nativeSelect.value);
    if (!$('#labConfirm').checked) { nativeStatus.textContent = 'Enable Protocol Lab confirmation first.'; return; }
    if (!confirm('Did you test this exact effect after closing the app AND power cycling the strip?')) return;
    S.nativeTested[id] = true; save(); renderNativeStatus();
  });
  const profile = $('#powerProfile');
  profile.value = S.powerProfile === 'elk' ? 'elk' : 'current';
  function renderProfile() { $('#powerProfileStatus').textContent = profile.value === 'elk'
    ? 'ELK alternative selected. Test ON/OFF with strip connected before relying on it.'
    : 'Existing MELK packets selected (original default).'; }
  profile.addEventListener('change', () => {
    if (profile.value === 'elk' && !confirm('Only use ELK after independently testing both ELK ON and ELK OFF in Protocol Lab. Continue?')) {
      profile.value = S.powerProfile === 'elk' ? 'elk' : 'current'; return;
    }
    S.powerProfile = profile.value; save(); renderProfile();
  });
  renderProfile(); renderNativeStatus();

  // Protocol Lab: never change the production power/mode packet builders.
  // The user must explicitly opt in to each packet. Auto/music remain stopped.
  const labMode = $('#labModeSelect');
  for (let id = 128; id <= 155; id++) {
    const option = document.createElement('option');
    option.value = String(id); option.textContent = 'Mode ' + id + ' (0x' + id.toString(16).toUpperCase() + ')';
    labMode.appendChild(option);
  }
  const labOutput = $('#labOutput');
  const labPackets = {
    labElkOn: [0x7e,0x00,0x04,0x01,0x00,0x00,0x00,0x00,0xef],
    labElkOff: [0x7e,0x00,0x04,0x00,0x00,0x00,0xff,0x00,0xef],
    labOldOn: Array.from(P.power(true)),
    labOldOff: Array.from(P.power(false))
  };
  function labSend(bytes, label) {
    if (!$('#labConfirm').checked) { labOutput.textContent = 'Please enable the stationary test confirmation first.'; return; }
    if (link.state !== 'connected') { labOutput.textContent = 'Connect the real LED strip first (Demo mode cannot test hardware).'; return; }
    // Do not let a JS-generated effect or auto timer override this test.
    S.auto = false; lastAuto = null; stopDriver(); cancelFade(); cancelRamp();
    if (link.queue) link.queue.length = 0;
    // Diagnostic commands intentionally bypass the app's saved OFF write gate.
    // Keep stored S.on unchanged: these are raw hardware tests, not state verification.
    nativeSend(Uint8Array.from(bytes), 'power');
    labOutput.textContent = 'Sent ' + label + ': ' + P.hex(bytes) + '\nObserve physical strip. App power indicator may be out of sync. Use a confirmed ON command to recover.';
  }
  $('#nativeEffectTest').addEventListener('click', () => {
    const id = Number(nativeSelect.value);
    const effect = nativeEffects.find(e => e.id === id);
    if (!effect) return;
    // ELK documentation packet; intentionally not applied to standard numbered modes.
    labSend([0x7e,0x00,0x03,id,0x03,0x00,0x00,0x00,0xef], 'ELK native ' + effect.name);
    renderNativeStatus();
  });
  for (const [id, packet] of Object.entries(labPackets))
    $('#' + id).addEventListener('click', () => labSend(packet, $('#' + id).textContent.trim()));
  // Magic Lantern 6.11.10 DEX: BluetoothLEService.changeScene() creates
  // [7E,05,31,sceneId,07,FF,FF,01,EF]. This is NOT the numbered-mode opcode 03.
  // Test exactly one user-selected ID. No automatic sweep, no persisted claim.
  $('#magicSceneSend').addEventListener('click', () => {
    const field = $('#magicSceneId');
    const id = Number(field.value);
    if (!Number.isInteger(id) || id < 0 || id > 255) {
      labOutput.textContent = 'Scene ID must be an integer from 0 to 255.';
      return;
    }
    if (!confirm('Send one Magic Lantern native scene test command (scene ' + id + ')? This can change the physical LEDs.')) return;
    labSend([0x7e,0x05,0x31,id,0x07,0xff,0xff,0x01,0xef], 'Magic Lantern native scene ' + id);
  });
  $('#labElkMode').addEventListener('click', () => {
    const id = Number(labMode.value);
    if (!Number.isInteger(id) || id < 128 || id > 155) return;
    labSend([0x7e,0x00,0x03,id,0x03,0x00,0x00,0x00,0xef], 'ELK native mode ' + id);
  });

  // Read-only BLE diagnostic: do not send test commands or change the working connection.
  const diagBtn = $('#deviceDiagBtn');
  if (diagBtn) diagBtn.addEventListener('click', async () => {
    const out = $('#deviceDiagOut');
    if (link.state !== 'connected') { out.textContent = 'Connect the strip first.'; return; }
    const info = ['Status: Connected', 'Name: ' + (link.name || 'Not reported'),
      'Device: ' + (link.deviceId ? '…' + String(link.deviceId).slice(-5) + ' (masked)' : 'Not available'),
      'Protocol service: ' + (P.SERVICE || 'Unknown'),
      'Write characteristic: ' + (P.CHAR || 'Unknown')];
    try {
      const plugin = window.Capacitor && (window.Capacitor.Plugins || {}).BluetoothLe;
      if (plugin && link.deviceId && typeof plugin.getServices === 'function') {
        const result = await plugin.getServices({deviceId: link.deviceId});
        const services = Array.isArray(result && result.services) ? result.services : [];
        const suffix = (uuid) => String(uuid || '').slice(4, 8).toUpperCase();
        for (const service of services) {
          const tag = suffix(service.uuid);
          info.push('');
          info.push('Service: ' + tag + (tag === '1800' ? ' (Generic Access)' : tag === 'FFF0' ? ' (LED Controller)' : ''));
          for (const characteristic of (service.characteristics || [])) {
            const ctag = suffix(characteristic.uuid);
            const props = characteristic.properties || {};
            const flags = ['read', 'write', 'writeWithoutResponse', 'notify'].filter((key) => props[key]);
            info.push('  ' + ctag + ': ' + (flags.join(', ') || 'no flags'));
          }
        }
        if (!services.length) info.push('GATT service list is empty');
      } else info.push('Additional GATT details: Not exposed by current adapter');
    } catch (e) { info.push('GATT details unavailable: ' + (e.message || e)); }
    info.push('');
    info.push('Exact model: not reported by the controller');
    out.textContent = info.join('\n');
  });

  /* ---------- studio ---------- */
  let sleepT = null, sleepEnd = 0, sleepTick = null;
  function setSleep(min) {
    clearTimeout(sleepT); clearInterval(sleepTick);
    $$('#sleepSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.min === min)));
    if (!min) { $('#sleepInfo').textContent = 'Off'; return; }
    sleepEnd = Date.now() + min * 60000;
    const upd = () => { $('#sleepInfo').textContent = 'Off in ' + Math.max(1, Math.ceil((sleepEnd - Date.now()) / 60000)) + ' min'; };
    upd(); sleepTick = setInterval(upd, 15000);
    sleepT = setTimeout(() => {
      clearInterval(sleepTick); stopDriver(); setPower(false);
      $('#sleepInfo').textContent = 'Off'; setSleep(0); toast('Sleep timer: strip turned off');
    }, min * 60000);
  }
  $$('#sleepSeg button').forEach((b) => b.addEventListener('click', () => setSleep(+b.dataset.min)));

  /* ---------- v1.1.0 smart routines: foreground only ---------- */
  const routineStatus = $('#routineStatus');
  const routineList = $('#routineList');
  const routineScene = $('#routineScene');
  function refreshRoutineOptions() {
    routineScene.innerHTML = '<option value="off">Turn lights OFF</option>';
    S.scenes.forEach(sc => { const o=document.createElement('option'); o.value=sc.id; o.textContent=sc.name; routineScene.appendChild(o); });
  }
  function renderRoutines() {
    refreshRoutineOptions();
    $('#routineEnabled').checked = !!S.routineEnabled;
    routineList.innerHTML = '';
    S.routines.forEach((r,i) => {
      const item=document.createElement('div'); item.className='routine-item';
      const label=document.createElement('span');
      const scene=S.scenes.find(sc=>sc.id===r.scene);
      label.textContent = r.time + ' · ' + (r.scene==='off' ? 'Lights OFF' : scene ? scene.name : 'Missing scene');
      const del=document.createElement('button'); del.type='button'; del.className='btn ghost'; del.textContent='Remove';
      del.addEventListener('click',()=>{ S.routines.splice(i,1); save(); renderRoutines(); });
      item.append(label,del); routineList.appendChild(item);
    });
    routineStatus.textContent = S.routineEnabled
      ? 'Enabled. Runs only while the app is open AND the strip is connected. Missed schedules are skipped.'
      : 'Disabled. Existing Sleep Timer and sunset dimming are unchanged.';
  }
  $('#routineEnabled').addEventListener('change', e => { S.routineEnabled = e.target.checked; save(); renderRoutines(); });
  $('#routineAdd').addEventListener('click', () => {
    const time = $('#routineTime').value;
    const scene = routineScene.value;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return toast('Choose a valid time');
    if (S.routines.length >= 12) return toast('Maximum 12 routines');
    if (S.routines.some(r => r.time===time && r.scene===scene)) return toast('Already added');
    S.routines.push({time,scene}); S.routines.sort((a,b)=>a.time.localeCompare(b.time)); save(); renderRoutines(); toast('Routine saved');
  });
  function tickRoutines() {
    if (!S.routineEnabled || !link.ready || document.hidden) return;
    const d = new Date(); const hh = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    const date = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    for (const r of S.routines) {
      const key = date + '|' + r.time + '|' + r.scene;
      if (r.time !== hh || S.routineLast[key]) continue;
      S.routineLast = {[key]:true}; save(); // mark once before acting; never repeat same minute
      if (r.scene === 'off') { setPower(false); renderScenes(); }
      else runSceneId(r.scene);
      toast('Routine: ' + (r.scene==='off' ? 'Lights OFF' : r.scene));
      break;
    }
  }
  setInterval(tickRoutines, 15000);
  renderRoutines();

  const rawIn = $('#rawMode');
  const sendRaw = () => { const id = clamp(Math.round(+rawIn.value || 0), 0, 255); rawIn.value = id; stopDriver(); activeMode = id; activeScene = null; setNative('mode', id); link.cancel(['color']); link.send(P.mode(id), 'mode'); renderModes(); renderScenes(); toast('Sent mode ' + id + (P.modeName(id) ? ': ' + P.modeName(id) : ' (not in the Magic Lantern list)')); };
  $('#rawGo').addEventListener('click', sendRaw);
  const nativeSel = $('#nativeSel');
  Object.keys(P.NATIVE_SCENES).forEach((k) => {
    const o = document.createElement('option'); o.value = k; o.textContent = k + ' · ' + P.NATIVE_SCENES[k]; nativeSel.appendChild(o);
  });
  if (S.nativeLast) nativeSel.value = String(S.nativeLast);
  $('#nativeGo').addEventListener('click', () => sendNativeScene(+nativeSel.value));
  $('#rawNext').addEventListener('click', () => { rawIn.value = clamp((+rawIn.value || 0) + 1, 0, 255); sendRaw(); });

  $('#showAll').checked = !!S.showAll;
  $('#showAll').addEventListener('change', (e) => { S.showAll = e.target.checked; save(); });
  $('#demoBtn').addEventListener('click', () => { if (link.state === 'connected') link.disconnect(); link.startDemo(); toast('Demo strip on. Nothing is sent over Bluetooth.'); });

  $('#expBtn').addEventListener('click', () => { $('#backup').value = JSON.stringify(S); toast('Copy the text below to keep a backup'); });
  $('#impBtn').addEventListener('click', () => {
    try {
      const o = JSON.parse($('#backup').value);
      if (typeof o !== 'object' || !o || Array.isArray(o)) throw new Error('bad');
      const clean = Melk.sceneDna.sanitizeSettings(o, DEF);
      const wasDev = S.devUnlocked;
      S = Object.assign({}, JSON.parse(JSON.stringify(DEF)), clean.settings); S.native = null; S.lastFail = null; S.devUnlocked = wasDev;   // a backup never turns developer options on or off
      if (!Array.isArray(S.seqs)) S.seqs = AMBIENT().concat(PRESET_SEQS());
      if (!Array.isArray(S.scenes)) S.scenes = DEFAULT_SCENES();
      normaliseState(); refreshDev();
      save(); stopDriver(); renderAll();
      toast(clean.dropped.length ? 'Settings imported. ' + clean.dropped.length + ' unknown or invalid item' + (clean.dropped.length === 1 ? '' : 's') + ' ignored.' : 'Settings imported');
    } catch (e) { toast('That text is not valid settings'); }
  });

  const logLines = [];
  link.addEventListener('tx', (e) => {
    logLines.unshift(e.detail); logLines.length = Math.min(logLines.length, 10);
    $('#log').textContent = logLines.join('\n');
  });
  function friendlyError(err) {
    const msg = String((err && err.message) || err || ''), code = err && err.code;
    if (code === 'BT_OFF' || /bluetooth.*(off|disabled)|not enabled/i.test(msg)) return 'Bluetooth is off. Turn it on and try again.';
    if (code === 'NO_SERVICE') return 'That device is not a MELK controller (no FFF0 service).';
    if (code === 'BUSY') return 'Still connecting. Please wait a moment.';
    if (/permission|denied|not authori[sz]ed/i.test(msg)) return 'Allow Nearby devices (and Location on older Android) for MELK Studio in Android settings.';
    if (/time ?out|not found|no device|could not connect|failed to connect|gatt|disconnect/i.test(msg)) return 'Could not reach the strip. Power it on, move closer, and close other apps connected to it, such as Magic Lantern.';
    return msg || 'unknown error';
  }
  function noteFail(text) { S.lastFail = { msg: text, at: Date.now() }; save(); renderController(); }
  let writeToastAt = 0;
  link.addEventListener('error', (e) => {            // rate limited so a dead link cannot spam toasts
    const now = Date.now(); if (now - writeToastAt < 4000) return; writeToastAt = now;
    const m = 'Write failed: ' + (e.detail && e.detail.message || 'unknown error'); toast(m); noteFail(m);
  });
  link.addEventListener('recovering', () => toast('Strip stopped answering. Reconnecting…'));
  link.addEventListener('lost', () => { toast('Could not reconnect. Tap Connect strip.'); noteFail('Could not reconnect after the link dropped.'); });
  link.addEventListener('restored', () => toast('Reconnected'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) link.resume(); });

  /* ---------- connection ---------- */
  let startupDone = false;
  link.addEventListener('state', (e) => {
    const { state, name } = e.detail, chip = $('#btnConn');
    chip.dataset.s = state;
    $('#connLabel').textContent = state === 'connected' ? name : state === 'demo' ? 'Demo strip' : state === 'connecting' ? (link.reconnecting ? 'Reconnecting…' : 'Connecting…') : 'Connect strip';
    if (link.ready) {
      const plan = Melk.syncPolicy.planConnectSync({ on: S.on, native: S.native, activeMode, hasDriver: !!driver, auto: S.auto, pendingScene: !!pendingScene, preserveHardware: !!S.preserveHardware });
      sentBr = S.br;
      if (plan.power) link.send(powerPacket(S.on), 'power');
      if (plan.brightness) pushBright();
      if (plan.mode) { link.send(P.mode(activeMode), 'mode'); link.send(P.speed(S.speed), 'speed'); }
      if (plan.colour) pushColor();
      if (plan.reason === 'native-effect-running') toast('Connected. The effect keeps running on the strip.');
      else if (plan.reason === 'preserve-hardware') toast('Connected: keeping controller effect');
      sunCheck();
      if (pendingScene) { const id = pendingScene; pendingScene = null; setTimeout(() => runSceneId(id), 700); }
      if (S.auto) { lastAuto = null; setTimeout(() => runAuto(true), 600); }
      if (!startupDone) {
        startupDone = true;
        const su = veh().startup;
        if (su && su !== 'keep' && !S.auto && !pendingScene) { const sc = S.scenes.find((x) => x.id === su); if (sc) setTimeout(() => applyScene(sc), 900); }
      }
    }
    renderController(); renderBanner();
  });
  $('#btnConn').addEventListener('click', async () => {
    if (link.state === 'connected' || link.state === 'demo') return link.disconnect();
    if (link.state === 'connecting' && !link.reconnecting) return;   // native: a tap during auto-reconnect starts a fresh connect
    if (!link.supported) { link.startDemo(); return toast('No Web Bluetooth here. Demo mode is on.'); }
    try { await link.connect(S.showAll); toast('Connected to ' + link.name); }
    catch (err) { if (err && err.name !== 'NotFoundError') { const m = friendlyError(err); toast(m); noteFail(m); } }
  });

  /* ---------- tabs ---------- */
  function showTab(t) {
    if (t === 'fx' && S.driveMode === 'driving') return toast('Browse native scenes while parked.');
    if (t === 'studio') t = 'settings';
    S.tab = t; save(); $('#app').dataset.tab = t;
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    ['color', 'fx', 'music', 'settings'].forEach((n) => { $('#tab-' + n).hidden = n !== t; });
    if (t === 'fx') { fxCat = 'scenes'; fxQuery = ''; $('#fxSearch').value = ''; setSeg('built'); renderModes(); }
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- sub-pages: Settings pages, Experimental Lab, Developer options ---------- */
  let openPageId = null, pageOpener = null;
  const syncInert = () => { $('#app').inert = !!openPageId || !$('#car').hidden; };   // keep keyboard and screen-reader focus inside the open page
  const hidePages = () => { $$('.page').forEach((p) => { p.hidden = true; }); document.body.classList.remove('noscroll'); };
  function openPage(id, fromPop) {
    if ((id === 'rotation' || id === 'scenes') && S.driveMode === 'driving') return toast('Scene browsing and editing are parked-only.');
    if (id === 'dev' && !S.devUnlocked) return;
    const el = $('#page-' + id); if (!el) return;
    pageOpener = document.activeElement; hidePages(); el.hidden = false; el.scrollTop = 0; openPageId = id;
    document.body.classList.add('noscroll'); syncInert();
    if (id === 'lab') { renderPersistentMapper(); renderHwRainbow(); }
    if (id === 'scenes') renderScenes();
    if (id === 'connection') renderController();
    if (id === 'vehicle') renderVehiclePage();
    if (!fromPop) { try { history.pushState({ melkPage: id }, ''); } catch (e) { /* no history API */ } }
    const b = el.querySelector('[data-back]'); if (b) b.focus({ preventScroll: true });
  }
  function closePage(fromPop) {
    if (!openPageId) return;
    const prev = pageOpener; hidePages(); openPageId = null; syncInert();
    if (!fromPop) { try { if (history.state && history.state.melkPage) history.back(); } catch (e) { /* ignore */ } }
    if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  window.addEventListener('popstate', () => { if (!$('#car').hidden) { $('#car').hidden = true; syncInert(); return; } if (openPageId) closePage(true); });
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openPage(o.dataset.open); return; }
    if (e.target.closest('[data-back]')) closePage(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPageId && !$('#dlg').open && $('#car').hidden) closePage(false); });

  const APP_VER = (window.MelkOta && window.MelkOta.APP_VERSION) || '1.1.7';
  $('#aboutText').textContent = 'Version ' + APP_VER;
  let aboutTaps = 0, aboutAt = 0;
  function refreshDev() {
    $('#rowDev').hidden = !S.devUnlocked;
    $('#aboutHint').textContent = S.devUnlocked ? 'Developer options are on.' : 'Independent app. Not affiliated with any LED strip maker.';
  }
  $('#aboutVersion').addEventListener('click', () => {
    if (S.devUnlocked) return toast('Developer options are already on.');
    const now = Date.now(); if (now - aboutAt > 2500) aboutTaps = 0; aboutAt = now; aboutTaps++;
    if (aboutTaps >= 7) { S.devUnlocked = true; save(); refreshDev(); aboutTaps = 0; toast('Developer options are on. Find them in Settings.'); }
    else if (aboutTaps >= 3) toast((7 - aboutTaps) + ' more taps for developer options');
  });
  $('#devHide').addEventListener('click', () => { S.devUnlocked = false; save(); refreshDev(); closePage(false); toast('Developer options hidden'); });
  // One parking confirmation, mirrored between the Lab and Protocol Lab checkboxes.
  $('#labConfirm').addEventListener('change', (e) => { $('#labConfirm2').checked = e.target.checked; });
  $('#labConfirm2').addEventListener('change', (e) => { $('#labConfirm').checked = e.target.checked; });
  /* One description of the connection. The top chip, the banner, the Connection page and the Settings row all use it, so they always agree. */
  function connView() {
    const st = link.state, name = link.name || 'LED strip';
    if (st === 'connected') return { state: st, title: name, sub: 'Connected', action: 'Disconnect', busy: false, banner: false, nav: name + ' · connected' };
    if (st === 'demo') return { state: st, title: 'Demo strip', sub: 'Nothing is sent to a strip', action: 'Stop demo', busy: false, banner: false, nav: 'Demo strip' };
    if (st === 'connecting') { const t = link.reconnecting ? 'Reconnecting…' : 'Connecting…'; return { state: st, title: t, sub: 'Please wait', action: t, busy: !link.reconnecting, banner: false, nav: t }; }
    return { state: 'idle', title: 'Not connected', sub: 'Power the strip on, then connect.', action: 'Connect strip', busy: false, banner: true, nav: 'Not connected' };
  }
  function renderBanner() {
    const v = connView(), set = (id, t) => { const e = $('#' + id); if (e) e.textContent = t; };
    const b = $('#connBanner'); if (b) b.hidden = !v.banner;
    const card = $('#connPageCard'); if (card) card.dataset.s = v.state;
    set('connPageLabel', v.title); set('connPageSub', v.sub); set('connPageBtn', v.action); set('navConnSub', v.nav);
    const btn = $('#connPageBtn'); if (btn) btn.disabled = v.busy;
  }
  $('#connBannerBtn').addEventListener('click', () => $('#btnConn').click());
  $('#connPageBtn').addEventListener('click', () => $('#btnConn').click());

  /* ---------- scenes: one tap sets everything for a situation ---------- */
  function sendNativeScene(id) {
    if (!P.NATIVE_SCENES[id] || !link.ready) { toast('Connect the strip first.'); return false; }
    if (S.driveMode === 'driving') return toast('Hardware effects are parked-only. Switch Car mode to Parked first.');
    stopDriver(); cancelRamp(); cancelFade(); setSleep(0);
    activeMode = null; activeScene = null;
    S.nativeLast = id; setNative('scene', id);
    S.smartScenes = Melk.smartScenes.preferences(S.smartScenes); S.smartScenes.recent = [id, ...S.smartScenes.recent.filter(x => x !== id)].slice(0, 8); save();
    if (!S.on) setPower(true);
    link.cancel(['color']);
    link.send(P.scene(id), 'scene');
    renderModes(); renderScenes(); render();
    if (!rotationSending) toast('Native scene: ' + P.NATIVE_SCENES[id]);
    return true;
  }

  function applyScene(sc, opts) {
    opts = opts || {};
    if (S.driveMode === 'driving' && !isDriveSafe(sc)) return toast('Parked-only effect. Switch Car mode to Parked first.');
    noteRecent(sc.id);
    if (Number.isInteger(sc.nativeScene) && P.NATIVE_SCENES[sc.nativeScene]) {
      sendNativeScene(sc.nativeScene);
      activeScene = sc.id; renderScenes(); save();
      return;
    }
    // Hardware mapping is opt-in. It plays the selected controller-native animation,
    // NOT the original app-generated scene animation. No timers/RGB writes are started.
    if (Number.isInteger(sc.hardwareMode) && P.isKnownMode(sc.hardwareMode)) {
      if (!S.on) setPower(true);
      stopDriver(); cancelRamp(); clearInterval(fadeT); fadeT = null;
      setSleep(0);
      activeMode = sc.hardwareMode; activeScene = sc.id; curSeqId = null;
      S.lastHardwareMode = activeMode; setNative('mode', activeMode);
      link.cancel(['color']);
      link.send(P.mode(activeMode), 'mode');
      link.send(P.speed(S.speed), 'speed');
      renderModes(); render(); renderScenes();
      toast(sc.name + ': hardware mode ' + activeMode);
      return;
    }
    if (!S.on) setPower(true);
    S.br = driveBr(sc.br); rampBright(S.br, S.fadeMs);
    if (!opts.noTimer) setSleep(sc.sleep || 0);
    if (sc.type === 'color') {
      const c = hex2rgb(sc.color); const hs = rgb2hsv(c[0], c[1], c[2]);
      stopDriver(); activeMode = null; renderModes(); S.h = hs[0]; S.s = hs[1]; fadeColor(curRGB(), S.fadeMs); render();
    } else if (sc.type === 'white') {
      stopDriver(); activeMode = null; renderModes(); S.warm = sc.warm; $('#warm').value = sc.warm;
      clearNative(); link.cancel(['color']); link.send(P.whiteTemp(100 - sc.warm, sc.warm), 'white');
      paint(sc.warm < 50 ? [255, 190, 120] : [200, 220, 255], S.br / 100); render();
    } else if (sc.type === 'seq') {
      const q = S.seqs.find((x) => x.id === sc.seq);
      if (!q) return toast('The effect for this scene was deleted');
      playSeq(q);
    } else if (sc.type === 'mode') {
      runMode(sc.mode);
    } else if (sc.type === 'music') {
      S.musicStyle = sc.style || 'pulse';
      $$('[data-ms]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.ms === S.musicStyle)));
      startMusic();
    }
    activeScene = sc.id; render(); renderScenes(); save();
  }
  // Optional hardware pattern shuffle; standard time-of-day Auto remains the default.
  let lastAutoMode = null, autoModeAt = 0;
  function runAutoModes(force) {
    if (!S.auto || !S.on || S.autoStyle !== 'modes' || !link.ready) return;
    const now = Date.now();
    if (!force && now - autoModeAt < S.autoInterval * 1000) return;
    const favorites = Object.keys(S.modeFav).filter(k => S.modeFav[k] && P.isKnownMode(+k)).map(Number);
    const pool = favorites.length ? favorites : Array.from({length:P.MODE_LAST-P.MODE_FIRST+1}, (_,i)=>P.MODE_FIRST+i);
    const choices = pool.filter(x=>x !== lastAutoMode);
    const selected = (choices.length ? choices : pool)[Math.floor(Math.random()*(choices.length || pool.length))];
    stopDriver(); activeMode = selected; lastAutoMode = selected; autoModeAt = now;
    S.lastHardwareMode = selected; save();
    link.send(P.mode(selected), 'mode'); link.send(P.speed(S.speed), 'speed');
    renderModes(); render(); toast('Smart Auto: ' + modeLabel(selected));
  }
  const autoId = () => { const h = new Date().getHours(); return h >= 6 && h < 9 ? 'morning' : h >= 9 && h < 17 ? 'focus' : h >= 17 && h < 20 ? 'dinner' : h >= 20 && h < 23 ? 'relax' : 'sleep'; };
  let lastAuto = null;
  function runAuto(force) {
    if (!S.auto || !S.on || !link.ready) return;
    if (S.autoStyle === 'modes') return runAutoModes(force);
    const id = autoId(); if (id === lastAuto && !force) return;
    const sc = S.scenes.find((x) => x.id === id); if (!sc) return;
    lastAuto = id; applyScene(sc, { noTimer: true }); toast('Auto: ' + sc.name);
  }
  setInterval(() => runAuto(false), 5000);
  $('#autoStyle').value = S.autoStyle;
  $('#autoStyle').addEventListener('change',e=>{ S.autoStyle=e.target.value; lastAuto=null; autoModeAt=0; save(); if(S.auto)runAuto(true); });
  $('#autoInterval').value = S.autoInterval;
  $('#autoIntervalOut').textContent = S.autoInterval + ' s';
  $('#autoInterval').addEventListener('input',e=>{S.autoInterval=+e.target.value;$('#autoIntervalOut').textContent=S.autoInterval+' s';save();});
  $('#preserveHardware').checked = !!S.preserveHardware;
  $('#preserveHardware').addEventListener('change',e=>{S.preserveHardware=e.target.checked;save();});

  function mapSceneHardware(sc) {
    const options = modeOptionIds(sc.hardwareMode);
    openDialog(`<h3>${esc(sc.name)}: Hardware mode</h3>
      <p class="hint">Link this scene to a controller-native animation. The original Candle/Party/Sleep animation is NOT copied to controller memory. The chosen numbered mode replaces that scene while linked.</p>
      <label class="field"><span>Controller pattern</span><select id="sceneHardware" class="text">
        <option value="">Original phone-driven scene (default)</option>
        ${options.map(id => `<option value="${id}" ${sc.hardwareMode === id ? 'selected' : ''}>${id} — ${esc(modeLabel(id))}${S.modePersistent[id] ? ' (offline-tested)' : ' (untested)'}</option>`).join('')}
      </select></label>
      <p class="hint">Start with tested Mode 128. After choosing another mode, close the app and power cycle the strip to confirm persistence. Smart Auto switching still needs the app connected.</p>
      <div class="dlgActs"><button class="btn ghost" value="cancel">Cancel</button><button class="btn main" type="button" id="saveSceneHardware">Save mapping</button></div>`, f => {
        f.querySelector('#saveSceneHardware').addEventListener('click', () => {
          const chosen = f.querySelector('#sceneHardware').value;
          if (chosen) sc.hardwareMode = Number(chosen);
          else delete sc.hardwareMode;
          save(); closeDialog(); renderScenes();
          toast(chosen ? sc.name + ' linked to Mode ' + chosen : sc.name + ': original mode restored');
        });
      });
  }
  /* ---------- scene helpers ---------- */
  const veh = () => S.vehicles.find((v) => v.id === S.vehicleId) || S.vehicles[0];
  const driveBr = (v) => (S.driveMode === 'driving' ? Math.min(v, veh().cap) : v);
  const seqCalm = (q) => !!q && Array.isArray(q.steps) && q.steps.length > 0 && q.steps.every((s) => (s.fade + s.hold) / (q.speed || 1) >= 1500);
  function isDriveSafe(sc) {
    if (!sc) return false;
    if (Number.isInteger(sc.nativeScene) || Number.isInteger(sc.hardwareMode)) return false;   // hardware effects: speed is unknown
    if (sc.type === 'music' || sc.type === 'mode') return false;
    if (sc.type === 'seq') return seqCalm(S.seqs.find((x) => x.id === sc.seq));
    return true;                                                                              // static colour or white
  }
  function noteRecent(id) { S.recent = [id].concat(S.recent.filter((x) => x !== id)).slice(0, 5); save(); }
  const isFav = (id) => S.favScenes.includes(id);
  function toggleFav(id) { S.favScenes = isFav(id) ? S.favScenes.filter((x) => x !== id) : S.favScenes.concat(id); save(); renderScenes(); }
  function sceneKind(sc) {
    if (Number.isInteger(sc.nativeScene)) return 'Hardware scene ' + sc.nativeScene + ' · ' + (hwStatus('scene:' + sc.nativeScene) === 'VERIFIED_SUPPORTED' ? 'verified' : 'not verified');
    if (Number.isInteger(sc.hardwareMode)) return 'Hardware mode ' + sc.hardwareMode + ' · ' + (S.modePersistent[sc.hardwareMode] || hwStatus('mode:' + sc.hardwareMode) === 'VERIFIED_SUPPORTED' ? 'verified' : 'not verified');
    if (sc.type === 'music') return 'Music · needs the app open';
    if (sc.type === 'seq') return 'Phone effect';
    if (sc.type === 'white') return 'White light';
    return 'Static colour';
  }
  function scenePreview(sc) {
    if (Number.isInteger(sc.nativeScene) || Number.isInteger(sc.hardwareMode) || sc.type === 'mode') return 'repeating-linear-gradient(90deg,#ff4d6d 0 10px,#ffb347 10px 20px,#2ec4b6 20px 30px,#7c5cff 30px 40px)';
    if (sc.type === 'music') return 'linear-gradient(90deg,#53d8a0,#f2b544,#ff7d7d)';
    if (sc.type === 'white') return 'linear-gradient(90deg,#ffa24a,#fff1e0 50%,#bcd8ff)';
    if (sc.type === 'seq') { const q = S.seqs.find((x) => x.id === sc.seq); if (q && q.steps.length) return q.steps.length === 1 ? q.steps[0].c : 'linear-gradient(90deg,' + q.steps.slice(0, 8).map((s) => s.c).join(',') + ')'; }
    return sc.color || '#FFB347';
  }
  function renderScenes() {
    renderCar();
    const box = $('#scenes'); if (!box) return; box.innerHTML = '';
    S.smartScenes = Melk.smartScenes.preferences(S.smartScenes);
    const addQuick = (text, fn, disabled) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'scene quickScene'; b.textContent = text; b.disabled = !!disabled; b.addEventListener('click', fn); box.appendChild(b); };
    const driving = S.driveMode === 'driving';
    addQuick(rotation && rotation.snapshot().running ? 'Auto · Running' : 'Auto', () => openPage('rotation'), driving);
    for (let i = 0; i < 4; i++) { const id = S.smartScenes.quick[i]; addQuick(id ? P.NATIVE_SCENES[id] : '+ Add scene', () => id ? (S.auto = false, sendNativeScene(id)) : editQuickScenes(), driving); }
    addQuick('All 28', () => showTab('fx'), driving);
    const edit = $('#quickEdit'); if (edit) edit.disabled = driving;
    const recent = $('#nativeRecent'); if (recent) { recent.innerHTML = ''; S.smartScenes.recent.forEach(id => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost sm'; b.textContent = P.NATIVE_SCENES[id]; b.disabled = driving; b.addEventListener('click', () => { S.auto = false; sendNativeScene(id); }); recent.appendChild(b); }); recent.parentElement.hidden = !S.smartScenes.recent.length; }
    // Recent
    const rec = $('#recentList');
    if (rec) {
      rec.innerHTML = '';
      const items = S.recent.map((id) => S.scenes.find((x) => x.id === id)).filter(Boolean);
      const wrap = $('#recentWrap'); if (wrap) wrap.hidden = !items.length;
      items.forEach((sc) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'scene'; b.textContent = sc.name; b.style.setProperty('--sp', scenePreview(sc)); b.addEventListener('click', () => { S.auto = false; applyScene(sc); }); rec.appendChild(b); });
    }
    // All scenes
    const list = $('#sceneList'); if (!list) return; list.innerHTML = '';
    S.scenes.forEach((sc, i) => {
      const r = document.createElement('div'); r.className = 'sceneRow';
      r.innerHTML = '<div class="srTop"><span class="srPrev" style="background:' + esc(scenePreview(sc)) + '"></span><div class="srName"><b>' + esc(sc.name) + '</b><small>' + esc(sceneKind(sc)) + (isDriveSafe(sc) ? '' : ' · parked only') + '</small></div>' +
        '<button type="button" class="fav' + (isFav(sc.id) ? ' starOn' : '') + '" aria-pressed="' + isFav(sc.id) + '" aria-label="' + (isFav(sc.id) ? 'Remove ' : 'Add ') + esc(sc.name) + ' favourite">' + (isFav(sc.id) ? '★' : '☆') + '</button></div>' +
        '<details class="srMore"><summary>More</summary><div class="srActs">' +
        '<button type="button" class="share" aria-label="Share ' + esc(sc.name) + '">Share</button>' +
        '<button type="button" class="lnk" aria-label="Copy shortcut link for ' + esc(sc.name) + '">Link</button>' +
        '<button type="button" class="map" aria-label="Map ' + esc(sc.name) + ' to a hardware mode">Hardware</button>' +
        '<button type="button" class="del" aria-label="Delete ' + esc(sc.name) + '">Delete</button></div></details>';
      const play = document.createElement('button'); play.type = 'button'; play.className = 'btn ghost customPlay'; play.textContent = 'Play custom scene'; play.addEventListener('click', () => { S.auto = false; applyScene(sc); }); r.querySelector('.srTop').appendChild(play);
      r.querySelector('.fav').addEventListener('click', () => toggleFav(sc.id));
      r.querySelector('.share').addEventListener('click', () => shareScene(sc));
      r.querySelector('.map').addEventListener('click', () => mapSceneHardware(sc));
      r.querySelector('.del').addEventListener('click', () => { S.scenes.splice(i, 1); S.favScenes = S.favScenes.filter((x) => x !== sc.id); S.recent = S.recent.filter((x) => x !== sc.id); save(); renderScenes(); });
      r.querySelector('.lnk').addEventListener('click', () => {
        const url = location.href.split('#')[0] + '#scene=' + sc.id;
        const fallback = () => openDialog('<h3>Shortcut link</h3><textarea class="text area" readonly rows="3" aria-label="Shortcut link">' + esc(url) + '</textarea><div class="dlgActs"><button class="btn main" value="cancel">Close</button></div>');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Link copied. Open it in Chrome and add it to your home screen.'), fallback); else fallback();
      });
      list.appendChild(r);
    });
    renderNavSubs();
  }
  function renderNavSubs() {
    const v = $('#navVehicleSub'); if (v) v.textContent = veh().name + ' · ' + (S.driveMode === 'driving' ? 'Driving' : 'Parked');
    const u = $('#navUpdateSub'); if (u) u.textContent = 'Version ' + ((window.MelkOta && window.MelkOta.APP_VERSION) || '1.1.7');
  }

  /* ---------- Scene DNA: share and import ---------- */
  const dnaCtx = () => ({ seqs: S.seqs, status: (kind, id) => hwStatus(kind + ':' + id), isVerified: (kind, id) => hwStatus(kind + ':' + id) === 'VERIFIED_SUPPORTED' });
  function shareScene(sc) {
    const r = Melk.sceneDna.exportScene(sc, dnaCtx());
    if (!r.ok) return toast(r.error);
    const text = JSON.stringify(r.data, null, 1);
    openDialog('<h3>Share ' + esc(sc.name) + '</h3><p class="hint">Paste this into Scenes, Import scene on another phone. ' + (r.data.type === 'hardware' ? 'A hardware effect is only used on strips where the other person has verified it. Otherwise they get the static colour.' : '') + '</p><textarea class="text area" readonly name="t" rows="9" aria-label="Scene text to copy">' + esc(text) + '</textarea><div class="dlgActs"><button class="btn ghost" value="cancel">Close</button><button class="btn main" type="button" id="okBtn">Copy</button></div>',
      (f) => f.querySelector('#okBtn').addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Scene copied'), () => { f.t.select(); toast('Select the text and copy it'); }); else { f.t.select(); toast('Select the text and copy it'); }
      }));
  }
  function importSceneDialog() {
    openDialog('<h3>Import scene</h3><p class="hint">Paste a scene shared from MELK Studio. It is checked first, and unknown or unsafe parts are rejected.</p><textarea class="text area" name="t" rows="8" spellcheck="false" aria-label="Shared scene text" placeholder="Paste the shared scene here"></textarea><p class="hint" id="impMsg" role="alert"></p><div class="dlgActs"><button class="btn ghost" type="button" id="impCancel">Cancel</button><button class="btn main" type="button" id="okBtn" data-primary>Check and add</button></div>',
      (f) => {
        f.querySelector('#impCancel').addEventListener('click', closeDialog);
        f.querySelector('#okBtn').addEventListener('click', () => {
          const msg = f.querySelector('#impMsg'), r = Melk.sceneDna.validateScene(f.t.value, dnaCtx());
          if (!r.ok) { msg.textContent = r.errors.join(' '); return; }
          if (S.scenes.length >= 64) { msg.textContent = 'You already have 64 scenes. Delete one first.'; return; }
          const sc = Object.assign({ id: 'u' + Date.now() }, r.scene);
          if (r.seq) { const q = { id: 's' + Date.now(), name: r.seq.name, speed: r.seq.speed, steps: r.seq.steps }; S.seqs.push(q); sc.seq = q.id; }
          S.scenes.push(sc); save(); renderScenes(); renderSeqs(); closeDialog();
          toast('Added ' + sc.name + (r.notes.length ? '. ' + r.notes[0] : ''));
        });
      });
  }
  $('#sceneImport').addEventListener('click', importSceneDialog);

  /* ---------- safe offline-tested hardware-to-scene mapper ---------- */
  const mapSceneSelect = $('#persistentScene');
  const mapModeSelect = $('#persistentMode');
  const mapStatus = $('#persistentMapStatus');
  function renderPersistentMapper() {
    const prevScene = mapSceneSelect.value;
    const prevMode = mapModeSelect.value;
    mapSceneSelect.innerHTML = '';
    S.scenes.forEach(sc => {
      const o = document.createElement('option'); o.value = sc.id;
      o.textContent = sc.name + (Number.isInteger(sc.hardwareMode) ? ' → Mode ' + sc.hardwareMode : ' (original)');
      mapSceneSelect.appendChild(o);
    });
    if (S.scenes.some(sc => sc.id === prevScene)) mapSceneSelect.value = prevScene;
    mapModeSelect.innerHTML = '';
    const verified = Object.keys(S.modePersistent || {})
      .filter(k => S.modePersistent[k] && P.isKnownMode(Number(k)))
      .map(Number).sort((a,b)=>a-b);
    verified.forEach(id => {
      const o = document.createElement('option'); o.value = String(id);
      o.textContent = id + ' — ' + modeLabel(id) + ' (offline-tested)';
      mapModeSelect.appendChild(o);
    });
    if (verified.some(id => String(id) === prevMode)) mapModeSelect.value = prevMode;
    mapModeSelect.disabled = !verified.length;
    $('#persistentLink').disabled = !verified.length || !S.scenes.length;
    mapStatus.textContent = verified.length
      ? verified.length + ' offline-tested mode(s). Mapping changes only the chosen scene.'
      : 'No verified hardware modes. Test a numbered mode offline, then mark it via Effects → Built-in → Rename.';
  }
  mapSceneSelect.addEventListener('change', () => {
    const sc = S.scenes.find(q => q.id === mapSceneSelect.value);
    if (sc && Number.isInteger(sc.hardwareMode) && S.modePersistent[sc.hardwareMode])
      mapModeSelect.value = String(sc.hardwareMode);
  });
  $('#persistentLink').addEventListener('click', () => {
    const sc = S.scenes.find(q => q.id === mapSceneSelect.value);
    const id = Number(mapModeSelect.value);
    if (!sc || !S.modePersistent[id] || !P.isKnownMode(id)) {
      mapStatus.textContent = 'Select an offline-tested hardware mode first.'; return;
    }
    if (!confirm(sc.name + ' will now play Mode ' + id + ' instead of its original animation. Save mapping?')) return;
    sc.hardwareMode = id; save(); renderScenes(); renderPersistentMapper();
    mapStatus.textContent = sc.name + ' mapped to hardware Mode ' + id + '. Play it, close the app, and power cycle to test.';
  });
  $('#persistentRestore').addEventListener('click', () => {
    const sc = S.scenes.find(q => q.id === mapSceneSelect.value);
    if (!sc) return;
    delete sc.hardwareMode; save(); renderScenes(); renderPersistentMapper();
    mapStatus.textContent = sc.name + ': original phone-driven scene restored.';
  });
  $('#persistentPlay').addEventListener('click', () => {
    const sc = S.scenes.find(q => q.id === mapSceneSelect.value);
    if (!sc) return;
    if (!link.ready) { mapStatus.textContent = 'Connect the LED strip first.'; return; }
    S.auto = false; applyScene(sc);
    mapStatus.textContent = sc.name + ' playback requested. Verify the physical LED strip.';
  });
  renderPersistentMapper();
  /* ---------- car mode: big targets, very dim screen ---------- */
  const CAR_DEFAULTS = ['c-night', 'c-cruise', 'c-chill', 'party'];
  function setDriveMode(mode) {
    if (S.driveMode === mode) return;
    S.driveMode = mode; save();
    if (mode === 'driving') {
      if (rotation) rotation.stop(); musicSession++; if (window.MelkSmartAudio) MelkSmartAudio.stop();
      // Replace anything moving or hardware-driven with the static colour, and respect the brightness limit.
      const curScene = S.scenes.find((x) => x.id === activeScene);
      if ((driver && driver.label === 'Listening…') || S.native || (curSeqId && !seqCalm(S.seqs.find((x) => x.id === curSeqId))) || (curScene && !isDriveSafe(curScene))) {
        stopDriver(); activeScene = null; setColor(S.h, S.s, true);
        toast('Driving mode: moving effects replaced by your static colour.');
      }
      if (S.br > veh().cap) { S.br = veh().cap; rampBright(S.br, 400); render(); save(); }
    }
    renderCar(); renderNavSubs(); renderScenes();
  }
  function renderCar() {
    const grid = $('#carGrid'); if (!grid) return; grid.innerHTML = '';
    const driving = S.driveMode === 'driving';
    $('#carDriving').setAttribute('aria-pressed', String(driving)); $('#carParked').setAttribute('aria-pressed', String(!driving));
    $('#carHint').textContent = driving ? 'Driving: calm scenes only, brightness limited to ' + veh().cap + '%.' : 'Parked: every effect is available. You choose the mode; nothing is detected.';
    const favs = S.favScenes.map((id) => S.scenes.find((x) => x.id === id)).filter(Boolean);
    const base = favs.length ? favs : CAR_DEFAULTS.map((id) => S.scenes.find((x) => x.id === id)).filter(Boolean);
    const shown = driving ? base.filter(isDriveSafe) : base;
    shown.forEach((sc) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = sc.name; b.setAttribute('aria-pressed', String(activeScene === sc.id && S.on));
      b.addEventListener('click', () => { S.auto = false; applyScene(sc); });
      grid.appendChild(b);
    });
    let starred = [];
    if (!driving) {
      // Starred built-in effects become large quick actions while parked.
      starred = Object.keys(S.modeFav).filter((id) => S.modeFav[id] && P.isKnownMode(+id)).slice(0, 6);
      starred.forEach((id) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = '★ ' + modeLabel(+id);
        b.setAttribute('aria-pressed', String(activeMode === +id && S.on));
        b.addEventListener('click', () => { S.auto = false; runMode(+id); renderCar(); });
        grid.appendChild(b);
      });
    }
    const hidden = base.length - shown.length;
    $('#carFavCount').textContent = driving
      ? (hidden > 0 ? hidden + ' parked-only scene' + (hidden === 1 ? '' : 's') + ' hidden while driving.' : 'All your quick scenes are calm enough for driving.')
      : (favs.length ? 'Your favourite scenes' + (starred.length ? ' and modes.' : '.') : 'Mark scenes as favourites in Settings, Scenes to show them here.');
    if (!shown.length && !starred.length) grid.innerHTML = '<p class="carHint" style="grid-column:1/-1">No calm scenes yet. Mark one as a favourite in Settings, Scenes.</p>';
  }
  function openCar() { $('#car').hidden = false; syncInert(); renderCar(); try { history.pushState({ melkCar: true }, ''); } catch (e) { /* ignore */ } }
  function closeCar() { if ($('#car').hidden) return; $('#car').hidden = true; syncInert(); try { if (history.state && history.state.melkCar) history.back(); } catch (e) { /* ignore */ } }
  $('#btnCar').addEventListener('click', openCar);
  $('#carExit').addEventListener('click', closeCar);
  $('#carDriving').addEventListener('click', () => setDriveMode('driving'));
  $('#carParked').addEventListener('click', () => setDriveMode('parked'));
  $('#vehOpenCar').addEventListener('click', openCar);
  const carStep = (d) => { const max = S.driveMode === 'driving' ? veh().cap : 100; S.br = clamp(S.br + d, 5, max); rampBright(S.br, 300); render(); save(); };
  $('#carUp').addEventListener('click', () => carStep(10));
  $('#carDown').addEventListener('click', () => carStep(-10));
  $('#carOff').addEventListener('click', () => { stopDriver(); activeScene = null; setPower(false); renderScenes(); });

  // Vehicle profiles: a name, a driving brightness limit, and what happens when the strip connects.
  function renderVehiclePage() {
    const sel = $('#vehSel'); sel.innerHTML = '';
    S.vehicles.forEach((v) => { const o = document.createElement('option'); o.value = v.id; o.textContent = v.name; sel.appendChild(o); });
    sel.value = S.vehicleId;
    const v = veh();
    $('#vehName').value = v.name; $('#vehCap').value = v.cap; $('#vehCapOut').textContent = v.cap + '%';
    const su = $('#vehStartup'); su.innerHTML = '';
    const keep = document.createElement('option'); keep.value = 'keep'; keep.textContent = 'Keep what the strip is doing'; su.appendChild(keep);
    S.scenes.forEach((sc) => { const o = document.createElement('option'); o.value = sc.id; o.textContent = 'Play ' + sc.name; su.appendChild(o); });
    su.value = S.scenes.some((x) => x.id === v.startup) ? v.startup : 'keep';
    $('#vehDel').disabled = S.vehicles.length < 2;
  }
  $('#vehSel').addEventListener('change', (e) => { S.vehicleId = e.target.value; save(); renderVehiclePage(); renderNavSubs(); renderCar(); });
  $('#vehName').addEventListener('input', (e) => { const t = e.target.value.replace(/[\u0000-\u001f<>]/g, '').slice(0, 24).trim(); if (t) { veh().name = t; save(); const o = $('#vehSel').selectedOptions[0]; if (o) o.textContent = t; renderNavSubs(); } });
  $('#vehCap').addEventListener('input', (e) => { veh().cap = +e.target.value; $('#vehCapOut').textContent = veh().cap + '%'; save(); renderCar(); });
  $('#vehStartup').addEventListener('change', (e) => { veh().startup = e.target.value; save(); });
  $('#vehNew').addEventListener('click', () => {
    if (S.vehicles.length >= 8) return toast('You can keep up to 8 vehicles.');
    const v = { id: 'v' + Date.now(), name: 'Vehicle ' + (S.vehicles.length + 1), cap: 40, startup: 'keep' };
    S.vehicles.push(v); S.vehicleId = v.id; save(); renderVehiclePage(); renderNavSubs();
  });
  $('#vehDel').addEventListener('click', () => {
    if (S.vehicles.length < 2) return;
    openDialog('<h3>Delete ' + esc(veh().name) + '?</h3><p class="hint">Its brightness limit and start-up choice are removed. Your scenes are not affected.</p><div class="dlgActs"><button class="btn ghost" value="cancel">Cancel</button><button class="btn main" type="button" id="okBtn">Delete</button></div>',
      (f) => f.querySelector('#okBtn').addEventListener('click', () => { S.vehicles = S.vehicles.filter((v) => v.id !== S.vehicleId); S.vehicleId = S.vehicles[0].id; save(); closeDialog(); renderVehiclePage(); renderNavSubs(); renderCar(); }));
  });

  $('#sceneSave').addEventListener('click', () => {
    openDialog(`<h3>Save scene</h3>
      <label class="field"><span>Name</span><input class="text" name="n" maxlength="16" placeholder="Gaming"></label>
      <p class="hint">Saves what the strip is doing now, plus brightness${sleepEnd > Date.now() ? ' and the sleep timer' : ''}.</p>
      <div class="dlgActs"><button class="btn ghost" value="cancel">Cancel</button><button class="btn main" id="okBtn" value="ok">Save</button></div>`,
    (f) => f.querySelector('#okBtn').addEventListener('click', (e) => {
      e.preventDefault();
      const name = f.n.value.trim(); if (!name) return toast('Give the scene a name');
      const sc = { id: 'u' + Date.now(), name, br: S.br };
      if (curSeqId) { sc.type = 'seq'; sc.seq = curSeqId; }
      else if (driver && driver.label === 'Listening…') { sc.type = 'music'; sc.style = S.musicStyle; }
      else if (activeMode !== null) { sc.type = 'mode'; sc.mode = activeMode; }
      else { sc.type = 'color'; sc.color = rgb2hex(...curRGB()); }
      if (sleepEnd > Date.now()) sc.sleep = Math.max(1, Math.round((sleepEnd - Date.now()) / 60000));
      S.scenes.push(sc); save(); renderScenes(); closeDialog(); toast('Saved scene ' + name);
    }));
  });
  $('#sceneReset').addEventListener('click', () => { S.scenes = DEFAULT_SCENES(); save(); renderScenes(); toast('Scenes reset'); });

  /* ---------- sunset dimming ---------- */
  function sunTimes(lat, lon, d) {
    const rad = Math.PI / 180;
    const n = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
    const g = 2 * Math.PI / 365 * (n - 1);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
    const base = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return { rise: new Date(base + (720 - 4 * (lon + ha) - eqt) * 60000), set: new Date(base + (720 - 4 * (lon - ha) - eqt) * 60000) };
  }
  const fmtT = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function sunInfo() {
    const el = $('#sunInfo'); if (!el) return;
    if (S.sunDim && S.geo) { const t = sunTimes(S.geo.lat, S.geo.lon, new Date()); el.textContent = isFinite(t.set) ? 'Sunset ' + fmtT(t.set) + ', sunrise ' + fmtT(t.rise) + ' today.' : 'No sunset today at this location.'; }
    else el.textContent = 'Uses your location once to work out sunset. It stays on your phone.';
  }
  function sunCheck() {
    if (!S.sunDim || !S.geo || !link.ready) return;
    const t = sunTimes(S.geo.lat, S.geo.lon, new Date()), now = Date.now();
    const night = isFinite(t.set) && isFinite(t.rise) ? (now < t.rise.getTime() || now > t.set.getTime()) : false;
    const st = night ? 'night' : 'day';
    if (st === S.sunState) return;
    S.sunState = st;
    if (night) { S.dayBr = S.br; S.br = Math.min(S.br, S.sunCap); } else { S.br = S.dayBr; }
    if (S.on) rampBright(S.br, Math.max(S.fadeMs, 1000) * 2);
    render(); save(); toast(night ? 'Sunset: dimmed to ' + S.br + '%' : 'Daytime: brightness restored');
  }
  setInterval(sunCheck, 2 * 60 * 1000);
  $('#sunDim').addEventListener('change', (e) => {
    S.sunDim = e.target.checked; save();
    if (!S.sunDim) { sunInfo(); return; }
    if (S.geo) { sunInfo(); sunCheck(); return; }
    if (!navigator.geolocation) { toast('This browser has no location'); e.target.checked = S.sunDim = false; return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { S.geo = { lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }; save(); sunInfo(); sunCheck(); },
      () => { toast('Location permission was denied'); e.target.checked = S.sunDim = false; save(); sunInfo(); });
  });
  $('#sunCap').addEventListener('input', (e) => { S.sunCap = +e.target.value; $('#sunCapOut').textContent = S.sunCap + '%'; save(); });

  /* ---------- smooth change setting ---------- */
  $$('#fadeSeg button').forEach((b) => b.addEventListener('click', () => {
    S.fadeMs = +b.dataset.fade; save();
    $$('#fadeSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));

  /* ---------- home screen shortcuts: index.html#scene=<id> ---------- */
  let pendingScene = null;
  function runSceneId(id) {
    if (id === 'off') { setPower(false); renderScenes(); return; }
    const sc = S.scenes.find((x) => x.id === id);
    if (sc) { S.auto = false; applyScene(sc); } else toast('That scene no longer exists');
  }
  function runHash() {
    const m = /scene=([\w-]+)/.exec(location.hash); if (!m) return;
    if (!link.ready) { pendingScene = m[1]; toast('Tap Connect strip to run this scene'); return; }
    runSceneId(m[1]);
  }
  window.addEventListener('hashchange', runHash);

  /* ---------- backup to a file ---------- */
  $('#expFile').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
    a.download = 'melk-studio-settings.json'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Settings saved to a file');
  });
  $('#impFile').addEventListener('click', () => $('#impInput').click());
  $('#impInput').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $('#backup').value = await f.text(); $('#impBtn').click(); e.target.value = '';
  });

  /* ---------- Hardware Rainbow: controller-native candidates with recorded evidence ---------- */
  // These come from Magic Lantern's own lists. None is assumed to work on your controller until you record it.
  const HW_RAINBOW = [
    { key: 'scene:11', type: 'scene', id: 11, label: 'Rainbow', note: 'Magic Lantern scene 11' },
    { key: 'mode:103', type: 'mode', id: 103, label: '7-Color Running', note: 'Magic Lantern mode 103' },
    { key: 'mode:105', type: 'mode', id: 105, label: 'R-G-B Running', note: 'Magic Lantern mode 105' },
    { key: 'mode:129', type: 'mode', id: 129, label: '7-Color in Red Running', note: 'Magic Lantern mode 129' },
  ];
  const vget = (key) => (S.verify && S.verify[key]) || {};
  function hwStatus(key) {
    const v = vget(key);
    if (v.moves === false) return 'UNSUPPORTED';
    if (v.moves === true && v.appClose === true) return 'VERIFIED_SUPPORTED';
    return 'UNVERIFIED';
  }
  function vset(key, field, val) {
    S.verify = S.verify || {};
    const v = S.verify[key] = S.verify[key] || {};
    if (val === null) delete v[field]; else v[field] = val;
    v.at = new Date().toISOString().slice(0, 10); save();
  }
  function runHwEffect(c) {
    if (!link.ready) return toast('Connect the strip first.');
    if (c.type === 'scene') sendNativeScene(c.id); else runMode(c.id);
  }
  function addHwScene(c) {
    const id = 'hw-rainbow-' + c.key.replace(':', '-');
    if (S.scenes.some((x) => x.id === id)) return toast('Already in your scenes');
    const sc = { id, name: 'Rainbow (hardware)', type: 'color', color: '#FF0000', br: S.br };
    if (c.type === 'scene') sc.nativeScene = c.id; else sc.hardwareMode = c.id;
    S.scenes.push(sc); save(); renderScenes(); toast('Added to your scenes');
  }
  const TRI = [['', 'Untested'], ['yes', 'Yes'], ['no', 'No']];
  const rbOpen = new Set([HW_RAINBOW[0].key]);   // which candidate cards are expanded
  const triVal = (v) => (v === true ? 'yes' : v === false ? 'no' : '');
  function renderHwRainbow(focusKey) {
    const box = $('#hwRbList'); if (!box) return; box.innerHTML = '';
    const states = HW_RAINBOW.map((c) => hwStatus(c.key));
    const overall = states.includes('VERIFIED_SUPPORTED') ? 'VERIFIED_SUPPORTED' : states.every((x) => x === 'UNSUPPORTED') ? 'UNSUPPORTED' : 'UNVERIFIED';
    const tested = HW_RAINBOW.filter((c) => vget(c.key).moves !== undefined).length;
    ['hwRbStatus', 'fxRbStatus'].forEach((id) => { const b = $('#' + id); if (b) { b.textContent = overall; b.dataset.s = overall; } });
    const txt = overall === 'VERIFIED_SUPPORTED' ? 'Confirmed on your strip' : overall === 'UNSUPPORTED' ? 'No candidate moves' : tested ? tested + ' of ' + HW_RAINBOW.length + ' tested' : 'Not tested yet';
    const ft = $('#fxRbText'); if (ft) ft.textContent = txt;
    $('#hwRbBar').style.width = Math.round(100 * tested / HW_RAINBOW.length) + '%';
    $('#hwRbCount').textContent = tested + ' of ' + HW_RAINBOW.length + ' candidates tested';
    $('#hwRbHint').textContent = overall === 'VERIFIED_SUPPORTED'
      ? 'Confirmed. Add it as a scene to use it with one tap.'
      : 'Run a candidate, watch the strip, close the app, then record what you saw.';
    HW_RAINBOW.forEach((c, i) => {
      const st = states[i], v = vget(c.key);
      const done = ['moves', 'appClose', 'powerCycle'].filter((f) => v[f] !== undefined).length;
      const card = document.createElement('details'); card.className = 'rb'; card.dataset.s = st; card.dataset.key = c.key; card.open = rbOpen.has(c.key);
      const steps = [['moves', 'Moves along the strip'], ['appClose', 'Still moving after the app is closed'], ['powerCycle', 'Comes back after power off and on']];
      card.innerHTML = '<summary class="rbHead"><span class="rbTitle"><b>' + esc(c.label) + '</b><small>' + esc(c.note) + ' · ' + done + ' of 3 recorded</small></span><span class="badge" data-s="' + st + '">' + st + '</span></summary>' +
        '<div class="rbBody"><div class="rbActs"><button class="btn main" data-run type="button">Run on strip</button>' + (st === 'VERIFIED_SUPPORTED' ? '<button class="btn ghost" data-add type="button">Add as scene</button>' : '') + '</div>' +
        '<div class="rbSteps">' + steps.map(([f, label]) => '<div class="tri"><span>' + label + '</span><div class="seg" role="group" aria-label="' + esc(c.label + ': ' + label) + '">' +
          TRI.map(([val, name]) => '<button type="button" data-f="' + f + '" data-v="' + val + '" aria-pressed="' + (triVal(v[f]) === val) + '">' + name + '</button>').join('') + '</div></div>').join('') + '</div></div>';
      card.addEventListener('toggle', () => { if (card.open) rbOpen.add(c.key); else rbOpen.delete(c.key); });
      card.querySelector('[data-run]').addEventListener('click', () => runHwEffect(c));
      card.querySelectorAll('.tri button').forEach((b) => b.addEventListener('click', () => {
        vset(c.key, b.dataset.f, b.dataset.v === 'yes' ? true : b.dataset.v === 'no' ? false : null);
        renderHwRainbow(c.key + '|' + b.dataset.f + '|' + b.dataset.v);
      }));
      const add = card.querySelector('[data-add]'); if (add) add.addEventListener('click', () => addHwScene(c));
      box.appendChild(card);
    });
    if (focusKey) { const [k, f, v] = focusKey.split('|'); const el = box.querySelector('.rb[data-key="' + k + '"] [data-f="' + f + '"][data-v="' + v + '"]'); if (el) el.focus({ preventScroll: true }); }
  }
  $('#hwRbStatic').addEventListener('click', () => { setColor(S.h, S.s, true); toast('Back to your static colour'); });

  /* ---------- Controller card: what is connected and what is actually known ---------- */
  function renderController() {
    const box = $('#ctrlInfo'); if (!box) return;
    const info = link.info, name = link.name || '';
    const mark = (v) => (v === true ? 'yes' : v === false ? 'no' : 'unknown');
    const nameOk = /^MELK/i.test(name);
    const rows = [['Connection', link.state === 'connected' ? 'Connected' : link.state === 'demo' ? 'Demo strip' : link.state === 'connecting' ? (link.reconnecting ? 'Reconnecting' : 'Connecting') : 'Not connected'],
      ['Device', name || 'none']];
    let profile = 'Not matched yet';
    if (info) {
      const fff3 = info.fff3 ? (info.fff3.writeWithoutResponse ? 'write without response' : info.fff3.write ? 'write' : 'not writable') : 'missing';
      rows.push(['FFF0 service', mark(info.fff0)], ['FFF3 commands', fff3], ['FFF4 notifications', info.fff4 ? (info.fff4.notify ? 'notify' : 'present') : 'not listed']);
      if (info.warn && info.warn.length) rows.push(['Warnings', info.warn.join('; ')]);
      profile = (nameOk && info.fff0 && info.fff3) ? 'MELK FFF0 family' : info.fff0 ? 'FFF0 controller, name not MELK: commands may differ' : 'Not matched';
    } else if (link.state === 'connected') profile = nameOk ? 'MELK name only (service details need the Android app)' : 'Not matched';
    rows.push(['Profile', profile]);
    if (profile === 'MELK FFF0 family') rows.push(['Matched on', 'name, service and characteristic']);
    rows.push(['Colour, brightness, power', 'Works on your strip']);
    rows.push(['Native modes 128-155', 'You reported they keep running after app close']);
    rows.push(['Hardware Rainbow', HW_RAINBOW.some((c) => hwStatus(c.key) === 'VERIFIED_SUPPORTED') ? 'VERIFIED_SUPPORTED (you confirmed)' : 'HARDWARE_PENDING']);
    rows.push(['Separate door and dash zones', 'Not verified, not offered']);
    rows.push(['Effect now', S.native ? (S.native.kind === 'scene' ? 'Hardware scene ' + S.native.id + ' (' + (P.NATIVE_SCENES[S.native.id] || '?') + ')' : 'Hardware mode ' + S.native.id + ' (' + (P.modeName(S.native.id) || '?') + ')') : (driver ? 'Phone-driven: ' + driver.label : 'Static colour')]);
    if (S.lastFail) rows.push(['Last problem', S.lastFail.msg]);
    // "Connection" and "Device" are shown by the status card above; services and capability statements are technical.
    const TECH = ['FFF0 service', 'FFF3 commands', 'FFF4 notifications', 'Colour, brightness, power', 'Native modes 128-155', 'Hardware Rainbow', 'Separate door and dash zones', 'Matched on'];
    const fmt = (list) => list.map((r) => '<div class="kv"><span>' + esc(r[0]) + '</span><strong>' + esc(r[1]) + '</strong></div>').join('');
    box.innerHTML = fmt(rows.filter((r) => r[0] !== 'Connection' && r[0] !== 'Device' && !TECH.includes(r[0])));
    const tb = $('#ctrlTech'); if (tb) tb.innerHTML = fmt(rows.filter((r) => TECH.includes(r[0])));
  }

  function renderAll() {
    $('#sp').value = S.speed; $('#spOut').textContent = S.speed + '%'; $('#sen').value = S.sens; $('#senOut').textContent = S.sens + '%';
    $('#warm').value = S.warm; $('#flowSec').value = S.flowSec; $('#flowOut').textContent = fmtSec(S.flowSec); $('#showAll').checked = !!S.showAll;
    $$('#fadeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.fade === S.fadeMs)));
    $('#sunDim').checked = !!S.sunDim; $('#sunCap').value = S.sunCap; $('#sunCapOut').textContent = S.sunCap + '%'; sunInfo();
    renderPalette(); renderModes(); renderSeqs(); renderScenes(); render(); renderHwRainbow(); renderController(); refreshDev(); renderBanner(); showTab(S.tab || 'color');
  }
  S.smartScenes = Melk.smartScenes.preferences(S.smartScenes);
  rotation = Melk.smartScenes.create({ preferences: S.smartScenes,
    canRun: () => link.ready && !document.hidden && S.driveMode !== 'driving',
    send: id => { rotationSending = true; try { return sendNativeScene(id); } finally { rotationSending = false; } },
    onChange: status => { const el = $('#rotationStatus'); if (el) el.textContent = status.running ? 'Rotating · Last requested: ' + (P.NATIVE_SCENES[status.current] || 'starting') + ' · Next: ' + (P.NATIVE_SCENES[status.next] || '—') : 'Stopped. The last native scene is left on the controller.'; const b = $('#rotationStart'); if (b) b.textContent = status.running ? 'Restart rotation' : 'Start rotation'; }
  });
  function editQuickScenes() {
    if (S.driveMode === 'driving') return toast('Edit Quick Scenes while parked.');
    openDialog('<h3>Quick Scenes</h3><p class="hint">Four slots, left to right. Choose None to remove a shortcut. Your custom scenes stay in Settings → Scenes.</p>' + Array.from({ length: 4 }, (_, i) => '<label class="field"><span>Slot ' + (i + 1) + '</span><select id="quickSlot' + i + '" class="text"><option value="">None</option>' + Object.keys(P.NATIVE_SCENES).map(id => '<option value="' + id + '" ' + (S.smartScenes.quick[i] === +id ? 'selected' : '') + '>' + esc(P.NATIVE_SCENES[id]) + '</option>').join('') + '</select></label>').join('') + '<div class="dlgActs"><button value="cancel" class="btn ghost">Cancel</button><button id="saveQuick" type="button" class="btn main">Save shortcuts</button></div>', f => {
      f.querySelector('#saveQuick').addEventListener('click', () => { const quick = Array.from({ length: 4 }, (_, i) => +f.querySelector('#quickSlot' + i).value).filter(Boolean); if (new Set(quick).size !== quick.length) return toast('Choose different native scenes for each slot.'); S.smartScenes.quick = quick; save(); renderScenes(); closeDialog(); });
    });
  }
  $('#quickEdit').addEventListener('click', editQuickScenes);
  $('#fxQuick').addEventListener('click', () => { const c = fxCurrent(); if (!c || c.kind !== 'scene' || S.driveMode === 'driving') return; if (S.smartScenes.quick.includes(c.id)) return toast('Already in Quick Scenes.'); if (S.smartScenes.quick.length < 4) { S.smartScenes.quick.push(c.id); save(); renderScenes(); toast('Added to Quick Scenes.'); } else { editQuickScenes(); toast('All four slots are full. Choose which scene to replace.'); } });
  function saveRotation() { S.smartScenes.selected = $$('#rotationScenes input:checked').map(e => +e.value); S.smartScenes.interval = +$('#rotationInterval').value; S.smartScenes.order = $('#rotationOrder').value; save(); rotation.configure(S.smartScenes); }
  $('#rotationScenes').innerHTML = Object.keys(P.NATIVE_SCENES).map(id => '<label class="check"><input type="checkbox" value="' + id + '" ' + (S.smartScenes.selected.includes(+id) ? 'checked' : '') + '><span>' + esc(P.NATIVE_SCENES[id]) + '</span></label>').join('');
  $('#rotationInterval').value = S.smartScenes.interval; $('#rotationOrder').value = S.smartScenes.order;
  $('#rotationScenes').addEventListener('change', saveRotation); $('#rotationInterval').addEventListener('change', saveRotation); $('#rotationOrder').addEventListener('change', saveRotation);
  $('#rotationStart').addEventListener('click', () => { if (!link.ready || document.hidden || S.driveMode === 'driving') return toast('Connect the strip and configure rotation while parked.'); stopDriver(); S.auto = false; save(); rotation.configure(S.smartScenes); if (!rotation.start()) toast('Select at least one native scene.'); });
  $('#rotationStop').addEventListener('click', () => rotation.stop());
  link.addEventListener('state', () => { if (!link.ready) { rotation.stop(); if (driver && driver.label === 'Listening…') stopDriver(); } });
  $('#legacyAuto').addEventListener('click', () => { if (!link.ready || S.driveMode === 'driving') return toast('Connect the strip while parked first.'); const enabled = !S.auto; stopDriver(); S.auto = enabled; save(); lastAuto = null; if (enabled) runAuto(true); $('#legacyAuto').setAttribute('aria-pressed', String(S.auto)); });
  $('#djBank').innerHTML = Object.keys(P.NATIVE_SCENES).map(id => '<label class="check"><input type="checkbox" value="s' + id + '" ' + ((S.djBank || []).includes('s' + id) ? 'checked' : '') + '><span>Native ' + esc(P.NATIVE_SCENES[id]) + '</span></label>').join('') + Object.keys(S.modeFav).filter(id => S.modeFav[id] && P.isKnownMode(+id)).map(id => '<label class="check"><input type="checkbox" value="m' + id + '" ' + ((S.djBank || []).includes('m' + id) ? 'checked' : '') + '><span>' + esc(modeLabel(+id)) + '</span></label>').join('');
  $('#djBank').addEventListener('change', () => { S.djBank = $$('#djBank input:checked').map(e => e.value); save(); });
  renderAll();
  runHash();

  /* ---------- app (APK) update: leave nothing running while Android's installer is open ---------- */
  MelkApk.init({
    hooks: {
      beforeInstall: async () => {
        stopDriver();                                                             // music and phone-driven effects stop sending
        if (window.MelkAudio && window.MelkAudio.native) { try { await window.MelkAudio.stop(); } catch (e) { /* already stopped */ } }
        await link.suspend();                                                      // closes Bluetooth cleanly and keeps the strip for the next start
      },
      afterInstallCancelled: async () => { await link.unsuspend(); toast('Update not installed. Reconnecting to the strip…'); },
      notify: (m) => toast(m),
    },
  });
})();
