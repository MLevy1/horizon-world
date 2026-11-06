import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlantField,plantHabitat} from '../explorer-plants.mjs';
import {createTerrainChunkBuilder,neighborhood,coordinateTile} from '../terrain-chunks.mjs';
const habitat={depthM:0,glacier:0,lava:0,slope:.02,temperature:14,elevationM:100,aridity:1,snow:0,shore:.4};
test('plant habitats exclude water, lava and ice and distinguish cold woodland',()=>{
 for(const change of [{depthM:.1},{glacier:1},{lava:1},{slope:.5},{temperature:-12},{elevationM:3000}])assert.equal(plantHabitat({...habitat,...change}).density,0);
 assert.equal(plantHabitat(habitat).kind,'broadleaf');assert.equal(plantHabitat({...habitat,temperature:6}).kind,'conifer');assert.equal(plantHabitat({...habitat,aridity:.2}).kind,'shrub');
});
test('plant identities, dimensions and trunk positions persist across streamed views',()=>{
 const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:100,waterM:null}})}),mesh=b.combine(neighborhood(coordinateTile(0,0,8),2).map(t=>b.build(t,{resolution:16}))),options={seed:'forest',lon:0,lat:0,radiusM:64000,mesh,environment:()=>habitat},a=buildPlantField(options),c=buildPlantField({...options,lon:.018}),byId=new Map(c.placements.map(p=>[p.id,p]));let shared=0;
 for(const p of a.placements)if(byId.has(p.id)){shared++;assert.deepEqual(p,byId.get(p.id));}assert.ok(shared>5);assert.ok(a.positions.every(Number.isFinite));assert.ok(a.normals.every(Number.isFinite));assert.ok(a.indices.length/3<60000);assert.equal(buildPlantField({...options,environment:()=>({...habitat,depthM:1})}).placements.length,0);
});
