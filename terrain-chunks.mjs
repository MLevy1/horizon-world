import {clipChunkWater} from './chunk-water.mjs?v=0.8.9';
/** Globally addressed cube-sphere ground chunks. Hydrology is queried from the
 * existing global surface; chunks neither solve nor invent independent water.
 * Integer direction keys are identical across face seams and dyadic LODs.
 */
const FACES=['+X','-X','+Y','-Y','+Z','-Z'],EDGES=['left','right','bottom','top'],DEG=180/Math.PI;
const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b){const r=a%b;a=b;b=r;}return a;};
function validate(tile,resolution){
  if(!Number.isInteger(tile.face)||tile.face<0||tile.face>5||!Number.isInteger(tile.level)||tile.level<0||tile.level>16)throw Error('Invalid global terrain tile');
  const count=2**tile.level;if(!Number.isInteger(tile.x)||!Number.isInteger(tile.y)||tile.x<0||tile.y<0||tile.x>=count||tile.y>=count)throw Error('Invalid terrain tile coordinates');
  if(!Number.isInteger(resolution)||resolution<4||resolution>256||resolution%2)throw Error('Terrain resolution must be even, from 4 to 256');
}
function cube(face,u,v,d){
  return [[d,v,-u],[-d,v,u],[u,d,-v],[u,-d,v],[u,v,d],[-u,v,-d]][face].map(x=>x===0?0:x);
}
export function tileKey(t){return `${t.face}/${t.level}/${t.x}/${t.y}`;}
export function terrainVertex(tile,resolution,i,j){
  validate(tile,resolution);if(!Number.isInteger(i)||!Number.isInteger(j)||i<0||j<0||i>resolution||j>resolution)throw Error('Invalid terrain vertex');
  const d=(2**tile.level)*resolution,u=2*(tile.x*resolution+i)-d,v=2*(tile.y*resolution+j)-d,xyz=cube(tile.face,u,v,d),divisor=gcd(gcd(xyz[0],xyz[1]),xyz[2]),integers=xyz.map(x=>x/divisor);
  return {key:integers.join(':'),direction:normalize(integers)};
}
export function directionTile(direction,level){
  if(!Number.isInteger(level)||level<0||level>16||direction.length!==3||!direction.every(Number.isFinite)||!Math.hypot(...direction))throw Error('Invalid terrain location');
  const [x,y,z]=direction,a=[Math.abs(x),Math.abs(y),Math.abs(z)],major=Math.max(...a);let face,u,v;
  if(a[0]===major){face=x>=0?0:1;u=x>=0?-z/major:z/major;v=y/major;}
  else if(a[1]===major){face=y>=0?2:3;u=x/major;v=y>=0?-z/major:z/major;}
  else{face=z>=0?4:5;u=z>=0?x/major:-x/major;v=y/major;}
  const count=2**level,cell=value=>Math.max(0,Math.min(count-1,Math.floor((value+1)*.5*count)));
  return {face,level,x:cell(u),y:cell(v)};
}
export function coordinateTile(lon,lat,level){
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat< -90||lat>90)throw Error('Invalid terrain coordinates');
  const l=lon/DEG,p=lat/DEG;return directionTile([Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],level);
}
export function tileNeighbor(tile,edge){
  validate(tile,4);if(!EDGES.includes(edge))throw Error('Invalid terrain edge');
  const count=2**tile.level,epsilon=1/(count*16);let u=2*(tile.x+.5)/count-1,v=2*(tile.y+.5)/count-1;
  if(edge==='left')u=2*tile.x/count-1-epsilon;if(edge==='right')u=2*(tile.x+1)/count-1+epsilon;
  if(edge==='bottom')v=2*tile.y/count-1-epsilon;if(edge==='top')v=2*(tile.y+1)/count-1+epsilon;
  return directionTile(cube(tile.face,u,v,1),tile.level);
}
export function terrainEdgeIndices(resolution,edge,coarse=false){
  if(!EDGES.includes(edge))throw Error('Invalid terrain edge');const out=[];
  for(let k=0;k<=resolution;k+=coarse?2:1)out.push(edge==='left'?k*(resolution+1):edge==='right'?k*(resolution+1)+resolution:edge==='bottom'?k:resolution*(resolution+1)+k);
  return Uint32Array.from(out);
}
export function neighborhood(tile,radius=2){
  validate(tile,4);if(!Number.isInteger(radius)||radius<0||radius>3)throw Error('Invalid terrain neighborhood');
  const queue=[{tile,distance:0}],seen=new Set([tileKey(tile)]);
  for(let k=0;k<queue.length;k++){const item=queue[k];if(item.distance===radius)continue;for(const edge of EDGES){const next=tileNeighbor(item.tile,edge),key=tileKey(next);if(!seen.has(key)){seen.add(key);queue.push({tile:next,distance:item.distance+1});}}}
  return queue.map(q=>q.tile);
}

export function createTerrainChunkBuilder(surface,{sampleCacheLimit=65536}={}){
  if(!Number.isInteger(sampleCacheLimit)||sampleCacheLimit<1)throw Error('Invalid terrain cache limit');
  const radiusM=surface.grid.radiusKm*1000,cache=new Map();let hits=0,misses=0;
  function sample(vertex){
    let value=cache.get(vertex.key);
    if(value){hits++;cache.delete(vertex.key);cache.set(vertex.key,value);return value;}
    const d=vertex.direction,q=surface.sample(Math.atan2(d[2],d[0])*DEG,Math.asin(Math.max(-1,Math.min(1,d[1])))*DEG),h=q.fitted.groundM;
    if(!Number.isFinite(h)||radiusM+h<=0)throw Error('Invalid global fitted height');
    // Filter narrow bank slopes over a physical span, independent of tile LOD.
    const horizontal=Math.hypot(d[0],d[2]),east=horizontal?[-d[2]/horizontal,0,d[0]/horizontal]:[0,0,1],north=horizontal?[-d[1]*d[0]/horizontal,horizontal,-d[1]*d[2]/horizontal]:[-d[1],0,0],step=Math.max(.25,Math.min(3,(q.river?.widthM||1.25)*.2)),angle=step/radiusM;
    const query=v=>surface.sample(Math.atan2(v[2],v[0])*DEG,Math.asin(Math.max(-1,Math.min(1,v[1])))*DEG).fitted;
    const around=[east,north].map(axis=>[-1,1].map(sign=>query(d.map((v,k)=>v*Math.cos(angle)+axis[k]*Math.sin(angle)*sign))));
    const normalFrom=(gradient,height)=>normalize(d.map((v,k)=>v-(east[k]*gradient[0]+north[k]*gradient[1])*radiusM/(radiusM+height)));
    const normal=normalFrom(around.map(pair=>(pair[1].groundM-pair[0].groundM)/(2*step)),h),head=Number.isFinite(q.fitted.waterM)?q.fitted.waterM:Number.isFinite(q.fitted.potentialWaterM)?q.fitted.potentialWaterM:NaN,fixed=q.fitted.waterM!==null&&(q.fitted.kind==='ocean'||q.fitted.kind==='pool');
    const waterNormal=fixed||!Number.isFinite(head)?d:normalFrom(around.map(pair=>{const levels=pair.map(v=>Number.isFinite(v.waterM)?v.waterM:Number.isFinite(v.potentialWaterM)?v.potentialWaterM:head);return (levels[1]-levels[0])/(2*step);}),head);
    value={position:d.map(v=>v*(radiusM+h)),groundM:h,waterM:q.fitted.waterM===null?NaN:q.fitted.waterM,headM:head,fixed:fixed?1:0,normal,waterNormal};misses++;cache.set(vertex.key,value);
    if(cache.size>sampleCacheLimit)cache.delete(cache.keys().next().value);return value;
  }
  function build(tile,{resolution=64,coarseEdges=[]}={}){
    validate(tile,resolution);if(coarseEdges.some(e=>!EDGES.includes(e)))throw Error('Invalid coarse-neighbor edge');
    const n=resolution,vertices=(n+1)**2,positions=new Float64Array(vertices*3),elevationsM=new Float64Array(vertices),waterM=new Float64Array(vertices),headM=new Float64Array(vertices),fixed=new Uint8Array(vertices),normals=new Float32Array(vertices*3),waterNormals=new Float32Array(vertices*3),triangles=[],coarse=new Set(coarseEdges);
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const id=j*(n+1)+i,value=sample(terrainVertex(tile,n,i,j));positions.set(value.position,id*3);elevationsM[id]=value.groundM;waterM[id]=value.waterM;headM[id]=value.headM;fixed[id]=value.fixed;normals.set(value.normal,id*3);waterNormals.set(value.waterNormal,id*3);}
    // A 2x2 fan keeps every boundary segment explicit. When a neighbor is one
    // LOD coarser, skip its unmatched odd boundary vertex and stitch the strip
    // to the same coarse segment, including corners with two coarse neighbors.
    const vertex=(i,j)=>j*(n+1)+i;
    for(let y=0;y<n;y+=2)for(let x=0;x<n;x+=2){
      const ring=[[x,y],[x+1,y],[x+2,y],[x+2,y+1],[x+2,y+2],[x+1,y+2],[x,y+2],[x,y+1]].filter(([i,j])=>!(i===0&&j%2&&coarse.has('left'))&&!(i===n&&j%2&&coarse.has('right'))&&!(j===0&&i%2&&coarse.has('bottom'))&&!(j===n&&i%2&&coarse.has('top')));
      const center=vertex(x+1,y+1);for(let k=0;k<ring.length;k++)triangles.push(center,vertex(...ring[k]),vertex(...ring[(k+1)%ring.length]));
    }
    return {tile:{...tile},resolution:n,coarseEdges:[...coarse],radiusM,positions,elevationsM,waterM,headM,fixed,normals,waterNormals,indices:Uint32Array.from(triangles),stats:{vertices,triangles:triangles.length/3}};
  }
  function combine(chunks){
    const byKey=new Map(),positions=[],elevations=[],waters=[],heads=[],fixed=[],normals=[],waterNormals=[],keys=[],indices=[],boundary=new Map();let sharedVertices=0;
    for(const chunk of chunks){const n=chunk.resolution,remap=new Uint32Array(chunk.elevationsM.length);
      for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
        const id=j*(n+1)+i,key=terrainVertex(chunk.tile,n,i,j).key;let index=byKey.get(key);
        if(index===undefined){index=elevations.length;byKey.set(key,index);positions.push(...chunk.positions.subarray(id*3,id*3+3));elevations.push(chunk.elevationsM[id]);waters.push(chunk.waterM[id]);heads.push(chunk.headM[id]);fixed.push(chunk.fixed[id]);normals.push(...chunk.normals.subarray(id*3,id*3+3));waterNormals.push(...chunk.waterNormals.subarray(id*3,id*3+3));keys.push(key);}
        else{sharedVertices++;for(let k=0;k<3;k++)if(positions[index*3+k]!==chunk.positions[id*3+k])throw Error('Chunk border disagrees with the global surface');}
        remap[id]=index;
      }
      for(const edge of EDGES){const edgeIds=terrainEdgeIndices(n,edge,chunk.coarseEdges.includes(edge));for(let k=1;k<edgeIds.length;k++){const a=remap[edgeIds[k-1]],b=remap[edgeIds[k]],key=a<b?a+':'+b:b+':'+a;if(boundary.has(key))boundary.delete(key);else boundary.set(key,[a,b]);}}
      for(const i of chunk.indices)indices.push(remap[i]);
    }
    const ground={positions:Float64Array.from(positions),elevationsM:Float64Array.from(elevations),normals:Float32Array.from(normals),indices:Uint32Array.from(indices),boundaryIndices:Uint32Array.from([...boundary.values()].flat())},waterM=Float64Array.from(waters),samples={waterM,headM:Float64Array.from(heads),fixed:Uint8Array.from(fixed),waterNormals:Float32Array.from(waterNormals)},clipped=clipChunkWater(ground,samples,keys,radiusM);
    const bytes=[...Object.values(clipped.ground),...Object.values(clipped.water),waterM].reduce((sum,a)=>sum+a.byteLength,0);
    return {stage:'terrain-chunks',waterStage:'clipped',radiusM,ground:clipped.ground,water:clipped.water,waterSamplesM:waterM,standingWater:clipped.water,tiles:chunks.map(c=>({tile:c.tile,resolution:c.resolution,coarseEdges:c.coarseEdges})),stats:{chunks:chunks.length,vertices:clipped.ground.elevationsM.length,triangles:clipped.ground.indices.length/3,sharedVertices,...clipped.stats,bytes},cache:{entries:cache.size,limit:sampleCacheLimit,hits,misses}};
  }
  function patch(lon,lat,{level=12,resolution=64,radius=2}={}){
    const tiles=neighborhood(coordinateTile(lon,lat,level),radius);let mesh,n=resolution;
    do{mesh=combine(tiles.map(tile=>build(tile,{resolution:n})));if(!mesh.stats.ambiguousWaterTriangles||n>=256)break;n=Math.min(256,n*2);}while(n<=256);
    mesh.stats.resolution=n;mesh.focus={lon,lat,groundM:surface.sample(lon,lat).fitted.groundM};return mesh;
  }
  return {build,combine,patch,cacheStats:()=>({entries:cache.size,limit:sampleCacheLimit,hits,misses})};
}
export {FACES,EDGES};
