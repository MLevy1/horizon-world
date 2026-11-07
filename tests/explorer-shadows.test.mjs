import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowFrame,shadowCoordinates,sunlight,createSunShadows} from '../explorer-shadows.mjs';
import {direction,dot} from '../explorer-world.mjs';
import {createTerrainChunkBuilder,coordinateTile,neighborhood} from '../terrain-chunks.mjs';
test('sun projection remains orthonormal and local on both hemispheres and at poles',()=>{
 for(const [lon,lat] of [[0,0],[73,36],[-150,-60],[0,89.9],[179.9,0]]){
  const b=createTerrainChunkBuilder({grid:{radiusKm:64},sample:()=>({fitted:{groundM:2200,waterM:null}})}),mesh=b.combine(neighborhood(coordinateTile(lon,lat,9),1).map(t=>b.build(t,{resolution:8})));mesh.anchor=direction(lon,lat);const s=shadowFrame(mesh);for(const v of [s.light,s.right,s.up])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-12);assert.ok(Math.abs(dot(s.light,s.right))<1e-12);assert.ok(Math.abs(dot(s.up,s.right))<1e-12);assert.ok(dot(sunlight(mesh.anchor),mesh.anchor)>.7);assert.deepEqual(shadowCoordinates(s.center,s),[.5,.5,.5]);
  const towardSun=s.center.map((v,k)=>v+s.light[k]*10),shadow=shadowCoordinates(towardSun,s);assert.ok(shadow[2]<.5);assert.ok(Math.abs(shadow[0]-.5)<1e-12);assert.ok(Math.abs(shadow[1]-.5)<1e-12);assert.ok(s.half>s.fade&&s.range<s.fade);
 }
});
test('sun depth pass draws opaque and cutout casters, excludes water and terrain casters, and restores the default framebuffer',()=>{
 let serial=0;const calls=[],gl=new Proxy({MAX_TEXTURE_SIZE:1,FRAMEBUFFER_COMPLETE:2,getParameter:()=>2048,createProgram:()=>++serial,createTexture:()=>++serial,createFramebuffer:()=>++serial,getProgramParameter:()=>true,getUniformLocation:(_,key)=>key,checkFramebufferStatus:()=>2},{get:(t,k)=>k in t?t[k]:(...args)=>calls.push([k,...args])});
 const sun=createSunShadows(gl,()=>++serial,10,11),resources=[{vao:20,count:12},{vao:21,count:18,plants:true},{vao:22,count:6,water:true},{vao:23,count:24,terrain:true}],s={center:[0,0,0],right:[1,0,0],up:[0,1,0],light:[0,0,1],half:150,depth:512};assert.equal(sun.available,true);assert.equal(sun.size,1024);sun.render(resources,s);assert.equal(calls.filter(c=>c[0]==='drawElements').length,2);assert.equal(calls.filter(c=>c[0]==='bindFramebuffer').at(-1).at(-1),null);assert.deepEqual(calls.filter(c=>c[0]==='colorMask').at(-1),['colorMask',true,true,true,true]);sun.dispose();assert.equal(calls.filter(c=>c[0]==='deleteTexture').length,1);
});
