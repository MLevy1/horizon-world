import {createTerrainChunkBuilder,tileKey} from './terrain-chunks.mjs?v=0.8.2';
import {selectTerrainTiles} from './terrain-lod.mjs?v=0.8.2';
/** Bounded worker-owned geometry cache. Combined output has separate buffers,
 * so transferring a view never detaches the cached chunks. */
export function createTerrainStream(surface,{cacheBytes=32*1048576,resolution=64}={}){
  if(!Number.isInteger(cacheBytes)||cacheBytes<0)throw Error('Invalid terrain cache budget');
  const builder=createTerrainChunkBuilder(surface),cache=new Map();let bytes=0;
  function view(lon,lat,options={}){
    const selected=selectTerrainTiles(lon,lat,{...options,radiusM:surface.grid.radiusKm*1000});let mesh,n=resolution,built=0,reused=0,evicted=0;
    do{
      const chunks=selected.map(({tile,coarseEdges})=>{
        const key=tileKey(tile)+'/'+n+'/'+coarseEdges.join(','),saved=cache.get(key);if(saved){cache.delete(key);cache.set(key,saved);reused++;return saved.chunk;}
        const chunk=builder.build(tile,{resolution:n,coarseEdges}),size=Object.values(chunk).reduce((s,v)=>s+(ArrayBuffer.isView(v)?v.byteLength:0),0);built++;
        if(size<=cacheBytes){while(bytes+size>cacheBytes){const oldest=cache.keys().next().value;bytes-=cache.get(oldest).bytes;cache.delete(oldest);evicted++;}cache.set(key,{chunk,bytes:size});bytes+=size;}
        return chunk;
      });
      mesh=builder.combine(chunks);if(!mesh.stats.ambiguousWaterTriangles||n>=128||selected.length*2*(n*2)**2>1200000)break;n*=2;
    }while(n<=128);
    mesh.focus={lon,lat,groundM:surface.sample(lon,lat).fitted.groundM};mesh.view={...options,lon,lat};mesh.stats.resolution=n;mesh.stats.minLevel=Math.min(...selected.map(v=>v.tile.level));mesh.stats.maxLevel=Math.max(...selected.map(v=>v.tile.level));
    mesh.stream={built,reused,evicted,cacheBytes:bytes,cacheLimitBytes:cacheBytes,entries:cache.size};return mesh;
  }
  return {view};
}

/** At most one worker request is active. New input replaces the waiting view;
 * only the most recent result is displayed, even after a world reset. */
export function createTerrainViewQueue(send,accept){
  let serial=0,active=null,pending=null;
  function pump(){if(!active&&pending){active=pending;pending=null;send(active);}}
  return {
    request(view){pending={...view,requestId:++serial};pump();return serial;},
    invalidate(){serial++;pending=null;},
    finish(result){if(result.requestId!==active?.requestId)return false;const fresh=result.requestId===serial;active=null;if(fresh)accept(result);pump();return fresh;},
    reset(){serial++;active=null;pending=null;}
  };
}
