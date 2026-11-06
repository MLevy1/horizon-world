import test from 'node:test';
import assert from 'node:assert/strict';
import {createGrid,neighbors,distanceKm} from '../planet.mjs';
import {buildBasinInventory} from '../basins.mjs';

function inventory(points,outletCell,toCell){
  const grid=createGrid({width:32,height:16,radiusKm:64});
  const height=new Float32Array(grid.count).fill(50),waterbody=new Int32Array(grid.count).fill(-1);
  for(const [i,h] of points){height[i]=h;waterbody[i]=0;}
  height[toCell]=20;
  const waterbodies=[{id:0,outletCell,outletReceiver:toCell,surfaceM:20}];
  const input={grid,height,waterbody,waterbodies,neighbors,distanceKm};
  const structure=buildBasinInventory(input);
  assert.equal(structure.validation.ok,true,JSON.stringify(structure.validation));
  return {structure,...input};
}

test('two local pits retain their lowest connecting saddle and the potential outer spill',()=>{
  const a=8*32+5,b=a+1,c=a+2;
  const {structure:s}=inventory([[a,0],[b,5],[c,1]],c,c+1);
  assert.equal(s.depressions.length,2);
  assert.equal(s.cellDepression[a],s.cellDepression[b]);
  assert.notEqual(s.cellDepression[a],s.cellDepression[c]);
  const saddle=s.connections.find(c=>c.kind==='saddle'),outlet=s.connections.find(c=>c.kind==='outlet');
  assert.deepEqual([saddle.fromCell,saddle.toCell,saddle.spillM],[b,c,5]);
  assert.deepEqual([outlet.fromCell,outlet.toCell,outlet.spillM],[c,c+1,20]);
  assert.equal(s.stats.coveredCells,3);
  assert.equal(s.stats.multiDepressionBasins,1);
});

test('a flat shelf drains across equal-height neighbors to its only lower edge',()=>{
  const a=8*32+5,points=Array.from({length:5},(_,k)=>[a+k,k===4?0:2]);
  const {structure:s}=inventory(points,a,a-1);
  assert.equal(s.depressions.length,1);assert.equal(s.depressions[0].pitCell,a+4);
  for(let k=0;k<4;k++)assert.equal(s.downhill[a+k],a+k+1);
  assert.equal(s.downhill[a+4],-1);
});

test('a level enclosed floor owns one shared pit, including across the longitude seam',()=>{
  const a=8*32,points=[[a+30,1],[a+31,1],[a,1],[a+1,1]];
  const {structure:s}=inventory(points,a+1,a+2);
  assert.equal(s.depressions.length,1);assert.equal(s.depressions[0].pitCell,a);
  for(const [i] of points)assert.equal(s.cellDepression[i],0);
});

test('an inventory includes the unique polar node and its real adjacent spill connection',()=>{
  const grid=createGrid({width:32,height:16,radiusKm:64}),pole=grid.north;
  const {structure:s}=inventory([[pole,0],[0,2],[1,2]],1,2);
  assert.equal(s.depressions.length,1);assert.equal(s.depressions[0].pitCell,pole);
  assert.equal(s.downhill[0],pole);assert.equal(s.downhill[1],pole);
  assert.equal(s.depressions[0].areaKm2,2*grid.rowArea[0]);
});
