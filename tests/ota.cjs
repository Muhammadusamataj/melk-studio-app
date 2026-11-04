const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function check(version, remote) {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {hidden:true, textContent:'', addEventListener(){}});
    return elements.get(id);
  };
  const context = vm.createContext({ URL, TextEncoder, console,
    document: { readyState:'complete', getElementById:element },
    localStorage: { getItem:()=>null }, setTimeout:()=>{},
    Capacitor: { isNativePlatform:()=>true, Plugins: {
      CapacitorUpdater: { current:async()=>({bundle:{version}}), notifyAppReady:async()=>{} },
      CapacitorHttp: { get:async()=>({status:200,data:{version:remote,url:'https://muhammadusamataj.github.io/melk-studio-ota-/ota/update.zip'}}) },
    } },
  });
  context.window=context;
  vm.runInContext(fs.readFileSync('www/js/ota.js','utf8'),context);
  await context.MelkOta.check();
  return {status:element('otaStatus').textContent,install:element('otaInstall').hidden};
}
// The packaged version is read from ota.js so these tests do not need editing at every release.
const PKG = /APP_VERSION\s*=\s*'([^']+)'/.exec(fs.readFileSync('www/js/ota.js', 'utf8'))[1];
const esc = (v) => v.replace(/\./g, '\\.');
const bump = (v, d) => { const [a, b, c] = v.split('.').map(Number); return [a, b, c + d].join('.'); };

test('builtin bundle uses the packaged version and rejects older server updates', async()=>{
  const result=await check('builtin', '0.9.9');
  assert.match(result.status, new RegExp('Up to date \\(v' + esc(PKG) + '\\)'));
  assert.equal(result.install,true);
});
test('a newer OTA bundle is compared against its running version', async()=>{
  const running = bump(PKG, 2);
  const result=await check(running, bump(PKG, 1));
  assert.match(result.status, new RegExp('Up to date \\(v' + esc(running) + '\\)'));
});
test('a newer server update offers installation', async()=>{
  const next = bump(PKG, 1);
  const result=await check('builtin', next);
  assert.match(result.status, new RegExp('New web update v' + esc(next)));
  assert.equal(result.install,false);
});
