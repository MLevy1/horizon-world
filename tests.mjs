import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,GRID,STEP,SIZE,HALF} from './world.mjs';
const a=createWorld(42);
test('drainage is calculated before final terrain, without cycles or uphill flow',()=>{
 assert.equal(a.stats.cells,GRID*GRID);
 assert.ok(a.stats.riverCells>200);
 for(let i=0;i<a.parent.length;i++){
  const p=a.parent[i];if(p<0)continue;
  assert.ok(a.filled[i]>=a.filled[p]-.003);
  assert.ok(a.acc[p]>=a.acc[i]);
  assert.ok(Math.abs(i%GRID-p%GRID)<=1 && Math.abs(Math.floor(i/GRID)-Math.floor(p/GRID))<=1);
 }
});
test('every modeled inland river has a real sea outlet',()=>{
 for(let i=0;i<a.river.length;i++)if(a.river[i]){
  assert.equal(a.sea[i],1);
  assert.ok(a.base[a.root[i]]<=0);
 }
});
test('final ground is cut from broad land after solving drainage',()=>{
 for(let x=-3000;x<=3000;x+=300)for(let z=-3000;z<=3000;z+=300){
  assert.ok(a.height(x,z)<=a.broad(x,z)+1e-6);
  assert.ok(Number.isFinite(a.height(x,z)));
 }
});
test('world seeds and query order are deterministic',()=>{
 const b=createWorld(42);const c=createWorld(43);
 for(const [x,z] of [[0,0],[1000,400],[-1700,-300],[2800,3400]])assert.deepEqual(a.inspect(x,z),b.inspect(x,z));
 assert.notEqual(a.height(400,500),c.height(400,500));
});
test('coastline and mountain belts both exist',()=>{
 assert.ok(a.height(-HALF+1,0)<0);
 assert.ok(a.height(HALF-1,0)>200);
});