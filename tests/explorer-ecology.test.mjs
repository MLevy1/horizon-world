import test from 'node:test';
import assert from 'node:assert/strict';
import {ecologyHabitat,buildCoastalFields} from '../explorer-ecology.mjs';
import {plantHabitat} from '../explorer-plants.mjs';
import {groundHabitat} from '../explorer-ground.mjs';
import {createGrid} from '../planet.mjs';
const coast={depthM:0,coastNear:1,coastExposure:.5,elevationM:2,slope:.002,temperature:14,aridity:1,snow:0,glacier:0,lava:0,shore:0};
test('coastal habitats keep tall temperate trees off low wet and exposed shores',()=>{
 assert.equal(ecologyHabitat(coast).biome,'Salt marsh');assert.equal(plantHabitat(coast).density,0);assert.equal(groundHabitat(coast).kind,'bank');assert.equal(ecologyHabitat({...coast,aridity:.2,elevationM:5}).biome,'Dune scrub');assert.equal(plantHabitat({...coast,aridity:.2,elevationM:5}).kind,'shrub');assert.equal(ecologyHabitat({...coast,slope:.25,elevationM:20}).biome,'Rocky coast');assert.equal(ecologyHabitat({...coast,elevationM:8}).biome,'Coastal grassland');
 const mangrove={...coast,temperature:25,elevationM:1,coastExposure:.2};assert.equal(ecologyHabitat(mangrove).biome,'Mangrove margin');assert.equal(plantHabitat(mangrove).kind,'mangrove');assert.notEqual(ecologyHabitat({...mangrove,coastExposure:.8}).biome,'Mangrove margin');assert.notEqual(ecologyHabitat({...mangrove,temperature:8}).biome,'Mangrove margin');assert.equal(ecologyHabitat({...coast,coastNear:0}),null);assert.equal(plantHabitat({...coast,coastNear:0}).kind,'broadleaf');assert.equal(ecologyHabitat({...coast,coastNear:0,temperature:26,aridity:1.5}).biome,'Tropical forest');
});
test('coastal fields buffer the actual ocean mask and retain a noncoastal interior',()=>{
 const grid=createGrid({width:32,height:16,radiusKm:64}),ocean=new Uint8Array(grid.count);for(let y=0;y<16;y++)for(let x=0;x<10;x++)ocean[y*32+x]=1;const result=buildCoastalFields({grid,ocean});assert.equal(result.band[8*32+2],0);assert.equal(result.band[8*32+10],1);assert.equal(result.band[8*32+18],255);assert.ok(result.exposure[8*32+10]>0);assert.ok(result.exposure.every(v=>v>=0&&v<=1));
});

test('open biome labels and placement policies agree on tree cover',async()=>{
 const {landHabitat}=await import('../explorer-ecology.mjs');
 for(const [aridity,biome] of [[.2,'Desert'],[.55,'Dry grassland'],[.75,'Grassland']]){const e={...coast,coastNear:0,elevationM:60,aridity};assert.equal(landHabitat(e).biome,biome);assert.equal(plantHabitat(e).kind,'shrub');assert.ok(plantHabitat(e).density<=.12);assert.notEqual(groundHabitat(e).kind,'woodland');}
 assert.equal(landHabitat({...coast,coastNear:0,elevationM:4000}).trees,'bare');
});

test('dry coastal slopes do not become a narrow belt of tall woodland',()=>{
 for(const aridity of [.59,.65,.75]){const e={...coast,elevationM:16,slope:.014,aridity};assert.equal(plantHabitat(e).kind,'shrub');assert.equal(ecologyHabitat(e).biome,aridity<.7?'Dune scrub':'Coastal grassland');}
 assert.equal(plantHabitat({...coast,elevationM:20,aridity:1}).kind,'broadleaf');
});
test('the reported bare hillside has persistent herb cover, with mineral and water exclusions',async()=>{
 const {meadowAppearance}=await import('../explorer-ecology.mjs');
 for(const [elevationM,aridity,slope] of [[41,.621,.018],[89,.639,.037],[254,.743,.113],[554,.641,.101]]){
  const e={...coast,coastNear:0,elevationM,aridity,slope},a=meadowAppearance(e);assert.ok(a.cover>.8);assert.ok(a.tint.every(v=>v>0&&v<1));assert.equal(plantHabitat(e).kind,'shrub');
 }
 for(const changes of [{aridity:.2},{depthM:1},{glacier:1},{lava:1},{elevationM:3000},{slope:.6}])assert.equal(meadowAppearance({...coast,coastNear:0,elevationM:100,aridity:.65,...changes}).cover,0);
 const dry=meadowAppearance({...coast,coastNear:0,elevationM:100,aridity:.55}),wet=meadowAppearance({...coast,coastNear:0,elevationM:100,aridity:.79});assert.ok(dry.tint[0]>wet.tint[0]);
});
