import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainChunkBuilder,coordinateTile} from '../terrain-chunks.mjs';
import {createGroundCollider,direction} from '../explorer-world.mjs';
import {meshWaterDepths,waterState,waterOpacity} from '../explorer-water.mjs';
test('a shallow channel retains its bed, transparent shores and correct eye immersion',()=>{
 const R=64000,surface={grid:{radiusKm:64},sample:(lon)=>{const x=lon*Math.PI/180*R,groundM=Math.abs(x)<5?10-.62*(1-(x/5)**2):10.5;return {fitted:{groundM,waterM:groundM<10?10:null,potentialWaterM:10}};}},b=createTerrainChunkBuilder(surface),mesh=b.combine([b.build(coordinateTile(0,0,12),{resolution:32})]),d=direction(-.0001,.001),g=createGroundCollider(mesh.ground,d,R)(d),w=createGroundCollider(mesh.water,d,R)(d),depths=meshWaterDepths(mesh);
 assert.ok(w-g>.59&&w-g<.64);assert.equal(waterState(g,w).submerged,false);assert.equal(waterState(g,w,true).submerged,true);assert.equal(waterState(g,null,true).submerged,false);assert.ok(depths.some(v=>v===0),'shore vertices have zero thickness');assert.ok(depths.every(v=>Number.isFinite(v)&&v>=0));assert.ok(waterOpacity(.1,1)<waterOpacity(.6,1));assert.ok(waterOpacity(0,1)<.03);assert.ok(waterOpacity(20,1)>.95);
});
