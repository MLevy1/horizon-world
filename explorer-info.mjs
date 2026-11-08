import {alpineClimate} from './alpine-climate.mjs?v=0.9.14';
import {landHabitat} from './explorer-ecology.mjs?v=0.9.14';
import {lonLat,neighbors,cellAt} from './planet.mjs?v=0.9.14';
import {direction,coordinates,unit,frame,dot} from './explorer-world.mjs?v=0.9.14';
import {ZONES} from './climate.mjs?v=0.9.14';
export function describeLocation(model,surface,lon,lat){
 const q=surface.sample(lon,lat),cells=q.triangle.cells,w=q.triangle.weights,blend=values=>cells.reduce((s,i,k)=>s+values[i]*w[k],0),temperature=blend(model.climate.temperature),precipitation=blend(model.climate.precipitation),aridity=blend(model.climate.aridity),snowMonths=blend(model.cryosphere.snowMonths),glacier=blend(model.cryosphere.glacier),lava=blend(model.geology.lava),i=cellAt(model.grid,lon,lat),groundM=q.fitted.groundM,waterM=q.fitted.waterM,waterKind=q.waterPlane?.kind||(q.river&&q.river.distanceM<q.river.widthM*.5?'river':null);
 const env=model.ecologySample?model.ecologySample(lon,lat):{temperature,aridity,snow:snowMonths/12,glacier,lava,elevationM:groundM,slope:0,shore:0};let biome=landHabitat(env).biome;
 if(waterM!==null)biome=waterKind==='ocean'?'Ocean':waterKind==='river'?'River':waterKind==='pond'?'Pond':'Lake';
 let setting=waterM===null?alpineClimate({elevationM:groundM,temperature,precipitation,snowMonths,glacier,lava})?.variant??null:null;if(waterM===null){const lakeId=cells.map(i=>model.waterbody[i]).find(id=>id>=0&&model.waterbodies?.[id]?.status!=='playa');if(lakeId!==undefined&&model.waterbodies?.[lakeId]&&Math.abs(groundM-model.waterbodies[lakeId].surfaceM)<6)setting='Lakefront';else if(q.river&&Math.abs(q.river.distanceM-q.river.widthM*.5)<10)setting='Riverbank';else if(cells.some(i=>model.ocean[i])&&Math.abs(groundM)<6)setting='Coast';}
 return {lon,lat,biome,setting,climate:ZONES[model.climate.zone[i]],temperature,precipitation,aridity,snowMonths,glacier,lava,groundM,waterM,waterKind,depthM:q.fitted.depthM};
}
/** Find real land beside a retained lake; use the fitted water boundary, not its center. */
export function findLakefront(model,surface){
 const near=new Int32Array(model.grid.width),lakes=model.waterbodies.filter(w=>w.kind==='lake'&&w.status!=='playa').sort((a,b)=>b.areaKm2-a.areaKm2),R=model.grid.radiusKm*1000;
 for(const lake of lakes.slice(0,20)){
  const wetCell=lake.outletCell,[lon,lat]=lonLat(model.grid,wetCell),wet=direction(lon,lat);
  const candidates=[],n=neighbors(model.grid,wetCell,near);for(let k=0;k<n;k++)if(!model.ocean[near[k]]&&model.waterbody[near[k]]<0)candidates.push(direction(...lonLat(model.grid,near[k])));
  if(!candidates.length){const f=frame(wet);for(let k=0;k<16;k++)candidates.push(unit(wet.map((v,j)=>v+(f.east[j]*Math.cos(k*Math.PI/8)+f.north[j]*Math.sin(k*Math.PI/8))*800/R)));}
  for(const dry of candidates){let a=wet,b=dry,at=coordinates(a),bt=coordinates(b);if(surface.sample(at.lon,at.lat).fitted.waterM===null||surface.sample(bt.lon,bt.lat).fitted.waterM!==null)continue;
   for(let j=0;j<15;j++){const mid=unit(a.map((v,k)=>v+b[k])),p=coordinates(mid);if(surface.sample(p.lon,p.lat).fitted.waterM===null)b=mid;else a=mid;}
   const outward=unit(b.map((v,k)=>v-a[k])),land=unit(b.map((v,k)=>v+outward[k]*6/R)),p=coordinates(land),q=surface.sample(p.lon,p.lat);if(q.fitted.waterM!==null)continue;const f=frame(land),toward=wet.map((v,k)=>v-land[k]);return {name:'Lakefront',...p,groundM:q.fitted.groundM,yaw:Math.atan2(dot(toward,f.east),dot(toward,f.north))};
  }
 }
 return null;
}
export function findMountain(model,spawn){let best=-1,score=-Infinity;for(let i=0;i<model.grid.count;i++){if(model.ocean[i]||model.waterbody[i]>=0||model.geology.ids[i]>=0||model.cryosphere.glacier[i])continue;const h=model.height[i];if(h>score){score=h;best=i;}}return best<0?null:{name:'Mountains',...spawn(...lonLat(model.grid,best))};}
export function findGlacier(model,surface){const glaciers=[...model.cryosphere.glaciers].sort((a,b)=>b.areaKm2-a.areaKm2);for(const g of glaciers){const [lon,lat]=lonLat(model.grid,g.peakCell),q=surface.sample(lon,lat);if(q.fitted.waterM===null&&describeLocation(model,surface,lon,lat).glacier>.25)return {name:'Glacier',lon,lat,groundM:q.fitted.groundM};}return null;}

/** Validate each destination against the fitted surface and interpolated climate. */
export function findAlpineVariants(model,surface,spawn){
 const candidates=[];for(let i=0;i<model.grid.count;i++){if(model.height[i]<=1600||model.ocean[i]||model.waterbody[i]>=0||model.geology.ids[i]>=0||model.cryosphere.glacier[i]>.25)continue;const a=alpineClimate({elevationM:model.height[i],temperature:model.climate.temperature[i],precipitation:model.climate.precipitation[i],snowMonths:model.cryosphere.snowMonths[i]});if(a)candidates.push({i,variant:a.variant,height:model.height[i]});}
 candidates.sort((a,b)=>b.height-a.height);const found=new Map();for(const c of candidates){if(found.has(c.variant))continue;const p=spawn(...lonLat(model.grid,c.i));if(!p)continue;const info=describeLocation(model,surface,p.lon,p.lat);if(info.waterM===null&&info.groundM>1600&&info.glacier<=.25&&info.lava<=.3&&info.setting===c.variant)found.set(c.variant,{name:c.variant,...p});if(found.size===2)break;}return [...found.values()];
}
