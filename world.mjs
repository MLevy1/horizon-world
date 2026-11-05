// HORIZON 0.1 — geography is computed before it is rendered.
// Pure, deterministic simulation. No Three.js, browser, tile, or camera dependency.
export const SIZE = 8192;
export const HALF = SIZE / 2;
export const GRID = 129;
export const STEP = SIZE / (GRID - 1);
const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*(3-2*t);
export function hash(x,z,seed=1){
  let h = Math.imul((x|0)^seed, 0x45d9f3b) ^ Math.imul((z|0)^0x9e3779b9,0x119de1f3);
  h = Math.imul(h ^ (h>>>16), 0x7feb352d);
  h = Math.imul(h ^ (h>>>15), 0x846ca68b);
  return ((h ^ (h>>>16))>>>0)/4294967295;
}
function noise(x,z,scale,seed){
  x/=scale;z/=scale;const ix=Math.floor(x),iz=Math.floor(z);
  const u=smooth(x-ix),v=smooth(z-iz);
  return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),u),
             mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),u),v)*2-1;
}
const DIRS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
class Heap {
  constructor(){this.a=[]}
  push(id,h){const o={id,h},a=this.a;let p=a.length;a.push(o);while(p){let j=(p-1)>>1;if(a[j].h<h||(a[j].h===h&&a[j].id<=id))break;a[p]=a[j];p=j}a[p]=o}
  pop(){const a=this.a,top=a[0],tail=a.pop();if(a.length){let p=0;while(2*p+1<a.length){let j=2*p+1;if(j+1<a.length&&(a[j+1].h<a[j].h||(a[j+1].h===a[j].h&&a[j+1].id<a[j].id)))j++;if(a[j].h>tail.h||(a[j].h===tail.h&&a[j].id>=tail.id))break;a[p]=a[j];p=j}a[p]=tail}return top}
  get length(){return this.a.length}
}
export function createWorld(seed=42){
  seed=seed|0;
  function broad(x,z){
    // Continental slope and a coastal shelf are established *before* routing.
    const warp=noise(x,z,2400,seed+11)*185 + noise(x,z,950,seed+12)*75;
    const coastX=x+warp;
    const continental=36+0.083*(coastX+1450);
    const hills=noise(x,z,1900,seed+17)*93 + noise(x,z,830,seed+23)*48
      +noise(x,z,330,seed+29)*15 +noise(x,z,115,seed+31)*3.3;
    const eastern=clamp((x-1000)/2500,0,1);
    const ridges=(1-Math.abs(noise(x,z,1750,seed+41)))*90*eastern
      + (1-Math.abs(noise(x+300,z,600,seed+43)))*52*eastern;
    return continental+hills+ridges;
  }
  const count=GRID*GRID,base=new Float32Array(count),filled=new Float32Array(count),
    parent=new Int32Array(count),root=new Int32Array(count),acc=new Float32Array(count),
    sea=new Uint8Array(count),visited=new Uint8Array(count),order=[];
  parent.fill(-1);acc.fill(1);
  const at=(ix,iz)=>iz*GRID+ix;
  for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++)base[at(x,z)]=broad(-HALF+x*STEP,-HALF+z*STEP);
  const heap=new Heap();
  for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
    const id=at(x,z),isSea=base[id]<=0;
    if(isSea||x===0||z===0||x===GRID-1||z===GRID-1){
      visited[id]=1;filled[id]=Math.max(0,base[id]);heap.push(id,filled[id]);
    }
  }
  while(heap.length){
    const id=heap.pop().id,x=id%GRID,z=Math.floor(id/GRID);order.push(id);
    for(const [dx,dz] of DIRS){const nx=x+dx,nz=z+dz;
      if(nx<0||nz<0||nx>=GRID||nz>=GRID)continue;
      const k=at(nx,nz);if(visited[k])continue;
      visited[k]=1;parent[k]=id;filled[k]=Math.max(base[k],filled[id]+.002);
      heap.push(k,filled[k]);
    }
  }
  for(let i=order.length-1;i>=0;i--){const k=order[i],p=parent[k];if(p>=0)acc[p]+=acc[k]}
  for(const id of order){const p=parent[id];root[id]=p<0?id:root[p];sea[id]=base[root[id]]<=0?1:0}
  // Distance to persistent, sea-connected drainage channels (terrain shaping).
  const river=new Uint8Array(count),dist=new Float32Array(count),nearAcc=new Float32Array(count),queue=new Heap();
  dist.fill(1e9);let riverCells=0,seaCells=0,maxAccumulation=0;
  for(let id=0;id<count;id++){
    if(base[id]<=0)seaCells++;
    if(base[id]>0&&sea[id]&&acc[id]>=22&&parent[id]>=0){
      river[id]=1;riverCells++;dist[id]=0;nearAcc[id]=acc[id];queue.push(id,0);
      maxAccumulation=Math.max(maxAccumulation,acc[id]);
    }
  }
  // Dijkstra in world metres; each cell inherits its nearest source area.
  while(queue.length){const {id,h}=queue.pop();if(h>dist[id]+1e-4)continue;
    const x=id%GRID,z=Math.floor(id/GRID);
    for(const [dx,dz] of DIRS){const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=GRID||nz>=GRID)continue;
      const k=at(nx,nz),nd=h+STEP*Math.hypot(dx,dz);
      if(nd>=dist[k]-1e-4)continue;dist[k]=nd;nearAcc[k]=nearAcc[id];queue.push(k,nd)
    }
  }
  const valley=new Float32Array(count);
  for(let k=0;k<count;k++){
    if(base[k]<=0||dist[k]>750)continue;
    const area=nearAcc[k],width=70+Math.min(200,Math.sqrt(area)*6),
      depth=Math.min(15,1.2+Math.log2(1+area)*1.3);
    const t=dist[k]/width;valley[k]=depth*Math.exp(-t*t*1.7);
  }
  function field(arr,x,z){
    const gx=clamp((x+HALF)/STEP,0,GRID-1-1e-6),gz=clamp((z+HALF)/STEP,0,GRID-1-1e-6);
    const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
    return mix(mix(arr[at(ix,iz)],arr[at(ix+1,iz)],u),
               mix(arr[at(ix,iz+1)],arr[at(ix+1,iz+1)],u),v);
  }
  function height(x,z){return broad(x,z)-field(valley,x,z)}
  function moisture(x,z){
    const drainage=1-clamp(field(dist,x,z)/470,0,1);
    return clamp(.42+.19*noise(x,z,950,seed+67)+.21*drainage,0,1);
  }
  function forest(x,z){
    const h=height(x,z);if(h<3||h>650)return 0;
    const m=moisture(x,z),patch=noise(x,z,720,seed+77)*.24+noise(x,z,230,seed+79)*.12;
    return clamp((m-.23)*1.6+patch-clamp((h-440)/400,0,.7),0,.88);
  }
  function inspect(x,z){
    const ground=height(x,z),raw=broad(x,z);
    return {x,z,ground,raw,water:ground<0?0:null,moisture:moisture(x,z),
      forest:forest(x,z),drainage:field(acc,x,z),channelDistance:field(dist,x,z)};
  }
  const lines=[];
  for(let id=0;id<count;id++){
    const p=parent[id];if(!river[id]||p<0||base[p]<=0)continue;
    lines.push({x:-HALF+(id%GRID)*STEP,z:-HALF+Math.floor(id/GRID)*STEP,
      toX:-HALF+(p%GRID)*STEP,toZ:-HALF+Math.floor(p/GRID)*STEP,flow:acc[id]});
  }
  return {seed,base,filled,parent,acc,root,sea,river,dist,valley,lines,
    broad,height,moisture,forest,inspect,
    stats:{cells:count,seaCells,riverCells,maxAccumulation,segments:lines.length},
    // World map and visual terrain both use this one simulation instance.
    gridAt:at};
}