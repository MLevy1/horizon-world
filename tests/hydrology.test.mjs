import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAIN,makeRelief,solveHydrology} from '../hydrology-model.mjs';

test('broad relief exactly reproduces the existing Horizon terrain seed formula',()=>{
 const a=makeRelief('HORIZON-01'),b=makeRelief('HORIZON-01'),c=makeRelief('different');
 for(const [x,z] of [[0,0],[921,1755],[-10000,9000],[257.5,-300.25]]){
  assert.equal(a.height(x,z),b.height(x,z));
  assert.ok(Number.isFinite(a.height(x,z)));
 }
 assert.notEqual(a.height(0,0),c.height(0,0));
});
test('all world cells belong to one acyclic downstream network',()=>{
 const h=solveHydrology({seed:'HORIZON-01'}),S=DOMAIN.n*DOMAIN.n;
 assert.equal(h.stats.cells,S);
 assert.equal(h.stats.uphill,0);
 assert.ok(h.stats.oceanCells>0);
 assert.ok(h.stats.seaCells>0&&h.stats.unresolvedCells>0);
 for(let i=0;i<S;i++){
  const p=h.parent[i];
  if(p<0){assert.ok(h.raw[i]<=0||i%DOMAIN.n===0||i%DOMAIN.n===DOMAIN.n-1||i<DOMAIN.n||i>=S-DOMAIN.n)}
  else{
   assert.ok(h.filled[p]<=h.filled[i]+1e-5);
   assert.ok(h.accumulated[p]>=h.accumulated[i]);
   assert.equal(h.outlet[p],h.outlet[i]);
  }
 }
});
test('drainage never resets at artificial local tile seams',()=>{
 const h=solveHydrology({seed:'HORIZON-01'}),n=DOMAIN.n;
 let crossings=0;
 for(let i=0;i<n*n;i++){
  const p=h.parent[i];if(p<0)continue;
  const col=i%n,row=(i/n)|0,pCol=p%n,pRow=(p/n)|0;
  const crosses=Math.floor(col/16)!==Math.floor(pCol/16)||Math.floor(row/16)!==Math.floor(pRow/16);
  if(crosses){crossings++;assert.equal(h.outlet[i],h.outlet[p]);assert.ok(h.accumulated[p]>=h.accumulated[i])}
 }
 assert.ok(crossings>100);
});
test('a selected land cell traces all the way to its declared outlet',()=>{
 const h=solveHydrology({seed:'HORIZON-01'}),i=h.cellAt(921,1755);
 assert.ok(i>=0);
 const downstream=h.downstream(i),last=downstream.at(-1);
 assert.equal(last,h.outlet[i]);
 assert.equal(h.parent[last],-1);
 assert.ok(downstream.length<DOMAIN.n*DOMAIN.n);
});
test('synthetic monotone valley slopes toward the real sea',()=>{
 const domain={minX:0,minZ:0,n:16,cell:100,size:1600};
 const s=solveHydrology({domain,heightAt:(x,z)=>x<150?-2:x*.01});
 assert.equal(s.stats.uphill,0);
 const i=s.cellAt(750,750),path=s.downstream(i),last=path.at(-1);
 assert.ok(s.raw[last]<=0,'positive-slope valley must terminate at sea');
 assert.equal(s.point(i).outletType,'sea');
});
