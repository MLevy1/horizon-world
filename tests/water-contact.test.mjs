import test from 'node:test';
import assert from 'node:assert/strict';
import {createContactFitter,composeWaterSurface} from '../water-contact.mjs';

const river=(overrides={})=>({edge:0,t:.5,distanceM:0,widthM:4,designDepthM:1,freeboardM:.4,waterM:9,bedM:8,wet:true,...overrides});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('incoming water reaches the fixed plane at the scaffold shore, not at the offshore node',()=>{
  const m={height:Float64Array.of(10,-10),riverProfiles:{from:Int32Array.of(0),to:Int32Array.of(1),
    kind:Uint8Array.of(1,3),waterM:Float64Array.of(9.5,0),bedM:Float64Array.of(9,-10),designDepthM:Float64Array.of(.5,.5)}};
  const f=createContactFitter(m);assert.equal(f.end[0],.5);
  close(f.fit(river({t:.5})).waterM,0);close(f.fit(river({t:.5})).bedM,-.5);
  close(f.fit(river({t:.75})).waterM,0);close(f.fit(river({t:1})).bedM,-10);
  close(f.fit(river({t:0})).waterM,9.5);
});
test('a fitted wet channel has a submerged core and rejoins unchanged land outside its support',()=>{
  const core=composeWaterSurface(10,null,[river()]);close(core.groundM,8);close(core.waterM,9);close(core.depthM,1);
  const outside=composeWaterSurface(10,null,[river({distanceM:3.4})]);close(outside.groundM,10);assert.equal(outside.waterM,null);
  for(const d of [2-1e-6,2+1e-6,3.4-1e-6]){
    const q=composeWaterSurface(10,null,[river({distanceM:d})]);assert.ok(Number.isFinite(q.groundM));
    if(q.waterM!==null)assert.ok(q.groundM<q.waterM);
  }
});
test('standing water stays flat and receives no bank fills, even beneath overlapping channels',()=>{
  const plane={kind:'ocean',waterM:0,support:1};
  for(const d of [0,1.5,2,2.7,3.3]){
    const q=composeWaterSurface(-2,plane,[river({distanceM:d,waterM:1,bedM:-3}),river({distanceM:d+.01,wet:false})]);
    close(q.waterM,0);assert.ok(q.groundM<=-2);assert.ok(q.depthM>=2);
  }
});
test('bank fitting is continuous on both sides of a standing-water shoreline',()=>{
  const plane={kind:'pool',waterM:0,support:.5};
  for(const d of [0,1,2,2.7,3.3]){
    const a=composeWaterSurface(-1e-7,plane,[river({distanceM:d,waterM:1,bedM:0})]);
    const b=composeWaterSurface(1e-7,plane,[river({distanceM:d,waterM:1,bedM:0})]);
    assert.ok(Math.abs(a.groundM-b.groundM)<1e-5);
    if(a.waterM!==null&&b.waterM!==null)assert.ok(Math.abs(a.waterM-b.waterM)<1e-5);
  }
});
test('overlapping junction patches keep shared anchors and do not depend on edge order',()=>{
  const a=river(),b=river({edge:1,wet:false});
  const q=composeWaterSurface(10,null,[a,b]);close(q.groundM,8);close(q.waterM,9);
  const left=composeWaterSurface(10,null,[river({distanceM:.7}),river({edge:1,distanceM:.8})]);
  const right=composeWaterSurface(10,null,[river({edge:1,distanceM:.8}),river({distanceM:.7})]);
  close(left.waterM,right.waterM);close(left.groundM,right.groundM);
});
test('dry channels remain dry, and untouched land remains the original scaffold',()=>{
  const dry=composeWaterSurface(10,null,[river({wet:false})]);assert.equal(dry.waterM,null);assert.equal(dry.depthM,0);
  const land=composeWaterSurface(12,null,[]);assert.equal(land.groundM,12);assert.equal(land.waterM,null);
});
test('standing water can enter a newly lowered dry throat at its shoreline',()=>{
  const q=composeWaterSurface(0,{kind:'ocean',waterM:0,support:1},[river({waterM:0,bedM:-1,wet:false})]);
  close(q.waterM,0);close(q.groundM,-1);assert.equal(q.kind,'ocean');
});

test('inland banks rise monotonically to surrounding ground without an artificial repeating berm',()=>{
  let previous=9;for(let k=0;k<=100;k++){const q=composeWaterSurface(9.2,null,[river({distanceM:2+1.4*k/100})]);assert.ok(q.groundM>=previous-1e-8);assert.ok(q.groundM<=9.2+1e-8);previous=q.groundM;}close(previous,9.2);
});
