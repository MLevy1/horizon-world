/**
 * Horizon 0.3.1 — canonical geographic terrain adapter.
 *
 * Consumes ONE completed whole-domain hydrology graph, then shapes the final
 * land height. All terrain, vegetation and collision callers use sample().ground.
 *
 * It does NOT invent river or lake water polygons. Those require resolved basin
 * levels and channel contours that this 256 m routing graph cannot yet supply.
 */
export function createHydrologicalTerrain(model,{heightAt,channelAreaKm2=2.0}={}){
 if(!model||typeof heightAt!=='function')throw new TypeError('Hydrology graph and base height required');
 const {domain,parent,accumulated,raw,filled}=model,n=domain.n,S=n*n;
 const bucketSize=512;
 const binCount=Math.ceil(domain.size/bucketSize);
 const buckets=new Map();
 const segmentCache=[];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
 const center=i=>({
  x:domain.minX+((i%n)+.5)*domain.cell,
  z:domain.minZ+(Math.floor(i/n)+.5)*domain.cell
 });
 const idx=(bx,bz)=>bz*binCount+bx;
 let active=0;
 for(let i=0;i<S;i++){
  const p=parent[i],area=accumulated[i];
  if(p<0||raw[i]<=0||area<channelAreaKm2)continue;
  const a=center(i),b=center(p);
  const width=clamp(2.8+Math.sqrt(area)*2.8,4,40);
  const influence=width*2.6+9;
  const seg={i,p,ax:a.x,az:a.z,bx:b.x,bz:b.z,
   areaKm2:area,width,bank:influence,
   waterUp:filled[i],waterDown:filled[p]};
  const k=segmentCache.length;segmentCache.push(seg);active++;
  const minX=Math.floor((Math.min(a.x,b.x)-influence-domain.minX)/bucketSize);
  const maxX=Math.floor((Math.max(a.x,b.x)+influence-domain.minX)/bucketSize);
  const minZ=Math.floor((Math.min(a.z,b.z)-influence-domain.minZ)/bucketSize);
  const maxZ=Math.floor((Math.max(a.z,b.z)+influence-domain.minZ)/bucketSize);
  for(let z=clamp(minZ,0,binCount-1);z<=clamp(maxZ,0,binCount-1);z++)
   for(let x=clamp(minX,0,binCount-1);x<=clamp(maxX,0,binCount-1);x++){
    const bkey=idx(x,z),list=buckets.get(bkey)||[];
    list.push(k);buckets.set(bkey,list);
   }
 }
 const domainWeight=(x,z)=>{
  const dx=Math.min(x-domain.minX,domain.minX+domain.size-x);
  const dz=Math.min(z-domain.minZ,domain.minZ+domain.size-z);
  return smooth(Math.min(dx,dz)/1024);
 };
 const inside=(x,z)=>x>=domain.minX&&z>=domain.minZ&&
  x<domain.minX+domain.size&&z<domain.minZ+domain.size;
 function nearest(x,z){
  if(!inside(x,z))return null;
  const bx=clamp(Math.floor((x-domain.minX)/bucketSize),0,binCount-1);
  const bz=clamp(Math.floor((z-domain.minZ)/bucketSize),0,binCount-1);
  const list=buckets.get(idx(bx,bz));
  if(!list)return null;
  let best=null,ratio=Infinity;
  for(const k of list){
   const seg=segmentCache[k],dx=seg.bx-seg.ax,dz=seg.bz-seg.az;
   const len2=dx*dx+dz*dz;
   if(len2<1)continue;
   const t=clamp(((x-seg.ax)*dx+(z-seg.az)*dz)/len2,0,1);
   const distance=Math.hypot(x-seg.ax-t*dx,z-seg.az-t*dz);
   const score=distance/seg.bank;
   if(distance>seg.bank||score>=ratio)continue;
   ratio=score;
   best={...seg,t,distance,
    water:seg.waterUp*(1-t)+seg.waterDown*t};
  }
  return best;
 }
 // This is a low-energy erosion baseline. The DEM and receiver graph remain
 // immutable, so changing the visual LOD cannot change watershed membership.
 function sample(x,z){
  const broad=heightAt(x,z);
  const feature=nearest(x,z);
  if(!feature)return {ground:broad,raw:broad,feature:null,water:null,domain:inside(x,z)};
  const weight=domainWeight(x,z);
  const channel=1-smooth((feature.distance-feature.width*.55)/(feature.bank-feature.width*.55));
  const depth=clamp(.3+Math.sqrt(feature.areaKm2)*.34,.4,3.2);
  const incision=depth*channel*weight;
  return {ground:broad-incision,raw:broad,feature:{
   kind:'river',distance:feature.distance,width:feature.width,bank:feature.bank,
   areaKm2:feature.areaKm2,water:feature.water,
   receiver:feature.p,source:feature.i
  },water:null,domain:true};
 }
 function tileHasChannel(x,z,size){
  // Bounded geometric test over indexed segments; no local watershed solves.
  const cx=x+size*.5,cz=z+size*.5,r=size*Math.SQRT2*.5+60;
  if(!inside(cx,cz))return false;
  const x0=clamp(Math.floor((cx-r-domain.minX)/bucketSize),0,binCount-1);
  const x1=clamp(Math.floor((cx+r-domain.minX)/bucketSize),0,binCount-1);
  const z0=clamp(Math.floor((cz-r-domain.minZ)/bucketSize),0,binCount-1);
  const z1=clamp(Math.floor((cz+r-domain.minZ)/bucketSize),0,binCount-1);
  for(let bz=z0;bz<=z1;bz++)for(let bx=x0;bx<=x1;bx++){
   for(const id of buckets.get(idx(bx,bz))||[]){
    const a=segmentCache[id];
    if(Math.max(a.ax,a.bx)+a.bank>=x&&Math.min(a.ax,a.bx)-a.bank<=x+size&&
       Math.max(a.az,a.bz)+a.bank>=z&&Math.min(a.az,a.bz)-a.bank<=z+size)return true;
   }
  }
  return false;
 }
 const summary=Object.freeze({segments:active,domainKm:domain.size/1000,cellMetres:domain.cell,
  authoritative:true,inlandWaterRendered:false});
 return {sample,nearest,tileHasChannel,inside,summary,model};
}
