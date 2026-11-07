import {sphereFaces} from './shorelines.mjs?v=0.9.3';
const normalize=a=>{const n=Math.hypot(...a);if(!(n>0&&Number.isFinite(n)))throw Error('Invalid channel frame');return a.map(v=>v/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const pair=(a,b,N)=>Math.min(a,b)*N+Math.max(a,b);
const mix=(a,b,t)=>t===0?a:t===1?b:normalize(a.map((v,k)=>v+(b[k]-v)*t));
const DEG=180/Math.PI;

/** The canonical face numbering from sphereFaces, with no coordinate seam.
 * A unique polar anchor has no single containing face and returns -1.
 */
export function sphereFaceIndex(g,cells){
  if(new Set(cells).size!==3)return -1;
  const w=g.width,regular=cells.filter(i=>i<g.north);
  if(regular.length===2){const [a,b]=regular.map(i=>i%w),x=(a+1)%w===b?a:b;return cells.includes(g.north)?x:w+2*(g.height-1)*w+x;}
  const y=Math.min(...regular.map(i=>(i/w)|0)),top=regular.filter(i=>((i/w)|0)===y),x=top.length===1?top[0]%w:((top[0]%w+1)%w===top[1]%w?top[0]%w:top[1]%w);
  return w+2*(y*w+x)+(top.length===1?1:0);
}

/** Global mesh input, not independent water ribbons. Centre anchors are shared
 * by the actual profile graph. Cross-section definitions are procedural and
 * sampled through the same fitted surface when consumed, avoiding a duplicate
 * multi-million-point surface cache. The following mesh pass triangulates them.
 */
export function buildChannelConstraints(m,surface,shores,{progress=()=>{}}={}){
  const p=m.riverProfiles,g=m.grid,N=g.count,E=p.from.length,anchorAt=new Int32Array(N).fill(-1),anchorCells=[];
  for(let i=0;i<N;i++)if(p.corridor[i]){anchorAt[i]=anchorCells.length;anchorCells.push(i);}
  const K=anchorCells.length,fromAnchor=new Uint32Array(E),toAnchor=new Uint32Array(E),incomingOffsets=new Uint32Array(K+1),outgoingEdge=new Int32Array(K).fill(-1),edgeFaces=new Int32Array(E*2).fill(-1),normals=new Float64Array(E*3),edgeMap=new Map();
  for(let e=0;e<E;e++){
    const a=anchorAt[p.from[e]],b=anchorAt[p.to[e]];if(a<0||b<0||outgoingEdge[a]>=0)throw Error('Invalid channel anchor graph');
    fromAnchor[e]=a;toAnchor[e]=b;incomingOffsets[b+1]++;outgoingEdge[a]=e;edgeMap.set(pair(p.from[e],p.to[e],N),e);
    normals.set(normalize(cross(surface.mesh.directionAt(p.from[e]),surface.mesh.directionAt(p.to[e]))),e*3);
  }
  for(let k=1;k<=K;k++)incomingOffsets[k]+=incomingOffsets[k-1];
  const incomingEdges=new Uint32Array(E),cursor=incomingOffsets.slice();for(let e=0;e<E;e++)incomingEdges[cursor[toAnchor[e]]++]=e;
  let f=0;
  for(const cells of sphereFaces(g)){
    for(let k=0;k<3;k++){const e=edgeMap.get(pair(cells[k],cells[(k+1)%3],N));if(e!==undefined){const j=e*2+(edgeFaces[e*2]>=0?1:0);if(edgeFaces[j]>=0)throw Error('Channel has more than two incident mesh faces');edgeFaces[j]=f;}}
    f++;
  }
  if(edgeFaces.some(i=>i<0))throw Error('Channel is missing a global mesh face');
  const stationOffsets=new Uint32Array(E+1),ts=[],centres=[],widths=[],stationEdges=[],directions=[],groundM=[],waterM=[],pointFaces=[];
  function point(direction){
    const q=surface.sample(Math.atan2(direction[2],direction[0])*DEG,Math.asin(Math.max(-1,Math.min(1,direction[1])))*DEG),id=groundM.length;
    directions.push(...direction);groundM.push(q.fitted.groundM);waterM.push(q.fitted.waterM===null?NaN:q.fitted.waterM);pointFaces.push(sphereFaceIndex(g,q.triangle.cells));return id;
  }
  const anchorPoint=new Uint32Array(K);for(let k=0;k<K;k++)anchorPoint[k]=point(surface.course.nodeDirection(anchorCells[k]));
  let junctions=0;for(let k=0;k<K;k++)if(incomingOffsets[k+1]-incomingOffsets[k]>1)junctions++;
  for(let e=0;e<E;e++){
    stationOffsets[e]=ts.length;
    const values=[0,.5,1,surface.contacts.start[e],surface.contacts.end[e]].sort((a,b)=>a-b);
    for(let k=0;k<values.length;k++){
      const t=values[k];if(k&&Math.abs(t-values[k-1])<1e-12)continue;
      const id=t===0?anchorPoint[fromAnchor[e]]:t===1?anchorPoint[toAnchor[e]]:point(surface.course.sample(e,t).direction);
      ts.push(t);centres.push(id);widths.push(surface.course.sample(e,t).widthM);stationEdges.push(e);
    }
    if(e%2048===0)progress(e/Math.max(1,E));
  }
  stationOffsets[E]=ts.length;
  const portalOffsets=new Uint32Array(shores.portals.length+1),portalEdges=[],portalPoints=new Uint32Array(shores.portals.length*2),portalClosed=new Uint8Array(shores.portals.length);
  for(let k=0;k<shores.portals.length;k++){
    const portal=shores.portals[k],edges=new Set();portalOffsets[k]=portalEdges.length;portalClosed[k]=portal.closed?1:0;
    const points=portal.points;
    portalPoints[k*2]=point(points[0].direction);portalPoints[k*2+1]=portal.closed?portalPoints[k*2]:point(points.at(-1).direction);
    function collect(d){for(const r of surface.channelsAtDirection(d))if(r.distanceM<=r.widthM/2+.02)edges.add(r.edge);}
    for(let j=0;j<points.length;j++){collect(points[j].direction);if(j)collect(mix(points[j-1].direction,points[j].direction,.5));}
    if(!edges.size)throw Error('Unlinked channel portal '+k);
    portalEdges.push(...[...edges].sort((a,b)=>a-b));
  }
  portalOffsets[shores.portals.length]=portalEdges.length;
  const result={stage:'channel-constraints',radiusM:g.radiusKm*1000,
    anchors:{cells:Int32Array.from(anchorCells),point:anchorPoint,from:fromAnchor,to:toAnchor,incomingOffsets,incomingEdges,outgoingEdge},
    points:{directions:Float64Array.from(directions),groundM:Float64Array.from(groundM),waterM:Float64Array.from(waterM),face:Int32Array.from(pointFaces)},
    edges:{faces:edgeFaces,normals,stationOffsets},
    stations:{t:Float64Array.from(ts),center:Uint32Array.from(centres),widthM:Float64Array.from(widths),edge:Uint32Array.from(stationEdges)},
    portals:{offsets:portalOffsets,edges:Uint32Array.from(portalEdges),endpoints:portalPoints,closed:portalClosed},
    stats:{edges:E,anchors:K,junctions,stations:ts.length,centerPoints:groundM.length,portals:shores.portals.length,portalLinks:portalEdges.length,closedPortals:portalClosed.reduce((s,v)=>s+v,0)}};
  result.stats.bytes=Object.values(result).filter(v=>v&&typeof v==='object').flatMap(v=>Object.values(v)).reduce((s,v)=>s+(ArrayBuffer.isView(v)?v.byteLength:0),0);
  return result;
}

export function nearestConstraintStation(c,edge,t){
  if(!Number.isInteger(edge)||edge<0||edge>=c.edges.stationOffsets.length-1||!Number.isFinite(t)||t<0||t>1)throw Error('Invalid mesh constraint station');
  const lo=c.edges.stationOffsets[edge],hi=c.edges.stationOffsets[edge+1];let best=lo;
  for(let i=lo+1;i<hi;i++)if(Math.abs(c.stations.t[i]-t)<Math.abs(c.stations.t[best]-t))best=i;
  return best;
}

/** Actual fitted query samples, including any overlapping channel or pool.
 * Nominal width marks are constraints to refine, not assumed dry shorelines.
 */
export function sampleConstraintSection(c,surface,station){
  if(!Number.isInteger(station)||station<0||station>=c.stations.t.length)throw Error('Invalid mesh constraint section');
  const edge=c.stations.edge[station],center=c.stations.center[station],d=[...c.points.directions.subarray(center*3,center*3+3)],normal=surface.course.sample(edge,c.stations.t[station]).normal,half=c.stations.widthM[station]/2,bank=Math.max(1,c.stations.widthM[station]*.35),support=half+bank;
  const offsets=[-support,-half-bank/2,-half,-half/2,0,half/2,half,half+bank/2,support];
  const samples=offsets.map(offsetM=>{
    const angle=offsetM/c.radiusM,direction=offsetM===0?d:d.map((v,k)=>v*Math.cos(angle)+normal[k]*Math.sin(angle));
    if(offsetM===0)return {offsetM,direction,groundM:c.points.groundM[center],waterM:Number.isNaN(c.points.waterM[center])?null:c.points.waterM[center],face:c.points.face[center]};
    const q=surface.sample(Math.atan2(direction[2],direction[0])*DEG,Math.asin(Math.max(-1,Math.min(1,direction[1])))*DEG);
    return {offsetM,direction,groundM:q.fitted.groundM,waterM:q.fitted.waterM,face:sphereFaceIndex(surface.grid,q.triangle.cells)};
  });
  return {edge,station,t:c.stations.t[station],widthM:c.stations.widthM[station],samples};
}
