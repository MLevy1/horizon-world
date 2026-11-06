/** Shared longitudinal design profiles for the entire active cell graph.
 * Heights, widths, depths and lengths are metres; flow is annual mean m³/s.
 * Dimensions are explicit procedural parameters, not calibrated hydraulics.
 * A finite design level on a dry channel does not imply actual surface water.
 */
export const FLOW_EPSILON_M3S=1e-9;
export function channelDimensions(dischargeM3s){
  if(!Number.isFinite(dischargeM3s)||dischargeM3s<0)throw Error('Invalid channel discharge');
  const q=Math.sqrt(dischargeM3s),widthM=Math.min(90,2+7*q),depthM=Math.min(5,.25+.35*q);
  return {widthM,depthM,freeboardM:.2+.25*depthM};
}

export function buildRiverProfiles(m,order,distanceKm){
  const {grid:g,height,level,channel,receiver,waterbody,waterbodies,ocean,discharge}=m,N=g.count;
  const waterM=new Float64Array(N).fill(NaN),bedM=new Float64Array(N).fill(NaN);
  const widthM=new Float64Array(N),designDepthM=new Float64Array(N),freeboardM=new Float64Array(N);
  const kind=new Uint8Array(N),corridor=new Uint8Array(N),wet=new Uint8Array(N),edgeAtCell=new Int32Array(N).fill(-1);
  const contactFloor=new Float64Array(N).fill(-Infinity),portFlow=new Float64Array(N);
  const from=[],to=[],lengthM=[],wetEdge=[];
  // Kinds: 0 unprofiled land, 1 river channel, 2 inland pool, 3 ocean.
  for(let i=0;i<N;i++){
    if(ocean[i]){kind[i]=3;waterM[i]=0;bedM[i]=height[i];wet[i]=1;}
    else if(waterbody[i]>=0){kind[i]=2;waterM[i]=waterbodies[waterbody[i]].waterLevelM;bedM[i]=height[i];wet[i]=height[i]<waterM[i]?1:0;}
    else if(channel[i]){kind[i]=1;corridor[i]=1;wet[i]=discharge[i]>FLOW_EPSILON_M3S?1:0;}
  }
  const addEdge=i=>{
    const p=receiver[i];if(p<0||!kind[p])throw Error('Profile has no receiving water or channel');
    edgeAtCell[i]=from.length;from.push(i);to.push(p);lengthM.push(distanceKm(g,i,p)*1000);
    wetEdge.push(discharge[i]>FLOW_EPSILON_M3S?1:0);corridor[i]=corridor[p]=1;
    if(kind[p]!==1)portFlow[p]+=discharge[i];
  };
  for(let i=0;i<N;i++)if(channel[i])addEdge(i);
  for(const wb of waterbodies)if(!wb.closed){
    addEdge(wb.outletCell);
    // The higher endpoint of the actual spill edge is its crest. A crest
    // on the receiving bank must meet the source lake level exactly.
    const crest=height[wb.outletCell]>=height[wb.outletReceiver]?wb.outletCell:wb.outletReceiver;
    contactFloor[crest]=Math.max(contactFloor[crest],wb.waterLevelM);
  }
  for(let i=0;i<N;i++)if(corridor[i]){
    const q=kind[i]===1?discharge[i]:Math.max(portFlow[i],edgeAtCell[i]>=0?discharge[i]:0),d=channelDimensions(q);
    widthM[i]=d.widthM;designDepthM[i]=d.depthM;freeboardM[i]=d.freeboardM;
    if(kind[i]!==1&&q>FLOW_EPSILON_M3S)wet[i]=1;
  }
  // Sinks first: backwater/contact constraints propagate upstream through a
  // junction once. Lake planes remain fixed; no artificial epsilon gradient.
  for(let k=order.length-1;k>=0;k--){
    const i=order[k];if(kind[i]!==1)continue;
    const p=receiver[i];
    waterM[i]=Math.max(height[i]-freeboardM[i],waterM[p],contactFloor[i]);
  }
  for(let i=0;i<N;i++)if(corridor[i])bedM[i]=Math.min(height[i],waterM[i]-designDepthM[i]);
  const result={waterM,bedM,widthM,designDepthM,freeboardM,kind,corridor,wet,edgeAtCell,
    from:Int32Array.from(from),to:Int32Array.from(to),lengthM:Float64Array.from(lengthM),wetEdge:Uint8Array.from(wetEdge)};
  result.validation=validateRiverProfiles(m,result);
  let riverCells=0,dryCells=0,ports=0,minWidth=Infinity,maxWidth=0,minDepth=Infinity,maxDepth=0;
  for(let i=0;i<N;i++)if(corridor[i]){
    if(kind[i]===1){riverCells++;if(!wet[i])dryCells++;}else ports++;
    minWidth=Math.min(minWidth,widthM[i]);maxWidth=Math.max(maxWidth,widthM[i]);
    minDepth=Math.min(minDepth,designDepthM[i]);maxDepth=Math.max(maxDepth,designDepthM[i]);
  }
  result.stats={riverCells,dryCells,ports,edges:from.length,wetEdges:wetEdge.reduce((sum,v)=>sum+v,0),
    minWidthM:Number.isFinite(minWidth)?minWidth:0,maxWidthM:maxWidth,minDesignDepthM:Number.isFinite(minDepth)?minDepth:0,maxDesignDepthM:maxDepth};
  return result;
}

/** Both ends read canonical node data. Every incoming/outgoing edge therefore
 * meets at exactly the same surface, bed and width at a junction or port.
 */
export function sampleRiverEdge(p,edge,t){
  if(!Number.isInteger(edge)||edge<0||edge>=p.from.length||!Number.isFinite(t)||t<0||t>1)throw Error('Invalid profile sample');
  const a=p.from[edge],b=p.to[edge],lerp=values=>t===0?values[a]:t===1?values[b]:values[a]+(values[b]-values[a])*t;
  return {waterM:lerp(p.waterM),bedM:lerp(p.bedM),widthM:lerp(p.widthM),designDepthM:lerp(p.designDepthM),
    distanceM:p.lengthM[edge]*t,wet:!!p.wetEdge[edge]};
}

export function validateRiverProfiles(m,p){
  const errors=[];let invalidNodes=0,invalidEdges=0,uphillEdges=0,badContacts=0,maxRiseM=0,checkedNodes=0;
  for(let i=0;i<m.grid.count;i++){
    if(m.channel[i]&&p.edgeAtCell[i]<0)invalidEdges++;
    if(!p.kind[i])continue;
    if(!Number.isFinite(p.waterM[i])||!Number.isFinite(p.bedM[i])||p.bedM[i]>p.waterM[i]+1e-8)invalidNodes++;
    if(m.ocean[i]&&p.waterM[i]!==0)badContacts++;
    if(m.waterbody[i]>=0&&p.waterM[i]!==m.waterbodies[m.waterbody[i]].waterLevelM)badContacts++;
    if(p.kind[i]===1&&p.waterM[i]>m.level[i]+1e-8)invalidNodes++;
    if(p.corridor[i]){
      checkedNodes++;
      if(!(p.widthM[i]>=2&&p.widthM[i]<=90&&p.designDepthM[i]>=.25&&p.designDepthM[i]<=5)||p.bedM[i]>p.waterM[i]-p.designDepthM[i]+1e-8)invalidNodes++;
    }
  }
  for(let e=0;e<p.from.length;e++){
    const a=p.from[e],b=p.to[e],rise=p.waterM[b]-p.waterM[a];maxRiseM=Math.max(maxRiseM,rise);
    if(rise>1e-8)uphillEdges++;
    if(m.receiver[a]!==b||p.edgeAtCell[a]!==e||!(p.lengthM[e]>0&&Number.isFinite(p.lengthM[e]))||p.wetEdge[e]!==Number(m.discharge[a]>FLOW_EPSILON_M3S))invalidEdges++;
  }
  for(const wb of m.waterbodies){
    if(wb.closed){if(p.edgeAtCell[wb.outletCell]>=0)badContacts++;continue;}
    const crest=m.height[wb.outletCell]>=m.height[wb.outletReceiver]?wb.outletCell:wb.outletReceiver;
    if(Math.abs(p.waterM[crest]-wb.waterLevelM)>1e-8)badContacts++;
  }
  if(invalidNodes||invalidEdges)errors.push(`${invalidNodes} invalid profile nodes; ${invalidEdges} invalid edges`);
  if(uphillEdges||badContacts)errors.push(`${uphillEdges} uphill profiles; ${badContacts} inconsistent water contacts`);
  return {ok:!errors.length,errors,checkedNodes,checkedEdges:p.from.length,invalidNodes,invalidEdges,uphillEdges,badContacts,maxRiseM};
}
