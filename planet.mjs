import {makeVolcanicGeography,linkVolcanoWater} from './geology.mjs?v=0.7.0';
import {solveCryosphere} from './cryosphere.mjs?v=0.7.0';
import {makeClimate,flowRegime} from './climate.mjs?v=0.7.0';
import {buildBasinInventory} from './basins.mjs?v=0.7.1';
import {solvePoolBalances} from './pools.mjs?v=0.7.2';
import {installPoolRouting} from './lake-routing.mjs?v=0.7.3';
import {buildRiverProfiles} from './river-profiles.mjs?v=0.7.4';

/** Horizon 0.7: one closed, deterministic planet. Distances km, elevations m.
 * No rendering, terrain tiles, scene, camera or vegetation dependencies.
 * Depression filling follows Priority-Flood (Barnes, Lehman & Mulla, 2014).
 * The grid is a staggered triangular mesh, closed by two unique polar nodes.
 */
export const VERSION = '0.8.8';
export const DEFAULT_WORLD = Object.freeze({width:1536, height:768, radiusKm:64});
const TAU = Math.PI * 2;
const YEAR_SECONDS = 365.25 * 86400;

export function createGrid(config=DEFAULT_WORLD) {
  const {width:w, height:h, radiusKm:r} = {...DEFAULT_WORLD, ...config};
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 16 || h < 8 || w > 4096 || h > 2048 || !(r > 0)) throw Error('Invalid planet grid');
  const count = w*h+2, north = w*h, south = north+1;
  const rowArea = new Float64Array(h), rowCos = new Float64Array(h);
  const horizontal = new Float64Array(h), diagonal = new Float64Array(h-1);
  const dlat = Math.PI/h, dlon = TAU/w;
  for (let y=0;y<h;y++) {
    const lat = Math.PI/2-(y+.5)*dlat;
    rowCos[y] = Math.cos(lat);
    rowArea[y] = r*r*dlon*(Math.sin(Math.PI/2-y*dlat)-Math.sin(Math.PI/2-(y+1)*dlat));
    horizontal[y] = 2*r*Math.asin(rowCos[y]*Math.sin(dlon/2));
    if (y<h-1) diagonal[y] = 2*r*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(lat)*Math.cos(lat-dlat)*Math.sin(dlon/4)**2));
  }
  return {width:w,height:h,radiusKm:r,count,north,south,rowArea,rowCos,horizontal,diagonal};
}

/** Caller reuses output; poles have width neighbors, every other cell <=6. */
export function neighbors(grid, i, output) {
  const {width:w,height:h,north,south} = grid;
  if (i>=north) {
    const start=i===north?0:(h-1)*w;
    for(let x=0;x<w;x++) output[x]=start+x;
    return w;
  }
  const y=(i/w)|0,x=i%w, left=(x+w-1)%w,right=(x+1)%w;
  output[0]=y*w+left; output[1]=y*w+right;
  const a=(y&1)?x:left,b=(y&1)?right:x;
  let n=2;
  if(y===0) output[n++]=north;
  else {output[n++]=(y-1)*w+a; output[n++]=(y-1)*w+b;}
  if(y===h-1) output[n++]=south;
  else {output[n++]=(y+1)*w+a; output[n++]=(y+1)*w+b;}
  return n;
}

export function lonLat(grid,i) {
  if(i===grid.north)return [0,90];
  if(i===grid.south)return [0,-90];
  const y=(i/grid.width)|0;
  return [((i%grid.width+.5+(y&1)*.5)/grid.width*360)%360-180,90-(y+.5)/grid.height*180];
}
export function cellAt(grid,lon,lat) {
  if(lat>=90)return grid.north;
  if(lat<=-90)return grid.south;
  const y=Math.min(grid.height-1,Math.max(0,Math.floor((90-lat)/180*grid.height)));
  const x=Math.floor(((lon+180)%360+360)%360/360*grid.width-(y&1)*.5);
  return y*grid.width+(x+grid.width)%grid.width;
}
export function distanceKm(grid,a,b) {
  const [la,pa]=lonLat(grid,a),[lb,pb]=lonLat(grid,b),d=Math.PI/180;
  const q=Math.sin((pb-pa)*d/2)**2+Math.cos(pa*d)*Math.cos(pb*d)*Math.sin((lb-la)*d/2)**2;
  return 2*grid.radiusKm*Math.asin(Math.min(1,Math.sqrt(q)));
}
function neighborDistance(g,a,b) {
  if(a>=g.north||b>=g.north)return g.radiusKm*Math.PI/g.height/2;
  const ay=(a/g.width)|0,by=(b/g.width)|0;
  return ay===by?g.horizontal[ay]:g.diagonal[Math.min(ay,by)];
}
export function hashSeed(seed) {
  let h=2166136261;
  for(const ch of String(seed))h=Math.imul(h^ch.charCodeAt(0),16777619);
  return h>>>0;
}
function makeNoise(seed) {
  const hash=(x,y,z)=>{
    let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^seed;
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/2147483647.5-1;
  };
  const fade=t=>t*t*t*(t*(t*6-15)+10);
  return (x,y,z)=>{
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=fade(x-ix),v=fade(y-iy),t=fade(z-iz);
    const a=hash(ix,iy,iz),b=hash(ix+1,iy,iz),c=hash(ix,iy+1,iz),d=hash(ix+1,iy+1,iz);
    const e=hash(ix,iy,iz+1),f=hash(ix+1,iy,iz+1),g=hash(ix,iy+1,iz+1),h=hash(ix+1,iy+1,iz+1);
    return (a+(b-a)*u+(c-a+(d-c-b+a)*u)*v)*(1-t)+(e+(f-e)*u+(g-e+(h-g-f+e)*u)*v)*t;
  };
}
class Heap {
  constructor(level,count){this.ids=new Int32Array(count);this.level=level;this.length=0;}
  less(a,b){return this.level[a]<this.level[b]||(this.level[a]===this.level[b]&&a<b);}
  push(id){
    let p=this.length++;
    while(p){const q=(p-1)>>1;if(!this.less(id,this.ids[q]))break;this.ids[p]=this.ids[q];p=q;}
    this.ids[p]=id;
  }
  pop(){
    const out=this.ids[0],tail=this.ids[--this.length];let p=0;
    while(p*2+1<this.length){let q=p*2+1;if(q+1<this.length&&this.less(this.ids[q+1],this.ids[q]))q++;
      if(!this.less(this.ids[q],tail))break;this.ids[p]=this.ids[q];p=q;}
    if(this.length)this.ids[p]=tail;
    return out;
  }
}

export function solvePlanet({seed='HORIZON-01',world=DEFAULT_WORLD,progress=()=>{},heightAt=null,volcanism=true}={}) {
  seed=String(seed).trim().slice(0,100)||'HORIZON-01';
  const grid=createGrid(world),{width:w,height:h,count:N,north}=grid;
  const noise=makeNoise(hashSeed(seed)),near=new Int32Array(w);
  const height=new Float32Array(N),level=new Float64Array(N),rainfall=new Float32Array(N);
  const ocean=new Uint8Array(N),receiver=new Int32Array(N),waterbody=new Int32Array(N);
  receiver.fill(-1);waterbody.fill(-1);
  progress('Defining continents and drainage divides',.03);
  // Only a drainage scaffold: these broad elevations define watersheds, not terrain meshes.
  const sample=(px,py,pz)=>{
    const nx=px+noise(px*2.1+13,py*2.1+7,pz*2.1-9)*.24;
    const ny=py+noise(px*2.1-4,py*2.1+23,pz*2.1+5)*.24;
    const nz=pz+noise(px*2.1+31,py*2.1-11,pz*2.1+19)*.24;
    const n=(f,s=0)=>noise(nx*f+17+s,ny*f-31+s*.3,nz*f+11-s*.7);
    const continent=n(1.85)*.64+n(3.7,7)*.26+n(7.4,19)*.10;
    const ridge=(1-Math.abs(n(13,43)))**3;
    return continent*3600+ridge*Math.max(0,continent+.20)*1600+n(30,5)*92+n(60,21)*34+n(120,37)*11+n(240,51)*3.2;
  };
  for(let y=0;y<h;y++){
    const lat=Math.PI/2-(y+.5)*Math.PI/h,py=Math.sin(lat),cos=Math.cos(lat);
    for(let x=0;x<w;x++){
      const i=y*w+x,lon=(x+.5+(y&1)*.5)/w*TAU-Math.PI,px=cos*Math.cos(lon),pz=cos*Math.sin(lon);
      height[i]=heightAt?heightAt(lon*180/Math.PI,lat*180/Math.PI):sample(px,py,pz);

    }
    if(y%128===0)progress('Defining continents and drainage divides',.03+.20*y/h);
  }
  height[grid.north]=heightAt?heightAt(0,90):sample(0,1,0);
  height[grid.south]=heightAt?heightAt(0,-90):sample(0,-1,0);
  // Choose sea level by area, not pixel count (latitude rows have different areas).
  let seaLevel=0;
  if(!heightAt){
    let lo=-6000,hi=6000;
    const target=4*Math.PI*grid.radiusKm**2*.62;
    for(let step=0;step<20;step++){
      const mid=(lo+hi)/2;let area=0;
      for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++)if(height[y*w+x]<mid)count++;area+=count*grid.rowArea[y];}
      if(area<target)lo=mid;else hi=mid;
    }
    seaLevel=(lo+hi)/2;
    for(let i=0;i<N;i++)height[i]-=seaLevel;
  }
  progress('Building volcanic landforms and cooled lava deposits',.24);
  const geology=makeVolcanicGeography({grid,height,seed,neighbors,cellAt,lonLat,enabled:volcanism&&!heightAt});
  progress('Connecting the planetary ocean',.25);
  // Only the largest CONNECTED sea is an ocean. Enclosed low areas become lakes.
  const seen=new Uint8Array(N),queue=new Int32Array(N);
  let oceanSeed=-1,largestArea=-1;
  for(let start=0;start<N;start++){
    if(seen[start]||height[start]>0)continue;
    let a=0,b=1,componentArea=0;queue[0]=start;seen[start]=1;
    while(a<b){const i=queue[a++];if(i<north)componentArea+=grid.rowArea[(i/w)|0];
      const n=neighbors(grid,i,near);
      for(let k=0;k<n;k++){const j=near[k];if(!seen[j]&&height[j]<=0){seen[j]=1;queue[b++]=j;}}
    }
    if(componentArea>largestArea){largestArea=componentArea;oceanSeed=start;}
  }
  if(oceanSeed<0)throw Error('This planet has no ocean below sea level');
  let a=0,b=1;queue[0]=oceanSeed;ocean[oceanSeed]=1;
  while(a<b){const i=queue[a++],n=neighbors(grid,i,near);
    for(let k=0;k<n;k++){const j=near[k];if(!ocean[j]&&height[j]<=0){ocean[j]=1;queue[b++]=j;}}
  }
  const oceanCells=b;
  progress('Resolving every basin to the ocean',.31);
  seen.fill(0);level.set(height);
  const rank=new Int32Array(N),heap=new Heap(level,N);
  let processed=0;
  for(let i=0;i<N;i++)if(ocean[i]){seen[i]=1;level[i]=0;rank[i]=processed++;}
  // Seed the true shoreline. No square edges or unresolved boundary outlets exist.
  for(let i=0;i<N;i++)if(ocean[i]){
    const n=neighbors(grid,i,near);
    for(let k=0;k<n;k++){
      const j=near[k];if(seen[j])continue;
      seen[j]=1;receiver[j]=i;level[j]=Math.max(0,height[j]);heap.push(j);
    }
  }
  while(heap.length){
    const i=heap.pop();rank[i]=processed++;
    const n=neighbors(grid,i,near);
    for(let k=0;k<n;k++){
      const j=near[k];if(seen[j])continue;
      seen[j]=1;receiver[j]=i;level[j]=Math.max(height[j],level[i]);heap.push(j);
    }
    if(processed%100000===0)progress('Resolving every basin to the ocean',.31+.20*processed/N);
  }
  if(processed!==N)throw Error('Planet contains unresolved cells');
  // Prefer the steepest actual descent outside flats. Rank breaks flat ties without epsilon slopes.
  for(let i=0;i<N;i++)if(!ocean[i]){
    const n=neighbors(grid,i,near);let best=receiver[i],slope=0;
    for(let k=0;k<n;k++){
      const j=near[k];if(rank[j]>=rank[i])continue;
      const s=(level[i]-level[j])/neighborDistance(grid,i,j);
      if(s>slope){slope=s;best=j;}
    }
    receiver[i]=best;
  }
  progress('Retaining ponds, lakes and their spill outlets',.54);
  const waterbodies=[];
  for(let start=0;start<N;start++){
    if(ocean[start]||waterbody[start]>=0||level[start]-height[start]<=.15)continue;
    const id=waterbodies.length,surface=level[start];
    let a=0,b=1,area=0,volume=0,deepest=0,outletCell=start,centerX=0,centerY=0,centerZ=0;
    queue[0]=start;waterbody[start]=id;
    while(a<b){
      const i=queue[a++],ca=i<north?grid.rowArea[(i/w)|0]:0,depth=surface-height[i];
      area+=ca;volume+=ca*1e6*depth;deepest=Math.max(deepest,depth);
      const [lon,lat]=lonLat(grid,i),p=lat*Math.PI/180,l=lon*Math.PI/180;
      centerX+=Math.cos(p)*Math.cos(l)*ca;centerY+=Math.sin(p)*ca;centerZ+=Math.cos(p)*Math.sin(l)*ca;
      if(rank[i]<rank[outletCell])outletCell=i;
      const n=neighbors(grid,i,near);
      for(let k=0;k<n;k++){
        const j=near[k];
        if(!ocean[j]&&waterbody[j]<0&&level[j]===surface&&level[j]-height[j]>.15){waterbody[j]=id;queue[b++]=j;}
      }
    }
    const outletReceiver=receiver[outletCell];
    // One outlet for each connected surface. Route its interior toward that spill.
    // The earliest flood rank guarantees its downstream path cannot return to this lake.
    for(let k=0;k<b;k++)seen[queue[k]]=0;
    let aa=0,bb=1;queue[0]=outletCell;seen[outletCell]=1;
    while(aa<bb){const i=queue[aa++],n=neighbors(grid,i,near);
      for(let k=0;k<n;k++){const j=near[k];if(waterbody[j]===id&&!seen[j]){seen[j]=1;receiver[j]=i;queue[bb++]=j;}}
    }
    if(bb!==b)throw Error('Disconnected waterbody');
    const lon=Math.atan2(centerZ,centerX)*180/Math.PI,lat=Math.atan2(centerY,Math.hypot(centerX,centerZ))*180/Math.PI;
    waterbodies.push({id,kind:area<.35?'pond':'lake',areaKm2:area,volumeM3:volume,maxDepthM:deepest,surfaceM:surface,
      cells:b,outletCell,outletReceiver,lon,lat,inlets:[],inflowM3s:0,localRunoffM3s:0,outflowM3s:0});
  }
  progress('Accumulating flow across the entire planet',.63);
  // Recompute a true topological order after lake interiors were rerouted.
  const degree=new Uint16Array(N),order=new Int32Array(N);
  for(let i=0;i<N;i++)if(receiver[i]>=0)degree[receiver[i]]++;
  a=0;b=0;
  for(let i=0;i<N;i++)if(!degree[i])order[b++]=i;
  while(a<b){const i=order[a++],p=receiver[i];if(p>=0&&!--degree[p])order[b++]=p;}
  if(b!==N)throw Error('Drainage cycle detected');
  progress('Solving global temperature, moisture and evaporation',.64);
  const climate=makeClimate({grid,height,ocean,noise});rainfall.set(climate.precipitation);
  progress('Accumulating snow and routing glacier meltwater',.69);
  const cryosphere=solveCryosphere({grid,height,ocean,receiver,order,climate,neighbors});
  const basins=waterbodies.slice(),basinId=waterbody.slice(),potentialReceiver=receiver.slice(),potentialLevel=level.slice();
  const potentialOutlet=new Int32Array(N),lakeCells=basins.map(()=>[]);
  for(let i=0;i<N;i++)if(basinId[i]>=0)lakeCells[basinId[i]].push(i);
  for(let k=N-1;k>=0;k--){const i=order[k];potentialOutlet[i]=receiver[i]<0?i:potentialOutlet[receiver[i]];}
  progress('Inventorying depressions and internal spill connections',.72);
  const basinStructure=buildBasinInventory({grid,height,waterbody,waterbodies,neighbors,distanceKm:neighborDistance,cellsByBasin:lakeCells});
  progress('Balancing independent pools across the entire planet',.75);
  const poolBalances=solvePoolBalances({grid,height,climate,ocean,receiver,waterbody,waterbodies,basinStructure,order});
  progress('Connecting actual pools and exposed basin margins',.79);
  const {cellPool,wetness,potentialSpills}=installPoolRouting({grid,height,receiver,level,waterbody,waterbodies,basins,structure:basinStructure,poolBalances,neighbors,lonLat});
  degree.fill(0);a=0;b=0;
  for(let i=0;i<N;i++)if(receiver[i]>=0)degree[receiver[i]]++;
  for(let i=0;i<N;i++)if(!degree[i])order[b++]=i;
  while(a<b){const i=order[a++],p=receiver[i];if(p>=0&&!--degree[p])order[b++]=p;}
  if(b!==N)throw Error('Active pool drainage contains a cycle');
  const catchment=new Float64Array(N),discharge=new Float64Array(N),outlet=new Int32Array(N),longest=new Float32Array(N);
  const activeTerminal=outlet,trunk=new Int32Array(N);trunk.fill(-1);
  let landArea=0,totalRunoff=0,totalPrecipitation=0,landEvaporation=0,extraLakeEvaporation=0;
  for(let i=0;i<N;i++)if(!ocean[i]){
    const area=i<north?grid.rowArea[(i/w)|0]:0;
    catchment[i]=area;discharge[i]=area*climate.runoffMm[i]*1000/YEAR_SECONDS;
    landArea+=area;totalRunoff+=discharge[i];
    totalPrecipitation+=area*rainfall[i]*1000/YEAR_SECONDS;
    landEvaporation+=area*(climate.liquidInputMm[i]-climate.runoffMm[i])*1000/YEAR_SECONDS;
    if(waterbody[i]>=0)waterbodies[waterbody[i]].localRunoffM3s+=discharge[i];
  }
  for(let k=0;k<N;k++){
    const i=order[k],p=receiver[i],id=waterbody[i];
    if(id>=0&&waterbodies[id].outletCell===i){
      const wb=waterbodies[id];wb.inputBeforeEvaporationM3s=discharge[i];
      if(Math.abs(discharge[i]-wb.availableM3s)>1e-7)throw Error('Installed pool inputs disagree with solved balances');
      discharge[i]=wb.outflowM3s;extraLakeEvaporation+=wb.netEvaporationM3s;
    }
    if(p<0)continue;
    catchment[p]+=catchment[i];discharge[p]+=discharge[i];
    const length=longest[i]+neighborDistance(grid,i,p);
    if(length>longest[p]){longest[p]=length;trunk[p]=i;}
  }
  for(let k=N-1;k>=0;k--){const i=order[k];outlet[i]=receiver[i]<0?i:outlet[receiver[i]];}
  for(let i=0;i<N;i++){
    const id=waterbody[i],p=receiver[i];
    if(p>=0&&waterbody[p]>=0&&id!==waterbody[p]){
      const wb=waterbodies[waterbody[p]];wb.inlets.push(i);wb.inflowM3s+=discharge[i];
    }
  }
  progress('Connecting headwaters, tributaries and river mouths',.86);
  const channel=new Uint8Array(N),classify=i=>catchment[i]>=140?3:catchment[i]>=12?2:1;
  for(let i=0;i<N;i++)if(!ocean[i]&&waterbody[i]<0&&catchment[i]>=.50)channel[i]=classify(i);
  for(const wb of waterbodies)if(!wb.closed){
    let i=wb.outletReceiver;
    while(i>=0&&!ocean[i]&&waterbody[i]<0&&!channel[i]){channel[i]=classify(i);i=receiver[i];}
  }
  const model={version:VERSION,seed,grid,height,level,rainfall,ocean,receiver,waterbody,waterbodies,catchment,discharge,outlet,channel,longest,trunk,climate,wetness,activeTerminal,cryosphere,geology,
    basinId,basins,potentialReceiver,potentialLevel,potentialOutlet,basinStructure,poolBalances,cellPool,potentialSpills};
  linkVolcanoWater(model);
  const network=buildNetwork(model);
  Object.assign(model,network);
  progress('Defining shared river surfaces, depths and widths',.90);
  model.riverProfiles=buildRiverProfiles(model,order,neighborDistance);
  const mouths=model.nodes.filter(n=>n.kind==='mouth');
  let deliveredArea=0,deliveredFlow=0,seamCrossings=0,poleConnections=0;
  const closedArea=waterbodies.filter(w=>w.closed).reduce((sum,w)=>sum+catchment[w.outletCell],0);
  for(let i=0;i<N;i++){
    const p=receiver[i];
    if(p>=0){
      if(ocean[p]&&!ocean[i]){deliveredArea+=catchment[i];deliveredFlow+=discharge[i];}
      if(i<north&&p<north&&Math.abs(i%w-p%w)>w/2)seamCrossings++;
      if(i>=north||p>=north)poleConnections++;
    }
  }
  model.stats={cells:N,landCells:N-oceanCells,oceanCells,worldAreaKm2:4*Math.PI*grid.radiusKm**2,landAreaKm2:landArea,
    oceanAreaKm2:4*Math.PI*grid.radiusKm**2-landArea,circumferenceKm:TAU*grid.radiusKm,equatorSpacingM:TAU*grid.radiusKm/w*1000,
    headwaters:model.nodes.filter(n=>n.kind==='headwater').length,streams:model.reaches.filter(e=>e.kind==='stream').length,
    rivers:model.reaches.filter(e=>e.kind==='river'||e.kind==='major').length,ponds:waterbodies.filter(x=>x.kind==='pond'&&x.status!=='playa').length,
    lakes:waterbodies.filter(x=>x.kind==='lake').length,mouths:mouths.length,edges:model.reaches.length,nodes:model.nodes.length,
    totalRunoffM3s:totalRunoff,deliveredFlowM3s:deliveredFlow,deliveredAreaKm2:deliveredArea,closedAreaKm2:closedArea,splitBasins:poolBalances.stats.splitBasins,seamCrossings,poleConnections,
    precipitationM3s:totalPrecipitation,landEvaporationM3s:landEvaporation,
    frozenBudgetM3s:cryosphere.stats.sublimationM3s+cryosphere.stats.iceStorageChangeM3s+cryosphere.stats.seasonalStorageChangeM3s+cryosphere.stats.calvingM3s,lakeExtraEvaporationM3s:extraLakeEvaporation,
    desertAreaKm2:climate.desertAreaKm2,coldAreaKm2:climate.coldAreaKm2,
    closedLakes:waterbodies.filter(x=>x.closed&&x.status!=='playa').length,playas:waterbodies.filter(x=>x.status==='playa').length,
    seasonalReaches:model.reaches.filter(x=>x.regime==='seasonal'||x.regime==='ephemeral').length};
  progress('Checking global connectivity and water balance',.92);
  model.validation=validatePlanet(model);
  if(!model.validation.ok)throw Error('Global hydrology check failed: '+model.validation.errors.join('; '));
  progress('Complete planet ready',1);
  return model;
}

function buildNetwork(m) {
  const {grid:g,channel,receiver,waterbody,waterbodies,catchment,discharge,ocean}=m,N=g.count;
  const upstream=new Uint16Array(N),nodeAt=new Int32Array(N),nodes=[],reaches=[];nodeAt.fill(-1);
  const addNode=(cell,kind,lake=-1)=>{
    const id=nodes.length,[lon,lat]=lonLat(g,cell);
    nodes.push({id,cell,kind,lon,lat,waterbody:lake,areaKm2:catchment[cell],dischargeM3s:discharge[cell],incoming:[],outgoing:-1});
    nodeAt[cell]=id;return id;
  };
  const lakeNodes=waterbodies.map(wb=>addNode(wb.outletCell,wb.kind,wb.id));
  for(let i=0;i<N;i++)if(channel[i]&&channel[receiver[i]])upstream[receiver[i]]++;
  for(const wb of waterbodies)if(!wb.closed&&channel[wb.outletReceiver])upstream[wb.outletReceiver]++;
  for(let i=0;i<N;i++)if(channel[i]&&upstream[i]!==1)addNode(i,upstream[i]===0?'headwater':'confluence');
  const mouth=i=>nodeAt[i]>=0?nodeAt[i]:addNode(i,'mouth');
  function reach(from,start) {
    const path=[start];let i=receiver[start],to=-1,length=0,maxArea=catchment[start],steps=0;
    while(i>=0){
      if(++steps>N)throw Error('Invalid river reach');
      length+=neighborDistance(g,path[path.length-1],i);path.push(i);maxArea=Math.max(maxArea,catchment[i]);
      if(waterbody[i]>=0){to=lakeNodes[waterbody[i]];break;}
      if(ocean[i]){to=mouth(i);break;}
      if(nodeAt[i]>=0){to=nodeAt[i];break;}
      if(!channel[i])throw Error('Unconnected channel');
      i=receiver[i];
    }
    if(to<0||to===from)throw Error('River has no valid destination');
    // Classify at the last inland channel, not the merged catchment of its receiving lake.
    const before=path[path.length-2],kind=channel[before]===3?'major':channel[before]===2?'river':'stream';
    const id=reaches.length;
    const sourceLake=nodes[from].waterbody;
    reaches.push({id,from,to,kind,lengthKm:length,areaKm2:catchment[before],dischargeM3s:discharge[before],
      regime:flowRegime(discharge[before],catchment[before]),dormantSpill:sourceLake>=0&&waterbodies[sourceLake].closed,path:Int32Array.from(path)});
    nodes[from].outgoing=id;nodes[to].incoming.push(id);
  }
  const startNodes=nodes.slice();
  for(const n of startNodes)if(n.waterbody<0||!waterbodies[n.waterbody].closed)reach(n.id,n.cell);
  // Reaches are the navigable global graph; no renderer invents additional links.
  return {nodes,reaches};
}

export function validatePlanet(m) {
  const {grid:g,receiver:r,ocean,level,waterbody,waterbodies,catchment,outlet,discharge}=m,N=g.count;
  const errors=[],near=new Int32Array(g.width),degree=new Uint16Array(N),queue=new Int32Array(N);
  if(!m.basinStructure.validation.ok)errors.push(...m.basinStructure.validation.errors);
  if(!m.poolBalances.validation.ok)errors.push(...m.poolBalances.validation.errors);
  if(!m.riverProfiles.validation.ok)errors.push(...m.riverProfiles.validation.errors);
  let uphill=0,invalid=0,unresolved=0,badNeighbors=0,invalidTerminal=0,exitCount=new Uint32Array(waterbodies.length);
  for(let i=0;i<N;i++){
    const p=r[i];
    if(p>=N||p===i||p< -1){invalid++;continue;}
    if(p<0){if(!ocean[i]&&!(waterbody[i]>=0&&waterbodies[waterbody[i]].closed&&waterbodies[waterbody[i]].outletCell===i))unresolved++;}
    else{
      degree[p]++;
      if(level[p]>level[i]+1e-4)uphill++;
      const n=neighbors(g,i,near);let adjacent=false;for(let k=0;k<n;k++)if(near[k]===p)adjacent=true;
      if(!adjacent)badNeighbors++;
      if(waterbody[i]>=0&&waterbody[i]!==waterbody[p])exitCount[waterbody[i]]++;
      const evaporatingOutlet=waterbody[p]>=0&&waterbodies[waterbody[p]].outletCell===p;
      if(catchment[p]+1e-8<catchment[i]||(!evaporatingOutlet&&discharge[p]+1e-8<discharge[i]))invalid++;
    }
    if(outlet[i]<0||outlet[i]>=N||r[outlet[i]]!==-1)invalidTerminal++;
    const terminal=m.activeTerminal[i],terminalBody=waterbody[terminal];
    if(!ocean[terminal]&&!(terminalBody>=0&&waterbodies[terminalBody].closed&&waterbodies[terminalBody].outletCell===terminal))invalidTerminal++;
  }
  let a=0,b=0;for(let i=0;i<N;i++)if(!degree[i])queue[b++]=i;
  while(a<b){const i=queue[a++],p=r[i];if(p>=0&&!--degree[p])queue[b++]=p;}
  let lakeErrors=0,balanceErrors=0;
  for(const wb of waterbodies){
    if(exitCount[wb.id]!==Number(!wb.closed)||waterbody[wb.outletCell]!==wb.id||waterbody[wb.outletReceiver]===wb.id)lakeErrors++;
    if(Math.abs(wb.outflowM3s+wb.netEvaporationM3s-wb.inflowM3s-wb.localRunoffM3s)>Math.max(1e-7,wb.outflowM3s*1e-9))balanceErrors++;
  }
  const areaError=Math.abs(m.stats.deliveredAreaKm2+m.stats.closedAreaKm2-m.stats.landAreaKm2),flowError=Math.abs(m.stats.deliveredFlowM3s+m.stats.lakeExtraEvaporationM3s-m.stats.totalRunoffM3s);
  if(uphill)errors.push(`${uphill} uphill receivers`);
  if(invalid)errors.push(`${invalid} invalid flow links`);
  if(unresolved||invalidTerminal)errors.push(`${unresolved+invalidTerminal} unresolved terminals`);
  if(badNeighbors)errors.push(`${badNeighbors} nonlocal links`);
  if(b!==N)errors.push(`${N-b} cyclic cells`);
  if(lakeErrors||balanceErrors)errors.push(`${lakeErrors+balanceErrors} invalid waterbodies`);
  if(areaError>m.stats.landAreaKm2*1e-9)errors.push('Catchment area is not conserved');
  if(flowError>Math.max(1e-7,m.stats.totalRunoffM3s*1e-9))errors.push('Runoff is not conserved');
  const precipitationError=Math.abs(m.stats.precipitationM3s-m.stats.landEvaporationM3s-m.stats.lakeExtraEvaporationM3s-m.stats.deliveredFlowM3s-m.stats.frozenBudgetM3s);
  if(m.cryosphere.stats.iceBalanceErrorM3s>1e-7)errors.push('Glacier budget is not conserved');
  if(precipitationError>Math.max(1e-7,m.stats.precipitationM3s*1e-9))errors.push('Precipitation budget is not conserved');
  for(const n of m.nodes)if(n.kind!=='mouth'&&n.outgoing<0&&!(n.waterbody>=0&&waterbodies[n.waterbody].closed))errors.push('Disconnected network node');
  return {ok:errors.length===0,errors,resolvedCells:N-unresolved,unresolvedCells:unresolved,uphillLinks:uphill,cycles:N-b,
    lakeErrors,balanceErrors,areaErrorKm2:areaError,flowErrorM3s:flowError,precipitationErrorM3s:precipitationError,checkedWaterbodies:waterbodies.length};
}

export function traceDownstream(m,start) {
  if(!Number.isInteger(start)||start<0||start>=m.grid.count)return [];
  const path=[];let i=start;
  while(i>=0&&path.length<=m.grid.count){path.push(i);i=m.receiver[i];}
  if(path.length>m.grid.count)throw Error('Drainage cycle');
  return path;
}
export function tracePotential(m,start){
  return traceDownstream({...m,receiver:m.potentialReceiver},start);
}
export function traceActive(m,start){
  const path=[];let i=start;
  while(i>=0&&path.length<=m.grid.count){
    path.push(i);i=m.receiver[i];
  }
  if(path.length>m.grid.count)throw Error('Drainage cycle');
  return path;
}
export function catchmentMask(m,start) {
  const mask=new Uint8Array(m.grid.count),queue=new Int32Array(m.grid.count),near=new Int32Array(m.grid.width);
  let a=0,b=1;queue[0]=start;mask[start]=1;
  while(a<b){const i=queue[a++],n=neighbors(m.grid,i,near);
    for(let k=0;k<n;k++){const j=near[k];if(!mask[j]&&m.receiver[j]===i){mask[j]=1;queue[b++]=j;}}
  }
  return mask;
}

export function transferBuffers(model) {
  const buffers=new Set();
  function visit(value){
    if(ArrayBuffer.isView(value)){buffers.add(value.buffer);return;}
    if(value&&typeof value==='object')for(const v of Object.values(value))visit(v);
  }
  visit(model);return [...buffers];
}
