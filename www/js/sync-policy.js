/* What to write when a connection opens or reopens.
 * Kept as a pure function so it can be unit tested without a phone.
 *
 * Rule: a hardware effect (native mode or scene) that is already running on the controller must never be
 * overwritten by a stale static colour just because the app reconnected or was reopened. */
(function (g) {
  'use strict';

  const NOTHING = { power: false, brightness: false, mode: false, colour: false };

  /**
   * st: { on, native: null | {kind, id}, activeMode: number|null, hasDriver, auto, pendingScene, preserveHardware }
   * returns { power, brightness, mode, colour, reason }
   */
  function planConnectSync(st) {
    const scenePending = !!(st.auto || st.pendingScene);

    // 1. A native effect is running and the user has not changed it since: write nothing.
    if (st.native && st.on && !scenePending) return Object.assign({ reason: 'native-effect-running' }, NOTHING);

    // 2. User opted in to leaving whatever the controller restored at power-on.
    if (st.preserveHardware && !scenePending) return Object.assign({ reason: 'preserve-hardware' }, NOTHING);

    // 3. Otherwise restore the saved state. While OFF only the power state is sent.
    const plan = { power: true, brightness: !!st.on, mode: false, colour: false, reason: st.on ? 'restore' : 'restore-off' };
    if (!st.on) return plan;

    // A scene or Auto is about to be applied in a moment: do not flash the old colour first.
    if (scenePending) { plan.reason = 'scene-pending'; return plan; }

    if (st.activeMode !== null && st.activeMode !== undefined) plan.mode = true;
    else if (!st.hasDriver) plan.colour = true;
    return plan;
  }

  g.Melk = g.Melk || {};
  g.Melk.syncPolicy = { planConnectSync };
})(typeof window !== 'undefined' ? window : globalThis);
