/* Android 8.1 panel startup diagnostic wiring regression checks. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('www/index.html', 'utf8');
const source = fs.readFileSync('www/js/panel-diagnostics.js', 'utf8');
const app = fs.readFileSync('www/js/app.js', 'utf8');

test('panel diagnostics loads before application scripts and marks ready', () => {
  assert.ok(html.indexOf('js/panel-diagnostics.js') < html.indexOf('js/protocol.js'));
  assert.ok(html.indexOf('js/panel-diagnostics.js') > -1);
  assert.match(app, /MelkPanelDiagnostics\.ready\(\)/);
});

test('panel diagnostics captures startup errors without requiring modern browser APIs', () => {
  const handlers = {};
  const domHandlers = {};
  const elements = [];
  const doc = {
    addEventListener(type, cb) { domHandlers[type] = cb; },
    body: { appendChild(el) { elements.push(el); } },
    createElement() { return { style: {}, setAttribute() {}, textContent: '' }; },
  };
  const win = {
    addEventListener(type, cb) { handlers[type] = cb; },
    setTimeout() {},
  };
  vm.runInNewContext(source, { window: win, document: doc, String });
  handlers.error({ message: 'Unexpected token', filename: 'file:///android_asset/public/js/app.js', lineno: 20 });
  assert.equal(elements.length, 1);
  assert.match(elements[0].textContent, /Unexpected token/);
  assert.match(elements[0].textContent, /app\.js:20/);
  win.MelkPanelDiagnostics.ready();
  assert.equal(typeof win.MelkPanelDiagnostics.report, 'function');
  assert.equal(typeof domHandlers.DOMContentLoaded, 'function');
});

test('Android 8.1 BLE discovery declares legacy permissions without widening Android 12+ scope', () => {
  const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
  for (const permission of ['BLUETOOTH', 'BLUETOOTH_ADMIN', 'ACCESS_FINE_LOCATION']) {
    assert.match(manifest, new RegExp('android:name="android\\.permission\\.' + permission + '" android:maxSdkVersion="30"'));
  }
  assert.match(manifest, /android\.permission\.BLUETOOTH_SCAN/);
});

test('errors reported before the body exists become visible on DOMContentLoaded', () => {
  const listeners = {};
  const doc = {
    body: null,
    addEventListener(name, fn) { listeners[name] = fn; },
    createElement() { return { style: {}, setAttribute() {}, textContent: '' }; },
  };
  const win = { addEventListener(name, fn) { listeners[name] = fn; }, setTimeout() {} };
  vm.runInNewContext(source, { window: win, document: doc, String });
  listeners.error({ message: 'Old WebView syntax error', filename: 'app.js', lineno: 1 });
  let element;
  doc.body = { appendChild(node) { element = node; } };
  listeners.DOMContentLoaded();
  assert.match(element.textContent, /Old WebView syntax error/);
});

test('diagnostic APK has a separate package id only when explicitly requested', () => {
  const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
  const workflow = fs.readFileSync('.github/workflows/android81-panel.yml', 'utf8');
  assert.match(gradle, /project\.hasProperty\('melkPanelSideBySide'\)/);
  assert.match(gradle, /applicationIdSuffix '\.paneldiag'/);
  assert.match(workflow, /-PmelkPanelSideBySide=true/);
  assert.match(workflow, /com\.bleled\.com\.paneldiag/);
});
