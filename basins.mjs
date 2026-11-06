/** Basin structure only: no water-level, climate or active-routing changes.
 * Each potential lake is partitioned into local downhill catchments. Flat
 * components drain to a lower neighbor when possible, or own one shared pit.
 * Connections retain the lowest mesh-edge saddle between each catchment pair.
 * Cell IDs and depression IDs are global; elevations m and areas km².
 */
export function buildBasinInventory({grid:g,height,waterbody,waterbodies,neighbors,distanceKm,cellsByBasin}) {
  const N=g.count,near=new Int32Array(g.width);
  const cellDepression=new Int32Array(N),downhill=new Int32Array(N),seen=new Uint8Array(N);
  cellDepression.fill(-1);downhill.fill(-1);
  const depressions=[],connections=[],basins=[];
  const lists=cellsByBasin||waterbodies.map(()=>[]);
  if(!cellsByBasin)for(let i=0;i<N;i++)if(waterbody[i]>=0)lists[waterbody[i]].push(i);
  let coveredCells=0,multiDepressionBasins=0;
  for(const wb of waterbodies){
    const cells=lists[wb.id],queue=new Int32Array(cells.length),depressionIds=[],connectionIds=[];
    // Strict descent first. Flat cells without a lower neighbor remain -2
    // until their entire equal-height component has been inspected.
    for(const i of cells){
      let best=-2,slope=0;const n=neighbors(g,i,near);
      for(let k=0;k<n;k++){
        const j=near[k];if(waterbody[j]!==wb.id||height[j]>=height[i])continue;
        const s=(height[i]-height[j])/distanceKm(g,i,j);
        if(s>slope||(s===slope&&j<best)){best=j;slope=s;}
      }
      downhill[i]=best;
    }
    for(const start of cells){
      if(seen[start])continue;
      const flat=[start];seen[start]=1;
      for(let a=0;a<flat.length;a++){
        const i=flat[a],n=neighbors(g,i,near);
        for(let k=0;k<n;k++){
          const j=near[k];
          if(!seen[j]&&waterbody[j]===wb.id&&height[j]===height[start]){seen[j]=1;flat.push(j);}
        }
      }
      flat.sort((a,b)=>a-b);
      let a=0,b=0;
      for(const i of flat)if(downhill[i]>=0)queue[b++]=i;
      if(!b){downhill[flat[0]]=-1;queue[b++]=flat[0];}
      // Multi-source routing across the plateau avoids artificial local pits
      // caused solely by cell-ID tie-breaking.
      while(a<b){
        const i=queue[a++],n=neighbors(g,i,near);
        for(let k=0;k<n;k++){
          const j=near[k];
          if(waterbody[j]===wb.id&&height[j]===height[start]&&downhill[j]===-2){downhill[j]=i;queue[b++]=j;}
        }
      }
    }
    for(const start of cells){
      if(cellDepression[start]>=0)continue;
      const path=[];let i=start;
      while(cellDepression[i]<0&&downhill[i]>=0){
        path.push(i);i=downhill[i];
        if(path.length>cells.length)throw Error('Cycle in basin inventory');
      }
      let id=cellDepression[i];
      if(id<0){
        id=depressions.length;cellDepression[i]=id;depressionIds.push(id);
        depressions.push({id,basinId:wb.id,pitCell:i,pitM:height[i],cellCount:0,areaKm2:0,connectionIds:[]});
      }
      for(const cell of path)cellDepression[cell]=id;
    }
    const saddles=new Map();
    for(const i of cells){
      const id=cellDepression[i],d=depressions[id];d.cellCount++;
      if(i<g.north)d.areaKm2+=g.rowArea[(i/g.width)|0];
      const n=neighbors(g,i,near);
      for(let k=0;k<n;k++){
        const j=near[k],other=cellDepression[j];
        if(j<=i||waterbody[j]!==wb.id||other===id)continue;
        const from=Math.min(id,other),to=Math.max(id,other),spillM=Math.max(height[i],height[j]);
        const key=from*N+to,old=saddles.get(key);
        if(!old||spillM<old.spillM||(spillM===old.spillM&&(i<old.edgeLow||(i===old.edgeLow&&j<old.edgeHigh)))){
          saddles.set(key,{basinId:wb.id,from,to,fromCell:from===id?i:j,toCell:from===id?j:i,spillM,edgeLow:i,edgeHigh:j,kind:'saddle'});
        }
      }
    }
    const add=c=>{
      const id=connections.length;connections.push({id,...c});connectionIds.push(id);
      depressions[c.from].connectionIds.push(id);
      if(c.to>=0)depressions[c.to].connectionIds.push(id);
      return id;
    };
    for(const c of [...saddles.values()].sort((a,b)=>a.spillM-b.spillM||a.edgeLow-b.edgeLow||a.edgeHigh-b.edgeHigh)){
      delete c.edgeLow;delete c.edgeHigh;add(c);
    }
    // This is the existing basin's POTENTIAL outer spill, not an active flow.
    // Shallow shoreline cells may put the raw edge slightly below that level.
    const outletConnection=add({basinId:wb.id,from:cellDepression[wb.outletCell],to:-1,
      fromCell:wb.outletCell,toCell:wb.outletReceiver,spillM:wb.surfaceM,kind:'outlet'});
    basins.push({id:wb.id,cells:Int32Array.from(cells),depressionIds:Int32Array.from(depressionIds),
      connectionIds:Int32Array.from(connectionIds),outletConnection,spillM:wb.surfaceM});
    coveredCells+=cells.length;if(depressionIds.length>1)multiDepressionBasins++;
  }
  for(const d of depressions)d.connectionIds=Int32Array.from(d.connectionIds);
  const inventory={cellDepression,downhill,depressions,connections,basins,
    stats:{basins:basins.length,depressions:depressions.length,internalSpills:connections.length-basins.length,multiDepressionBasins,coveredCells}};
  inventory.validation=validateBasinInventory({grid:g,height,waterbody,waterbodies,neighbors},inventory);
  return inventory;
}

export function validateBasinInventory({grid:g,height,waterbody,waterbodies,neighbors},s) {
  const errors=[],near=new Int32Array(g.width),seen=new Uint8Array(g.count),state=new Uint8Array(g.count);
  let coveredCells=0,badCells=0,badLinks=0,cycles=0,badConnections=0,disconnectedBasins=0;
  const adjacent=(a,b)=>{
    const n=neighbors(g,a,near);for(let k=0;k<n;k++)if(near[k]===b)return true;
    return false;
  };
  for(const basin of s.basins){
    for(const i of basin.cells){
      const d=s.depressions[s.cellDepression[i]],p=s.downhill[i];coveredCells++;
      if(seen[i]||waterbody[i]!==basin.id||!d||d.basinId!==basin.id){badCells++;continue;}
      seen[i]=1;
      if(p<0){if(p!==-1||d.pitCell!==i)badLinks++;}
      else if(p>=g.count||!adjacent(i,p)||waterbody[p]!==basin.id||s.cellDepression[p]!==d.id||height[p]>height[i])badLinks++;
      const path=[];let j=i;
      while(j>=0&&j<g.count&&!state[j]){state[j]=1;path.push(j);j=s.downhill[j];}
      if(j>=0&&j<g.count&&state[j]===1)cycles++;
      for(const cell of path)state[cell]=2;
    }
    const reached=new Set(),queue=[s.connections[basin.outletConnection]?.from];
    for(let a=0;a<queue.length;a++){
      const id=queue[a];if(reached.has(id)||!s.depressions[id])continue;reached.add(id);
      for(const edge of s.depressions[id].connectionIds){
        const c=s.connections[edge],other=c.from===id?c.to:c.from;
        if(other>=0&&!reached.has(other))queue.push(other);
      }
    }
    if(reached.size!==basin.depressionIds.length)disconnectedBasins++;
  }
  for(let i=0;i<g.count;i++)if((waterbody[i]>=0)!==Boolean(seen[i])||(waterbody[i]<0&&(s.cellDepression[i]!==-1||s.downhill[i]!==-1)))badCells++;
  for(const c of s.connections){
    const wb=waterbodies[c.basinId];
    if(!wb||!adjacent(c.fromCell,c.toCell)||s.cellDepression[c.fromCell]!==c.from||waterbody[c.fromCell]!==c.basinId){badConnections++;continue;}
    if(c.kind==='outlet'){
      if(c.to!==-1||c.fromCell!==wb.outletCell||c.toCell!==wb.outletReceiver||c.spillM!==wb.surfaceM||waterbody[c.toCell]===wb.id)badConnections++;
    }else if(c.to===c.from||s.cellDepression[c.toCell]!==c.to||waterbody[c.toCell]!==c.basinId||c.spillM!==Math.max(height[c.fromCell],height[c.toCell])||c.spillM>wb.surfaceM)badConnections++;
  }
  if(badCells)errors.push(`${badCells} invalid basin cells`);
  if(badLinks||cycles)errors.push(`${badLinks} invalid descents; ${cycles} basin cycles`);
  if(badConnections||disconnectedBasins)errors.push(`${badConnections} invalid spills; ${disconnectedBasins} disconnected basins`);
  return {ok:!errors.length,errors,coveredCells,badCells,badLinks,cycles,badConnections,disconnectedBasins};
}
