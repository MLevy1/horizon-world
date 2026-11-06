import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTerrainTiles,coveringTile,panTerrainView} from '../terrain-lod.mjs';
import {createTerrainStream,createTerrainViewQueue} from '../terrain-stream.mjs';
import {tileKey,tileNeighbor,coordinateTile,neighborhood,EDGES} from '../terrain-chunks.mjs';
const positions=[[0,0],[45,35.264389],[135,-35.264389],[0,90],[0,-90],[-180,0],[-78.33974,-41.71876]];
const sampler={grid:{radiusKm:64},sample:(lon,lat)=>{const h=100*(Math.sin(lat*Math.PI/180)-.123);return {fitted:{groundM:h,waterM:h<0?0:null,potentialWaterM:0,kind:h<0?'ocean':'land'}};}};
function checkTopology(mesh){
  const edges=new Map(),key=(a,b)=>a<b?a+':'+b:b+':'+a,g=mesh.ground,boundary=new Set();
  for(let k=0;k<g.boundaryIndices.length;k+=2)boundary.add(key(g.boundaryIndices[k],g.boundaryIndices[k+1]));
  for(let k=0;k<g.indices.length;k+=3)for(let j=0;j<3;j++){const edge=key(g.indices[k+j],g.indices[k+(j+1)%3]);edges.set(edge,(edges.get(edge)||0)+1);}
  for(const [edge,count] of edges)assert.equal(count,boundary.has(edge)?1:2,edge);
}
test('automatic LOD selection covers its complete roots without overlaps and balances every edge at seams and poles',()=>{
  for(const [lon,lat] of positions)for(const level of [8,10.5,12,14]){
    const selected=selectTerrainTiles(lon,lat,{level}),map=new Map(selected.map(v=>[tileKey(v.tile),v.tile]));assert.ok(selected.length<=160);
    const expected=neighborhood(coordinateTile(lon,lat,Math.ceil(level)-2),2).length*4**-(Math.ceil(level)-2);
    assert.equal(selected.reduce((s,v)=>s+4**-v.tile.level,0),expected);
    for(const {tile,coarseEdges} of selected){
      if(tile.level)assert.equal(coveringTile(map,{...tile,level:tile.level-1,x:tile.x>>1,y:tile.y>>1}),null);
      for(const edge of EDGES){const other=coveringTile(map,tileNeighbor(tile,edge));if(other)assert.ok(tile.level-other.level<=1);assert.equal(coarseEdges.includes(edge),other?.level===tile.level-1);}
    }
    const center=coveringTile(map,coordinateTile(lon,lat,Math.ceil(level)));assert.equal(center.level,Math.ceil(level));assert.ok(new Set(selected.map(v=>v.tile.level)).size>1);
  }
});
test('stitched automatic neighborhoods have no internal ground cracks, including sea shores and cube corners',()=>{
  const stream=createTerrainStream(sampler,{resolution:8});
  for(const [lon,lat] of [[45,35.264389],[0,90],[0,-90],[-180,7.065],[-78.3,-41.7]]){const mesh=stream.view(lon,lat);checkTopology(mesh);assert.equal(mesh.stats.ambiguousWaterTriangles,0);assert.ok(mesh.stats.maxLevel>mesh.stats.minLevel);assert.ok(mesh.stats.sharedVertices>0);}
});
test('repeated and overlapping views reuse chunks and transferring results leaves the cache intact',()=>{
  const stream=createTerrainStream(sampler,{resolution:8}),a=stream.view(0,0),expected=[...a.ground.positions];assert.ok(a.stream.built>0);
  structuredClone(a,{transfer:[a.ground.positions.buffer,a.water.positions.buffer]});const b=stream.view(0,0);assert.equal(b.stream.built,0);assert.equal(b.stream.reused,b.stats.chunks);assert.deepEqual([...b.ground.positions],expected);
  const c=stream.view(.001,0);assert.ok(c.stream.reused>0);assert.ok(c.stream.cacheBytes<=c.stream.cacheLimitBytes);
});
test('cache eviction respects its byte limit and regeneration preserves geometry',()=>{
  const stream=createTerrainStream(sampler,{resolution:8,cacheBytes:100000}),a=stream.view(0,0);assert.ok(a.stream.evicted>0);assert.ok(a.stream.cacheBytes<=100000);stream.view(100,80);const b=stream.view(0,0);assert.deepEqual(a.ground.positions,b.ground.positions);assert.deepEqual(a.water.indices,b.water.indices);assert.ok(b.stream.cacheBytes<=100000);
});
test('camera panning uses screen scale and remains finite across longitude and polar boundaries',()=>{
  const viewport={width:1000,height:500,tilt:45};for(const [lon,lat] of positions){const next=panTerrainView({lon,lat,level:10},-500,300,viewport);assert.ok(Number.isFinite(next.lon)&&Number.isFinite(next.lat));assert.ok(next.lon>=-180&&next.lon<=180&&next.lat>=-90&&next.lat<=90);}
  const a=panTerrainView({lon:0,lat:0,level:10},-100,0,viewport),b=panTerrainView({lon:0,lat:0,level:11},-100,0,viewport);assert.ok(a.lon>b.lon&&b.lon>0);assert.ok(Math.abs(a.lon/b.lon-2)<1e-5);
});
test('stream queue coalesces movement, discards stale results, and cannot accept results from a previous world',()=>{
  const sent=[],accepted=[],queue=createTerrainViewQueue(v=>sent.push(v),v=>accepted.push(v));queue.request({lon:1});queue.request({lon:2});queue.request({lon:3});assert.equal(sent.length,1);assert.equal(queue.finish(sent[0]),false);assert.equal(sent.length,2);assert.equal(sent[1].lon,3);assert.equal(queue.finish(sent[1]),true);assert.equal(accepted.length,1);
  queue.request({lon:4});queue.invalidate();assert.equal(queue.finish(sent[2]),false);assert.equal(accepted.length,1);queue.request({lon:5});const old=sent.at(-1);queue.reset();queue.request({lon:6});assert.equal(queue.finish(old),false);assert.equal(queue.finish(sent.at(-1)),true);assert.equal(accepted.at(-1).lon,6);
});
test('invalid camera and cache budgets are rejected',()=>{
  assert.throws(()=>selectTerrainTiles(0,91));assert.throws(()=>selectTerrainTiles(0,0,{level:15}));assert.throws(()=>selectTerrainTiles(0,0,{aspect:0}));assert.throws(()=>createTerrainStream(sampler,{cacheBytes:-1}));assert.throws(()=>panTerrainView({lon:0,lat:0,level:12},1,1,{width:0,height:500}));
});
