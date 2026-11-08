import {direction,coordinates,moveDirection} from './explorer-world.mjs?v=0.9.12';
import {coordinateTile,terrainVertex,tileNeighbor,tileKey,EDGES} from './terrain-chunks.mjs?v=0.9.12';
export const DETAIL_FADE_SECONDS=.7,DETAIL_CACHE_BYTES=16*1048576;
export const detailVisibility=(distance,age,clearance=0)=>{const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};return smooth(0,DETAIL_FADE_SECONDS,age)*(1-smooth(64,96,distance))*(1-smooth(60,140,clearance));};
/** Full tiles cover the current view and a bounded motion-predicted buffer. */
export function planGroundDetail({lon,lat,radiusM,yaw=0,forward=0,right=0,speed=0,latency=1}){
 const anchor=direction(lon,lat),lead=Math.min(240,Math.max(0,speed)*(Math.min(6,Math.max(1,latency))+1)),ahead=forward||right?moveDirection(anchor,yaw,forward,right,lead,radiusM):anchor,starts=[coordinateTile(lon,lat,11),coordinateTile(...Object.values(coordinates(ahead)),11)],queue=[],seen=new Set(),tiles=[];
 for(const t of starts){const key=tileKey(t);if(!seen.has(key)){seen.add(key);queue.push(t);}}
 for(let i=0;i<queue.length;i++){const tile=queue[i],c=terrainVertex(tile,4,2,2).direction,bound=Math.max(...[[0,0],[4,0],[4,4],[0,4]].map(([x,y])=>Math.hypot(...terrainVertex(tile,4,x,y).direction.map((v,k)=>v-c[k]))))*radiusM,dist=p=>Math.hypot(...c.map((v,k)=>v-p[k]))*radiusM,near=dist(anchor),future=dist(ahead),line=ahead.map((v,k)=>v-anchor[k]),length2=line.reduce((s,v)=>s+v*v,0),t=length2?Math.max(0,Math.min(1,c.reduce((s,v,k)=>s+(v-anchor[k])*line[k],0)/length2)):0,corridor=Math.hypot(...c.map((v,k)=>v-anchor[k]-line[k]*t))*radiusM;if(corridor-bound>112)continue;tiles.push({tile,id:tileKey(tile),distance:near,priority:Math.min(near,future+40)});for(const edge of EDGES){const t=tileNeighbor(tile,edge),key=tileKey(t);if(!seen.has(key)){seen.add(key);queue.push(t);}}}
 tiles.sort((a,b)=>a.priority-b.priority);return {tiles,ahead};
}
/** Cache owns immutable arrays; messages copy buffers so transfers cannot detach it. */
export function createGroundDetailCache({limitBytes=DETAIL_CACHE_BYTES}={}){
 const entries=new Map();let bytes=0;
 return {get(key){const e=entries.get(key);if(e){entries.delete(key);entries.set(key,e);}return e?.data;},put(key,data){const size=Object.values(data).reduce((s,v)=>s+(ArrayBuffer.isView(v)?v.byteLength:0),0);if(entries.has(key)){bytes-=entries.get(key).size;entries.delete(key);}if(size>limitBytes)return false;while(bytes+size>limitBytes){const key=entries.keys().next().value;bytes-=entries.get(key).size;entries.delete(key);}entries.set(key,{data,size});bytes+=size;return true;},stats:()=>({bytes,limitBytes,entries:entries.size}),clear(){entries.clear();bytes=0;}};
}
export function detailRevision(tile,ground){return [[0,0],[2,0],[4,0],[0,2],[2,2],[4,2],[0,4],[2,4],[4,4]].map(([x,y])=>{const h=ground(terrainVertex(tile,4,x,y).direction);return h===null?'x':Math.round(h*50);}).join(',');}
export function copyGroundDetail(data){return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,ArrayBuffer.isView(v)?v.slice():v]));}
