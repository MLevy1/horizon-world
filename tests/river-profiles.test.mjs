import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRiverProfiles,channelDimensions,sampleRiverEdge} from '../river-profiles.mjs';

function model({height,receiver,channel,discharge,ocean,waterbody=height.map(()=>-1),waterbodies=[]}){
  const m={grid:{count:height.length},height:Float64Array.from(height),level:Float64Array.from(height),
    receiver:Int32Array.from(receiver),channel:Uint8Array.from(channel),discharge:Float64Array.from(discharge),
    ocean:Uint8Array.from(ocean),waterbody:Int32Array.from(waterbody),waterbodies};
  for(let i=0;i<height.length;i++)if(ocean[i])m.level[i]=0;else if(waterbody[i]>=0)m.level[i]=waterbodies[waterbody[i]].waterLevelM;
  return m;
}
const solve=m=>{
  const p=buildRiverProfiles(m,Int32Array.from(m.height,(_,i)=>i),()=>.1);
  assert.equal(p.validation.ok,true,JSON.stringify(p.validation));return p;
};
const section=s=>[s.waterM,s.bedM,s.widthM,s.designDepthM];

test('procedural channel dimensions grow with supply and respect their explicit bounds',()=>{
  let last=channelDimensions(0);
  for(const q of [.0001,.1,1,10,100,1e8]){
    const d=channelDimensions(q);assert.ok(d.widthM>=last.widthM&&d.depthM>=last.depthM);
    assert.ok(d.widthM<=90&&d.depthM<=5&&d.freeboardM>0);last=d;
  }
  assert.equal(channelDimensions(0).widthM,2);assert.equal(channelDimensions(0).depthM,.25);
  for(const q of [-1,NaN,Infinity])assert.throws(()=>channelDimensions(q));
});

test('both tributaries share the exact same bed, surface and width as their outgoing junction',()=>{
  const m=model({height:[20,18,15,10,0],receiver:[2,2,3,4,-1],channel:[1,1,1,1,0],
    discharge:[.2,.3,.5,.6,0],ocean:[0,0,0,0,1]}),p=solve(m);
  const a=sampleRiverEdge(p,p.edgeAtCell[0],1),b=sampleRiverEdge(p,p.edgeAtCell[1],1),c=sampleRiverEdge(p,p.edgeAtCell[2],0);
  assert.deepEqual(section(a),section(b));assert.deepEqual(section(b),section(c));
  for(let e=0;e<p.from.length;e++){
    const mid=sampleRiverEdge(p,e,.5);assert.ok(mid.bedM<mid.waterM);assert.equal(mid.distanceM,50);
  }
});

test('a receiving-bank spill crest meets the upstream lake surface and owns a submerged channel bed',()=>{
  const m=model({height:[10,12,8,0],receiver:[1,2,3,-1],channel:[0,1,1,0],discharge:[1,1,1.1,0],ocean:[0,0,0,1],
    waterbody:[0,-1,-1,-1],waterbodies:[{id:0,closed:false,outletCell:0,outletReceiver:1,waterLevelM:12,outflowM3s:1}]}),p=solve(m);
  assert.equal(p.waterM[0],12);assert.equal(p.waterM[1],12);assert.ok(p.bedM[1]<12);
  assert.deepEqual(section(sampleRiverEdge(p,p.edgeAtCell[0],1)),section(sampleRiverEdge(p,p.edgeAtCell[1],0)));
});

test('lake backwater propagates upstream without sloping the closed lake or inventing an outflow',()=>{
  const m=model({height:[5,4,0],receiver:[1,-1,-1],channel:[1,0,0],discharge:[.1,0,0],ocean:[0,0,1],
    waterbody:[-1,0,-1],waterbodies:[{id:0,closed:true,outletCell:1,outletReceiver:-1,waterLevelM:5,outflowM3s:0}]}),p=solve(m);
  assert.equal(p.waterM[0],5);assert.equal(p.waterM[1],5);assert.equal(p.edgeAtCell[1],-1);
  assert.ok(p.bedM[0]<5&&p.bedM[1]<5);
});

test('zero-flow channel design profiles remain explicitly dry, including at an ocean endpoint',()=>{
  const m=model({height:[10,5,-2],receiver:[1,2,-1],channel:[1,1,0],discharge:[0,0,0],ocean:[0,0,1]}),p=solve(m);
  assert.equal(p.wet[0],0);assert.equal(p.wet[1],0);assert.equal(p.wet[2],1);
  for(let e=0;e<p.from.length;e++)assert.equal(sampleRiverEdge(p,e,.5).wet,false);
  assert.throws(()=>sampleRiverEdge(p,0,-.1));assert.throws(()=>sampleRiverEdge(p,99,.5));
});

test('lake ports size their incoming and outgoing flows without double-counting or drying an active crest',()=>{
  // The downstream lake appears first in the inventory, so its incoming
  // lake-to-lake edge is processed after its own outlet edge.
  const m=model({height:[12,10,10,0],receiver:[1,2,3,-1],channel:[0,0,1,0],discharge:[.5,.4,.4,0],ocean:[0,0,0,1],
    waterbody:[1,0,-1,-1],waterbodies:[
      {id:0,closed:false,outletCell:1,outletReceiver:2,waterLevelM:10,outflowM3s:.4},
      {id:1,closed:false,outletCell:0,outletReceiver:1,waterLevelM:12,outflowM3s:.5}]}),p=solve(m);
  assert.equal(p.widthM[1],channelDimensions(.5).widthM);
  assert.equal(p.wet[0],1,'an active zero-depth crest is a wet channel contact');
});
