/* Capability-gated native PCM analysis; legacy APK and browser microphone remain explicit choices. */
(function (g) {
  'use strict';
  const native = !!(g.Capacitor && g.Capacitor.isNativePlatform && g.Capacitor.isNativePlatform());
  const plugin = native && g.Capacitor.Plugins && g.Capacitor.Plugins.SmartAudio;
  let handles = [], teardown = null, generation = 0;
  async function capabilities() {
    if (plugin) { try { return await plugin.getCapabilities(); } catch (_) { /* old APK */ } }
    return { apiVersion: 0, playback: false, microphone: !!g.MelkAudio || !!(g.navigator && navigator.mediaDevices) };
  }
  async function stop() {
    generation++;
    const dispose = teardown; teardown = null;
    const old = handles; handles = [];
    if (plugin) { try { await plugin.stop(); } catch (_) {} }
    if (dispose) await dispose();
    await Promise.all(old.map(h => h.remove().catch(() => {})));
  }
  async function start(source, onFrame, onStopped) {
    const my = generation + 1; await stop();
    if (my !== generation) throw new Error('Audio start cancelled');
    const cap = await capabilities();
    if (my !== generation) throw new Error('Audio start cancelled');
    const chosen = source === 'auto' ? 'device' : source;
    if (chosen === 'device' && !cap.playback) throw new Error('Device Audio needs Android 10+ and MELK Studio native 1.2.0. Choose Microphone to use the available fallback.');
    const frame = f => { if (my === generation) onFrame(f); };
    if (cap.apiVersion >= 2 && plugin) {
      try {
        for (const [event, callback] of [['frame', frame], ['stopped', e => { if (my === generation && onStopped) onStopped(e.message); }]]) {
          const handle = await plugin.addListener(event, callback);
          if (my !== generation) { await handle.remove(); throw new Error('Audio start cancelled'); }
          handles.push(handle);
        }
        const result = await plugin.start({ source: chosen });
        if (my !== generation) throw new Error('Audio start cancelled');
        return result;
      } catch (e) { if (my === generation) await stop(); throw e; }
    }
    if (chosen !== 'microphone') throw new Error('Select Microphone explicitly. It will not be enabled automatically.');
    if (g.MelkAudio) {
      teardown = () => g.MelkAudio.stop();
      await g.MelkAudio.start(f => frame({ ...f, energy: f.bass, source: 'microphone', legacy: true }));
      if (my !== generation) throw new Error('Audio start cancelled');
      return { source: 'microphone', legacy: true };
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Microphone capture is unavailable in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (my !== generation) { stream.getTracks().forEach(t => t.stop()); throw new Error('Audio start cancelled'); }
    let ctx, an;
    try {
      ctx = new (g.AudioContext || g.webkitAudioContext)(); an = ctx.createAnalyser();
      an.fftSize = 2048; an.smoothingTimeConstant = .4; ctx.createMediaStreamSource(stream).connect(an);
    } catch (e) {
      stream.getTracks().forEach(t => t.stop()); if (ctx) await ctx.close().catch(() => {}); throw e;
    }
    const pcm = new Float32Array(2048), bins = new Float32Array(1024), previous = new Float32Array(1024);
    let peak = .02, floor = .0002, fluxMean = .001, lastBeat = -10000, quietSince = 0;
    const timer = setInterval(() => {
      if (my !== generation) return;
      an.getFloatTimeDomainData(pcm); an.getFloatFrequencyData(bins);
      const now = performance.now(), rms = Math.sqrt(pcm.reduce((a, x) => a + x * x, 0) / pcm.length);
      peak = Math.max(rms, .005, peak * .995); floor += (rms - floor) * (rms < floor ? .12 : .0005);
      floor = Math.max(.00005, Math.min(.015, floor)); const gain = Math.min(30, 1 / Math.max(.01, peak * 1.4));
      const sums = [0, 0, 0], spectrum = Array(16).fill(0); let flux = 0;
      bins.forEach((db, i) => { const mag = Number.isFinite(db) ? Math.pow(10, db / 20) : 0, hz = i * ctx.sampleRate / 2048;
        flux += Math.max(0, mag - previous[i]); previous[i] = mag;
        const band = hz < 250 ? 0 : hz < 4000 ? 1 : 2; if (hz >= 35 && hz < 16000) sums[band] += mag * mag;
        spectrum[Math.min(15, Math.floor(i * 16 / bins.length))] += mag * mag;
      });
      const beat = rms > Math.max(.0005, floor * 2) && flux > fluxMean * 1.7 + .002 && now - lastBeat > 260;
      fluxMean += (flux - fluxMean) * .05; if (beat) lastBeat = now;
      if (rms < Math.max(.0005, floor * 1.8)) { if (!quietSince) quietSince = now; } else quietSince = 0;
      const unit = v => Math.min(1, Math.max(0, v)), silence = !!quietSince && now - quietSince > 500;
      frame({ source: 'microphone', rms, energy: silence ? 0 : unit((rms - floor) * gain), bass: silence ? 0 : unit(Math.sqrt(sums[0]) * gain), mid: silence ? 0 : unit(Math.sqrt(sums[1]) * gain), treble: silence ? 0 : unit(Math.sqrt(sums[2]) * gain), beat, silence, spectrum: spectrum.map(v => silence ? 0 : unit(Math.sqrt(v) * gain)), waveform: Array.from({ length: 32 }, (_, i) => pcm[i * 64]) });
    }, 90);
    teardown = async () => { clearInterval(timer); stream.getTracks().forEach(t => t.stop()); await ctx.close(); };
    return { source: 'microphone' };
  }
  g.MelkSmartAudio = { capabilities, start, stop };
})(typeof window !== 'undefined' ? window : globalThis);
