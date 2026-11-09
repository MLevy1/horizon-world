import {terrainVertex,tileKey,tileNeighbor,EDGES} from './terrain-chunks.mjs?v=0.9.18';
import {coveringTile} from './terrain-lod.mjs?v=0.9.18';
/** Six complete cube faces remain present. Refinement changes detail, never coverage. */
export function scenicTiles(lon,lat,R,{clearance=0,resolution=8}={}){
 const l=lon*Math.PI/180,p=lat*Math.PI/180,focus=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],leaves=new Map(),children=t=>[0,1,2,3].map(k=>({face:t.face,level:t.level+1,x:t.x*2+k%2,y:t.y*2+(k>>1)}));
 function visit(t){const c=terrainVertex(t,4,2,2).direction,bound=Math.max(...[[0,0],[4,0],[4,4],[0,4]].map(([i,j])=>Math.hypot(...terrainVertex(t,4,i,j).direction.map((v,k)=>v-c[k]))))*R,dist=Math.hypot(...c.map((v,k)=>v-focus[k]))*R,target=Math.max(1.7,clearance*.06,Math.max(0,dist-bound)*.12);if(t.level<13&&2*bound/resolution>target)for(const child of children(t))visit(child);else leaves.set(tileKey(t),t);}
 for(let face=0;face<6;face++)visit({face,level:0,x:0,y:0});
 let changed=true;while(changed){changed=false;for(const t of [...leaves.values()])for(const edge of EDGES){const other=coveringTile(leaves,tileNeighbor(t,edge));if(other&&t.level-other.level>1){leaves.delete(tileKey(other));for(const child of children(other))leaves.set(tileKey(child),child);changed=true;}}}
 return [...leaves.values()].map(tile=>({tile,coarseEdges:EDGES.filter(e=>coveringTile(leaves,tileNeighbor(tile,e))?.level===tile.level-1)}));
}
/** Clear-air visibility depends on the region, not on selected travel speed. */
export function scenicFog({elevationM=0,aridity=1}={}){const distance=elevationM>1400?24000:aridity<.4?18000:aridity>1.4?9000:14000;return 1.2/distance;}
