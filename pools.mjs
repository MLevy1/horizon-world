import {YEAR_SECONDS} from './climate.mjs?v=0.9.13';

/** Annual fill/spill/merge balances, separate from active cell routing.
 * A fixed one-metre shoreline-area ramp keeps evaporation continuous when
 * groups merge. This is a subcell reservoir approximation, not a fluid solver.
 * Water quantities are m³/s; elevations m; wet areas km²; volumes m³.
 */
export const SHORE_BAND_M=1;
export const poolWetFraction=(bed,stage)=>Math.max(0,Math.min(1,(stage-bed)/SHORE_BAND_M));

export function solveBasinPools({basin,structure,grid:g,height,climate,inputAtCellM3s}) {
  const ids=[...basin.depressionIds],local=new Map(ids.map((id,i)=>[id,i])),K=ids.length;
  const parent=Int32Array.from(ids,(_,i)=>i),joinedAt=new Float64Array(K).fill(-Infinity);
  const initial=ids.map(()=>({cells:[],source:0}));
  const liquid=climate.liquidInputMm||climate.precipitation;
  const demand=climate.effectiveEvaporationMm||climate.potentialEvaporation;
  for(const i of basin.cells){
    const source=inputAtCellM3s[i],area=i<g.north?g.rowArea[(i/g.width)|0]:0;
    if(!Number.isFinite(source)||source<0)throw Error('Pool inputs must be finite and nonnegative');
    const conversion=area*1000/YEAR_SECONDS,group=initial[local.get(structure.cellDepression[i])];
    const evaporation=demand[i]*conversion,rain=liquid[i]*conversion,runoff=climate.runoffMm[i]*conversion;
    if(![evaporation,rain,runoff].every(x=>Number.isFinite(x)&&x>=0))throw Error('Invalid pool climate');
    group.cells.push({id:i,bed:height[i],area,evaporation,rain,runoff,loss:Math.max(0,evaporation-rain+runoff)});
    group.source+=source;
  }
  const find=i=>{let r=i;while(parent[r]!==r)r=parent[r];while(parent[i]!==i){const p=parent[i];parent[i]=r;i=p;}return r;};
  const capacity=(group,stage)=>{let loss=0;for(const c of group.cells)loss+=c.loss*poolWetFraction(c.bed,stage);return loss;};
  const edges=[...basin.connectionIds].map(id=>structure.connections[id]);
  let groups,mergePasses=0;
  for(;;){
    groups=new Map();
    for(let i=0;i<K;i++){
      const root=find(i);let group=groups.get(root);
      if(!group){group={root,cells:[],depressionIds:[],source:0,best:null,to:-1,degree:0};groups.set(root,group);}
      for(const cell of initial[i].cells)group.cells.push(cell);
      group.depressionIds.push(ids[i]);group.source+=initial[i].source;
    }
    for(const edge of edges){
      const a=find(local.get(edge.from)),b=edge.to<0?-1:find(local.get(edge.to));if(a===b)continue;
      for(const [from,to] of [[a,b],[b,a]])if(from>=0){
        const group=groups.get(from),old=group.best;
        if(!old||edge.spillM<old.spillM||(edge.spillM===old.spillM&&edge.id<old.id)){group.best=edge;group.to=to;}
      }
    }
    for(const group of groups.values()){
      if(!group.best)throw Error('Pool group has no potential spill');
      group.available=group.source;group.capacity=capacity(group,group.best.spillM);group.outflow=0;group.done=false;
      if(group.to>=0)groups.get(group.to).degree++;
    }
    // Each group chooses its lowest boundary edge. Unique edge-ID ties make
    // every remaining cycle a mutual pair across one shared saddle.
    const queue=[...groups.values()].filter(group=>!group.degree);
    for(let a=0;a<queue.length;a++){
      const group=queue[a];group.done=true;group.outflow=Math.max(0,group.available-group.capacity);
      if(group.to>=0){const next=groups.get(group.to);next.available+=group.outflow;if(!--next.degree)queue.push(next);}
    }
    let merges=0;
    for(const a of groups.values())if(!a.done){
      const b=groups.get(a.to);
      if(!b||b.to!==a.root||b.best.id!==a.best.id)throw Error('Invalid spill-pair topology');
      a.done=b.done=true;
      const surplusA=a.available-a.capacity,surplusB=b.available-b.capacity;
      if(surplusA+surplusB>0){
        const root=Math.min(a.root,b.root),other=Math.max(a.root,b.root);
        parent[other]=root;joinedAt[root]=Math.max(joinedAt[root],joinedAt[other],a.best.spillM);merges++;
      }else if(surplusA>0){a.outflow=surplusA;b.available+=surplusA;}
      else if(surplusB>0){b.outflow=surplusB;a.available+=surplusB;}
    }
    if(!merges)break;
    if(++mergePasses>=K)throw Error('Pool merges did not converge');
  }
  const ordered=[...groups.values()].sort((a,b)=>a.root-b.root),poolId=new Map(ordered.map((group,i)=>[group.root,i]));
  const pools=ordered.map((group,id)=>{
    const closed=group.outflow===0,spillM=group.best.spillM;
    let min=Infinity;for(const c of group.cells)min=Math.min(min,c.bed);
    let stage=spillM;
    if(closed){
      if(!group.available)stage=min;
      else{
        let lo=min,hi=spillM;
        for(let k=0;k<56;k++){const mid=(lo+hi)/2;if(capacity(group,mid)<group.available)lo=mid;else hi=mid;}
        stage=(lo+hi)/2;
      }
    }
    let wetArea=0,volume=0,evaporation=0,rain=0,wetRunoff=0,loss=0;
    for(const c of group.cells){
      const f=poolWetFraction(c.bed,stage),d=Math.max(0,stage-c.bed);
      wetArea+=c.area*f;evaporation+=c.evaporation*f;rain+=c.rain*f;wetRunoff+=c.runoff*f;loss+=c.loss*f;
      // Integral of the same fractional area with respect to stage.
      volume+=c.area*1e6*(d<SHORE_BAND_M?d*d/(2*SHORE_BAND_M):d-SHORE_BAND_M/2);
    }
    const c=group.best,forward=find(local.get(c.from))===group.root;
    return {id,basinId:basin.id,depressionIds:Int32Array.from(group.depressionIds),cellCount:group.cells.length,
      sourceM3s:group.source,availableM3s:group.available,netEvaporationM3s:loss,outflowM3s:group.outflow,
      waterLevelM:stage,spillM,joinedAtM:Number.isFinite(joinedAt[group.root])?joinedAt[group.root]:null,
      spillConnection:c.id,spillFromCell:forward?c.fromCell:c.toCell,spillToCell:forward?c.toCell:c.fromCell,
      potentialDownstreamPoolId:group.to<0?-1:poolId.get(group.to),downstreamPoolId:closed?null:group.to<0?-1:poolId.get(group.to),
      closed,status:wetArea<.015?'playa':closed?'closed':'overflowing',wetAreaKm2:wetArea,wetVolumeM3:volume,
      evaporationM3s:evaporation,liquidInputM3s:rain,wetBaseRunoffM3s:wetRunoff};
  });
  return {basinId:basin.id,pools,mergePasses,availableM3s:pools.reduce((s,p)=>s+p.sourceM3s,0),
    netEvaporationM3s:pools.reduce((s,p)=>s+p.netEvaporationM3s,0),
    outflowM3s:pools.reduce((s,p)=>s+(p.downstreamPoolId===-1?p.outflowM3s:0),0)};
}

/** Compute a separate complete-planet budget through existing outer basin
 * connections. Results never overwrite the viewer's discharge or receivers.
 * Active routing through the new pools is the following checkpoint.
 */
export function solvePoolBalances({grid:g,height,climate,ocean,receiver,waterbody,waterbodies,basinStructure:structure,order}) {
  const flow=new Float64Array(g.count),input=new Float64Array(g.count),pools=[],basins=[];
  const depressionPool=new Int32Array(structure.depressions.length).fill(-1);
  let runoff=0,delivered=0;
  for(let i=0;i<g.count;i++)if(!ocean[i]){
    const area=i<g.north?g.rowArea[(i/g.width)|0]:0;
    flow[i]=area*climate.runoffMm[i]*1000/YEAR_SECONDS;runoff+=flow[i];
    if(waterbody[i]>=0)input[i]=flow[i];
  }
  for(const i of order){
    const id=waterbody[i],p=receiver[i];
    if(id>=0&&waterbodies[id].outletCell===i){
      const result=solveBasinPools({basin:structure.basins[id],structure,grid:g,height,climate,inputAtCellM3s:input});
      const offset=pools.length,poolIds=[];
      for(const pool of result.pools){
        pool.id+=offset;
        if(pool.downstreamPoolId>=0&&pool.downstreamPoolId!==null)pool.downstreamPoolId+=offset;
        if(pool.potentialDownstreamPoolId>=0)pool.potentialDownstreamPoolId+=offset;
        for(const d of pool.depressionIds)depressionPool[d]=pool.id;
        pools.push(pool);poolIds.push(pool.id);
      }
      basins[id]={basinId:id,poolIds:Int32Array.from(poolIds),availableM3s:result.availableM3s,
        netEvaporationM3s:result.netEvaporationM3s,outflowM3s:result.outflowM3s,mergePasses:result.mergePasses};
      flow[i]=result.outflowM3s;
    }
    if(p>=0){
      flow[p]+=flow[i];
      if(waterbody[p]>=0&&waterbody[p]!==id)input[p]+=flow[i];
      if(ocean[p]&&!ocean[i])delivered+=flow[i];
    }
  }
  const result={pools,basins,depressionPool,stats:{pools:pools.length,basins:basins.length,
    splitBasins:basins.filter(b=>b.poolIds.length>1).length,mergedPools:pools.filter(p=>p.depressionIds.length>1).length,
    runoffM3s:runoff,deliveredFlowM3s:delivered,netEvaporationM3s:pools.reduce((s,p)=>s+p.netEvaporationM3s,0)}};
  result.validation=validatePoolBalances(result,structure);
  return result;
}

export function validatePoolBalances(result,structure) {
  const {pools,basins,stats}=result,errors=[],incoming=new Float64Array(pools.length),degree=new Uint32Array(pools.length);
  const seen=new Uint8Array(structure.depressions.length);
  let balanceError=0,badPools=0,badSpills=0;
  for(const p of pools){
    if(!Number.isFinite(p.waterLevelM)||p.waterLevelM>p.spillM+1e-7||(p.joinedAtM!==null&&p.waterLevelM<p.joinedAtM-1e-7)||p.netEvaporationM3s<0||p.outflowM3s<0)badPools++;
    for(const id of p.depressionIds){if(seen[id]||result.depressionPool[id]!==p.id||structure.depressions[id].basinId!==p.basinId)badPools++;seen[id]=1;}
    if(p.closed){if(p.outflowM3s!==0||p.downstreamPoolId!==null)badSpills++;}
    else{
      if(Math.abs(p.waterLevelM-p.spillM)>1e-7)badSpills++;
      if(p.downstreamPoolId>=0){
        const to=pools[p.downstreamPoolId];incoming[to.id]+=p.outflowM3s;degree[to.id]++;
        if(to.basinId!==p.basinId||to.waterLevelM>p.waterLevelM+1e-7)badSpills++;
      }
    }
  }
  for(const p of pools)balanceError=Math.max(balanceError,Math.abs(p.sourceM3s+incoming[p.id]-p.netEvaporationM3s-p.outflowM3s));
  for(const b of basins)balanceError=Math.max(balanceError,Math.abs(b.availableM3s-b.netEvaporationM3s-b.outflowM3s));
  for(const value of seen)if(!value)badPools++;
  const queue=pools.filter(p=>!degree[p.id]).map(p=>p.id);
  for(let a=0;a<queue.length;a++){const p=pools[queue[a]],to=p.downstreamPoolId;if(to!==null&&to>=0&&!--degree[to])queue.push(to);}
  const cycles=pools.length-queue.length;
  const globalError=Math.abs(stats.runoffM3s-stats.netEvaporationM3s-stats.deliveredFlowM3s);
  if(badPools||badSpills||cycles)errors.push(`${badPools} invalid pools; ${badSpills} invalid spills; ${cycles} cyclic pools`);
  if(balanceError>1e-7||globalError>Math.max(1e-7,stats.runoffM3s*1e-9))errors.push('Independent pool water budget is not conserved');
  return {ok:!errors.length,errors,badPools,badSpills,cycles,maxBalanceErrorM3s:balanceError,globalErrorM3s:globalError};
}
