import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRockField,rockBlocks} from '../explorer-rocks.mjs';
import {createTerrainChunkBuilder,neighborhood,coordinateTile} from '../terrain-chunks.mjs';
import {direction} from '../explorer-world.mjs';
test('streamed rock placements retain identity across views and avoid deep water',()=>{
 const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:20,waterM:null}})}),mesh=b.combine(neighborhood(coordinateTile(0,0,8),2).map(t=>b.build(t,{resolution:16}))),environment=()=>({depthM:0,snow:0,glacier:0,lava:0,slope:.3,shore:.5}),options={seed:'stable-rocks',lon:0,lat:0,radiusM:64000,mesh,environment},a=buildRockField(options),c=buildRockField({...options,lon:.018}),byId=new Map(c.placements.map(p=>[p.id,p]));let shared=0;
 for(const p of a.placements){const other=byId.get(p.id);if(other){shared++;assert.deepEqual(p,other);}}
 assert.ok(shared>10);assert.ok(a.placements.length<250);assert.ok(a.indices.length/3<80000);assert.ok(a.positions.every(Number.isFinite));assert.ok(a.normals.every(Number.isFinite));assert.equal(buildRockField({...options,environment:()=>({...environment(),depthM:2})}).placements.length,0);
 const rock=a.placements.find(p=>p.topM-p.groundM>.5);assert.ok(rock);assert.equal(rockBlocks([rock],rock.direction,rock.groundM,64000),true);assert.equal(rockBlocks([rock],direction(2,0),20,64000),false);
});
test('sediment fields retain simplified distant rocks and rendered water excludes submerged clasts',()=>{
 const sample=waterM=>({grid:{radiusKm:64},sample:()=>({fitted:{groundM:20,waterM,kind:waterM===null?'land':'pool'}})}),b=createTerrainChunkBuilder(sample(null)),tiles=neighborhood(coordinateTile(0,0,8),2),mesh=b.combine(tiles.map(t=>b.build(t,{resolution:16}))),environment=()=>({depthM:0,snow:0,glacier:0,lava:0,slope:0,shore:0,talus:1,sediment:{coarse:.8,gravel:.2,fines:0}}),options={seed:'deposit-rocks',lon:0,lat:0,radiusM:64000,mesh,environment,rangeM:450},field=buildRockField(options);
 const distant=field.placements.filter(p=>Math.hypot(...p.direction.map((v,k)=>v-direction(0,0)[k]))*64000>200);assert.ok(distant.length>100);assert.ok(field.indices.length/3<220000,'distant rock representation must fit a bounded geometry budget');assert.ok(field.placements.length>500,'a deposit needs substantially more than occasional decorative rocks');
 const wet=createTerrainChunkBuilder(sample(25)),wetMesh=wet.combine(tiles.map(t=>wet.build(t,{resolution:16})));assert.equal(buildRockField({...options,mesh:wetMesh}).placements.length,0,'rendered depth excludes rocks even when the habitat sample is dry');
});
