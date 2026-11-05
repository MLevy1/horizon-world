import test from 'node:test';
import assert from 'node:assert/strict';
import {channelAwareGrid} from '../terrain-mesh.js';
import {sharedChannelMesh} from '../shared-channel-mesh.js';

function make(width=3){
 const grid=channelAwareGrid({
  x:0,z:0,size:32,segments:8,subdivision:8,
  ground:(x,z)=>100-Math.max(0,1-Math.abs(z-16)/5)*1.5,
  nearChannel:(x,z,pad)=>Math.abs(z-16)<width+pad
 });
 const sample=(x,z)=>{
  const distance=Math.abs(z-16),water=99.4;
  return {ground:100-Math.max(0,1-distance/5)*1.5,
    feature:{kind:'river',distance,width,water,flowDistance:800},
    shoreDistance:distance-width,
    waterElevation:distance<=width?water+.09:null};
 };
 return sharedChannelMesh(grid,{sample,minimumHalfWidth:.5,
  waterColor:depth=>[.4,.8,.9,.9]});
}
test('riverbank and water share one shoreline contour',()=>{
 const shared=make();
 assert.ok(shared.stats.waterTriangles>0,'wet polygons should be triangulated');
 assert.ok(shared.stats.contourEdges>0,'shoreline should cross rendered triangles');
 assert.ok(shared.stats.waterTriangles<shared.stats.triangles*2,'water should occupy a local corridor');
 const terrainXY=new Set();
 const g=shared.terrain.positions;
 for(let i=0;i<g.length;i+=3)terrainXY.add(g[i].toFixed(7)+','+g[i+2].toFixed(7));
 const water=shared.water.positions;
 // Every water vertex (including generated shoreline crossings) must have a
 // matching horizontal terrain vertex. No independently laid-down ribbon.
 for(let i=0;i<water.length;i+=3){
  const key=water[i].toFixed(7)+','+water[i+2].toFixed(7);
  assert.ok(terrainXY.has(key),'water/terrain coordinate mismatch '+key);
 }
});
test('water geometry is finite, indexed and wound above the terrain',()=>{
 const {water,terrain}=make();
 assert.equal(water.positions.length%3,0);
 assert.equal(water.indices.length%3,0);
 assert.equal(water.colors.length,water.positions.length/3*4);
 for(const p of water.positions)assert.ok(Number.isFinite(p));
 for(let i=0;i<water.indices.length;i+=3){
  const [a,b,c]=water.indices.slice(i,i+3);
  const ax=water.positions[3*a],az=water.positions[3*a+2],
   bx=water.positions[3*b],bz=water.positions[3*b+2],
   cx=water.positions[3*c],cz=water.positions[3*c+2];
  const signed=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);
  assert.ok(signed>1e-10,'wrong winding or degenerate water triangle');
 }
 assert.ok(terrain.indices.length>0);
});
test('sub-grid headwaters remain dry instead of dashed polygons',()=>{
 const {water}=make(.1);
 assert.equal(water.indices.length,0);
});
test('shared contour generation is deterministic across rebuilds',()=>{
 assert.deepEqual(make(),make());
});
