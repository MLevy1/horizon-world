import {coordinateTile,terrainVertex,tileNeighbor,tileKey,neighborhood,EDGES} from './terrain-chunks.mjs?v=0.9.6';
import {coveringTile} from './terrain-lod.mjs?v=0.9.6';
export const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
export function direction(lon,lat){const l=lon*Math.PI/180,p=lat*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)];}
export function coordinates(d){return {lon:Math.atan2(d[2],d[0])*180/Math.PI,lat:Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI};}
export function frame(d,yaw=0,pitch=0){const {lon,lat}=coordinates(d),l=lon*Math.PI/180,p=lat*Math.PI/180,east=[-Math.sin(l),0,Math.cos(l)],north=[-Math.sin(p)*Math.cos(l),Math.cos(p),-Math.sin(p)*Math.sin(l)],forward=north.map((v,k)=>v*Math.cos(yaw)+east[k]*Math.sin(yaw)),right=east.map((v,k)=>v*Math.cos(yaw)-north[k]*Math.sin(yaw));return {east,north,right,forward:forward.map((v,k)=>v*Math.cos(pitch)+d[k]*Math.sin(pitch)),up:d.map((v,k)=>v*Math.cos(pitch)-forward[k]*Math.sin(pitch))};}
export function moveDirection(d,yaw,forward,right,metres,radius){const f=frame(d,yaw),v=f.forward.map((x,k)=>x*forward+f.right[k]*right),n=Math.hypot(...v);if(!n)return d;const a=metres/radius;return unit(d.map((x,k)=>x*Math.cos(a)+v[k]/n*Math.sin(a)));}
export function explorerTiles(lon,lat,R){
  const d=direction(lon,lat),leaves=new Map(),children=t=>[0,1,2,3].map(k=>({face:t.face,level:t.level+1,x:t.x*2+k%2,y:t.y*2+(k>>1)})),reach={8:450,9:250,10:120,11:45};
  function visit(t){const c=terrainVertex(t,4,2,2).direction,bound=Math.max(...[[0,0],[4,0],[4,4],[0,4]].map(([i,j])=>Math.hypot(...terrainVertex(t,4,i,j).direction.map((v,k)=>v-c[k]))))*R,dist=Math.hypot(...c.map((v,k)=>v-d[k]))*R;if(t.level<12&&dist-bound<reach[t.level])for(const child of children(t))visit(child);else leaves.set(tileKey(t),t);}
  for(const root of neighborhood(coordinateTile(lon,lat,8),1))visit(root);
  let changed=true;while(changed){changed=false;for(const t of [...leaves.values()])for(const edge of EDGES){const o=coveringTile(leaves,tileNeighbor(t,edge));if(o&&t.level-o.level>1){leaves.delete(tileKey(o));for(const child of children(o))leaves.set(tileKey(child),child);changed=true;}}}
  return [...leaves.values()].map(tile=>({tile,coarseEdges:EDGES.filter(e=>coveringTile(leaves,tileNeighbor(tile,e))?.level===tile.level-1)}));
}
/** Collision rays intersect the actual indexed mesh, rather than an unseen
 * high-resolution height field. Gnomonic bins preserve spherical coverage. */
export function createGroundCollider(data,anchor,R,{rangeM=512,binSize=12}={}){
  const basis=frame(anchor),bins=new Map(),size=binSize,p=data.positions,triangles=[],key=(x,y)=>Math.floor(x/size)+':'+Math.floor(y/size),xy=d=>{const z=dot(d,anchor);return z>0?[dot(d,basis.east)/z*R,dot(d,basis.north)/z*R]:null;};
  for(let k=0;k<data.indices.length;k+=3){const ids=Array.from(data.indices.subarray(k,k+3)),v=ids.map(i=>Array.from(p.subarray(i*3,i*3+3))),q=v.map(xy);if(q.some(x=>!x))continue;if([0,1].some(k=>Math.min(...q.map(v=>v[k]))>rangeM||Math.max(...q.map(v=>v[k]))< -rangeM))continue;const [a,b,c]=v,u=b.map((x,k)=>x-a[k]),w=c.map((x,k)=>x-a[k]),n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],id=triangles.length;triangles.push({q,n,plane:dot(n,a)});
    const lo=[0,1].map(k=>Math.floor(Math.max(-rangeM,Math.min(...q.map(v=>v[k])))/size)),hi=[0,1].map(k=>Math.floor(Math.min(rangeM,Math.max(...q.map(v=>v[k])))/size));for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++){const key=x+':'+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(id);}}
  return d=>{const q=xy(d);if(!q)return null;for(const id of bins.get(key(...q))||[]){const t=triangles[id],[a,b,c]=t.q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;const wa=((b[1]-c[1])*(q[0]-c[0])+(c[0]-b[0])*(q[1]-c[1]))/den,wb=((c[1]-a[1])*(q[0]-c[0])+(a[0]-c[0])*(q[1]-c[1]))/den;if(wa>=-1e-7&&wb>=-1e-7&&wa+wb<=1+1e-7){const r=t.plane/dot(t.n,d);return Number.isFinite(r)?r-R:null;}}return null;};
}
