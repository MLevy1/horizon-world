import test from 'node:test';
import assert from 'node:assert/strict';
import {solveHydrology,makeRelief,DOMAIN} from '../hydrology-model.mjs';
import {createHydrologicalTerrain} from '../hydrology-terrain.mjs';
function build(seed='HORIZON-01'){
 const heightAt=makeRelief(seed).height;
 return createHydrologicalTerrain(solveHydrology({seed,heightAt}),{heightAt});
}
test('viewer shares atlas receiver graph and never invents inland water',()=>{
 const g=build();assert.equal(g.model.stats.uphill,0);
 assert.ok(g.summary.segments>100);
 for(let x=-10000;x<10000;x+=197)for(let z=-10000;z<10000;z+=203){
  const s=g.sample(x,z);
  assert.ok(Number.isFinite(s.ground));
  assert.ok(s.ground<=s.raw+1e-8);
  assert.equal(s.water,null);
  if(s.feature)assert.equal(g.model.parent[s.feature.source],s.feature.receiver);
 }
});
test('world seeds produce deterministic geographic elevations',()=>{
 const a=build(),b=build(),c=build('OTHER');
 for(const [x,z] of [[0,0],[921,1755],[-12000,13000]])
  assert.deepEqual(a.sample(x,z),b.sample(x,z));
 assert.notEqual(a.sample(0,0).raw,c.sample(0,0).raw);
});
test('outside the bounded domain and at edges, original relief is preserved',()=>{
 const g=build();
 for(let z=-10000;z<=10000;z+=317){
  let a=g.sample(DOMAIN.minX+8,z),b=g.sample(DOMAIN.minX-8,z);
  assert.ok(Math.abs(a.ground-a.raw)<.001);
  assert.equal(b.ground,b.raw);assert.equal(b.domain,false);
 }
});
test('no artificial rendering-tile elevation seams are introduced',()=>{
 const g=build();
 for(let x=-8192;x<=8192;x+=4096)for(let z=-8000;z<=8000;z+=417)
  assert.ok(Math.abs(g.sample(x-.001,z).ground-g.sample(x+.001,z).ground)<.5);
});
