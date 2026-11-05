const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function engine(){const c=vm.createContext({});c.window=c;vm.runInContext(fs.readFileSync('www/js/smart-music.js','utf8'),c);return c.Melk.smartMusic.create();}
const opts={style:'smart',hue:30,saturation:.8,djInterval:7,bank:['s4','m0'],random:()=>0};
test('Smart Auto makes bounded RGB decisions from real frames, at most eight writes per second',()=>{
 const e=engine();let count=0;for(let now=0;now<2000;now+=10){const d=e.frame({bass:.7,energy:.8,treble:.4,beat:now%500===0},opts,now);if(d){count++;assert.ok(d.rgb.every(x=>Number.isFinite(x)&&x>=0&&x<=255));}}
 assert.ok(count<=16&&count>1);
});
test('silence converges to a stable dim color without flicker',()=>{
 const e=engine();let last;for(let t=0;t<20000;t+=125){const d=e.frame({bass:0,energy:0,treble:0,silence:true},opts,t);if(d)last=d;}
 assert.ok(last.level<.1);assert.equal(e.frame({bass:0,energy:0,silence:true},opts,21000),null);
});
test('DJ Scenes requires beats, respects minimum duration and avoids restarting the same native pattern',()=>{
 const e=engine(),o={...opts,style:'dj'};assert.equal(e.frame({bass:1,beat:false},o,0),null);
 const a=e.frame({bass:1,beat:true},o,0);assert.equal(a.key,'s4');assert.equal(e.frame({bass:1,beat:true},o,1000),null);
 assert.equal(e.frame({bass:1,beat:true},o,7000).key,'m0');assert.equal(e.frame({bass:0,beat:true,silence:true},o,14000),null);
});
test('manual Bass Pulse and Smooth Flow remain available',()=>{
 for(const style of ['pulse','spectrum']){const d=engine().frame({bass:.5,energy:.5},{...opts,style},1000);assert.equal(d.kind,'color');}
});
test('a one-effect DJ bank does not repeatedly restart its native effect',()=>{
 const e=engine(),o={...opts,style:'dj',bank:['s4']};
 assert.equal(e.frame({bass:1,beat:true},o,0).key,'s4');
 assert.equal(e.frame({bass:1,beat:true},o,10000),null);
});
test('invalid frames are ignored',()=>{assert.equal(engine().frame(null,opts,0),null);assert.equal(engine().frame({bass:'invalid'},opts,0),null);});
