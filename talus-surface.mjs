import {neighbors} from './planet.mjs?v=0.9.12';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** A bounded depositional fan below a mapped rockfall source. Heights remain metres. */
export function talusDeposit({along,across,sourceM,groundM,length=700,width=180}){
 if(along<=0||along>=length)return 0;const spread=20+width*along/length,edge=1-smooth(.55,1,Math.abs(across)/spread),toe=1-smooth(.7*length,length,along),start=smooth(0,60,along),fill=Math.max(0,sourceM-along*.62-groundM);
 return Math.min(110,fill)*edge*toe*start;
}
export function createTalusField(model,mesh){
 const R=model.grid.radiusKm*1000,bins=new Map(),near=new Int32Array(model.grid.width),size=512,key=p=>p.map(v=>Math.floor(v/size)).join(':'),sources=[];
 for(let i=0;i<model.grid.count;i++){
  if(model.height[i]<1000||model.ocean[i]||model.waterbody[i]>=0||model.cryosphere?.glacier[i]>.05||model.geology?.lava[i]>.1)continue;
  const d=mesh.directionAt(i),n=neighbors(model.grid,i,near);let best=null,bestSlope=.75;
  for(let k=0;k<n;k++){const j=near[k],q=mesh.directionAt(j),distance=Math.hypot(...q.map((v,k)=>v-d[k]))*R,drop=model.height[i]-model.height[j],slope=drop/Math.max(1,distance);if(drop>140&&slope>bestSlope){bestSlope=slope;best=q;}}
  if(!best)continue;const downhill=unit(best.map((v,k)=>v-d[k]*dot(best,d))),across=unit([d[1]*downhill[2]-d[2]*downhill[1],d[2]*downhill[0]-d[0]*downhill[2],d[0]*downhill[1]-d[1]*downhill[0]]),length=450+Math.min(400,(bestSlope-.75)*400),width=90+length*.18,origin=d.map(v=>v*R),source={origin,downhill,across,sourceM:model.height[i],length,width},id=sources.length;sources.push(source);
  const corners=[origin,...[-1,1].map(sign=>origin.map((v,k)=>v+downhill[k]*length+across[k]*(width+20)*sign))],lo=[0,1,2].map(k=>Math.floor((Math.min(...corners.map(p=>p[k]))-10)/size)),hi=[0,1,2].map(k=>Math.floor((Math.max(...corners.map(p=>p[k]))+10)/size));
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){const at=x+':'+y+':'+z;if(!bins.has(at))bins.set(at,[]);bins.get(at).push(id);}
 }
 return {stats:{sources:sources.length,buckets:bins.size},sample(direction,groundM,{waterM=null,protectedRiver=false,glacier=0,lava=0}={}){
  if(protectedRiver||glacier>.05||lava>.1)return {depositM:0,cover:0};const p=direction.map(v=>v*R);let depositM=0;for(const id of bins.get(key(p))||[]){const s=sources[id],v=p.map((x,k)=>x-s.origin[k]);depositM=Math.max(depositM,talusDeposit({along:dot(v,s.downhill),across:dot(v,s.across),sourceM:s.sourceM,groundM,length:s.length,width:s.width}));}
  // Preserve solved wet beds and water contours; blend dry deposits into the shore.
  if(waterM!==null)depositM*=smooth(0,50,Math.abs(groundM-waterM));
  if(waterM!==null&&groundM<waterM)depositM=0;
  return {depositM,cover:smooth(.3,8,depositM)};
 }};
}
