/* Old Android WebView diagnostics. No network, no permissions, no BLE writes. */
(function (w, d) {
  'use strict';
  var errors = [], ready = false, panel;
  function add(message) {
    var line = String(message || 'Unknown startup error').slice(0, 350);
    errors.push(line);
    if (errors.length > 8) errors.shift();
    show();
  }
  function show() {
    if (!d.body) return;
    if (!panel) {
      panel = d.createElement('div');
      panel.id = 'melkStartupDiagnostic';
      panel.setAttribute('role', 'alert');
      panel.style.cssText = 'position:fixed;z-index:2147483647;bottom:8px;left:8px;right:8px;max-height:45vh;overflow:auto;background:#231626;color:#fff;padding:14px;border:2px solid #ffb347;border-radius:9px;font:14px sans-serif;white-space:pre-wrap';
      d.body.appendChild(panel);
    }
    panel.textContent = 'MELK Studio startup diagnostic (Android panel)\n' + errors.join('\n') + '\n\nTake a photo of this message and send it for debugging.';
  }
  d.addEventListener('DOMContentLoaded', function () { if (errors.length) show(); });
  w.addEventListener('error', function (e) {
    add((e.message || 'Script load error') + (e.filename ? ' [' + e.filename.split('/').pop() + ':' + e.lineno + ']' : ''));
  });
  w.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    add('Promise: ' + (reason && reason.message ? reason.message : String(reason)));
  });
  w.MelkPanelDiagnostics = {
    ready: function () { ready = true; },
    report: add,
    errors: errors
  };
  w.setTimeout(function () {
    if (!ready) add('App did not finish initialization. Check script compatibility and native plugins.');
  }, 7000);
})(window, document);
