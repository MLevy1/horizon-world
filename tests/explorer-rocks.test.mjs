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
