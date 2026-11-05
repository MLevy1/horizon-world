/**
 * Horizon 0.3 — whole-domain, deterministic hydrology model.
 * Pure geographic calculation. No Three.js, camera, DOM or rendering tiles.
 *
 * v0.3 defines a finite 65.536 km square world, solved as ONE 256x256 network.
 * Sea and map-boundary outlets are distinguished. This is NOT yet an infinite
 * planetary drainage model; nothing outside the simulation bounds is asserted.
 */
export const DOMAIN = Object.freeze({minX:-32768,minZ:-32768,size:65536,cell:256,n:256});
export function makeRelief(seed='HORIZON-01'){
 let seedNumber=2166136261;
 for(let i=0;i<seed.length;i++)seedNumber=Math.imul(seedNumber^seed.charCodeAt(i),16777619);
 seedNumber>>>=0;
 const hash=(x,z,s=0)=>{
  let h=Math.imul(x|0,374761393)+Math.imul(z|0,668265263)+Math.imul((seedNumber+s)|0,1442695041);
  h=Math.imul(h^(h>>>13),1274126177);
  return ((h^(h>>>16))>>>0)/4294967295;
 };
 const sm=t=>t*t*(3-2*t);
 const noise=(x,z,scale,s=0)=>{
  const a=x/scale,b=z/scale,i=Math.floor(a),j=Math.floor(b),u=sm(a-i),v=sm(b-j);
  const A=hash(i,j,s),B=hash(i+1,j,s),C=hash(i,j+1,s),D=hash(i+1,j+1,s);
  return ((A+(B-A)*u)*(1-v)+(C+(D-C)*u)*v)*2-1;
 };
 const fbm=(x,z,scale,s=0,oct=4)=>{
  let val=0,amp=1,total=0;
  for(let k=0;k<oct;k++){val+=noise(x,z,scale/(1<<k),s+k*97)*amp;total+=amp;amp*=.52}
  return val/total;
 };
 const height=(x,z)=>{
  const wx=x+fbm(x,z,6800,51,3)*1750,wz=z+fbm(x,z,6900,71,3)*1750;
  const broad=fbm(wx,wz,13500,11,4);
  const uplift=Math.max(0,fbm(wx,wz,9400,18,4)*.85+.26);
  const ridge=1-Math.abs(noise(wx,wz,3000,81));
  const ridge2=1-Math.abs(noise(wx,z,1300,83));
  const mountain=Math.pow(ridge,2.9)*uplift*1650+Math.pow(ridge2,3)*uplift*410;
  const hills=fbm(wx,wz,2200,26,5)*200+fbm(wx,wz,480,32,4)*62;
  const local=fbm(x,z,110,42,3)*12;
  return broad*650+mountain+hills+local-185;
 };
 return {height,hash,noise};
}
class MinHeap{
 constructor(){this.h=[];this.i=[]}
 push(height,id){
  let p=this.h.length;this.h.push(height);this.i.push(id);
  while(p){let q=(p-1)>>1;if(this.h[q]<=height)break;this.h[p]=this.h[q];this.i[p]=this.i[q];p=q}
  this.h[p]=height;this.i[p]=id;
 }
 pop(){
  const h=this.h[0],id=this.i[0],n=this.h.length-1;
  if(n===0){this.h.pop();this.i.pop();return [h,id]}
  const tailH=this.h.pop(),tailI=this.i.pop();
  let p=0;
  while(p*2+1<n){
   let q=p*2+1;
   if(q+1<n&&this.h[q+1]<this.h[q])q++;
   if(this.h[q]>=tailH)break;
   this.h[p]=this.h[q];this.i[p]=this.i[q];p=q;
  }
  this.h[p]=tailH;this.i[p]=tailI;
  return [h,id];
 }
 get length(){return this.h.length}
}
const NEIGHBORS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
export function solveHydrology({seed='HORIZON-01',domain=DOMAIN,heightAt=null}={}){
 const n=domain.n,S=n*n,step=domain.cell,relief=heightAt?null:makeRelief(seed);
 const height=heightAt||relief.height;
 const raw=new Float32Array(S),filled=new Float32Array(S);
 const parent=new Int32Array(S),outlet=new Int32Array(S),kind=new Uint8Array(S);
 const accumulated=new Float32Array(S),order=new Int32Array(S);
 const seen=new Uint8Array(S),heap=new MinHeap();
 const id=(x,z)=>z*n+x,coords=(i)=>[i%n,(i/n)|0];
 let oceanCells=0,seaOutlets=0,boundaryOutlets=0,processed=0;
 parent.fill(-1);outlet.fill(-1);
 // Broad geographic elevations and seed-dependent rainfall are computed once.
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  const i=id(x,z),wx=domain.minX+(x+.5)*step,wz=domain.minZ+(z+.5)*step;
  raw[i]=height(wx,wz);filled[i]=raw[i];
  accumulated[i]=step*step/1e6; // drainage area in square kilometres
  if(raw[i]<=0){kind[i]=1;seen[i]=1;outlet[i]=i;heap.push(raw[i],i);oceanCells++;seaOutlets++}
 }
 // Boundary land is deliberately an unresolved outer-world exit.
 // It is NOT automatically classified as an ocean outlet.
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  if(x!==0&&z!==0&&x!==n-1&&z!==n-1)continue;
  const i=id(x,z);
  if(seen[i])continue;
  kind[i]=2;seen[i]=1;outlet[i]=i;heap.push(raw[i],i);boundaryOutlets++;
 }
 // Whole-domain priority flood; every land point obtains one downstream
 // receiver. Equal-height depressions receive a tiny monotone gradient.
 // Every parent was visited previously, so cycles are impossible.
 while(heap.length){
  const [,i]=heap.pop();order[processed++]=i;
  const [x,z]=coords(i);
  for(const [dx,dz] of NEIGHBORS){
   const xx=x+dx,zz=z+dz;
   if(xx<0||zz<0||xx>=n||zz>=n)continue;
   const j=id(xx,zz);if(seen[j])continue;
   seen[j]=1;parent[j]=i;outlet[j]=outlet[i];kind[j]=kind[i];
   const level=Math.max(raw[j],filled[i]+.001);
   filled[j]=level;heap.push(level,j);
  }
 }
 // Reverse visitation aggregates catchment area into the parent.
 // With a global ordering, accumulation never resets at a tile boundary.
 for(let k=S-1;k>=0;k--){const i=order[k],p=parent[i];if(p>=0)accumulated[p]+=accumulated[i]}
 let maxArea=0,uphill=0,unresolvedCells=0,seaCells=0,riverCells=0;
 const largest=[];
 for(let i=0;i<S;i++){
  maxArea=Math.max(maxArea,accumulated[i]);
  if(parent[i]>=0&&filled[parent[i]]>filled[i]+1e-5)uphill++;
  if(raw[i]>0){if(kind[i]===2)unresolvedCells++;else seaCells++;
   if(accumulated[i]>=8)riverCells++;
  }
 }
 const point=i=>{const [x,z]=coords(i);return {
  index:i,x:domain.minX+(x+.5)*step,z:domain.minZ+(z+.5)*step,
  raw:raw[i],drainageElevation:filled[i],areaKm2:accumulated[i],
  outletType:kind[i]===1?'sea':'boundary',outletIndex:outlet[i],receiver:parent[i]
 }};
 const cellAt=(x,z)=>{
  const col=Math.floor((x-domain.minX)/step),row=Math.floor((z-domain.minZ)/step);
  return col<0||row<0||col>=n||row>=n?-1:id(col,row);
 };
 const downstream=(i,limit=S)=>{
  const path=[],visited=new Set();
  for(let count=0;i>=0&&count<limit;i=parent[i],count++){
   if(visited.has(i))throw Error('Drainage cycle');
   visited.add(i);path.push(i);
  }
  return path;
 };
 // Longest upstream trunk, not the arbitrary raster source.
 const upstreamLength=new Float32Array(S),bestChild=new Int32Array(S);
 bestChild.fill(-1);
 for(let k=S-1;k>=0;k--){
  const i=order[k],p=parent[i];if(p<0)continue;
  const dist=Math.hypot((i%n)-(p%n),Math.floor(i/n)-Math.floor(p/n))*step;
  if(upstreamLength[i]+dist>upstreamLength[p]){
   upstreamLength[p]=upstreamLength[i]+dist;bestChild[p]=i;
  }
 }
 const upstream=(i,limit=S)=>{const path=[],seen=new Set();
  while(i>=0&&path.length<limit){if(seen.has(i))throw Error('Upstream cycle');seen.add(i);path.push(i);i=bestChild[i]}
  return path;
 };
 return {seed,domain,raw,filled,parent,outlet,kind,accumulated,order,
  point,cellAt,downstream,upstream,stats:{cells:S,oceanCells,seaOutlets,
   boundaryOutlets,seaCells,unresolvedCells,riverCells,uphill,maxAreaKm2:maxArea,
   coverageKm:domain.size/1000}};
}
