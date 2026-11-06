import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainChunkBuilder,terrainVertex,directionTile,coordinateTile,tileNeighbor,terrainEdgeIndices,neighborhood,EDGES,tileKey} from '../terrain-chunks.mjs';
const sampler={grid:{radiusKm:64},sample:(lon,lat)=>({fitted:{groundM:100*Math.sin(lon*Math.PI/180)*Math.cos(lat*Math.PI/180),waterM:lat<0?120:null}})};
const builder=createTerrainChunkBuilder(sampler);
function edgeKeys(tile,n,edge,coarse=false){return [...terrainEdgeIndices(n,edge,coarse)].map(id=>terrainVertex(tile,n,id%(n+1),(id/(n+1))|0).key);}
function edgeSegments(keys){return keys.slice(1).map((key,i)=>[keys[i],key].sort().join('|')).sort();}
function topology(chunk){
  const edges=new Map(),used=new Set(),n=chunk.positions.length/3,p=chunk.positions;
  for(let k=0;k<chunk.indices.length;k+=3){const t=[...chunk.indices.subarray(k,k+3)];for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3];assert.ok(a<n&&b<n&&a!==b);used.add(a);const key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);}
    const [a,b,c]=t.map(i=>i*3),u=[0,1,2].map(j=>p[b+j]-p[a+j]),v=[0,1,2].map(j=>p[c+j]-p[a+j]);assert.ok((u[1]*v[2]-u[2]*v[1])*p[a]+(u[2]*v[0]-u[0]*v[2])*p[a+1]+(u[0]*v[1]-u[1]*v[0])*p[a+2]>0);
  }
  for(const count of edges.values())assert.ok(count===1||count===2);return {edges,used};
}
test('all cube-face neighbors share canonical border samples, including every face seam and corner',()=>{
  for(const level of [0,1,3])for(let face=0;face<6;face++)for(let y=0;y<2**level;y++)for(let x=0;x<2**level;x++){
    const tile={face,level,x,y};for(const edge of EDGES){const next=tileNeighbor(tile,edge),back=EDGES.find(e=>tileKey(tileNeighbor(next,e))===tileKey(tile));assert.ok(back);
      assert.deepEqual(edgeKeys(tile,8,edge).sort(),edgeKeys(next,8,back).sort());
    }
  }
});
test('a coarse edge and its two finer neighbors use identical stitched segments on all six faces',()=>{
  for(let face=0;face<6;face++)for(const edge of EDGES){
    const tile={face,level:1,x:edge==='right'?1:0,y:edge==='top'?1:0},neighbor=tileNeighbor(tile,edge),keys=edgeKeys(tile,8,edge),set=new Set(keys),fine=[];
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const t={face:neighbor.face,level:2,x:neighbor.x*2+dx,y:neighbor.y*2+dy};for(const e of EDGES){const candidates=edgeKeys(t,8,e,true);if(candidates.every(key=>set.has(key))){const mesh=builder.build(t,{resolution:8,coarseEdges:[e]});topology(mesh);fine.push(...edgeSegments(candidates));}}}
    assert.equal(fine.length,8);assert.deepEqual(fine.sort(),edgeSegments(keys));
  }
});
test('every combination of coarse-neighbor edges produces a conforming disk including stitched corners',()=>{
  for(let face=0;face<6;face++)for(let mask=0;mask<16;mask++){
    const coarseEdges=EDGES.filter((_,k)=>mask&(1<<k)),chunk=builder.build({face,level:2,x:1,y:1},{resolution:8,coarseEdges}),{edges,used}=topology(chunk);
    assert.equal(used.size-edges.size+chunk.indices.length/3,1);assert.equal([...edges.values()].filter(n=>n===1).length,32-coarseEdges.length*4);
  }
});
test('six overview faces combine into one closed sphere with shared polar and seam vertices',()=>{
  const mesh=builder.combine(Array.from({length:6},(_,face)=>builder.build({face,level:0,x:0,y:0},{resolution:8}))),{edges,used}=topology(mesh.ground);
  for(const count of edges.values())assert.equal(count,2);assert.equal(used.size-edges.size+mesh.ground.indices.length/3,2);assert.ok(mesh.stats.sharedVertices>0);
});
test('global addresses cover arbitrary directions and cached samples remain bounded and deterministic',()=>{
  const bounded=createTerrainChunkBuilder(sampler,{sampleCacheLimit:50}),t={face:2,level:3,x:3,y:4},a=bounded.build(t,{resolution:8}),b=bounded.build(t,{resolution:8});assert.deepEqual(a.positions,b.positions);assert.ok(bounded.cacheStats().entries<=50);
  for(let lat=-90;lat<=90;lat+=15)for(let lon=-180;lon<180;lon+=30){const tile=coordinateTile(lon,lat,12);assert.ok(tile.face>=0&&tile.face<6);assert.ok(neighborhood(tile).length>=9);}
  assert.throws(()=>directionTile([0,0,0],2));assert.throws(()=>coordinateTile(0,91,2));assert.throws(()=>bounded.build(t,{resolution:7}));assert.throws(()=>terrainVertex(t,8,-1,0));assert.throws(()=>tileNeighbor(t,'bad'));
});
