import {poolWetFraction} from './pools.mjs?v=0.9.12';

/** Install the solved pools in the authoritative cell graph. Dry margins
 * remain land. Only a pool's wet footprint (including its zero-depth contact
 * cells) belongs to its waterbody. Closed pools own real receiver=-1 sinks.
 */
export function installPoolRouting({grid:g,height,receiver,level,waterbody,waterbodies,basins,structure,poolBalances,neighbors,lonLat}) {
  const cellPool=new Int32Array(g.count).fill(-1),seen=new Uint8Array(g.count),near=new Int32Array(g.width);
  const cells=poolBalances.pools.map(()=>[]),wetness=new Float32Array(g.count),potentialSpills=[];
  for(const basin of structure.basins)for(const i of basin.cells){
    const id=poolBalances.depressionPool[structure.cellDepression[i]];cellPool[i]=id;cells[id].push(i);
  }
  waterbody.fill(-1);waterbodies.length=0;
  for(const p of poolBalances.pools){
    let root=-1,min=Infinity,area=0,maxDepth=0,cx=0,cy=0,cz=0,wetCells=0;
    for(const i of cells[p.id]){
      const a=i<g.north?g.rowArea[(i/g.width)|0]:0;area+=a;
      if(height[i]<min||(height[i]===min&&i<root)){min=height[i];root=i;}
      if(height[i]<=p.waterLevelM){
        waterbody[i]=p.id;wetness[i]=poolWetFraction(height[i],p.waterLevelM);wetCells++;
        const [lon,lat]=lonLat(g,i),l=lon*Math.PI/180,t=lat*Math.PI/180,wa=a*wetness[i];
        cx+=Math.cos(t)*Math.cos(l)*wa;cy+=Math.sin(t)*wa;cz+=Math.cos(t)*Math.sin(l)*wa;
        maxDepth=Math.max(maxDepth,p.waterLevelM-height[i]);
      }
    }
    if(!p.closed)root=p.spillFromCell;
    if(waterbody[root]!==p.id){waterbody[root]=p.id;wetCells++;}
    const [fallbackLon,fallbackLat]=lonLat(g,root);
    const lon=cx||cz?Math.atan2(cz,cx)*180/Math.PI:fallbackLon;
    const lat=cx||cy||cz?Math.atan2(cy,Math.hypot(cx,cz))*180/Math.PI:fallbackLat;
    waterbodies.push({...p,kind:p.wetAreaKm2<.35?'pond':'lake',areaKm2:area,volumeM3:p.wetVolumeM3,
      maxDepthM:maxDepth,surfaceM:p.spillM,cells:wetCells,basinCells:cells[p.id].length,
      outletCell:root,outletReceiver:p.closed?-1:p.spillToCell,lon,lat,wetLon:lon,wetLat:lat,
      directRainM3s:p.liquidInputM3s,inlets:[],inflowM3s:0,localRunoffM3s:0});
    if(p.closed)potentialSpills.push({kind:'stream',regime:'dry',dormantSpill:true,dischargeM3s:0,
      waterbody:p.id,path:Int32Array.of(p.spillFromCell,p.spillToCell)});
    // A priority flood confined to the connected pool catchment routes wet
    // flats to its outlet and exposed ground down to its actual water level.
    const heap=[];
    const less=(a,b)=>level[a]<level[b]||(level[a]===level[b]&&a<b);
    const push=i=>{let k=heap.length;heap.push(i);while(k){const q=(k-1)>>1;if(!less(i,heap[q]))break;heap[k]=heap[q];k=q;}heap[k]=i;};
    const pop=()=>{const out=heap[0],tail=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let q=k*2+1;if(q+1<heap.length&&less(heap[q+1],heap[q]))q++;if(!less(heap[q],tail))break;heap[k]=heap[q];k=q;}heap[k]=tail;}return out;};
    seen[root]=1;level[root]=Math.max(height[root],p.waterLevelM);receiver[root]=p.closed?-1:p.spillToCell;push(root);
    let routed=0;
    while(heap.length){
      const i=pop();routed++;const n=neighbors(g,i,near);
      for(let k=0;k<n;k++){
        const j=near[k];if(seen[j]||cellPool[j]!==p.id)continue;
        seen[j]=1;receiver[j]=i;level[j]=Math.max(height[j],p.waterLevelM,level[i]);push(j);
      }
    }
    if(routed!==cells[p.id].length)throw Error('Disconnected pool catchment');
    for(const i of cells[p.id])if(level[i]>Math.max(height[i],p.waterLevelM)+1e-4)throw Error('Pool routing introduced an unsolved depression: '+JSON.stringify({pool:p.id,cell:i,bed:height[i],stage:p.waterLevelM,level:level[i],joined:p.joinedAtM,root,spill:p.spillM}));
  }
  for(const basin of basins)basin.poolIds=poolBalances.basins[basin.id].poolIds;
  return {cellPool,wetness,potentialSpills};
}
