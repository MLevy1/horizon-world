import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {solvePlanet,neighbors,lonLat,cellAt,traceDownstream,catchmentMask,DEFAULT_WORLD} from '../planet.mjs';

const planet=solvePlanet();
const digest=m=>{
  const hash=createHash('sha256');
  for(const key of ['height','level','receiver','ocean','waterbody','catchment','discharge','outlet','channel'])hash.update(new Uint8Array(m[key].buffer));
  return hash.digest('hex');
};

test('the published model solves the entire closed planet, with every requested feature',()=>{
  const m=planet;
  assert.equal(m.grid.count,DEFAULT_WORLD.width*DEFAULT_WORLD.height+2);
  assert.equal(m.stats.cells,1179650);
  assert.equal(m.validation.ok,true,JSON.stringify(m.validation));
  assert.equal(m.validation.unresolvedCells,0);assert.equal(m.validation.cycles,0);assert.equal(m.validation.uphillLinks,0);
  for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])assert.ok(m.stats[key]>0,key);
  assert.ok(m.stats.seamCrossings>0,'the default drainage crosses the longitude seam');
  for(let i=0;i<m.grid.count;i++){
    assert.ok(m.ocean[m.outlet[i]],'every terminal is part of the connected ocean');
    if(m.receiver[i]<0)assert.ok(m.ocean[i],'only the ocean terminates a flow');
  }
});

test('mesh edges are reciprocal across longitude and both unique poles; coordinate lookup round-trips',()=>{
  const g=planet.grid,a=new Int32Array(g.width),b=new Int32Array(g.width),cells=[g.north,g.south];
  for(let y=0;y<g.height;y++)cells.push(y*g.width,y*g.width+g.width-1);
  for(let i=0;i<g.count;i+=997)cells.push(i);
  for(const i of cells){
    const [lon,lat]=lonLat(g,i);assert.equal(cellAt(g,lon,lat),i);
    const n=neighbors(g,i,a);
    for(let k=0;k<n;k++){
      const j=a[k],nn=neighbors(g,j,b);assert.ok(j>=0&&j<g.count&&j!==i);
      assert.ok(b.subarray(0,nn).includes(i),`nonreciprocal mesh ${i} -> ${j}`);
    }
  }
  let area=0;for(const value of g.rowArea)area+=value*g.width;
  assert.ok(Math.abs(area-4*Math.PI*g.radiusKm**2)<1e-7);
  assert.equal(neighbors(g,g.north,a),g.width);assert.equal(neighbors(g,g.south,a),g.width);
});

test('the ocean is one connected component, not a collection of negative-height pits',()=>{
  const m=planet,g=m.grid,seen=new Uint8Array(g.count),queue=new Int32Array(g.count),near=new Int32Array(g.width);
  const first=m.ocean.findIndex(Boolean);let a=0,b=1;queue[0]=first;seen[first]=1;
  while(a<b){const i=queue[a++],n=neighbors(g,i,near);for(let k=0;k<n;k++){const j=near[k];if(m.ocean[j]&&!seen[j]){seen[j]=1;queue[b++]=j;}}}
  assert.equal(b,m.stats.oceanCells);
  let enclosed=0;for(let i=0;i<g.count;i++)if(m.height[i]<0&&!m.ocean[i]){assert.ok(m.waterbody[i]>=0);enclosed++;}
  assert.ok(enclosed>0,'enclosed below-sea-level basins are inland water');
});

test('every pond and lake is level, has one spill outlet and independently balances its inputs',()=>{
  const m=planet,exits=new Uint32Array(m.waterbodies.length),rainInput=new Float64Array(m.waterbodies.length),externalInput=new Float64Array(m.waterbodies.length);
  for(let i=0;i<m.grid.count;i++){
    const id=m.waterbody[i],p=m.receiver[i];
    if(id>=0){
      const wb=m.waterbodies[id];assert.equal(m.level[i],wb.surfaceM);assert.ok(m.height[i]<wb.surfaceM);
      if(p<0||m.waterbody[p]!==id)exits[id]++;
      const area=i<m.grid.north?m.grid.rowArea[(i/m.grid.width)|0]:0;
      rainInput[id]+=area*m.rainfall[i]*1000/(365.25*86400)*.58;
    }
    if(p>=0&&m.waterbody[p]>=0&&m.waterbody[p]!==id)externalInput[m.waterbody[p]]+=m.discharge[i];
  }
  for(const wb of m.waterbodies){
    assert.equal(exits[wb.id],1);
    assert.ok(Math.abs(m.discharge[wb.outletCell]-externalInput[wb.id]-rainInput[wb.id])<1e-7);
    const path=traceDownstream(m,wb.outletCell);assert.ok(m.ocean[path.at(-1)]);
  }
});

test('the compact graph connects every source and waterbody to a mouth without omitted channel cells',()=>{
  const m=planet,covered=new Uint8Array(m.grid.count);
  for(const edge of m.reaches){
    assert.equal(m.nodes[edge.from].outgoing,edge.id);assert.ok(m.nodes[edge.to].incoming.includes(edge.id));
    for(let k=0;k<edge.path.length-1;k++){assert.equal(m.receiver[edge.path[k]],edge.path[k+1]);covered[edge.path[k]]=1;}
  }
  for(let i=0;i<m.grid.count;i++)if(m.channel[i])assert.equal(covered[i],1,`channel ${i} was omitted`);
  for(const start of m.nodes){
    let node=start,steps=0;
    while(node.outgoing>=0){assert.ok(++steps<m.nodes.length);node=m.nodes[m.reaches[node.outgoing].to];}
    assert.equal(node.kind,'mouth');assert.ok(m.ocean[node.cell]);
  }
});

test('global runoff and catchment area reach the ocean without resets or losses',()=>{
  assert.ok(Math.abs(planet.stats.totalRunoffM3s-planet.stats.deliveredFlowM3s)<1e-7);
  assert.ok(Math.abs(planet.stats.landAreaKm2-planet.stats.deliveredAreaKm2)<1e-7);
  const node=planet.nodes.find(n=>n.kind==='headwater'&&planet.waterbody[planet.receiver[n.cell]]<0);
  const mask=catchmentMask(planet,node.cell);let area=0;
  for(let i=0;i<planet.grid.north;i++)if(mask[i])area+=planet.grid.rowArea[(i/planet.grid.width)|0];
  assert.ok(Math.abs(area-planet.catchment[node.cell])<1e-8);
  const path=traceDownstream(planet,node.cell);assert.equal(path.at(-1),planet.outlet[node.cell]);
});

test('same seed reproduces the complete network; another seed creates a different valid planet',()=>{
  const repeat=solvePlanet({seed:planet.seed});assert.equal(digest(repeat),digest(planet));
  const other=solvePlanet({seed:'ANOTHER-PLANET'});assert.notEqual(digest(other),digest(planet));
  assert.equal(other.validation.ok,true);assert.equal(other.grid.count,planet.grid.count);
  for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])assert.ok(other.stats[key]>0,key);
});

test('land at both poles drains through the real polar nodes instead of ending at grid edges',()=>{
  const m=solvePlanet({world:{width:96,height:48,radiusKm:64},heightAt:(lon,lat)=>Math.abs(lat)<12?-10:Math.abs(lat)*9+Math.cos(lon*Math.PI/180)*3});
  for(const i of [m.grid.north,m.grid.south]){
    assert.equal(m.ocean[i],0);assert.ok(m.receiver[i]>=0);
    assert.ok(m.ocean[traceDownstream(m,i).at(-1)]);
  }
  assert.equal(m.validation.ok,true);assert.ok(m.stats.poleConnections>=2);
});
