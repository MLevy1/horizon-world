import {neighbors,cellAt,lonLat} from './planet.mjs?v=0.7.6';
import {sampleRiverEdge} from './river-profiles.mjs?v=0.7.4';

const RAD=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const normalize=a=>{const d=Math.hypot(...a);if(!(d>0&&Number.isFinite(d)))throw Error('Invalid surface direction');return a.map(v=>v/d);};

/** One triangulated spherical scaffold, with compact row/longitude caches.
 * Ray/triangle projective weights agree on shared edges, the seam and caps.
 * Interpolation is of radial elevation, not a second terrain/noise generator.
 */
export function createSphereSampler(grid,height){
  const g=grid,w=g.width,h=g.height,near=new Int32Array(w);
  const sinLat=new Float64Array(h),cosLat=new Float64Array(h),sinLon=[new Float64Array(w),new Float64Array(w)],cosLon=[new Float64Array(w),new Float64Array(w)];
  for(let y=0;y<h;y++){const p=Math.PI/2-(y+.5)*Math.PI/h;sinLat[y]=Math.sin(p);cosLat[y]=Math.cos(p);}
  for(let parity=0;parity<2;parity++)for(let x=0;x<w;x++){const l=(x+.5+parity*.5)/w*Math.PI*2-Math.PI;sinLon[parity][x]=Math.sin(l);cosLon[parity][x]=Math.cos(l);}
  function directionAt(i){
    if(i===g.north)return [0,1,0];if(i===g.south)return [0,-1,0];
    const y=(i/w)|0,x=i%w;return [cosLat[y]*cosLon[y&1][x],sinLat[y],cosLat[y]*sinLon[y&1][x]];
  }
  function face(p,a,b,c){
    const A=directionAt(a),B=directionAt(b),C=directionAt(c),bc=cross(B,C),det=dot(A,bc);
    const wa=dot(p,bc),wb=dot(A,cross(p,C)),wc=dot(A,cross(B,p)),sum=wa+wb+wc;
    if(!(sum*det>0))return null;
    const weights=[wa/sum,wb/sum,wc/sum];if(weights.some(v=>v< -1e-8||v>1+1e-8))return null;
    for(let k=0;k<3;k++)weights[k]=Math.max(0,weights[k]);
    const total=weights.reduce((s,v)=>s+v,0);for(let k=0;k<3;k++)weights[k]/=total;
    for(let k=0;k<3;k++)if(weights[k]>1-1e-10){weights.fill(0);weights[k]=1;break;}
    const cells=[a,b,c],terrainM=cells.reduce((s,i,k)=>s+height[i]*weights[k],0);
    return {cells,weights,terrainM};
  }
  function fan(p,i){
    const n=neighbors(g,i,near),ids=[...near.subarray(0,n)];
    let ring;
    if(i>=g.north)ring=ids;
    else{const y=(i/w)|0;ring=(y===0?[0,2,1,4,3]:y===h-1?[0,2,3,1,4]:[0,2,3,1,5,4]).map(k=>ids[k]);}
    for(let k=0;k<ring.length;k++){const found=face(p,i,ring[k],ring[(k+1)%ring.length]);if(found)return found;}
    return null;
  }
  function locate(lon,lat){
    if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat< -90||lat>90)throw Error('Invalid surface coordinates');
    lon=((lon+180)%360+360)%360-180;
    if(Math.abs(lat)===90){const i=lat>0?g.north:g.south;return {cells:[i,i,i],weights:[1,0,0],terrainM:height[i],direction:directionAt(i),lon,lat};}
    const l=lon*RAD,p=lat*RAD,direction=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],i=cellAt(g,lon,lat);
    let found=fan(direction,i);
    if(!found){const n=neighbors(g,i,near),ids=[...near.subarray(0,n)];for(const j of ids){found=fan(direction,j);if(found)break;}}
    if(!found)throw Error('No spherical triangle contains the surface query');
    return {...found,direction,lon,lat};
  }
  return {directionAt,locate,sampleDirection(direction){
    const p=normalize(direction);return locate(Math.atan2(p[2],p[0])/RAD,Math.asin(clamp(p[1],-1,1))/RAD);
  }};
}

/** Read-only global surface query. Terrain, standing water and channel design
 * remain explicit fields; fitting/meshing their shoreline transitions is 3b.
 * The 3D bucket index has no special longitude edge or polar search limit.
 */
export function createSurfaceSampler(m){
  const {grid:g,riverProfiles:p}=m,mesh=createSphereSampler(g,m.height),E=p.from.length,R=g.radiusKm*1000;
  const B=clamp(Math.ceil(g.width/6),16,256),step=2/B,buckets=new Map(),xyz=new Float64Array(E*6);
  const bin=v=>clamp(Math.floor((v+1)/step),0,B-1),key=(x,y,z)=>x+B*(y+B*z);
  for(let e=0;e<E;e++){
    const a=mesh.directionAt(p.from[e]),b=mesh.directionAt(p.to[e]);xyz.set(a,e*6);xyz.set(b,e*6+3);
    const width=Math.max(p.widthM[p.from[e]],p.widthM[p.to[e]]),support=width/2+Math.max(1,width*.35);
    const sagitta=1-Math.sqrt(Math.max(0,(1+dot(a,b))/2)),pad=support/R+sagitta+1e-12;
    const lo=a.map((v,k)=>bin(Math.min(v,b[k])-pad)),hi=a.map((v,k)=>bin(Math.max(v,b[k])+pad));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
      const id=key(x,y,z);let bucket=buckets.get(id);if(!bucket){bucket=[];buckets.set(id,bucket);}bucket.push(e);
    }
  }
  function riverAt(direction){
    const candidates=buckets.get(key(...direction.map(bin)))||[];let best=null;
    for(const edge of candidates){
      const a=[xyz[edge*6],xyz[edge*6+1],xyz[edge*6+2]],b=[xyz[edge*6+3],xyz[edge*6+4],xyz[edge*6+5]],normal=cross(a,b);
      const sa=dot(cross(a,subtract(direction,a)),normal),sb=dot(cross(subtract(direction,b),b),normal);
      let t=sa>=0&&sb>=0&&sa+sb>0?clamp(sa/(sa+sb),0,1):dot(direction,a)>=dot(direction,b)?0:1;
      if(t<1e-9)t=0;else if(t>1-1e-9)t=1;
      const closest=normalize(a.map((v,k)=>v+(b[k]-v)*t));
      const distanceM=R*Math.atan2(Math.hypot(...cross(direction,closest)),clamp(dot(direction,closest),-1,1));
      const s=sampleRiverEdge(p,edge,t),support=s.widthM/2+Math.max(1,s.widthM*.35);
      if(distanceM>support+1e-6)continue;
      if(best&&(distanceM>best.distanceM+1e-7||(Math.abs(distanceM-best.distanceM)<=1e-7&&((best.wet&&!s.wet)||(best.wet===s.wet&&edge>best.edge)))))continue;
      const insideChannel=distanceM<=s.widthM/2;
      const freeboardM=p.freeboardM[p.from[edge]]+(p.freeboardM[p.to[edge]]-p.freeboardM[p.from[edge]])*t;
      best={edge,t,distanceM,waterM:s.waterM,bedM:s.bedM,widthM:s.widthM,designDepthM:s.designDepthM,freeboardM,
        wet:s.wet,insideChannel,designBedM:insideChannel?s.waterM-(s.waterM-s.bedM)*(1-(distanceM/(s.widthM/2))**2):null};
    }
    return best;
  }
  function sample(lon,lat){
    const q=mesh.locate(lon,lat);let standingWater=null;
    for(let k=0;k<3;k++){
      if(q.weights[k]<1e-10)continue;
      const i=q.cells[k],id=m.waterbody[i];
      const level=m.ocean[i]?0:id>=0&&m.height[i]<m.waterbodies[id].waterLevelM?m.waterbodies[id].waterLevelM:null;
      if(level===null||q.terrainM>=level)continue;
      if(!standingWater||level>standingWater.waterM)standingWater={kind:m.ocean[i]?'ocean':'pool',id:m.ocean[i]?-1:id,waterM:level,depthM:level-q.terrainM};
    }
    return {lon:q.lon,lat:q.lat,terrainM:q.terrainM,triangle:{cells:q.cells,weights:q.weights},standingWater,river:riverAt(q.direction)};
  }
  return {sample,mesh,riverAtDirection(direction){return riverAt(normalize(direction));},
    stats:{globalEdges:E,buckets:buckets.size,indexResolution:B,scaffoldCells:g.count}};
}
