import test from 'node:test';
import assert from 'node:assert/strict';
import {createForestField} from '../explorer-forest.mjs';
import {buildPlantField} from '../explorer-plants.mjs';
import {scenicTiles} from '../explorer-visibility.mjs';
import {createTerrainChunkBuilder} from '../terrain-chunks.mjs';
const environment=()=>({depthM:0,glacier:0,lava:0,slope:.02,temperature:14,elevationM:100,aridity:1,snow:0,shore:0});
const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:100,waterM:null}})}),mesh=b.combine(scenicTiles(0,0,64000).map(({tile,coarseEdges})=>b.build(tile,{resolution:8,coarseEdges}))),options={seed:'forest-lod',lon:0,lat:0,radiusM:64000,mesh,environment};
test('distant forests continue beyond detailed trees and share identities and dimensions through the handoff',()=>{
 const field=createForestField(),far=field.build({...options,rangeM:900}),near=buildPlantField(options),ids=new Map(far.placements.map(p=>[p.id,p]));let common=0;for(const p of near.placements){if(p.kind==='shrub'||!ids.has(p.id))continue;const q=ids.get(p.id);common++;assert.deepEqual(p.direction,q.direction);assert.equal(p.heightM,q.heightM);assert.equal(p.kind,q.kind);}assert.ok(common>10);assert.ok(far.placements.some(p=>p.distanceM>700));assert.ok(far.indices.length/3<150000);assert.equal(far.foliage.length,far.positions.length);assert.ok(far.positions.every(Number.isFinite));assert.ok(far.indices.every(i=>i<far.positions.length/3));assert.equal(far.shadowCaster,false);
 const next=field.build({...options,lon:.018,rangeM:900}),nextIds=new Map(next.placements.map(p=>[p.id,p]));let shared=0;for(const p of far.placements)if(nextIds.has(p.id)){shared++;assert.equal(p.heightM,nextIds.get(p.id).heightM);assert.deepEqual(p.direction,nextIds.get(p.id).direction);}assert.ok(shared>100);assert.ok(next.stats.sampled<far.stats.sampled/2);assert.ok(next.stats.cacheEntries<=next.stats.cacheLimit);
});
test('distant forests remain visible directly underneath high flight and exclude open habitats and water',()=>{
 const field=createForestField(),a=field.build({...options,rangeM:400,detailed:false});assert.ok(a.placements.some(p=>p.distanceM<80));for(const change of [{aridity:.55},{depthM:1},{glacier:1},{elevationM:3000}])assert.equal(field.build({...options,seed:'excluded'+JSON.stringify(change),rangeM:400,environment:()=>({...environment(),...change})}).placements.length,0);
});
