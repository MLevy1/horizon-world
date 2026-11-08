import {crownLobes,forestUV,packedBuffer} from './forest-structure.mjs?v=0.9.17';
import {plantAddress,plantGrove,plantShape,plantHabitat} from './explorer-plants.mjs?v=0.9.17';
import {coordinateTile,terrainVertex,tileNeighbor,tileKey,EDGES} from './terrain-chunks.mjs?v=0.9.17';
import {direction,coordinates,frame,createGroundCollider} from './explorer-world.mjs?v=0.9.17';
import {rockBlocks} from './explorer-rocks.mjs?v=0.9.17';
const rank=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
/** Ring traversal has no fixed tile radius, including across cube-face seams. */
function forestTiles(anchor,lon,lat,R,range){const first=coordinateTile(lon,lat,11),queue=[first],seen=new Set([tileKey(first)]),result=[];for(let i=0;i<queue.length;i++){const tile=queue[i],c=terrainVertex(tile,4,2,2).direction,bound=Math.max(...[[0,0],[4,0],[4,4],[0,4]].map(([x,y])=>Math.hypot(...terrainVertex(tile,4,x,y).direction.map((v,k)=>v-c[k]))))*R;if(Math.hypot(...c.map((v,k)=>v-anchor[k]))*R-bound>range)continue;result.push(tile);for(const edge of EDGES){const t=tileNeighbor(tile,edge),key=tileKey(t);if(!seen.has(key)){seen.add(key);queue.push(t);}}}return result;}
/** Bounded, seed-specific placement cache. Repeated streaming reuses immutable records. */
export function createForestField({limit=48000}={}){
 const cache=new Map(),habitats=new Map(),rejected=new Map();let worldSeed,samples=0;
 function reset(seed){if(seed!==worldSeed){cache.clear();habitats.clear();rejected.clear();worldSeed=seed;}}
 function resolve({seed,address,environment,radiusM}){
  reset(seed);if(cache.has(address.id))return cache.get(address.id);const split=address.id.lastIndexOf(':'),tile=address.id.slice(0,split),bit=1<<Number(address.id.slice(split+1));if((rejected.get(tile)||0)&bit)return null;samples++;
  const ll=coordinates(address.direction),h=plantHabitat(environment(ll.lon,ll.lat));
  const record=h.kind==='bare'||h.kind==='shrub'||address.roll>h.density*(.15+plantGrove(seed,address.direction,radiusM)*.95)?null:{id:address.id,direction:address.direction,kind:h.kind,...plantShape(seed,address.id,h.kind)};
  if(record){if(cache.size>=limit)cache.delete(cache.keys().next().value);cache.set(address.id,record);}else{if(!rejected.has(tile)&&rejected.size>=8000)rejected.delete(rejected.keys().next().value);rejected.set(tile,(rejected.get(tile)||0)|bit);}return record;
 }
 return {resolve,build({seed,lon,lat,radiusM,mesh,environment,rangeM=1800,detailed=true}){
  reset(seed);let cachedGround=null,cachedWater=null;const anchor=direction(lon,lat),ground=d=>{cachedGround ||= createGroundCollider(mesh.ground,anchor,radiusM,{rangeM:rangeM+100,binSize:40});return cachedGround(d);},water=d=>{if(!mesh.water)return null;cachedWater ||= createGroundCollider(mesh.water,anchor,radiusM,{rangeM:rangeM+100,binSize:40});return cachedWater(d);},positions=packedBuffer(),normals=packedBuffer(),colors=packedBuffer(),foliage=packedBuffer(),shade=packedBuffer(),treeLOD=packedBuffer(),indices=packedBuffer(Uint32Array),placements=[];let sampled=0;const startingSamples=samples;
  function card(corners,uv,flag,color,d,meta){const at=positions.length/3;for(let i=0;i<4;i++){positions.push(...corners[i]);normals.push(...d);colors.push(...color);foliage.push(...uv[i],flag);shade.push(.95);treeLOD.push(...meta);}indices.push(at,at+1,at+2,at,at+2,at+3);}
  for(const tile of forestTiles(anchor,lon,lat,radiusM,rangeM)){
   const key=tileKey(tile);let possible=habitats.get(key);if(possible===undefined){possible=false;for(const [x,y] of [[2,2],[0,0],[4,0],[4,4],[0,4]]){const ll=coordinates(terrainVertex(tile,4,x,y).direction),h=plantHabitat(environment(ll.lon,ll.lat));sampled++;if(h.kind!=='bare'&&h.kind!=='shrub'){possible=true;break;}}if(habitats.size>=8000)habitats.delete(habitats.keys().next().value);habitats.set(key,possible);}if(!possible)continue;
   for(let candidate=0;candidate<32;candidate++){
    const a=plantAddress(seed,tile,candidate),d=a.direction,dist=Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM;if(dist>rangeM)continue;
    const record=resolve({seed,address:a,environment,radiusM});if(!record)continue;
    const h=ground(d);if(h===null||(water(d)??-Infinity)>h+.03||dist<320&&rockBlocks(mesh.rocks?.placements,d,h,radiusM))continue;
    const f=frame(d,record.yaw),height=record.height,w=record.width,origin=d.map(v=>v*(radiusM+h-.12)),world=p=>origin.map((v,k)=>v+f.right[k]*p[0]+d[k]*p[1]+f.forward[k]*p[2]),seedRoll=rank(a.id+':lod'),tint=[.84+record.tone*.12,.86+record.tone*.12,.80+record.tone*.12];
    if(dist<490){
     const meta=[...origin,2+seedRoll];
     for(const c of crownLobes(record.kind)){
      const center=[c.x*w+record.leanX*c.y,c.y*height,c.z*w+record.leanZ*c.y],uv=forestUV(record.kind,1);
      for(const angle of [0,Math.PI/2]){const x=Math.cos(angle)*c.rx*w,z=Math.sin(angle)*c.rz*w;card([[-x,-c.ry*height,-z],[x,-c.ry*height,z],[x,c.ry*height,z],[-x,c.ry*height,-z]].map(p=>world(p.map((v,k)=>v+center[k]))),uv,4,tint,d,meta);}
      card([[-c.rx*w,0,-c.rz*w],[c.rx*w,0,-c.rz*w],[c.rx*w,0,c.rz*w],[-c.rx*w,0,c.rz*w]].map(p=>world(p.map((v,k)=>v+center[k]))),uv,4,tint,d,meta);
     }
     for(const angle of [0,Math.PI/2]){const x=Math.cos(angle)*record.trunk*.6,z=Math.sin(angle)*record.trunk*.6;card([[-x,0,-z],[x,0,z],[x,height*.66,z],[-x,height*.66,-z]].map(world),[[0,1],[1,1],[1,0],[0,0]],0,[.24*record.tone,.19*record.tone,.13*record.tone],d,meta);}
    }
    if(dist>70){
     const meta=[...origin,(dist<490?4:6)+seedRoll],uv=forestUV(record.kind,0);
     for(const angle of [0,Math.PI/2]){const x=Math.cos(angle)*w*1.1,z=Math.sin(angle)*w*1.1;card([[-x,0,-z],[x,0,z],[x+record.leanX,height,z+record.leanZ],[-x+record.leanX,height,-z+record.leanZ]].map(world),uv,4,tint,d,meta);}
     const y=height*(record.pine?.33:record.tropical?.86:.78),r=w*1.1;card([[-r,y,-r],[r,y,-r],[r,y,r],[-r,y,r]].map(world),forestUV(record.kind,2),4,tint,d,meta);
    }
    placements.push({id:a.id,direction:d,groundM:h,heightM:height,widthM:w,crownWidthM:w*2.2,kind:record.kind,distanceM:dist});
   }
  }
  return {positions:positions.finish(),normals:normals.finish(),colors:colors.finish(),foliage:foliage.finish(),shade:shade.finish(),treeLOD:treeLOD.finish(),indices:indices.finish(),placements,plants:true,distantPlants:true,shadowCaster:false,stats:{sampled:sampled+samples-startingSamples,rejectedTiles:rejected.size,cacheEntries:cache.size,cacheLimit:limit,habitatEntries:habitats.size,rangeM}};
 }};
}
