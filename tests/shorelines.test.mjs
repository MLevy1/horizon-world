import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid,solvePlanet} from '../planet.mjs';
import {createSurfaceSampler} from '../surface-sampler.mjs';
import {sphereFaces,splitShoreArc,extractShorelines} from '../shorelines.mjs';

test('spherical shoreline triangulation is closed at every edge including the seam and unique poles',()=>{
  const g=createGrid({width:32,height:16}),edges=new Map();let faces=0;
  for(const f of sphereFaces(g)){faces++;assert.equal(new Set(f).size,3);for(let k=0;k<3;k++){const a=f[k],b=f[(k+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');edges.set(key,(edges.get(key)||0)+1);}}
  assert.equal(faces,2*g.count-4);assert.equal(g.count-edges.size+faces,2);for(const n of edges.values())assert.equal(n,2);
});
test('adaptive arc splitting catches a narrow off-centre mouth and refines its paired bank endpoints',()=>{
  const R=64000,a=[1,0,0],b=[Math.cos(.004),0,Math.sin(.004)],center=37.123,width=.3;
  const probe=p=>Math.abs(Math.atan2(p[2],p[0])*R-center)-width/2;
  const spans=splitShoreArc(a,b,probe,R);
  assert.deepEqual(spans.map(s=>s.portal),[false,true,false]);
  const portal=spans[1];for(const v of [portal.a,portal.b])assert.ok(Math.abs(probe(v))<1e-7);
  assert.equal(spans[0].from,0);assert.equal(spans.at(-1).to,1);
  assert.deepEqual(splitShoreArc(a,b,()=>Infinity,R).map(s=>s.portal),[false]);
  assert.deepEqual(splitShoreArc(a,b,()=>-1000,R).map(s=>s.portal),[true]);
  assert.throws(()=>splitShoreArc(a,b,probe,R,0));
});
test('shorelines include polar land and wrapped shores for an independent global world',()=>{
  const m=solvePlanet({seed:'SHORE-SEAM-POLES',world:{width:192,height:96,radiusKm:64},heightAt:(lon,lat)=>Math.abs(lat)>75?80:Math.cos(lon*Math.PI/180)*200-25});
  const s=createSurfaceSampler(m),r=extractShorelines(m,s);
  assert.equal(r.stats.faces,2*m.grid.count-4);assert.ok(r.paths.length>0);
  for(const path of r.paths)for(const p of path.points){assert.ok(Number.isFinite(p.lon)&&Number.isFinite(p.lat));assert.ok(Math.abs(s.sample(p.lon,p.lat).fitted.groundM-p.waterM)<.01);}
});

test('an alternate full-resolution planet keeps touching saddle lobes as closed rings',()=>{
  const m=solvePlanet({seed:'SHORE-ALTERNATE'}),s=createSurfaceSampler(m),r=extractShorelines(m,s);
  assert.equal(r.stats.faces,2359296);
  for(const ring of r.rings){assert.equal(ring.vertices[0],ring.vertices.at(-1));assert.equal(new Set(ring.vertices.slice(0,-1)).size,ring.vertices.length-1);}
  for(const path of r.paths)for(const p of path.points)assert.ok(Math.abs(s.sample(p.lon,p.lat).fitted.groundM-p.waterM)<.01);
});
