import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid,lonLat} from '../planet.mjs';
import {describeLocation,findMountain,findGlacier} from '../explorer-info.mjs';
const grid=createGrid({width:16,height:8,radiusKm:64}),values=v=>new Float32Array(grid.count).fill(v),model={grid,height:values(200),ocean:values(0),waterbody:values(-1),geology:{ids:values(-1),lava:values(0)},climate:{temperature:values(14),precipitation:values(900),aridity:values(1),zone:values(4)},cryosphere:{snowMonths:values(2),glacier:values(0),glaciers:[]}};
const sample={triangle:{cells:[0,1,2],weights:[.2,.3,.5]},fitted:{groundM:200,waterM:null,depthM:0},waterPlane:null,river:null},surface={sample:()=>sample};
test('location readout uses model climate units and identifies ice, mountains and water',()=>{
 const info=describeLocation(model,surface,0,0);assert.equal(info.biome,'Woodland');assert.equal(info.temperature,14);assert.equal(info.precipitation,900);assert.equal(info.snowMonths,2);assert.equal(info.climate,'Humid');
 assert.equal(describeLocation(model,{sample:()=>({...sample,fitted:{...sample.fitted,groundM:2400}})},0,0).biome,'Alpine mountains');assert.equal(describeLocation(model,{sample:()=>({...sample,fitted:{groundM:-3,waterM:0,depthM:3},waterPlane:{kind:'ocean'}})},0,0).biome,'Ocean');
});
test('mountain destination excludes volcanic sites and glacier cells',()=>{
 const m={...model,height:values(100),geology:{...model.geology,ids:values(-1)},cryosphere:{...model.cryosphere,glacier:values(0)}};m.height[1]=7000;m.geology.ids[1]=0;m.height[2]=8000;m.cryosphere.glacier[2]=1;m.height[3]=3500;const target=findMountain(m,(lon,lat)=>({lon,lat}));assert.equal(target.name,'Mountains');assert.deepEqual([target.lon,target.lat],lonLat(grid,3));
 const ice={...model,cryosphere:{...model.cryosphere,glacier:values(1),glaciers:[{areaKm2:1,peakCell:2},{areaKm2:5,peakCell:3}]}};const glacier=findGlacier(ice,surface);assert.equal(glacier.name,'Glacier');assert.deepEqual([glacier.lon,glacier.lat],lonLat(grid,3));
});
