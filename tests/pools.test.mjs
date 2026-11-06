import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid,neighbors,distanceKm} from '../planet.mjs';
import {buildBasinInventory} from '../basins.mjs';
import {solveBasinPools} from '../pools.mjs';
import {YEAR_SECONDS} from '../climate.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-8,Math.abs(b)*1e-12),`${a} != ${b}`);
function fixture(heights){
  const grid=createGrid({width:32,height:16,radiusKm:64}),start=8*32+5;
  const height=new Float32Array(grid.count).fill(50),waterbody=new Int32Array(grid.count).fill(-1);
  for(let k=0;k<heights.length;k++){height[start+k]=heights[k];waterbody[start+k]=0;}
  const end=start+heights.length-1;height[end+1]=20;
  const waterbodies=[{id:0,outletCell:end,outletReceiver:end+1,surfaceM:20}];
  const structure=buildBasinInventory({grid,height,waterbody,waterbodies,neighbors,distanceKm});
  // Each fully wet cell consumes exactly 1 m³/s. Input is independently
  // assigned to the cell that receives it, not shared across the whole basin.
  const precipitation=new Float64Array(grid.count),runoffMm=new Float64Array(grid.count);
  const potentialEvaporation=new Float64Array(grid.count).fill(YEAR_SECONDS/(grid.rowArea[8]*1000));
  const climate={precipitation,runoffMm,potentialEvaporation},inputAtCellM3s=new Float64Array(grid.count);
  return {start,grid,height,structure,basin:structure.basins[0],climate,inputAtCellM3s};
}
function check(result){
  close(result.availableM3s,result.netEvaporationM3s+result.outflowM3s);
  for(const p of result.pools){
    const incoming=result.pools.filter(q=>q.downstreamPoolId===p.id).reduce((s,q)=>s+q.outflowM3s,0);
    close(p.sourceM3s+incoming,p.outflowM3s+p.netEvaporationM3s);
    if(p.closed)assert.equal(p.outflowM3s,0);
    else{close(p.waterLevelM,p.spillM);if(p.downstreamPoolId>=0)assert.ok(p.waterLevelM>=result.pools[p.downstreamPoolId].waterLevelM);}
  }
}

test('isolated pools keep independent water levels below their connecting ridge',()=>{
  const f=fixture([0,5,1]);f.inputAtCellM3s[f.start]=.05;f.inputAtCellM3s[f.start+2]=.8;
  const r=solveBasinPools(f);check(r);assert.equal(r.pools.length,2);
  close(r.pools[0].waterLevelM,.05);close(r.pools[1].waterLevelM,1.8);
  assert.ok(r.pools.every(p=>p.closed));assert.equal(r.outflowM3s,0);
});

test('a supplied high pool spills toward a lower isolated pool without equalizing their levels',()=>{
  const f=fixture([0,5,1]);f.inputAtCellM3s[f.start]=.05;f.inputAtCellM3s[f.start+2]=1.2;
  const r=solveBasinPools(f);check(r);assert.equal(r.pools.length,2);
  const [low,high]=r.pools;close(low.waterLevelM,.25);close(high.waterLevelM,5);
  close(high.outflowM3s,.2);assert.equal(high.downstreamPoolId,low.id);assert.equal(low.closed,true);
  assert.equal(high.spillFromCell,f.start+2);assert.equal(high.spillToCell,f.start+1);
});

test('pools merge at a wetted connecting ridge while the combined lake can remain closed',()=>{
  const f=fixture([0,5,1]);f.inputAtCellM3s[f.start]=2.2;f.inputAtCellM3s[f.start+2]=.05;
  const r=solveBasinPools(f);check(r);assert.equal(r.pools.length,1);
  const p=r.pools[0];close(p.waterLevelM,5.25);assert.equal(p.joinedAtM,5);
  assert.equal(p.depressionIds.length,2);assert.equal(p.closed,true);
});

test('a merged lake exports only the surplus after evaporation at the outer spill',()=>{
  const f=fixture([0,5,1]);f.inputAtCellM3s[f.start]=3;f.inputAtCellM3s[f.start+2]=.1;
  const r=solveBasinPools(f);check(r);assert.equal(r.pools.length,1);
  close(r.pools[0].waterLevelM,20);close(r.outflowM3s,.1);close(r.netEvaporationM3s,3);
  assert.equal(r.pools[0].downstreamPoolId,-1);
});

test('dry basins remain empty and zero evaporation passes available water through real spill connections',()=>{
  const f=fixture([0,5,1]),dry=solveBasinPools(f);check(dry);
  assert.equal(dry.pools.length,2);assert.ok(dry.pools.every(p=>p.wetAreaKm2===0&&p.wetVolumeM3===0));
  f.climate.potentialEvaporation.fill(0);f.inputAtCellM3s[f.start]=.1;
  const wet=solveBasinPools(f);check(wet);assert.equal(wet.pools.length,1);close(wet.outflowM3s,.1);
});

test('equal-height saddles merge deterministically without creating a cyclic spill network',()=>{
  const f=fixture([0,5,1,5,2]);f.inputAtCellM3s[f.start]=5.5;
  const a=solveBasinPools(f),b=solveBasinPools(f);check(a);
  assert.deepEqual(a,b);assert.equal(a.pools.length,1);assert.equal(a.pools[0].depressionIds.length,3);
  close(a.outflowM3s,.5);assert.ok(a.mergePasses>0);
});

test('partial shoreline area and stored volume use the same continuous area-stage curve',()=>{
  const f=fixture([0]);f.inputAtCellM3s[f.start]=.5;
  const r=solveBasinPools(f);check(r);const p=r.pools[0],area=f.grid.rowArea[8];
  close(p.waterLevelM,.5);close(p.wetAreaKm2,area*.5);close(p.wetVolumeM3,area*1e6*.125);
});
