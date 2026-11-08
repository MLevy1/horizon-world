import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSediment,sampleSediment} from '../sediment.mjs';
import {createGrid,neighbors,distanceKm,solvePlanet,validatePlanet} from '../planet.mjs';
import {createSurfaceSampler} from '../surface-sampler.mjs';
test('weathering and transport conserve spherical grain inventories and actually move the ground',()=>{
 const grid=createGrid({width:64,height:32,radiusKm:8}),initial=new Float32Array(grid.count).fill(200),source=16*64+16;initial[source]=4000;
 const height=initial.slice(),s=generateSediment({grid,height,neighbors,distanceKm});
 assert.ok(s.stats.relativeVolumeError<1e-6);assert.ok(s.stats.depositedM3>0);assert.ok(height[source]<initial[source]);assert.ok(height.some((v,i)=>v>initial[i]+1));assert.ok(Math.abs(s.stats.depositedM3-s.stats.erodedM3)/s.stats.initialM3<1e-6);
 for(let i=0;i<grid.count;i++){for(const a of [s.coarse,s.gravel,s.fines])assert.ok(a[i]>=0);assert.ok(Math.abs(s.bedrock[i]+s.coarse[i]+s.gravel[i]+s.fines[i]-height[i])<.001);}
 const again=initial.slice();generateSediment({grid,height:again,neighbors,distanceKm});assert.deepEqual(again,height);
 const lava=new Float32Array(grid.count).fill(1),unchanged=initial.slice(),blocked=generateSediment({grid,height:unchanged,neighbors,distanceKm,lava});assert.deepEqual(unchanged,initial);assert.equal(blocked.stats.initialM3,0);
});
test('substrate interpolation supplies continuous proportions, stone coverage and soil depth',()=>{
 const s={coarse:Float32Array.of(10,0),gravel:Float32Array.of(5,0),fines:Float32Array.of(0,2),changeM:Float32Array.of(12,0)};let last=sampleSediment(s,[0,1],[0,1]);
 assert.ok(last.soilDepthM>1);assert.equal(last.stoneCover,0);
 for(let k=1;k<=1000;k++){const q=sampleSediment(s,[0,1],[k/1000,1-k/1000]);assert.ok(Math.abs(q.stoneCover-last.stoneCover)<.02);assert.ok(Math.abs(q.coarse+q.gravel+q.fines-1)<1e-7);last=q;}
 assert.equal(last.stoneCover,1);assert.equal(last.soilDepthM,0);
});
test('normal world generation solves water after sediment and uses that surface in geographic queries',()=>{
 const m=solvePlanet({seed:'sediment-integration',world:{width:128,height:64,radiusKm:8}});assert.ok(m.sediment);assert.ok(m.validation.ok);assert.ok(m.sediment.stats.changedCells>0);const surface=createSurfaceSampler(m),q=surface.sample(17,30);assert.ok(q.sediment.thicknessM>=0);assert.equal(q.talus,q.sediment.stoneCover);assert.equal(q.talusDepositM,q.sediment.depositM);m.sediment.stats.relativeVolumeError=1;assert.ok(!validatePlanet(m).ok);
});
