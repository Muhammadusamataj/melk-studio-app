/* Effect catalogue: how the Effects tab organises the controller's built-in modes and strip scenes.
 *
 * Pure data code (no DOM, no Bluetooth). Nothing here sends a command or invents a mapping:
 *  - ids, names and groups come straight from protocol.js (checked against Magic Lantern's own arrays by tests/modes-audit.cjs),
 *  - the group order is Magic Lantern's (array/modes_groups in its APK),
 *  - "verified" only ever means what the USER recorded on THEIR strip; everything else is "untested", never "unsupported".
 * "Strip scenes" are the controller's own Scene list (command 7E 05 31 ...). They are not the user's saved scenes (Settings, Scenes). */
(function (g) {
  'use strict';
  const P = g.Melk && g.Melk.protocol;
  const GROUP_ORDER = ['Basic', 'Curtain', 'Trans', 'Water', 'Flow', 'Tail', 'Run', 'RunBack'];
  const LABEL = { RunBack: 'Run back', scenes: 'Scenes' };
  const groupLabel = (k) => LABEL[k] || k;

  /** 'verified' | 'unsupported' | 'untested'. verifyStatus(key) is the app's existing hwStatus ("mode:130", "scene:11"). */
  function statusOf(kind, id, st) {
    const v = st.verifyStatus ? st.verifyStatus(kind + ':' + id) : 'UNVERIFIED';
    if (v === 'UNSUPPORTED') return 'unsupported';
    if (v === 'VERIFIED_SUPPORTED') return 'verified';
    if (kind === 'mode' && st.persistent && st.persistent[id]) return 'verified';   // the "Verified" box in the edit dialog
    return 'untested';
  }

  function modes(st) {
    const out = [], ids = Object.keys(P.MODES).map(Number);
    GROUP_ORDER.forEach((grp) => {
      ids.filter((id) => P.MODES[id][0] === grp).sort((a, b) => a - b).forEach((id) => {
        const custom = st.names && st.names[id] ? String(st.names[id]) : '';
        out.push({ kind: 'mode', key: 'm' + id, id, group: grp, groupLabel: groupLabel(grp), mlName: P.MODES[id][1], name: custom || P.MODES[id][1], renamed: !!custom,
          fav: !!(st.fav && st.fav[id]), hidden: !!(st.hidden && st.hidden[id]), status: statusOf('mode', id, st) });
      });
    });
    return out;
  }

  function scenes(st) {
    return Object.keys(P.NATIVE_SCENES).map(Number).sort((a, b) => a - b).map((id) => ({
      kind: 'scene', key: 's' + id, id, group: 'scenes', groupLabel: 'Scene', mlName: P.NATIVE_SCENES[id], name: P.NATIVE_SCENES[id], renamed: false,
      fav: false, hidden: false, status: statusOf('scene', id, st) }));
  }

  /** The chips, in order: All, Favourites, Scenes, then Magic Lantern's groups, then Hidden (only when something is hidden). */
  function categories(modeList, sceneList) {
    const visible = modeList.filter((e) => !e.hidden);
    const cats = [{ key: 'all', label: 'All', count: visible.length }, { key: 'fav', label: 'Favourites', count: visible.filter((e) => e.fav).length }, { key: 'scenes', label: 'Scenes', count: sceneList.length }];
    GROUP_ORDER.forEach((grp) => cats.push({ key: grp, label: groupLabel(grp), count: visible.filter((e) => e.group === grp).length }));
    const hidden = modeList.filter((e) => e.hidden).length;
    if (hidden) cats.push({ key: 'hidden', label: 'Hidden', count: hidden });
    return cats;
  }

  /** opts: { cat, query, verifiedOnly }. A typed query searches every visible mode and scene, whatever chip is selected. */
  function filter(modeList, sceneList, opts) {
    const q = String(opts.query || '').toLowerCase().replace(/#/g, ' ').trim(), cat = opts.cat || 'all';
    let list;
    if (q) list = modeList.filter((e) => !e.hidden).concat(sceneList);
    else if (cat === 'scenes') list = sceneList;
    else if (cat === 'hidden') list = modeList.filter((e) => e.hidden);
    else if (cat === 'fav') list = modeList.filter((e) => e.fav && !e.hidden);
    else if (cat === 'all') list = modeList.filter((e) => !e.hidden);
    else list = modeList.filter((e) => e.group === cat && !e.hidden);
    if (q) {
      const tokens = q.split(/\s+/);
      list = list.filter((e) => { const hay = (e.name + ' ' + e.mlName + ' ' + e.groupLabel + ' ' + (e.kind === 'scene' ? 'scene strip' : 'mode')).toLowerCase(); return tokens.every((t) => (/^\d+$/.test(t) ? String(e.id).indexOf(t) === 0 : hay.indexOf(t) >= 0)); });
    }
    if (opts.verifiedOnly) list = list.filter((e) => e.status === 'verified');
    return list;
  }

  g.Melk = g.Melk || {};
  g.Melk.modeCatalog = { GROUP_ORDER, groupLabel, statusOf, modes, scenes, categories, filter };
})(typeof window !== 'undefined' ? window : globalThis);
