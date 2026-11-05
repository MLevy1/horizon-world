import test from 'node:test';
import assert from 'node:assert/strict';
import {PILOT,pilotWeight,pilotOverlapsTile,buildChannelFocusedGrid} from '../river-lab-pilot.js';

test('pilot remains restricted to the photographed river',()=>{
 assert.equal(pilotWeight(PILOT.x,PILOT.z),1);
 assert.equal(pilotWeight(PILOT.x+800,PILOT.z),0);
 assert.equal(pilotOverlapsTile(768,1536,256),true);
 assert.equal(pilotOverlapsTile(4096,4096,256),false);
});
test('River Lab style terrain refinement has conforming edges',()=>{
 const x=768,z=1536,size=256;
 const g=buildChannelFocusedGrid({
  x,z,size,segments:56,subdivision:8,
  height:(px,pz)=>100+Math.sin(px*.03)+pz*.002,
  nearChannel:(px,pz,pad)=>Math.abs(px-921)<2+pad
 });
 assert.ok(g.flags.some(Boolean),'stream corridor must be refined');
 assert.ok(g.flags.some(v=>!v),'outside corridor stays coarse');
 const p=g.positions,indices=g.indices,edges=new Map();
 for(let k=0;k<indices.length;k+=3){
  const a=indices[k],b=indices[k+1],c=indices[k+2];
  const sign=(p[b*3+2]-p[a*3+2])*(p[c*3]-p[a*3])-
    (p[b*3]-p[a*3])*(p[c*3+2]-p[a*3+2]);
  assert.ok(sign>1e-9,'no flipped or degenerate triangles');
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
   const key=Math.min(u,v)+','+Math.max(u,v);
   edges.set(key,(edges.get(key)||0)+1);
  }
 }
 for(const [key,count] of edges){
  assert.ok(count===1||count===2,'non-manifold terrain');
  if(count===2)continue;
  const [a,b]=key.split(',').map(Number);
  const x1=p[a*3],z1=p[a*3+2],x2=p[b*3],z2=p[b*3+2];
  assert.ok((x1===x&&x2===x)||(x1===x+size&&x2===x+size)||
   (z1===z&&z2===z)||(z1===z+size&&z2===z+size),
   'no internal cracks or free edges');
 }
});
