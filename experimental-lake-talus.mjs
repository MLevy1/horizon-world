import {neighbors} from './planet.mjs?v=0.9.14';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
export const smoothMask=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function evaluateLakeFan(s,d,groundM,R){
 const delta=d.map((v,k)=>v*R-s.origin[k]),along=dot(delta,s.forward),cross=Math.abs(dot(delta,s.right));if(along<=0||along>=s.length)return 0;
 const width=25+s.width*along/s.length,edge=1-smoothMask(.5,1,cross/width),toe=1-smoothMask(s.length*.65,s.length,along),start=smoothMask(0,90,along),dry=smoothMask(0,60,groundM-s.waterM),fill=Math.max(0,s.sourceM-along*.62-groundM);
 return Math.min(12,fill)*edge*toe*start*dry;
}
/** Lake-specific, opt-in prototype. Conservative bounding boxes are validated against all sources. */
export function createExperimentalLakeTalus(model,mesh){
 const R=model.grid.radiusKm*1000,sources=[],bins=new Map(),near=new Int32Array(model.grid.width),key=p=>p.map(v=>Math.floor(v/512)).join(':');
 for(let i=0;i<model.grid.count;i++){
  if(model.height[i]<1000||model.ocean[i]||model.waterbody[i]>=0||model.geology?.lava[i]>.1||model.cryosphere?.glacier[i]>.05)continue;
  const d=mesh.directionAt(i),n=neighbors(model.grid,i,near);let chosen=null,slope=.65;
  for(let k=0;k<n;k++){const j=near[k],id=model.waterbody[j],lake=model.waterbodies?.[id];if(id<0||!lake||lake.status==='playa')continue;const target=mesh.directionAt(j),distance=Math.hypot(...target.map((v,k)=>v-d[k]))*R,waterM=lake.waterLevelM,drop=model.height[i]-waterM;if(drop>100&&drop/distance>slope){slope=drop/distance;chosen={target,waterM,distance};}}
  if(!chosen)continue;const forward=unit(chosen.target.map((v,k)=>v-d[k]*dot(chosen.target,d))),right=unit([d[1]*forward[2]-d[2]*forward[1],d[2]*forward[0]-d[0]*forward[2],d[0]*forward[1]-d[1]*forward[0]]),length=Math.min(900,Math.max(300,chosen.distance*1.6)),width=90+length*.15,origin=d.map(v=>v*R),s={origin,forward,right,length,width,waterM:chosen.waterM,sourceM:model.height[i]},id=sources.length;sources.push(s);
  const corners=[...[-1,1].map(sign=>origin.map((v,k)=>v+right[k]*25*sign)),...[-1,1].map(sign=>origin.map((v,k)=>v+forward[k]*length+right[k]*(width+25)*sign))],pad=30+length*length/R,lo=[0,1,2].map(k=>Math.floor((Math.min(...corners.map(p=>p[k]))-pad)/512)),hi=[0,1,2].map(k=>Math.floor((Math.max(...corners.map(p=>p[k]))+pad)/512));
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const key=x+':'+y+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}
 }
 function sample(d,h,{glacier=0,lava=0,riverMarginM=Infinity,waterPlanes=[]}={},all=false){let fill=0;for(const id of all?sources.keys():bins.get(key(d.map(v=>v*R)))||[]){const s=sources[id],other=waterPlanes.reduce((factor,p)=>factor*(Math.abs(p.waterM-s.waterM)>1e-6?1-smoothMask(0,.05,p.support):1),1);fill=Math.max(fill,evaluateLakeFan(s,d,h,R)*other);}return fill*(1-smoothMask(.01,.2,glacier))*(1-smoothMask(.02,.3,lava))*smoothMask(0,120,riverMarginM);}
 return {sample:(d,h,o)=>sample(d,h,o),sampleAll:(d,h,o)=>sample(d,h,o,true),stats:{sources:sources.length,buckets:bins.size,maxFillM:12}};
}
