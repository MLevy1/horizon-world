import test from 'node:test';
import assert from 'node:assert/strict';
import {scenicTiles,scenicFog} from '../explorer-visibility.mjs';
import {coveringTile} from '../terrain-lod.mjs';
import {terrainVertex,tileKey,tileNeighbor,EDGES,createTerrainChunkBuilder,coordinateTile} from '../terrain-chunks.mjs';
import {createGroundCollider,direction} from '../explorer-world.mjs';
test('scenic terrain covers all six faces at every flight altitude without gaps or unbalanced joins',()=>{
 for(const [lon,lat] of [[-63.071,-23.9648],[95.4212,-18.8666],[45,35.264389],[179.999,0],[0,89.99]])for(const clearance of [0,305,4000]){
  const tiles=scenicTiles(lon,lat,64000,{clearance}),map=new Map(tiles.map(v=>[tileKey(v.tile),v.tile]));assert.equal(tiles.reduce((s,v)=>s+4**-v.tile.level,0),6);assert.ok(tiles.length<1000);for(const {tile,coarseEdges} of tiles)for(const e of EDGES){const neighbor=coveringTile(map,tileNeighbor(tile,e));if(neighbor)assert.ok(Math.abs(tile.level-neighbor.level)<=1);assert.equal(coarseEdges.includes(e),neighbor?.level===tile.level-1);}for(let latitude=-80;latitude<=80;latitude+=20)for(let longitude=-180;longitude<180;longitude+=30)assert.ok(coveringTile(map,coordinateTile(longitude,latitude,13)));
 }
});
test('complete scenic geometry is closed and collision indexing stays local',()=>{
 const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:100,waterM:null}})}),tiles=scenicTiles(0,0,64000),mesh=b.combine(tiles.map(({tile,coarseEdges})=>b.build(tile,{resolution:4,coarseEdges}))),edges=new Map();for(let k=0;k<mesh.ground.indices.length;k+=3)for(let j=0;j<3;j++){const a=mesh.ground.indices[k+j],c=mesh.ground.indices[k+(j+1)%3],key=Math.min(a,c)+':'+Math.max(a,c);edges.set(key,(edges.get(key)||0)+1);}assert.equal(mesh.ground.boundaryIndices.length,0);assert.ok([...edges.values()].every(v=>v===2));const collide=createGroundCollider(mesh.ground,direction(0,0),64000);assert.ok(Math.abs(collide(direction(0,0))-100)<1e-6);assert.equal(collide(direction(20,0)),null);assert.ok(mesh.ground.positions.every(Number.isFinite));
});
test('alpine haze preserves nearby mountain contrast and is unrelated to flight speed',()=>{
 const fog=scenicFog({elevationM:4192,aridity:.3});assert.ok(Math.exp(-((1500*fog)**2))>.98);assert.equal(fog,scenicFog({elevationM:4192,aridity:.3,speed:1000}));assert.ok(fog<scenicFog({elevationM:100,aridity:2}));
});
