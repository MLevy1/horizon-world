import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainMaterialWeights,makeTerrainTextures,sampleTerrainTextureLevel,MATERIALS} from '../terrain-materials.mjs';
const base={aridity:1,snow:0,glacier:0,lava:0,slope:0,shore:0,coast:0};
test('climate, slope and wet contact produce normalized ground blends',()=>{
 for(const [change,expected] of [[{},0],[{aridity:.1},1],[{slope:.8},2],[{snow:12},3],[{lava:1},4],[{shore:1},5]]){
  const weights=terrainMaterialWeights({...base,...change});assert.ok(weights.every(v=>Number.isFinite(v)&&v>=0));assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-6);assert.ok(weights[expected]>.9);
 }
 const shore=terrainMaterialWeights({...base,snow:12,shore:1});assert.ok(shore[5]>shore[3],'wet shoreline exposes gravel through snow');
 const mixed=terrainMaterialWeights({...base,aridity:.3,snow:8,lava:.3,slope:.4,shore:.5});assert.ok(Math.abs(mixed.reduce((a,b)=>a+b,0)-1)<1e-6);
});
test('shared image mips retain six layers and world phase across streaming origins',()=>{
 const textures=makeTerrainTextures();assert.equal(textures,makeTerrainTextures());assert.equal(textures.levels.at(-1).size,1);
 const a=new Float32Array(3),b=new Float32Array(3);
 for(let m=0;m<MATERIALS.length;m++)for(let k=0;k<textures.levels.length;k++){
  const level=textures.levels[k];assert.equal(level.data.length,level.size**2*4*6);
  sampleTerrainTextureLevel(textures,m,-23.17,51.27,k,a);sampleTerrainTextureLevel(textures,m,-23.17+128,51.27-128,k,b);assert.deepEqual(a,b);
 }
 assert.ok(textures.levels.reduce((sum,l)=>sum+l.data.byteLength,0)<2.1*1024*1024);
});

test('cold alpine ground favors rock over desert sand even in an arid climate',()=>{const w=terrainMaterialWeights({elevationM:4000,temperature:-4,aridity:.1,snow:6,glacier:0,lava:0,slope:.02,shore:0,coast:0});assert.ok(w[2]>w[1]);assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-6);});
