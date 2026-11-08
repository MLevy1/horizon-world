import {buildPlantField} from '../explorer-plants.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {forestBlend,branchVisibility,crownLobes,forestUV,packedBuffer} from '../forest-structure.mjs';
import {createForestField} from '../explorer-forest.mjs';
import {createTerrainChunkBuilder,neighborhood,coordinateTile} from '../terrain-chunks.mjs';
test('canopy and wood transitions span many metres and stagger between individual trees',()=>{
 assert.equal(forestBlend(100,0),0);assert.equal(forestBlend(450,1),1);assert.ok(forestBlend(270,0)>forestBlend(270,1)+.2);let last=0;for(let d=0;d<600;d+=.5){const t=forestBlend(d,.4);assert.ok(t>=last&&t-last<.005);last=t;}assert.ok(branchVisibility(120,.5)>.5);assert.equal(branchVisibility(300,.5),0);
});
test('tropical, temperate, conifer and mangrove crowns have shared, bounded but distinct silhouettes',()=>{
 const kinds=['broadleaf','conifer','tropical','mangrove'];assert.equal(new Set(kinds.map(k=>JSON.stringify(crownLobes(k)))).size,4);assert.equal(new Set(kinds.map(k=>forestUV(k)[0][0])).size,4);
 for(const kind of kinds)for(const c of crownLobes(kind)){assert.ok(Math.abs(c.x)+c.rx<=1.1);assert.ok(Math.abs(c.z)+c.rz<=1.1);assert.ok(c.y-c.ry>=0&&c.y+c.ry<=1.001);}
 assert.ok(Math.min(...crownLobes('tropical').map(c=>c.y-c.ry))>Math.min(...crownLobes('broadleaf').map(c=>c.y-c.ry))+.1);
});
test('crowns persist under the camera and across the aerial flag without resizing at 300 metres',()=>{
 const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:100,waterM:null}})}),mesh=b.combine(neighborhood(coordinateTile(0,0,8),2).map(t=>b.build(t,{resolution:16}))),environment=()=>({depthM:0,glacier:0,lava:0,slope:.02,temperature:28,elevationM:100,aridity:2,snow:0,shore:0}),options={seed:'persistent-canopy',lon:0,lat:0,radiusM:64000,mesh,environment,rangeM:400},f=createForestField(),a=f.build({...options,detailed:true}),c=f.build({...options,detailed:false});assert.deepEqual(a.placements,c.placements);assert.ok(a.placements.some(p=>p.distanceM<40));assert.equal(a.treeLOD.length,a.positions.length/3*4);assert.ok(buildPlantField({...options,cameraHeightM:100}).placements.length>0);assert.equal(buildPlantField({...options,cameraHeightM:1000}).placements.length,0);
 const next=f.build({...options,lon:.05}),map=new Map(next.placements.map(p=>[p.id,p]));let shared=0;for(const p of a.placements)if(map.has(p.id)){shared++;assert.equal(p.crownWidthM,map.get(p.id).crownWidthM);assert.equal(p.kind,map.get(p.id).kind);}assert.ok(shared>100);
});

test('packed forest geometry retains vertices and indices across typed chunk boundaries',()=>{const vertices=packedBuffer(),indices=packedBuffer(Uint32Array);for(let i=0;i<20000;i++){vertices.push(i,i+.25,i+.5);indices.push(i);}const v=vertices.finish(),ids=indices.finish();assert.equal(v.length,60000);assert.equal(ids.length,20000);for(const i of [0,5461,5462,10922,19999]){assert.equal(v[i*3],i);assert.equal(v[i*3+2],i+.5);assert.equal(ids[i],i);}});
