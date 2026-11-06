import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid,lonLat,neighbors} from '../planet.mjs';
import {createSphereSampler} from '../surface-sampler.mjs';

const g=createGrid({width:96,height:48,radiusKm:64}),height=new Float64Array(g.count);
for(let i=0;i<g.count;i++){const [lon,lat]=lonLat(g,i);height[i]=500*Math.sin(lat*Math.PI/180)+70*Math.cos(lon*Math.PI/180)*Math.cos(lat*Math.PI/180);}
const mesh=createSphereSampler(g,height),unit=p=>{const d=Math.hypot(...p);return p.map(v=>v/d);};

test('spherical sampling reproduces every node including both unique poles',()=>{
  for(let i=0;i<g.count;i++){const [lon,lat]=lonLat(g,i),q=mesh.locate(lon,lat);assert.ok(Math.abs(q.terrainM-height[i])<1e-8);}
});
test('all longitudes wrap and every latitude band remains covered without a bounded region',()=>{
  for(let lat=-89.99;lat<90;lat+=1.71)for(let lon=-180;lon<180;lon+=3.13){
    const a=mesh.locate(lon,lat),b=mesh.locate(lon+720,lat);
    assert.ok(Number.isFinite(a.terrainM));assert.ok(Math.abs(a.terrainM-b.terrainM)<1e-7);
    assert.ok(Math.abs(a.weights.reduce((s,v)=>s+v,0)-1)<1e-12);
  }
  for(const lat of [-90,-89.999999,0,89.999999,90]){
    const a=mesh.locate(-180,lat),b=mesh.locate(180,lat);assert.equal(a.terrainM,b.terrainM);
  }
});
test('shared triangle edges use the same projective radial interpolation',()=>{
  const near=new Int32Array(g.width);
  for(let i=0;i<g.count;i+=17){
    const count=neighbors(g,i,near),a=mesh.directionAt(i);
    for(let k=0;k<count;k+=Math.max(1,Math.floor(count/7))){
      const j=near[k],b=mesh.directionAt(j),t=.37;
      const q=mesh.sampleDirection(unit(a.map((v,k)=>v*(1-t)+b[k]*t)));
      assert.ok(Math.abs(q.terrainM-(height[i]*(1-t)+height[j]*t))<1e-6);
    }
  }
});
test('invalid coordinates and zero directions are rejected rather than clamped into an unrelated cell',()=>{
  for(const [lon,lat] of [[NaN,0],[0,Infinity],[0,91]])assert.throws(()=>mesh.locate(lon,lat));
  assert.throws(()=>mesh.sampleDirection([0,0,0]));
});
