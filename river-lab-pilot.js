/**
 * Horizon 0.2.2 River Lab integration pilot.
 * Refine the SAME terrain tile around drainage channels, following River Lab's
 * policy of sub-metre sampling near water instead of densifying the whole world.
 * Outer tile edges remain on the original grid for straightforward LOD seams.
 * All vertices use the canonical world terrain function: no render-only carving.
 */
export const PILOT = Object.freeze({x:921,z:1755,core:310,edge:460});
const smooth=(t)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function pilotWeight(x,z){
 return 1-smooth((Math.hypot(x-PILOT.x,z-PILOT.z)-PILOT.core)/(PILOT.edge-PILOT.core));
}
export function pilotOverlapsTile(x,z,size){
 const cx=Math.max(x,Math.min(PILOT.x,x+size));
 const cz=Math.max(z,Math.min(PILOT.z,z+size));
 return Math.hypot(cx-PILOT.x,cz-PILOT.z)<PILOT.edge;
}
/**
 * Build conforming cells with eightfold subdivision beside channels.
 * Transition cells incorporate all neighboring edge points to avoid T-junctions.
 */
export function buildChannelFocusedGrid({x,z,size,segments,height,nearChannel,subdivision=8}){
 if(!Number.isInteger(segments)||segments<2||!Number.isInteger(subdivision)||subdivision<2||subdivision%2)
  throw Error('Invalid pilot terrain grid parameters');
 const N=segments,R=subdivision,step=size/N,flags=new Uint8Array(N*N);
 const at=(i,j)=>j*N+i;
 // Reserve one coarse cell at each tile edge. All outer edges therefore
 // match the original terrain's border samples, not a camera-dependent mesh.
 for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
  const px=x+(i+.5)*step,pz=z+(j+.5)*step;
  const r=step*.73;
  const spots=[[px,pz],[px-r,pz-r],[px+r,pz-r],[px-r,pz+r],[px+r,pz+r]];
  if(spots.some(([xx,zz])=>nearChannel(xx,zz,step*.6)))flags[at(i,j)]=1;
 }
 const positions=[],indices=[],coords=[],cache=new Map();
 const vertex=(i,j)=>{
  const key=i+','+j,known=cache.get(key);
  if(known!==undefined)return known;
  const wx=x+i*step/R,wz=z+j*step/R,h=height(wx,wz);
  if(!Number.isFinite(h))throw Error('Invalid pilot terrain height');
  const id=positions.length/3;
  positions.push(wx,h,wz);coords.push([wx,wz]);cache.set(key,id);return id;
 };
 const tri=(a,b,c)=>indices.push(a,b,c);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const ii=i*R,jj=j*R;
  if(flags[at(i,j)]){
   for(let y=0;y<R;y++)for(let a=0;a<R;a++){
    const tl=vertex(ii+a,jj+y),tr=vertex(ii+a+1,jj+y);
    const bl=vertex(ii+a,jj+y+1),br=vertex(ii+a+1,jj+y+1);
    tri(tl,bl,tr);tri(tr,bl,br);
   }
   continue;
  }
  const left=i>0&&flags[at(i-1,j)],right=i<N-1&&flags[at(i+1,j)];
  const top=j>0&&flags[at(i,j-1)],bottom=j<N-1&&flags[at(i,j+1)];
  if(!left&&!right&&!top&&!bottom){
   const tl=vertex(ii,jj),tr=vertex(ii+R,jj);
   const bl=vertex(ii,jj+R),br=vertex(ii+R,jj+R);
   tri(tl,bl,tr);tri(tr,bl,br);
   continue;
  }
  const perimeter=[];
  const along=(a,b)=>perimeter.push(vertex(a,b));
  const L=left?R:1,B=bottom?R:1,Q=right?R:1,T=top?R:1;
  for(let k=0;k<L;k++)along(ii,jj+k*R/L);
  for(let k=0;k<B;k++)along(ii+k*R/B,jj+R);
  for(let k=0;k<Q;k++)along(ii+R,jj+R-k*R/Q);
  for(let k=0;k<T;k++)along(ii+R-k*R/T,jj);
  const middle=vertex(ii+R/2,jj+R/2);
  for(let k=0;k<perimeter.length;k++)
   tri(perimeter[k],perimeter[(k+1)%perimeter.length],middle);
 }
 return {positions,indices,coords,flags,segments:N,subdivision:R};
}
