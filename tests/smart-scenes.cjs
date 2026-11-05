const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const c = vm.createContext({setTimeout, clearTimeout}); c.window = c;
for (const file of ['protocol', 'smart-scenes', 'mode-catalog', 'scene-dna']) vm.runInContext(fs.readFileSync(`www/js/${file}.js`, 'utf8'), c);
const A = c.Melk.smartScenes, json = x => JSON.parse(JSON.stringify(x));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function rig(preferences) {
  let allowed = true, now = 0; const pending = new Map(), sent = []; let id = 0;
  const ctrl = A.create({preferences, canRun:()=>allowed, send:async x=>{sent.push(x);return true;}, random:()=>.99,
    setTimeout:(fn,ms)=>{pending.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>pending.delete(id)});
  async function advance(ms) { now += ms; for (const [id,t] of [...pending]) if(t.at<=now){pending.delete(id);t.fn();} await flush(); }
  return {ctrl,sent,pending,advance,offline:()=>{allowed=false;}};
}
test('four default Quick Scenes are valid native IDs; preference order and empty slots are preserved',()=>{
  assert.deepEqual(json(A.preferences().quick),[1,16,11,6]);
  assert.deepEqual(json(A.preferences({quick:[6,11,6,99,1],recent:[4,4,11]}).quick),[6,11,1]);
  assert.deepEqual(json(A.preferences({quick:[]}).quick),[]);
  assert.deepEqual(json(A.preferences({selected:[]}).selected),[]);
});
test('all 241 entries and exact native scene packet IDs are preserved',()=>{
  const P=c.Melk.protocol, MC=c.Melk.modeCatalog, modes=MC.modes({}),scenes=MC.scenes({});
  assert.equal(modes.length,213);assert.equal(scenes.length,28);
  assert.equal(MC.filter(modes,scenes,{cat:'all'}).length,241);
  assert.deepEqual(json(MC.categories(modes,scenes).map(x=>x.key)),['scenes','fav','all','Basic','Curtain','Trans','Water','Flow','Tail','Run','RunBack']);
  for(let id=1;id<=28;id++)assert.deepEqual(Array.from(P.scene(id)),[126,5,49,id,7,255,255,1,239]);
});
test('sequential rotation sends once per interval, wraps and never accumulates timers',async()=>{
  const r=rig({selected:[1,11,16],interval:30000});r.ctrl.start();await flush();assert.deepEqual(r.sent,[1]);
  await r.advance(29999);assert.deepEqual(r.sent,[1]);await r.advance(1);assert.deepEqual(r.sent,[1,11]);
  await r.advance(30000);assert.deepEqual(r.sent,[1,11,16]);await r.advance(30000);assert.equal(r.sent.at(-1),1);
  r.ctrl.start();await flush();assert.equal(r.pending.size,1);r.ctrl.stop();assert.equal(r.pending.size,0);
  await r.advance(900000);assert.equal(r.ctrl.snapshot().running,false);
});
test('shuffle does not repeat the current scene with multiple choices',async()=>{
  const r=rig({selected:[4,11],order:'shuffle',interval:60000});r.ctrl.start();await flush();await r.advance(60000);await r.advance(60000);
  assert.deepEqual(r.sent,[11,4,11]);assert.equal(r.ctrl.snapshot().next,4);
});
test('disconnect or foreground policy failure stops with no catch-up commands',async()=>{
  const r=rig({selected:[1,2],interval:300000});r.ctrl.start();await flush();r.offline();await r.advance(300000);
  assert.deepEqual(r.sent,[1]);assert.equal(r.pending.size,0);assert.equal(r.ctrl.snapshot().running,false);
  assert.equal(r.ctrl.start(),false);
});
test('a stopped in-flight send cannot arm another timer or change the current scene',async()=>{
  let done; const timers=[];const ctrl=A.create({canRun:()=>true,send:()=>new Promise(r=>done=r),setTimeout:fn=>timers.push(fn),clearTimeout:()=>{}});
  ctrl.start();ctrl.stop();done(true);await flush();assert.equal(timers.length,0);assert.equal(ctrl.snapshot().current,null);
});
test('all offered intervals restore; editing preferences stops the old scheduler',async()=>{
  for(const interval of [30000,60000,300000,900000]){const r=rig({interval,selected:[4]});r.ctrl.start();await flush();assert.equal(r.pending.size,1);r.ctrl.configure({interval,selected:[6]});assert.equal(r.pending.size,0);assert.equal(r.ctrl.snapshot().preferences.interval,interval);}
});
test('settings export/import retains Quick Scenes, source and DJ bank without accepting unknown IDs',()=>{
  const defs={smartScenes:null,nativeSceneFav:[],djBank:[],musicSource:'auto',musicStyle:'smart'};
  const out=c.Melk.sceneDna.sanitizeSettings({smartScenes:{quick:[6,4],recent:[11],selected:[1,28],order:'shuffle',interval:900000},nativeSceneFav:[4],djBank:['s4','m0'],musicSource:'device',musicStyle:'smart'},defs);
  assert.deepEqual(json(out.dropped),[]);assert.deepEqual(json(out.settings.smartScenes.quick),[6,4]);assert.equal(out.settings.musicSource,'device');
  assert.ok(c.Melk.sceneDna.sanitizeSettings({djBank:['s999']},defs).dropped.includes('djBank'));
});
