import {createTerrainStream} from '../terrain-stream.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {volcanicProfile,applyVolcanicSites} from '../geology.mjs';
import {annualSnowBudget,seasonalCycle} from '../cryosphere.mjs';
import {annualPartition,lakeBalance,makeClimate} from '../climate.mjs';
import {poolWetFraction} from '../pools.mjs';
import {sampleRiverEdge,FLOW_EPSILON_M3S} from '../river-profiles.mjs';
import {inspectionRoute,inspectionStation} from '../profile-view.mjs';
import {createTerrainChunkBuilder,terrainVertex,tileNeighbor,tileKey,terrainEdgeIndices,EDGES} from '../terrain-chunks.mjs';
import {buildChannelConstraints,sampleConstraintSection,sphereFaceIndex,nearestConstraintStation} from '../channel-constraints.mjs';
import {buildMeshFoundation} from '../mesh-foundation.mjs';
import {extractShorelines,packShorelines,sphereFaces} from '../shorelines.mjs';
import {createSurfaceSampler} from '../surface-sampler.mjs';
import {solvePlanet,neighbors,lonLat,cellAt,traceDownstream,catchmentMask,DEFAULT_WORLD,traceActive,tracePotential,createGrid} from '../planet.mjs';

const planet=solvePlanet();
const surface=createSurfaceSampler(planet);
const digest=m=>{
  const hash=createHash('sha256');
  for(const key of ['height','level','receiver','ocean','waterbody','catchment','discharge','outlet','channel','activeTerminal','wetness'])hash.update(new Uint8Array(m[key].buffer));
  for(const key of ['cellDepression','downhill'])hash.update(new Uint8Array(m.basinStructure[key].buffer));
  hash.update(JSON.stringify(m.basinStructure.connections));
  hash.update(JSON.stringify(m.poolBalances));
  for(const key of ['waterM','bedM','widthM','designDepthM','freeboardM','kind','corridor','wet','from','to','lengthM','wetEdge'])hash.update(new Uint8Array(m.riverProfiles[key].buffer));
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
    assert.equal(m.receiver[m.outlet[i]],-1);
    assert.ok(m.ocean[m.potentialOutlet[i]],'potential routes retain their ocean destination');
    if(m.receiver[i]<0&&!m.ocean[i])assert.ok(m.waterbodies[m.waterbody[i]].closed);
  }
});

test('every global potential lake cell belongs to one local depression and a connected spill inventory',()=>{
  const m=planet,s=m.basinStructure,g=m.grid,near=new Int32Array(g.width);
  assert.equal(s.validation.ok,true,JSON.stringify(s.validation));
  assert.equal(s.basins.length,m.basins.length);
  assert.ok(s.stats.multiDepressionBasins>0);
  assert.ok(s.depressions.length>s.basins.length);
  let covered=0,area=0;
  for(const basin of s.basins){
    assert.equal(basin.cells.length,m.basins[basin.id].cells);
    const reached=new Set(),queue=[s.connections[basin.outletConnection].from];
    for(let a=0;a<queue.length;a++){
      const id=queue[a];if(reached.has(id))continue;reached.add(id);
      for(const edge of s.depressions[id].connectionIds){
        const c=s.connections[edge],next=c.from===id?c.to:c.from;
        if(next>=0&&!reached.has(next))queue.push(next);
      }
    }
    assert.equal(reached.size,basin.depressionIds.length);
    for(const i of basin.cells){
      covered++;assert.equal(m.basinId[i],basin.id);
      const d=s.depressions[s.cellDepression[i]],p=s.downhill[i];assert.equal(d.basinId,basin.id);
      if(i<g.north)area+=g.rowArea[(i/g.width)|0];
      if(p<0)assert.equal(i,d.pitCell);
      else{assert.ok(near.subarray(0,neighbors(g,i,near)).includes(p));assert.ok(m.height[p]<=m.height[i]);}
    }
  }
  assert.equal(covered,s.stats.coveredCells);
  assert.ok(Math.abs(area-s.depressions.reduce((sum,d)=>sum+d.areaKm2,0))<1e-7);
  for(let i=0;i<g.count;i++)assert.equal(s.cellDepression[i]>=0,m.basinId[i]>=0);
});

test('every recorded internal spill is the lowest real mesh-edge connection between its two depressions',()=>{
  const m=planet,s=m.basinStructure,g=m.grid,near=new Int32Array(g.width),minima=new Map();
  for(const basin of s.basins)for(const i of basin.cells){
    const n=neighbors(g,i,near),from=s.cellDepression[i];
    for(let k=0;k<n;k++){
      const j=near[k],to=s.cellDepression[j];
      if(j<=i||m.basinId[j]!==basin.id||from===to)continue;
      const key=[Math.min(from,to),Math.max(from,to)].join(':');
      const candidate=[Math.max(m.height[i],m.height[j]),i,j],old=minima.get(key);
      if(!old||candidate[0]<old[0]||(candidate[0]===old[0]&&(i<old[1]||(i===old[1]&&j<old[2]))))minima.set(key,candidate);
    }
  }
  for(const c of s.connections)if(c.kind==='saddle'){
    const key=[c.from,c.to].join(':');
    assert.deepEqual([c.spillM,Math.min(c.fromCell,c.toCell),Math.max(c.fromCell,c.toCell)],minima.get(key));
    minima.delete(key);
  }
  assert.equal(minima.size,0,'no adjacent depression pair was omitted');
});

test('independent pools cover every global basin and conserve water through the potential outer-spill graph',()=>{
  const m=planet,r=m.poolBalances,s=m.basinStructure;
  assert.equal(r.validation.ok,true,JSON.stringify(r.validation));
  assert.equal(r.basins.length,m.basins.length);
  assert.ok(r.stats.splitBasins>0&&r.stats.mergedPools>0);
  assert.ok(Math.abs(r.stats.runoffM3s-m.stats.totalRunoffM3s)<1e-8);
  assert.ok(Math.abs(r.stats.runoffM3s-r.stats.netEvaporationM3s-r.stats.deliveredFlowM3s)<1e-7);
  const loss=new Float64Array(r.pools.length),area=new Float64Array(r.pools.length);
  for(const b of s.basins)for(const i of b.cells){
    const id=r.depressionPool[s.cellDepression[i]],p=r.pools[id];assert.equal(p.basinId,b.id);
    const a=i<m.grid.north?m.grid.rowArea[(i/m.grid.width)|0]:0,f=poolWetFraction(m.height[i],p.waterLevelM);
    loss[id]+=Math.max(0,m.climate.effectiveEvaporationMm[i]-m.climate.liquidInputMm[i]+m.climate.runoffMm[i])*a*1000/(365.25*86400)*f;
    area[id]+=a*f;
  }
  for(const p of r.pools){
    assert.ok(Math.abs(loss[p.id]-p.netEvaporationM3s)<1e-7);
    assert.ok(Math.abs(area[p.id]-p.wetAreaKm2)<1e-7);
    assert.ok(p.waterLevelM<=p.spillM+1e-7);
    if(p.joinedAtM!==null)assert.ok(p.waterLevelM>=p.joinedAtM-1e-7,'merged pools remain joined by wetted ridges');
    if(p.closed)assert.equal(p.outflowM3s,0);
    else if(p.downstreamPoolId>=0)assert.ok(p.waterLevelM>=r.pools[p.downstreamPoolId].waterLevelM-1e-7);
  }
});

test('real multi-pool basins retain different wet surface levels instead of sharing water across dry ridges',()=>{
  const r=planet.poolBalances;
  assert.ok(r.basins.some(b=>{
    const wet=[...b.poolIds].map(id=>r.pools[id]).filter(p=>p.wetAreaKm2>0);
    return wet.some(a=>wet.some(b=>Math.abs(a.waterLevelM-b.waterLevelM)>.01));
  }));
});

test('installed pools have connected wet footprints and exposed margins carry the rebuilt channels',()=>{
  const m=planet,near=new Int32Array(m.grid.width),seen=new Uint8Array(m.grid.count);
  for(const wb of m.waterbodies){
    const queue=[wb.outletCell];seen[wb.outletCell]=1;
    for(let a=0;a<queue.length;a++){
      const i=queue[a];assert.equal(m.level[i],wb.waterLevelM);
      const n=neighbors(m.grid,i,near);
      for(let k=0;k<n;k++){const j=near[k];if(!seen[j]&&m.waterbody[j]===wb.id){seen[j]=1;queue.push(j);}}
    }
    assert.equal(queue.length,wb.cells,'every mapped pool is connected at its actual level');
    assert.equal(m.receiver[wb.outletCell],wb.closed?-1:wb.spillToCell);
  }
  let exposed=0,restored=0;
  for(let i=0;i<m.grid.count;i++)if(m.basinId[i]>=0&&m.waterbody[i]<0){
    exposed++;if(m.channel[i])restored++;
    const p=m.waterbodies[m.cellPool[i]];
    assert.ok(m.height[i]>p.waterLevelM);assert.equal(m.level[i],m.height[i]);
  }
  assert.ok(exposed>0&&restored>0);
  assert.ok(Math.abs(m.stats.deliveredFlowM3s-m.poolBalances.stats.deliveredFlowM3s)<1e-7);
});

test('dormant spills remain adjacent optional links and never appear as active closed-pool outflows',()=>{
  const m=planet,near=new Int32Array(m.grid.width);
  assert.equal(m.potentialSpills.length,m.waterbodies.filter(w=>w.closed).length);
  for(const edge of m.potentialSpills){
    assert.equal(edge.dormantSpill,true);assert.equal(edge.dischargeM3s,0);
    assert.equal(edge.path.length,2);const n=neighbors(m.grid,edge.path[0],near);
    assert.ok(near.subarray(0,n).includes(edge.path[1]));assert.ok(m.waterbodies[edge.waterbody].closed);
  }
  for(const node of m.nodes)if(node.waterbody>=0&&m.waterbodies[node.waterbody].closed)assert.equal(node.outgoing,-1);
});

test('shared river profiles cover the complete global channel network with downhill surfaces and submerged beds',()=>{
  const m=planet,p=m.riverProfiles;
  assert.equal(p.validation.ok,true,JSON.stringify(p.validation));assert.equal(p.validation.uphillEdges,0);
  assert.equal(p.from.length,m.channel.reduce((s,v)=>s+Number(v>0),0)+m.waterbodies.filter(w=>!w.closed).length);
  assert.ok(p.stats.wetEdges>0&&p.stats.dryCells>0);
  for(let e=0;e<p.from.length;e++){
    const a=p.from[e],b=p.to[e];assert.equal(m.receiver[a],b);assert.equal(p.edgeAtCell[a],e);
    assert.ok(p.waterM[a]>=p.waterM[b]);assert.equal(p.wetEdge[e],Number(m.discharge[a]>FLOW_EPSILON_M3S));
    for(const t of [.25,.75]){
      const s=sampleRiverEdge(p,e,t);assert.ok(s.bedM<=s.waterM-s.designDepthM+1e-8);
      assert.ok(s.widthM>=2&&s.widthM<=90&&s.designDepthM>=.25&&s.designDepthM<=5);
    }
  }
  for(const w of m.waterbodies){
    assert.equal(p.waterM[w.outletCell],w.waterLevelM);
    if(w.closed)assert.equal(p.edgeAtCell[w.outletCell],-1);
    else{
      const crest=m.height[w.outletCell]>=m.height[w.outletReceiver]?w.outletCell:w.outletReceiver;
      assert.equal(p.waterM[crest],w.waterLevelM);
    }
  }
});

test('all global confluences use identical endpoint profiles across incoming and outgoing reaches',()=>{
  const m=planet,p=m.riverProfiles;let checked=0;
  for(const n of m.nodes)if(n.kind==='confluence'){
    const out=sampleRiverEdge(p,p.edgeAtCell[n.cell],0);
    for(const id of n.incoming){
      const path=m.reaches[id].path,end=sampleRiverEdge(p,p.edgeAtCell[path.at(-2)],1);
      for(const field of ['waterM','bedM','widthM','designDepthM'])assert.equal(end[field],out[field]);
      checked++;
    }
  }
  assert.ok(checked>100);
});

test('inspection routes cover every global profile edge and finish at exact lake or ocean contacts',()=>{
  const m=planet,p=m.riverProfiles,covered=new Uint8Array(p.from.length);
  for(const node of m.nodes){
    if(p.edgeAtCell[node.cell]<0)continue;
    const r=inspectionRoute(p,node.cell),end=r.cells.at(-1);
    assert.ok(p.kind[end]===2||p.kind[end]===3);
    const station=inspectionStation(p,r,r.totalLengthM);
    assert.equal(station.t,1);assert.equal(station.waterM,p.waterM[end]);assert.equal(station.bedM,p.bedM[end]);
    for(const edge of r.edges)covered[edge]=1;
  }
  for(const value of covered)assert.equal(value,1);
});

test('the spherical scaffold sampler reproduces every vertex of the complete default planet',()=>{
  const m=planet;
  for(let i=0;i<m.grid.count;i++){
    const [lon,lat]=lonLat(m.grid,i),q=surface.mesh.locate(lon,lat);
    assert.ok(Math.abs(q.terrainM-m.height[i])<1e-5,`scaffold vertex ${i}`);
  }
  for(const lat of [-90,-89.9999,-45,0,45,89.9999,90])assert.equal(surface.sample(-180,lat).terrainM,surface.sample(180,lat).terrainM);
});

test('the global 3D channel index finds every profile midpoint and exact canonical endpoint',()=>{
  const p=planet.riverProfiles;assert.equal(surface.stats.globalEdges,p.from.length);
  for(let e=0;e<p.from.length;e++){
    const a=surface.mesh.directionAt(p.from[e]),b=surface.mesh.directionAt(p.to[e]);
    const river=surface.riverAtDirection(surface.course.sample(e,.5).direction);
    assert.ok(river&&river.distanceM<1e-5,`missing edge ${e}`);assert.equal(river.edge,e);
    assert.ok(Math.abs(river.waterM-(p.waterM[p.from[e]]+p.waterM[p.to[e]])/2)<1e-5);
    assert.ok(Math.abs(river.bedM-(p.bedM[p.from[e]]+p.bedM[p.to[e]])/2)<1e-5);
  }
  for(let i=0;i<planet.grid.count;i++)if(p.corridor[i]){
    const river=surface.riverAtDirection(surface.course.nodeDirection(i));assert.ok(river);
    assert.ok(Math.abs(river.waterM-p.waterM[i])<1e-5);assert.ok(Math.abs(river.bedM-p.bedM[i])<1e-5);
  }
});

test('standing water queries preserve actual pool planes and sea level without flooding exposed margins',()=>{
  const m=planet;
  for(let i=0;i<m.grid.count;i++){
    if(m.waterbody[i]>=0){
      const body=m.waterbodies[m.waterbody[i]];if(m.height[i]>=body.waterLevelM-1e-7)continue;
      const q=surface.sample(...lonLat(m.grid,i));assert.ok(q.standingWater);assert.equal(q.standingWater.waterM,body.waterLevelM);
      assert.equal(q.standingWater.id,body.id);assert.ok(q.standingWater.depthM>0);
      assert.equal(q.fitted.waterM,body.waterLevelM);assert.ok(q.fitted.groundM<=m.height[i]+1e-8);assert.ok(q.fitted.groundM<body.waterLevelM);
    }else if((m.basinId[i]>=0||m.ocean[i])&&i%97===0){
      const q=surface.sample(...lonLat(m.grid,i));
      if(m.ocean[i]&&m.height[i]<0){assert.equal(q.standingWater.kind,'ocean');assert.equal(q.standingWater.waterM,0);}
      else assert.equal(q.standingWater,null);
    }
  }
});

test('contact fitting covers every global profile with anchored endpoints, downhill water and submerged beds',()=>{
  const m=planet,p=m.riverProfiles;assert.ok(surface.contacts.stats.waterContacts>0&&surface.contacts.stats.shoreIntersections>0);
  for(let edge=0;edge<p.from.length;edge++){
    let last=Infinity;
    for(const t of [0,.25,.5,.75,1]){
      const r=surface.contacts.fit({...sampleRiverEdge(p,edge,t),edge,t});
      assert.ok(r.waterM<=last+1e-8);assert.ok(r.bedM<=r.waterM-r.designDepthM+1e-8);last=r.waterM;
      if(t===0){assert.equal(r.waterM,p.waterM[p.from[edge]]);assert.equal(r.bedM,p.bedM[p.from[edge]]);}
      if(t===1){assert.equal(r.waterM,p.waterM[p.to[edge]]);assert.equal(r.bedM,p.bedM[p.to[edge]]);}
    }
  }
});

test('composed surfaces preserve every wet global channel anchor and remain finite over all profile midpoints',()=>{
  const m=planet,p=m.riverProfiles;
  for(let i=0;i<m.grid.count;i++)if(p.corridor[i]){
    const d=surface.course.nodeDirection(i),q=surface.sample(Math.atan2(d[2],d[0])*180/Math.PI,Math.asin(d[1])*180/Math.PI);assert.ok(Number.isFinite(q.fitted.groundM));
    assert.ok(Math.abs(q.fitted.groundM-p.bedM[i])<1e-4,`bed anchor ${i}`);
    if(p.wet[i])assert.ok(q.fitted.waterM!==null&&Math.abs(q.fitted.waterM-p.waterM[i])<1e-4,`water anchor ${i}`);
  }
  for(let e=0;e<p.from.length;e++){
    const a=surface.mesh.directionAt(p.from[e]),b=surface.mesh.directionAt(p.to[e]),point=surface.mesh.sampleDirection(surface.course.sample(e,.5).direction);
    const q=surface.sample(point.lon,point.lat).fitted;
    assert.ok(Number.isFinite(q.groundM));if(q.waterM!==null){assert.ok(q.waterM>q.groundM);assert.ok(q.depthM>0);}
    if(p.wetEdge[e]){assert.ok(q.waterM!==null);assert.ok(q.waterM<=p.waterM[p.from[e]]+1e-5&&q.waterM>=p.waterM[p.to[e]]-1e-5);}
  }
});

test('every global shore intersection remains continuous through its center and lateral channel banks',()=>{
  const p=planet.riverProfiles,R=planet.grid.radiusKm*1000;
  const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
  let checked=0;
  for(let e=0;e<p.from.length;e++){
    const t=surface.contacts.end[e];if(t>=1||t<=0)continue;
    const a=surface.mesh.directionAt(p.from[e]),b=surface.mesh.directionAt(p.to[e]);
    const normal=unit([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);
    const width=p.widthM[p.from[e]]+(p.widthM[p.to[e]]-p.widthM[p.from[e]])*t;
    const eps=Math.min(t/2,(1-t)/2,.001/p.lengthM[e]);
    const at=(u,offset)=>{
      const center=unit(a.map((v,k)=>v+(b[k]-v)*u)),angle=offset/R;
      const point=surface.mesh.sampleDirection(center.map((v,k)=>v*Math.cos(angle)+normal[k]*Math.sin(angle)));
      return surface.sample(point.lon,point.lat);
    };
    for(const offset of [0,-width*.4,width*.4,-width*.65,width*.65]){
      const left=at(t-eps,offset),right=at(t+eps,offset);
      const tolerance=Math.max(.05,Math.abs(left.terrainM-right.terrainM)*10);
      assert.ok(Math.abs(left.fitted.groundM-right.fitted.groundM)<tolerance,`shore ground ${e}`);
      if(left.fitted.waterM!==null&&right.fitted.waterM!==null)assert.ok(Math.abs(left.fitted.waterM-right.fitted.waterM)<tolerance,`shore water ${e}`);
      for(const q of [left,right])if(q.standingWater){assert.equal(q.fitted.waterM,q.standingWater.waterM);assert.ok(q.fitted.groundM<=q.terrainM+1e-8);}
      checked++;
    }
  }
  assert.ok(checked>100);
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
  let enclosed=0;for(let i=0;i<g.count;i++)if(m.height[i]<0&&!m.ocean[i]){assert.ok(m.basinId[i]>=0);enclosed++;}
  assert.ok(enclosed>0,'enclosed below-sea-level basins are inland water');
});

test('every pond and lake is level, has one exit or a closed sink and independently balances its inputs',()=>{
  const m=planet,exits=new Uint32Array(m.waterbodies.length),rainInput=new Float64Array(m.waterbodies.length),externalInput=new Float64Array(m.waterbodies.length);
  for(let i=0;i<m.grid.count;i++){
    const id=m.waterbody[i],p=m.receiver[i];
    if(id>=0){
      const wb=m.waterbodies[id];assert.ok(Math.abs(m.level[i]-wb.waterLevelM)<1e-3);assert.ok(m.height[i]<=wb.waterLevelM+1e-5);
      if(p<0||m.waterbody[p]!==id)exits[id]++;
      const area=i<m.grid.north?m.grid.rowArea[(i/m.grid.width)|0]:0;
      rainInput[id]+=area*m.climate.runoffMm[i]*1000/(365.25*86400);
    }
    if(p>=0&&m.waterbody[p]>=0&&m.waterbody[p]!==id)externalInput[m.waterbody[p]]+=m.discharge[i];
  }
  for(const wb of m.waterbodies){
    assert.equal(exits[wb.id],1);
    assert.ok(Math.abs(m.discharge[wb.outletCell]+wb.netEvaporationM3s-externalInput[wb.id]-rainInput[wb.id])<1e-7);
    const path=traceDownstream(m,wb.outletCell);assert.equal(path.at(-1),m.outlet[wb.outletCell]);
  }
});

test('the compact graph connects every source and waterbody to an ocean or closed pool without omitted channel cells',()=>{
  const m=planet,covered=new Uint8Array(m.grid.count);
  for(const edge of m.reaches){
    assert.equal(m.nodes[edge.from].outgoing,edge.id);assert.ok(m.nodes[edge.to].incoming.includes(edge.id));
    for(let k=0;k<edge.path.length-1;k++){assert.equal(m.receiver[edge.path[k]],edge.path[k+1]);covered[edge.path[k]]=1;}
  }
  for(let i=0;i<m.grid.count;i++)if(m.channel[i])assert.equal(covered[i],1,`channel ${i} was omitted`);
  for(const start of m.nodes){
    let node=start,steps=0;
    while(node.outgoing>=0){assert.ok(++steps<m.nodes.length);node=m.nodes[m.reaches[node.outgoing].to];}
    assert.ok(m.ocean[node.cell]||(node.waterbody>=0&&m.waterbodies[node.waterbody].closed));
  }
});

test('global catchment area and annual runoff are conserved through ocean delivery and lake evaporation',()=>{
  assert.ok(Math.abs(planet.stats.totalRunoffM3s-planet.stats.deliveredFlowM3s-planet.stats.lakeExtraEvaporationM3s)<1e-7);
  assert.ok(Math.abs(planet.stats.landAreaKm2-planet.stats.deliveredAreaKm2-planet.stats.closedAreaKm2)<1e-7);
  const node=planet.nodes.find(n=>n.kind==='headwater'&&planet.waterbody[planet.receiver[n.cell]]<0);
  const mask=catchmentMask(planet,node.cell);let area=0;
  for(let i=0;i<planet.grid.north;i++)if(mask[i])area+=planet.grid.rowArea[(i/planet.grid.width)|0];
  assert.ok(Math.abs(area-planet.catchment[node.cell])<1e-8);
  const path=traceDownstream(planet,node.cell);assert.equal(path.at(-1),planet.outlet[node.cell]);
});

test('same seed reproduces the complete network; another seed creates a different valid planet',()=>{
  const repeat=solvePlanet({seed:planet.seed});assert.equal(digest(repeat),digest(planet));assert.deepEqual(repeat.geology.sites,planet.geology.sites);
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


test('annual precipitation partition respects water and energy limits, including zero cases',()=>{
  for(const p of [0,1,100,700,2500])for(const pet of [0,1,100,1000,3000]){
    const b=annualPartition(p,pet);
    assert.ok(b.evaporation>=0&&b.evaporation<=Math.min(p,pet)+1e-10);
    assert.ok(b.runoff>=0);assert.ok(Math.abs(b.evaporation+b.runoff-p)<1e-9);
  }
  assert.ok(annualPartition(100,1500).runoff<annualPartition(1000,1500).runoff);
});

test('every full-planet climate value is finite and the annual planetary precipitation budget balances',()=>{
  const m=planet,c=m.climate;
  for(let i=0;i<m.grid.count;i++){
    for(const key of ['temperature','precipitation','potentialEvaporation','runoffMm','aridity'])assert.ok(Number.isFinite(c[key][i]),key);
    assert.ok(c.precipitation[i]>=0&&c.runoffMm[i]>=0&&c.runoffMm[i]<=c.liquidInputMm[i]+1e-3);
    assert.ok(c.zone[i]<=4);
  }
  assert.ok(m.stats.desertAreaKm2>0&&m.stats.coldAreaKm2>0);
  assert.ok(m.stats.seasonalReaches>0&&m.stats.closedLakes>0&&m.stats.playas>0);
  assert.ok(Math.abs(m.stats.precipitationM3s-m.stats.landEvaporationM3s-m.stats.lakeExtraEvaporationM3s-m.stats.deliveredFlowM3s-m.stats.frozenBudgetM3s)<1e-7);
});

test('closed basins are valid active-flow destinations while their possible overflow routes remain connected',()=>{
  const m=planet;
  for(let i=0;i<m.grid.count;i++){
    const t=m.activeTerminal[i],wb=m.waterbody[t]>=0?m.waterbodies[m.waterbody[t]]:null;
    assert.ok(m.ocean[t]||(wb?.closed&&wb.outletCell===t));
  }
  for(const wb of m.waterbodies){
    assert.ok(wb.waterLevelM<=wb.surfaceM+1e-5);
    assert.ok(wb.wetAreaKm2<=wb.areaKm2+1e-7);
    assert.ok(Math.abs(wb.inflowM3s+wb.localRunoffM3s-wb.wetBaseRunoffM3s+wb.directRainM3s-wb.evaporationM3s-wb.outflowM3s)<1e-7);
    if(wb.closed){
      assert.equal(wb.outflowM3s,0);assert.equal(m.activeTerminal[wb.outletCell],wb.outletCell);
      assert.equal(traceActive(m,wb.outletCell).length,1);
      assert.ok(m.ocean[tracePotential(m,wb.outletCell).at(-1)]);
      assert.ok(wb.waterLevelM<=wb.surfaceM);
    }
  }
});

test('a water-limited lake contracts and closes; ample upstream supply sustains overflow',()=>{
  const g=planet.grid,cells=[Math.floor(g.height/2)*g.width+2],i=cells[0],height=new Float32Array(g.count);
  height[i]=10;
  const c={precipitation:new Float32Array(g.count),potentialEvaporation:new Float32Array(g.count),runoffMm:new Float32Array(g.count)};
  c.precipitation[i]=100;c.potentialEvaporation[i]=1200;c.runoffMm[i]=annualPartition(100,1200).runoff;
  const args={cells,grid:g,height,climate:c,spillM:20};
  const scarce=lakeBalance({...args,availableM3s:.00001}),wet=lakeBalance({...args,availableM3s:1});
  assert.equal(scarce.closed,true);assert.equal(scarce.outflowM3s,0);assert.ok(scarce.waterLevelM<20);
  assert.equal(wet.closed,false);assert.equal(wet.waterLevelM,20);assert.ok(wet.outflowM3s>0);
  assert.ok(scarce.wetAreaKm2<wet.wetAreaKm2);
  assert.ok(Math.abs(scarce.netEvaporationM3s-.00001)<1e-10);
});


test('snow budgets conserve water across warm, seasonal and permanently freezing climates',()=>{
  for(const temperature of [-30,-10,-2,5,20])for(const latitude of [-75,-45,0,45,75]){
    const b=annualSnowBudget({temperature,precipitation:900,potentialEvaporation:500,latitude});
    assert.ok(Math.abs(900-b.rainMm-b.meltMm-b.sublimationMm-b.formationMm-b.seasonalChangeMm)<1e-8);
    assert.ok(Math.abs(900-b.rainMm-b.snowfallMm)<1e-8);
    assert.ok(b.peakSnowMm>=0&&b.endSnowMm>=0&&b.formationMm>=0);
  }
  const warm=annualSnowBudget({temperature:30,precipitation:900,potentialEvaporation:500,latitude:0});
  assert.equal(warm.snowfallMm,0);assert.equal(warm.rainMm,900);
  const cold=annualSnowBudget({temperature:-30,precipitation:900,potentialEvaporation:35,latitude:75});
  assert.ok(cold.formationMm>800);assert.equal(cold.meltMm,0);
});

test('hemisphere seasons reverse while annual precipitation and temperature offsets remain balanced',()=>{
  const north=seasonalCycle(60),south=seasonalCycle(-60);
  assert.ok(north.offsets[6]>0&&north.offsets[0]<0);
  assert.ok(south.offsets[0]>0&&south.offsets[6]<0);
  assert.ok(Math.abs(north.weights.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.ok(Math.abs(north.offsets.reduce((a,b)=>a+b,0))<1e-12);
});

test('the full planet stores glacier water and routes melt into its actual drainage graph',()=>{
  const m=planet,c=m.cryosphere,s=c.stats;
  assert.ok(s.glaciers>0&&s.glacierAreaKm2>0&&s.snowAreaKm2>0);
  assert.ok(s.snowmeltM3s>0&&s.glacierMeltM3s>0&&s.iceStorageChangeM3s>0&&s.calvingM3s>0);
  assert.ok(Math.abs(s.glacierFormationM3s-s.glacierMeltM3s-s.iceStorageChangeM3s-s.calvingM3s)<1e-8);
  let meltCells=0;
  for(let i=0;i<m.grid.count;i++){
    if(c.iceExportM3s[i]>0){assert.ok(m.potentialReceiver[i]>=0);assert.ok(m.height[m.potentialReceiver[i]]<m.height[i]);}
    if(c.glacier[i])assert.ok(c.glacierId[i]>=0);
    if(c.iceMeltMm[i]>0){assert.ok(m.climate.liquidInputMm[i]>=c.iceMeltMm[i]-.01);meltCells++;}
    assert.ok(c.freezeMonths[i]<=12&&c.snowMonths[i]<=12);
  }
  assert.ok(meltCells>0);
  for(const glacier of c.glaciers){
    const path=traceActive(m,glacier.outletCell),end=path.at(-1),wb=m.waterbody[end]>=0?m.waterbodies[m.waterbody[end]]:null;
    assert.ok(m.ocean[end]||wb?.closed);
  }
});


test('volcanic profiles create the requested distinct landforms with feathered boundaries',()=>{
  const base={baseM:100,reliefM:600,radiusKm:3};
  for(let type=0;type<4;type++){
    const site={...base,type};assert.equal(volcanicProfile(site,3).blend,0);
    assert.ok(volcanicProfile(site,2.99).blend<.01);
    assert.ok(Number.isFinite(volcanicProfile(site,0).heightM));
  }
  const caldera={...base,type:2};
  assert.ok(volcanicProfile(caldera,0).heightM<volcanicProfile(caldera,1.05).heightM);
  assert.equal(new Set(planet.geology.sites.map(s=>s.type)).size,4);
});

test('the entire planet is re-solved around actual volcanic elevation changes',()=>{
  const original=solvePlanet({volcanism:false}),m=planet;let modified=0,rerouted=0;
  for(let i=0;i<m.grid.count;i++){
    const difference=m.height[i]-original.height[i];
    assert.ok(Math.abs(difference-m.geology.change[i]-m.sediment.changeM[i]+original.sediment.changeM[i])<.005);
    if(difference!==0)modified++;
    else if(m.geology.ids[i]<0)assert.equal(m.height[i],original.height[i]);
    if(m.receiver[i]!==original.receiver[i])rerouted++;
  }
  assert.ok(modified>1000&&rerouted>100);
  assert.equal(m.geology.change.reduce((n,v)=>n+Number(v!==0),0),m.geology.stats.affectedCells);
  assert.equal(m.validation.ok,true);assert.equal(m.grid.count,original.grid.count);
});

test('cooled lava paths followed adjacent descending ground and every volcanic basin links to the solved water inventory',()=>{
  const m=planet,near=new Int32Array(m.grid.width);
  assert.ok(m.geology.flows.length>0&&m.geology.stats.lavaCells>0&&m.geology.stats.craterBasins>0);
  for(const flow of m.geology.flows){
    assert.ok(flow.path.length>=2&&flow.lengthKm>0);
    const unique=new Set(flow.path);assert.equal(unique.size,flow.path.length);
    for(let k=1;k<flow.path.length;k++){
      const n=neighbors(m.grid,flow.path[k-1],near);assert.ok(near.subarray(0,n).includes(flow.path[k]));
      assert.ok(flow.preDepositElevations[k]<flow.preDepositElevations[k-1]);
    }
    for(const cell of flow.path)assert.ok(m.geology.lava[cell]&&m.geology.depositM[cell]>0);
  }
  for(const site of m.geology.sites){
    assert.equal(site.craterWaterbody,m.waterbody[site.centerCell]);
    for(const id of site.waterbodyIds)assert.ok(id>=0&&id<m.waterbodies.length);
  }
});

test('spherical volcanic footprints cross longitude and include a polar cap without map-edge clipping',()=>{
  const grid=createGrid({width:192,height:96,radiusKm:64}),height=new Float32Array(grid.count);
  const sites=[{id:0,type:1,lon:179.5,lat:0,radiusKm:8,reliefM:300,baseM:0},
    {id:1,type:1,lon:50,lat:89.5,radiusKm:5,reliefM:300,baseM:0}];
  const g=applyVolcanicSites({grid,height,sites}),row=48;
  assert.equal(g.ids[row*grid.width],0);assert.equal(g.ids[row*grid.width+grid.width-1],0);
  assert.ok(height[row*grid.width]>0&&height[row*grid.width+grid.width-1]>0);
  assert.equal(g.ids[grid.north],1);assert.equal(g.ids[grid.south],-1);
});

const shores=extractShorelines(planet,surface);
test('global standing-water shorelines close using shared spherical vertices and preserve independent pool levels',()=>{
  assert.equal(shores.stats.faces,2*planet.grid.count-4);
  assert.ok(shores.rings.some(r=>r.body===-1));assert.ok(shores.rings.some(r=>r.body>=0));assert.ok(shores.portals.length>100);
  const seen=new Set();
  for(const r of shores.rings){
    assert.equal(r.vertices[0],r.vertices.at(-1));assert.equal(r.vertices.length,r.segments.length+1);
    assert.equal(r.waterM,r.body<0?0:planet.waterbodies[r.body].waterLevelM);
    for(const e of r.segments){assert.ok(!seen.has(e));seen.add(e);assert.equal(shores.segments[e].body,r.body);}
  }
  assert.equal(seen.size,shores.segments.length);
  for(let i=0;i<planet.grid.count;i++)if(planet.ocean[i]||planet.waterbody[i]>=0&&planet.height[i]<planet.waterbodies[planet.waterbody[i]].waterLevelM)assert.notEqual(surface.waterScaffold.owner[i],-2);
});
test('every exposed global shoreline point and span agrees with its fixed water plane in the shared fitted query',()=>{
  let count=0,seam=false;
  for(const path of shores.paths){
    for(let k=0;k<path.points.length;k++){
      const v=path.points[k],q=surface.sample(v.lon,v.lat);
      assert.ok(Math.abs(q.fitted.groundM-path.waterM)<.01,JSON.stringify({v,ground:q.fitted.groundM}));
      if(!k)continue;
      const a=path.points[k-1].direction,b=v.direction,n=Math.hypot(...a.map((x,j)=>x+b[j])),d=a.map((x,j)=>(x+b[j])/n),lon=Math.atan2(d[2],d[0])*180/Math.PI,lat=Math.asin(d[1])*180/Math.PI;
      const mid=surface.sample(lon,lat);assert.ok(Math.abs(mid.fitted.groundM-path.waterM)<.01,JSON.stringify({lon,lat,level:path.waterM,ground:mid.fitted.groundM}));
      seam ||=Math.abs(v.lon-path.points[k-1].lon)>180;count++;
    }
  }
  assert.ok(count>10000);assert.ok(seam,'shore paths cross the longitude seam without a cut');
});
test('shoreline portals are paired with shore endpoints and the compact worker payload preserves all paths',()=>{
  const packed=packShorelines(shores);
  assert.equal(packed.paths.length,shores.paths.length);assert.equal(packed.portals.length,shores.portals.length);
  const ends=new Set(shores.paths.flatMap(p=>p.closed?[]:[p.points[0],p.points.at(-1)]).map(p=>p.direction.map(x=>x.toFixed(10)).join(':')));
  for(const p of shores.portals){
    assert.equal(p.waterM,p.body<0?0:planet.waterbodies[p.body].waterLevelM);
    if(!p.closed)for(const v of [p.points[0],p.points.at(-1)])assert.ok(ends.has(v.direction.map(x=>x.toFixed(10)).join(':')));
  }
  for(let k=0;k<packed.paths.length;k++){
    const p=packed.paths[k],original=shores.paths[k];assert.ok(p.coordinates instanceof Float64Array);assert.equal(p.coordinates.length,original.points.length*2);
    for(let j=0;j<p.coordinates.length;j++)assert.equal(p.coordinates[j],j%2?original.points[j>>1].lat:original.points[j>>1].lon);
  }
});

const foundation=buildMeshFoundation(planet,surface);
function meshEdges(mesh){
  const n=mesh.positions.length/3,edges=new Float64Array(mesh.indices.length);
  for(let k=0;k<mesh.indices.length;k+=3)for(let j=0;j<3;j++){const a=mesh.indices[k+j],b=mesh.indices[k+(j+1)%3];assert.ok(a<n&&b<n&&a!==b);edges[k+j]=Math.min(a,b)*n+Math.max(a,b);}
  return edges.sort();
}
test('the complete ground foundation is a closed indexed sphere without seam, pole or shoreline cracks',()=>{
  const m=foundation.ground,n=m.positions.length/3,edges=meshEdges(m);let unique=0;
  for(let k=0;k<edges.length;){let end=k+1;while(end<edges.length&&edges[end]===edges[k])end++;assert.equal(end-k,2,'every ground edge must have exactly two incident faces');unique++;k=end;}
  assert.equal(n-unique+m.indices.length/3,2);assert.equal(foundation.stats.sourceFaces,2359296);assert.equal(foundation.stats.sourceCells,1179650);
  assert.equal(foundation.stage,'foundation');assert.match(foundation.next,/4a2/);
  const used=new Uint8Array(n);for(const i of m.indices)used[i]=1;for(const v of used)assert.equal(v,1);
  for(let i=0;i<planet.grid.count;i++)assert.equal(m.elevationsM[i],planet.height[i]);
});
test('every standing-water mesh boundary uses the exact same ground position at its fixed pool or ocean level',()=>{
  const m=foundation.standingWater,n=m.positions.length/3,edges=meshEdges(m);let boundary=0;
  for(let k=0;k<edges.length;){let end=k+1;while(end<edges.length&&edges[end]===edges[k])end++;assert.ok(end-k===1||end-k===2);if(end-k===1){boundary++;for(const i of [Math.floor(edges[k]/n),edges[k]%n]){const v=m.groundVertex[i];assert.equal(foundation.ground.elevationsM[v],m.elevationsM[i]);for(let j=0;j<3;j++)assert.equal(foundation.ground.positions[v*3+j],m.positions[i*3+j]);}}k=end;}
  assert.ok(boundary>10000);
  for(let k=0;k<m.indices.length;k+=3){const ids=m.indices.subarray(k,k+3);assert.equal(m.bodies[ids[0]],m.bodies[ids[1]]);assert.equal(m.bodies[ids[0]],m.bodies[ids[2]]);}
  for(let i=0;i<n;i++){const level=m.bodies[i]===-1?0:planet.waterbodies[m.bodies[i]].waterLevelM;assert.ok(Math.abs(level-m.elevationsM[i])<.0002);}
});
test('all foundation triangles are finite, nondegenerate and outward-facing in metre coordinates',()=>{
  for(const mesh of [foundation.ground,foundation.standingWater]){
    const p=mesh.positions;
    for(const v of p)assert.ok(Number.isFinite(v));
    for(let k=0;k<mesh.indices.length;k+=3){const a=mesh.indices[k]*3,b=mesh.indices[k+1]*3,c=mesh.indices[k+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];assert.ok((uy*vz-uz*vy)*p[a]+(uz*vx-ux*vz)*p[a+1]+(ux*vy-uy*vx)*p[a+2]>0);}
    for(let i=0;i<mesh.elevationsM.length;i++){const radial=Math.hypot(p[i*3],p[i*3+1],p[i*3+2]);assert.ok(Math.abs(radial-(foundation.radiusM+mesh.elevationsM[i]))<.01);}
  }
});

const beforeConstraints=digest(planet),constraints=buildChannelConstraints(planet,surface,shores);
test('mesh constraints cover every global profile and share exact junction anchors across all incident links',()=>{
  const c=constraints,p=planet.riverProfiles,a=c.anchors;assert.equal(c.stats.edges,p.from.length);assert.equal(c.stats.anchors,p.corridor.reduce((s,v)=>s+v,0));assert.ok(c.stats.junctions>0);
  const seen=new Uint8Array(p.from.length);let junctions=0;
  for(let k=0;k<a.cells.length;k++){
    const cell=a.cells[k];assert.ok(p.corridor[cell]);if(a.incomingOffsets[k+1]-a.incomingOffsets[k]>1)junctions++;
    for(let j=a.incomingOffsets[k];j<a.incomingOffsets[k+1];j++){const e=a.incomingEdges[j];assert.equal(p.to[e],cell);assert.equal(a.to[e],k);assert.equal(c.stations.center[c.edges.stationOffsets[e+1]-1],a.point[k]);seen[e]++;}
    if(a.outgoingEdge[k]>=0){const e=a.outgoingEdge[k];assert.equal(p.from[e],cell);assert.equal(a.from[e],k);assert.equal(c.stations.center[c.edges.stationOffsets[e]],a.point[k]);}
  }
  for(const n of seen)assert.equal(n,1);assert.equal(junctions,c.stats.junctions);assert.equal(digest(planet),beforeConstraints);
});
test('all channel edges link their two real global faces, with every endpoint, midpoint and shore-contact station retained',()=>{
  const c=constraints,p=planet.riverProfiles,faces=new Int32Array((2*planet.grid.count-4)*3);let f=0;
  for(const cells of sphereFaces(planet.grid)){assert.equal(sphereFaceIndex(planet.grid,cells),f);faces.set(cells,f++*3);}
  for(let e=0;e<p.from.length;e++){
    const fs=c.edges.faces.subarray(e*2,e*2+2);assert.notEqual(fs[0],fs[1]);for(const id of fs){const cells=faces.subarray(id*3,id*3+3);assert.ok(cells.includes(p.from[e])&&cells.includes(p.to[e]));}
    const lo=c.edges.stationOffsets[e],hi=c.edges.stationOffsets[e+1],ts=c.stations.t.subarray(lo,hi);assert.equal(ts[0],0);assert.equal(ts.at(-1),1);assert.ok(ts.includes(.5));
    for(const t of [surface.contacts.start[e],surface.contacts.end[e]])assert.ok([...ts].some(v=>Math.abs(v-t)<1e-12));
    for(let j=lo;j<hi;j++){assert.equal(c.stations.edge[j],e);assert.ok(c.stations.widthM[j]>0);if(j>lo)assert.ok(c.stations.t[j]>c.stations.t[j-1]);assert.equal(nearestConstraintStation(c,e,c.stations.t[j]),j);}
  }
});
test('every saved global channel and portal center reproduces the shared fitted surface query',()=>{
  const c=constraints,p=c.points;let wet=0,dry=0;
  for(let i=0;i<p.groundM.length;i++){
    const d=p.directions.subarray(i*3,i*3+3);assert.ok(Math.abs(Math.hypot(...d)-1)<1e-12);
    const q=surface.sample(Math.atan2(d[2],d[0])*(180/Math.PI),Math.asin(Math.max(-1,Math.min(1,d[1])))*(180/Math.PI));assert.equal(p.groundM[i],q.fitted.groundM);assert.equal(p.face[i],sphereFaceIndex(planet.grid,q.triangle.cells));
    if(q.fitted.waterM===null){assert.ok(Number.isNaN(p.waterM[i]));dry++;}else{assert.equal(p.waterM[i],q.fitted.waterM);assert.ok(p.waterM[i]>p.groundM[i]);wet++;}
  }
  assert.ok(wet>0&&dry>0);
});
test('every global saved section has nine finite perpendicular fitted samples, retaining wet overlaps and dry designs',()=>{
  const c=constraints,R=c.radiusM;let wet=0,dry=0,openWater=0;
  for(let i=0;i<c.stations.t.length;i++){
    const s=sampleConstraintSection(c,surface,i);assert.equal(s.samples.length,9);const d=s.samples[4].direction;
    for(const point of s.samples){
      assert.ok(Number.isFinite(point.groundM));assert.ok(point.face>=-1&&point.face<2359296);
      if(point.waterM!==null)assert.ok(point.waterM>point.groundM);
      const v=point.direction,cr=[d[1]*v[2]-d[2]*v[1],d[2]*v[0]-d[0]*v[2],d[0]*v[1]-d[1]*v[0]],distance=Math.atan2(Math.hypot(...cr),d.reduce((a,x,k)=>a+x*v[k],0))*R;assert.ok(Math.abs(distance-Math.abs(point.offsetM))<1e-6);
    }
    if(s.samples[4].waterM===null)dry++;else wet++;
    if(s.samples[0].waterM!==null||s.samples.at(-1).waterM!==null)openWater++;
  }
  assert.ok(wet>0&&dry>0&&openWater>0);
});
test('every standing-water mouth portal retains its paired endpoints and global contributing channel links',()=>{
  const c=constraints,p=c.portals;assert.equal(c.stats.portals,shores.portals.length);
  for(let i=0;i<shores.portals.length;i++){
    const source=shores.portals[i];assert.ok(p.offsets[i+1]>p.offsets[i]);const linked=[...p.edges.subarray(p.offsets[i],p.offsets[i+1])];assert.equal(new Set(linked).size,linked.length);for(const e of linked)assert.ok(e<planet.riverProfiles.from.length);
    for(let end=0;end<2;end++){const id=p.endpoints[i*2+end],d=c.points.directions.subarray(id*3,id*3+3),expected=(end?source.points.at(-1):source.points[0]).direction;for(let k=0;k<3;k++)assert.ok(Math.abs(d[k]-expected[k])<1e-12);if(source.closed)assert.ok(c.points.groundM[id]<=source.waterM+.01);else assert.ok(Math.abs(c.points.groundM[id]-source.waterM)<.01);}
    if(source.closed)assert.equal(p.endpoints[i*2],p.endpoints[i*2+1]);
  }
});

test('terrain chunk addresses sample the same complete planetary surface across every cube face',()=>{
  const chunks=createTerrainChunkBuilder(surface,{sampleCacheLimit:1024}),before=digest(planet);
  for(let face=0;face<6;face++)for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const tile={face,level:2,x,y},chunk=chunks.build(tile,{resolution:4});
    for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){
      const id=j*5+i,d=terrainVertex(tile,4,i,j).direction,q=surface.sample(Math.atan2(d[2],d[0])*(180/Math.PI),Math.asin(Math.max(-1,Math.min(1,d[1])))*(180/Math.PI));
      assert.equal(chunk.elevationsM[id],q.fitted.groundM);if(q.fitted.waterM===null)assert.ok(Number.isNaN(chunk.waterM[id]));else assert.equal(chunk.waterM[id],q.fitted.waterM);
    }
  }
  assert.equal(digest(planet),before);assert.ok(chunks.cacheStats().entries<=1024);
});
test('actual global surface border positions agree bit for bit across cube seams without relying on cache hits',()=>{
  const builder=createTerrainChunkBuilder(surface,{sampleCacheLimit:1});
  for(let face=0;face<6;face++)for(const edge of ['right','top']){
    const tile={face,level:3,x:edge==='right'?7:3,y:edge==='top'?7:3},other=tileNeighbor(tile,edge),back=EDGES.find(e=>tileKey(tileNeighbor(other,e))===tileKey(tile)),a=builder.build(tile,{resolution:8}),b=builder.build(other,{resolution:8}),values=new Map();
    for(const id of terrainEdgeIndices(8,edge)){const key=terrainVertex(tile,8,id%9,(id/9)|0).key;values.set(key,{position:[...a.positions.subarray(id*3,id*3+3)],height:a.elevationsM[id],water:a.waterM[id]});}
    for(const id of terrainEdgeIndices(8,back)){const key=terrainVertex(other,8,id%9,(id/9)|0).key,v=values.get(key);assert.ok(v);assert.deepEqual([...b.positions.subarray(id*3,id*3+3)],v.position);assert.equal(b.elevationsM[id],v.height);assert.equal(b.waterM[id],v.water);}
  }
});
test('on-demand neighborhoods build local fitted geometry for wet rivers, dry channels and both poles',()=>{
  const builder=createTerrainChunkBuilder(surface),p=planet.riverProfiles,examples=[0,Math.max(0,p.wetEdge.findIndex(v=>v===1)),Math.max(0,p.wetEdge.findIndex(v=>v===0))].map(e=>lonLat(planet.grid,p.from[e]));examples.push([0,90],[0,-90],[-180,0]);
  for(const [lon,lat] of examples){const patch=builder.patch(lon,lat,{level:12,resolution:16});assert.equal(patch.stage,'terrain-chunks');assert.ok(patch.stats.chunks>=9&&patch.stats.chunks<=13);assert.ok(patch.stats.triangles<10000);assert.ok(patch.stats.sharedVertices>0);assert.equal(patch.waterStage,'clipped');assert.equal(patch.water.indices.length,patch.stats.waterTriangles*3);
    for(const v of patch.ground.positions)assert.ok(Number.isFinite(v));for(const id of patch.ground.indices)assert.ok(id<patch.ground.elevationsM.length);
  }
});

test('actual planet clipped water has manifold edges and every open edge is a shore or patch border',()=>{
  const builder=createTerrainChunkBuilder(surface),p=planet.riverProfiles,e=p.wetEdge.findIndex(v=>v===1),[lon,lat]=lonLat(planet.grid,p.from[e]),patch=builder.patch(lon,lat,{level:12,resolution:32});
  const key=(a,b)=>a<b?a+':'+b:b+':'+a,edges=data=>{const out=new Map();for(let k=0;k<data.indices.length;k+=3)for(let j=0;j<3;j++){const a=data.indices[k+j],b=data.indices[k+(j+1)%3],s=key(a,b);out.set(s,(out.get(s)||0)+1);}return out;},boundary=new Set();
  for(let k=0;k<patch.ground.boundaryIndices.length;k+=2)boundary.add(key(patch.ground.boundaryIndices[k],patch.ground.boundaryIndices[k+1]));
  for(const [edge,count] of edges(patch.ground))assert.equal(count,boundary.has(edge)?1:2);
  const w=patch.water,g=patch.ground,isShore=id=>[0,1,2].every(k=>w.positions[id*3+k]===g.positions[w.groundVertex[id]*3+k]);
  assert.ok(w.indices.length>0);assert.equal(patch.stats.ambiguousWaterTriangles,0);
  for(const [edge,count] of edges(w)){assert.ok(count<=2);if(count===1){const [a,b]=edge.split(':').map(Number);assert.ok((isShore(a)&&isShore(b))||boundary.has(key(w.groundVertex[a],w.groundVertex[b])));}}
  for(let i=0;i<w.elevationsM.length;i++)assert.ok(w.elevationsM[i]>=g.elevationsM[w.groundVertex[i]]-1e-8);
});

test('a real closed lake chunk retains its exact independent water level',()=>{
  const wb=planet.waterbodies.find(w=>w.closed&&w.wetAreaKm2>10);assert.ok(wb);
  let cell=-1;for(let i=0;i<planet.grid.count;i++)if(planet.waterbody[i]===wb.id&&(cell<0||planet.height[i]<planet.height[cell]))cell=i;
  assert.ok(cell>=0);const [lon,lat]=lonLat(planet.grid,cell),patch=createTerrainChunkBuilder(surface).patch(lon,lat,{level:13,resolution:16});
  assert.ok(patch.water.indices.length>0);assert.equal(patch.stats.ambiguousWaterTriangles,0);for(const h of patch.water.elevationsM)assert.ok(Math.abs(h-wb.waterLevelM)<1e-7);
});


test('camera-selected mixed detail chunks use real fitted global water and reuse geometry after movement',()=>{
  const stream=createTerrainStream(surface),a=stream.view(-78.33974,-41.71876,{level:12,aspect:1.9,tilt:45});
  assert.ok(a.stats.waterTriangles>0);assert.equal(a.stats.ambiguousWaterTriangles,0);assert.ok(a.stats.minLevel<a.stats.maxLevel);assert.ok(a.stats.triangles<1200000);
  const b=stream.view(-78.3397,-41.71876,{level:12,aspect:1.9,tilt:45});assert.ok(b.stream.reused>0);assert.ok(b.stream.cacheBytes<=b.stream.cacheLimitBytes);assert.ok(b.cache.entries<=b.cache.limit);
  for(const mesh of [a,b]){for(const v of mesh.ground.positions)assert.ok(Number.isFinite(v));for(const v of mesh.water.elevationsM)assert.ok(Number.isFinite(v));}
});


test('every global curved course is indexed at quarter stations and preserves its canonical downstream graph',()=>{
  const p=planet.riverProfiles,c=surface.course,before=digest(planet);assert.ok(c.stats.movedNodes>1000&&c.stats.curvedEdges>1000&&c.stats.protectedEdges>0);
  for(let e=0;e<p.from.length;e++){
    assert.deepEqual(c.sample(e,0).direction,c.nodeDirection(p.from[e]));assert.deepEqual(c.sample(e,1).direction,c.nodeDirection(p.to[e]));
    for(const t of [.25,.75]){const frame=c.sample(e,t),r=surface.riverAtDirection(frame.direction);assert.ok(r&&r.distanceM<1e-5,`missing curve station ${e}/${t}`);assert.equal(r.edge,e);assert.ok(frame.leftHalfM>0&&frame.rightHalfM>0);}
    const next=p.edgeAtCell[p.to[e]];if(next>=0){const a=c.sample(e,1),b=c.sample(next,0);assert.deepEqual(a.direction,b.direction);for(const key of ['widthM','leftHalfM','rightHalfM','leftBankM','rightBankM'])assert.ok(Math.abs(a[key]-b[key])<1e-8,`bank join ${e}/${key}`);}
  }
  assert.equal(digest(planet),before);
});
