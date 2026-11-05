import test from 'node:test';
import assert from 'node:assert/strict';
import {channelAwareGrid} from '../terrain-mesh.js';

function audit(mesh){
 const edgeCounts=new Map(),{positions,indices}=mesh;
 function edge(a,b){
  const key=Math.min(a,b)+':'+Math.max(a,b);
  edgeCounts.set(key,(edgeCounts.get(key)||0)+1);
 }
 for(let k=0;k<indices.length;k+=3){
  const [a,b,c]=indices.slice(k,k+3);
  assert.notEqual(a,b);assert.notEqual(a,c);assert.notEqual(b,c);
  const ax=positions[a*3],az=positions[a*3+2],
    bx=positions[b*3],bz=positions[b*3+2],
    cx=positions[c*3],cz=positions[c*3+2];
  // +Y normal requires this triangle orientation in x,z space.
  assert.ok((bz-az)*(cx-ax)-(bx-ax)*(cz-az)>1e-10,'flipped or degenerate terrain triangle');
  edge(a,b);edge(b,c);edge(c,a);
 }
 let exterior=0;
 for(const [key,count] of edgeCounts){
  assert.ok(count===1||count===2,'nonmanifold edge');
  if(count===1){
   exterior++;
   const [a,b]=key.split(':').map(Number);
   const boundary=(k)=>[positions[k*3],positions[k*3+2]];
   const [ax,az]=boundary(a),[bx,bz]=boundary(b);
   assert.ok((ax===0&&bx===0)||(ax===32&&bx===32)||
     (az===0&&bz===0)||(az===32&&bz===32),
     'unstitched interior T-junction');
  }
 }
 assert.ok(exterior>0);
}
test('channel-aware mesh refines locally and stitches all cell transitions',()=>{
 const mesh=channelAwareGrid({x:0,z:0,size:32,segments:8,subdivision:8,
  ground:(x,z)=>100-2*Math.exp(-Math.pow((x-16)/2,2)),
  nearChannel:(x,z,pad)=>Math.abs(x-16)<2+pad
 });
 assert.ok(mesh.dense.some(Boolean));
 assert.ok(mesh.dense.some(v=>!v));
 assert.ok(mesh.positions.length/3>81);
 audit(mesh);
});
test('no-feature cells retain original light grid topology',()=>{
 const mesh=channelAwareGrid({x:0,z:0,size:32,segments:8,ground:()=>0,nearChannel:()=>false});
 assert.equal(mesh.positions.length/3,81);
 assert.equal(mesh.indices.length,8*8*6);
 audit(mesh);
});
test('world-aligned samples are deterministic',()=>{
 const args={x:-256,z:512,size:256,segments:56,subdivision:8,
  ground:(x,z)=>x*.01+z*.001,
  nearChannel:(x,z,pad)=>Math.abs(z-630)<3+pad};
 const a=channelAwareGrid(args),b=channelAwareGrid(args);
 assert.deepEqual(a.positions,b.positions);
 assert.deepEqual(a.indices,b.indices);
 // Interior samples should resolve sub-metre channel features.
 const zs=a.coords.filter(([x,z])=>Math.abs(z-630)<1).map(p=>p[1]);
 assert.ok(zs.length>20);
});
