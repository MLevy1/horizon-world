import test from 'node:test';
import assert from 'node:assert/strict';
import {clipChunkWater} from '../chunk-water.mjs';
import {createTerrainChunkBuilder,tileNeighbor,tileKey,terrainVertex,terrainEdgeIndices,EDGES} from '../terrain-chunks.mjs';
const R=64000,norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
function triangle(heights,water,head=water,fixed=[0,0,0],order=[0,1,2]){
  const directions=[[1,0,0],[1,.0001,0],[1,0,.0001]].map(norm),positions=Float64Array.from(directions.flatMap((d,i)=>d.map(v=>v*(R+heights[i]))));
  return clipChunkWater({positions,elevationsM:Float64Array.from(heights),normals:Float32Array.from(directions.flat()),indices:Uint32Array.from(order),boundaryIndices:Uint32Array.of(0,1,1,2,2,0)},{waterM:Float64Array.from(water),headM:Float64Array.from(head),fixed:Uint8Array.from(fixed),waterNormals:Float32Array.from(directions.flat())},['a','b','c'],R);
}
function edges(mesh){const out=new Map(),n=mesh.positions.length/3;for(let i=0;i<mesh.indices.length;i+=3)for(let k=0;k<3;k++){const a=mesh.indices[i+k],b=mesh.indices[i+(k+1)%3],key=Math.min(a,b)*n+Math.max(a,b);out.set(key,(out.get(key)||0)+1);}return out;}
test('a standing-water shore clips both meshes at identical vertices and keeps the exact fixed level',()=>{
  const m=triangle([-1,1,1],[0,NaN,NaN],[0,NaN,NaN],[1,0,0]);assert.equal(m.stats.waterTriangles,1);assert.equal(m.stats.shoreVertices,2);assert.equal(m.stats.ambiguousWaterTriangles,0);
  for(const h of m.water.elevationsM)assert.equal(h,0);
  for(let i=0;i<m.water.groundVertex.length;i++){const g=m.water.groundVertex[i];if(g>=3){for(let k=0;k<3;k++)assert.equal(m.water.positions[i*3+k],m.ground.positions[g*3+k]);assert.equal(m.ground.elevationsM[g],0);}}
  const e=edges(m.ground),used=new Set(m.ground.indices);assert.equal(used.size-e.size+m.ground.indices.length/3,1);assert.equal([...e.values()].filter(n=>n===1).length,m.ground.boundaryIndices.length/2);
});
test('dry channel designs remain dry even when a potential design head lies above the bed',()=>{
  const m=triangle([-1,-1,-1],[NaN,NaN,NaN],[0,0,0]);assert.equal(m.water.indices.length,0);assert.deepEqual([...m.ground.indices],[0,1,2]);
});
test('river water retains its sampled downhill heads rather than being forced to a plane',()=>{
  const m=triangle([-1,-2,-3],[1,.5,0]);assert.deepEqual([...m.water.elevationsM],[1,.5,0]);assert.equal(m.stats.waterTriangles,1);assert.equal(m.stats.shoreVertices,0);
});
test('incompatible standing-water levels are flagged for refinement rather than joined by a sloping sheet',()=>{
  const m=triangle([-1,-1,-1],[1,0,0],[1,0,0],[1,1,1]);assert.equal(m.water.indices.length,0);assert.equal(m.stats.ambiguousWaterTriangles,1);assert.deepEqual([...m.ground.indices],[0,1,2]);
});
test('shared shore roots are reused by adjacent ground and water triangles',()=>{
  const dirs=[[1,0,0],[1,.0001,0],[1,.0001,.0001],[1,0,.0001]].map(norm),heights=[-1,1,1,-1],ground={positions:Float64Array.from(dirs.flatMap((d,i)=>d.map(x=>x*(R+heights[i])))),elevationsM:Float64Array.from(heights),indices:Uint32Array.of(0,1,2,0,2,3),boundaryIndices:Uint32Array.of(0,1,1,2,2,3,3,0)};
  const m=clipChunkWater(ground,{waterM:Float64Array.of(0,NaN,NaN,0),headM:Float64Array.of(0,0,0,0),fixed:Uint8Array.of(1,0,0,1)},['a','b','c','d'],R);
  assert.equal(m.stats.shoreVertices,3);assert.equal(m.stats.waterTriangles,3);for(const n of edges(m.ground).values())assert.ok(n===1||n===2);for(const n of edges(m.water).values())assert.ok(n===1||n===2);
});
test('smooth global normals remain identical when a vertex is sampled at another LOD',()=>{
  const sampler={grid:{radiusKm:64},sample:(lon,lat)=>({fitted:{groundM:Math.sin(lon*Math.PI/180)*50,waterM:lat<0?0:null,potentialWaterM:0,kind:lat<0?'ocean':'land'}})},b=createTerrainChunkBuilder(sampler,{sampleCacheLimit:1}),coarse=b.build({face:0,level:1,x:0,y:0},{resolution:8}),fine=b.build({face:0,level:2,x:0,y:0},{resolution:8});
  for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){const a=j*9+i,c=(j*2)*9+i*2;assert.deepEqual([...coarse.normals.subarray(a*3,a*3+3)],[...fine.normals.subarray(c*3,c*3+3)]);assert.ok(Math.abs(Math.hypot(...fine.normals.subarray(c*3,c*3+3))-1)<1e-6);}
});
const ocean={grid:{radiusKm:64},sample:(lon,lat)=>{const groundM=100*(Math.sin(lat*Math.PI/180)-.123);return {fitted:{groundM,waterM:groundM<0?0:null,potentialWaterM:0,kind:groundM<0?'ocean':'land'}};}};
function seamSegments(mesh){
  const water=mesh.water,n=water.positions.length/3,list=[];
  for(const [key,count] of edges(water))if(count===1){const a=Math.floor(key/n),b=key%n,A=[...water.positions.subarray(a*3,a*3+3)],B=[...water.positions.subarray(b*3,b*3+3)];if(Math.abs(A[0]+A[2])<1e-7&&Math.abs(B[0]+B[2])<1e-7)list.push([A.map(x=>x.toPrecision(17)).join(':'),B.map(x=>x.toPrecision(17)).join(':')].sort().join('|'));}
  return list.sort();
}
test('water clipping agrees exactly across an independently built cube-face seam',()=>{
  const b=createTerrainChunkBuilder(ocean,{sampleCacheLimit:1}),tile={face:0,level:1,x:1,y:1},next=tileNeighbor(tile,'right'),a=b.combine([b.build(tile,{resolution:8})]),c=b.combine([b.build(next,{resolution:8})]);
  const first=seamSegments(a),second=seamSegments(c);assert.ok(first.length>0);assert.deepEqual(first,second);assert.ok(a.stats.shoreVertices>0&&c.stats.shoreVertices>0);
});
test('clipped water borders match a coarse tile and its two stitched finer neighbors',()=>{
  const b=createTerrainChunkBuilder(ocean),tile={face:0,level:1,x:1,y:1},neighbor=tileNeighbor(tile,'right'),keys=new Set([...terrainEdgeIndices(8,'right')].map(id=>terrainVertex(tile,8,id%9,(id/9)|0).key)),fine=[];
  for(let y=0;y<2;y++)for(let x=0;x<2;x++){const t={face:neighbor.face,level:2,x:neighbor.x*2+x,y:neighbor.y*2+y};for(const e of EDGES){const candidates=[...terrainEdgeIndices(8,e,true)].map(id=>terrainVertex(t,8,id%9,(id/9)|0).key);if(candidates.every(key=>keys.has(key)))fine.push(b.build(t,{resolution:8,coarseEdges:[e]}));}}
  assert.equal(fine.length,2);assert.deepEqual(seamSegments(b.combine([b.build(tile,{resolution:8})])),fine.flatMap(c=>seamSegments(b.combine([c]))).sort());
});
