import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGroundField,groundHabitat} from '../explorer-ground.mjs';
import {createTerrainChunkBuilder,neighborhood,coordinateTile} from '../terrain-chunks.mjs';
const base={depthM:0,glacier:0,snow:0,lava:0,slope:.01,shore:0,temperature:15,aridity:1};
test('ground detail covers each environment and excludes submerged placements',()=>{
 const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:100,waterM:null}})}),mesh=b.combine(neighborhood(coordinateTile(0,0,8),1).map(t=>b.build(t,{resolution:16}))),options={seed:'ground',lon:0,lat:0,radiusM:64000,mesh};
 for(const [kind,change] of [['woodland',{}],['desert',{aridity:.2}],['snow',{snow:1}],['rubble',{lava:1}],['bank',{shore:1}],['tundra',{temperature:-10}],['scree',{slope:.6}]]){
  const environment=()=>({...base,...change});assert.equal(groundHabitat(environment()).kind,kind);const a=buildGroundField({...options,environment});assert.ok(a.placements.length>30,kind);assert.ok(a.indices.length/3<50000);assert.ok(a.positions.every(Number.isFinite));assert.ok(a.normals.every(Number.isFinite));assert.equal(a.colors.length,a.positions.length);assert.equal(a.shade.length,a.positions.length/3);assert.ok(a.indices.every(i=>i<a.positions.length/3));
  if(kind==='woodland'){assert.ok(a.placements.some(p=>p.form==='fern'));assert.ok(a.placements.some(p=>p.form==='deadwood'));const c=buildGroundField({...options,lon:.018,environment}),byId=new Map(c.placements.map(p=>[p.id,p]));let shared=0;for(const p of a.placements)if(byId.has(p.id)){assert.deepEqual(p,byId.get(p.id));shared++;}assert.ok(shared>50);console.log('Woodland ground clusters:',a.placements.length,'triangles:',a.indices.length/3);}
 }
 assert.equal(buildGroundField({...options,environment:()=>({...base,depthM:2})}).indices.length,0);
});
