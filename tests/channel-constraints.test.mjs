import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid} from '../planet.mjs';
import {sphereFaceIndex,nearestConstraintStation} from '../channel-constraints.mjs';
import {constraintSectionSvg} from '../constraint-view.mjs';

test('constraint station lookup clamps to saved endpoint choices and rejects invalid requests',()=>{
  const c={edges:{stationOffsets:Uint32Array.of(0,4)},stations:{t:Float64Array.of(0,.3,.5,1)}};
  assert.equal(nearestConstraintStation(c,0,.28),1);assert.equal(nearestConstraintStation(c,0,0),0);assert.equal(nearestConstraintStation(c,0,1),3);
  for(const args of [[-1,0],[1,0],[0,NaN],[0,2]])assert.throws(()=>nearestConstraintStation(c,...args));
  const g=createGrid({width:32,height:16});assert.equal(sphereFaceIndex(g,[g.north,g.north,g.north]),-1);assert.equal(sphereFaceIndex(g,[g.south,g.south,g.south]),-1);
});
test('fitted constraint plots retain dry gaps and open standing water without NaN geometry',()=>{
  const samples=Array.from({length:9},(_,k)=>({offsetM:k-4,groundM:9+(k-4)**2/8,waterM:k>1&&k<7?10:null}));
  const dry=constraintSectionSvg({samples:samples.map(p=>({...p,waterM:null}))}),wet=constraintSectionSvg({samples});
  assert.ok(!dry.includes('profile-water-fill'));assert.ok(wet.includes('profile-water-fill'));assert.equal((wet.match(/class="profile-dot"/g)||[]).length,9);assert.ok(!/NaN|Infinity/.test(wet+dry));
  const open=constraintSectionSvg({samples:samples.map(p=>({...p,groundM:8,waterM:10}))});assert.equal((open.match(/class="fitted-water-dot"/g)||[]).length,9);
});
