import {createRiverCourse} from './river-course.mjs?v=0.8.4';
import {createWaterScaffold} from './water-scaffold.mjs?v=0.8.4';
import {neighbors,cellAt} from './planet.mjs?v=0.8.4';
import {sampleRiverEdge} from './river-profiles.mjs?v=0.7.4';
import {createContactFitter,composeWaterSurface} from './water-contact.mjs?v=0.8.4';

const RAD=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
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
 * remain explicit fields, with a separate composed `fitted` surface result.
 * The 3D bucket index has no special longitude edge or polar search limit.
 */
export function createSurfaceSampler(m){
  const {grid:g,riverProfiles:p}=m,mesh=createSphereSampler(g,m.height),E=p.from.length,R=g.radiusKm*1000;
  const contacts=createContactFitter(m),waterScaffold=createWaterScaffold(m,mesh),near=new Int32Array(g.width),protection=new Int8Array(g.count).fill(-1);
  const protectedNode=i=>{if(protection[i]>=0)return !!protection[i];const n=neighbors(g,i,near);protection[i]=Number(waterScaffold.owner[i]!==-2||[...near.subarray(0,n)].some(j=>waterScaffold.owner[j]!==-2));return !!protection[i];};
  const course=createRiverCourse(m,mesh,{protectedNode});
  const B=clamp(Math.ceil(g.width/6),16,256),step=2/B,buckets=new Map(),bounds=new Float64Array(E*4);
  const bin=v=>clamp(Math.floor((v+1)/step),0,B-1),key=(x,y,z)=>x+B*(y+B*z);
  for(let e=0;e<E;e++){
    const a=mesh.directionAt(p.from[e]),b=mesh.directionAt(p.to[e]);const center=normalize(a.map((v,k)=>v+b[k]));bounds.set(center,e*4);bounds[e*4+3]=p.lengthM[e]/2+course.pads[e]+Math.max(p.widthM[p.from[e]],p.widthM[p.to[e]])*1.1+1e-6;
    const width=Math.max(p.widthM[p.from[e]],p.widthM[p.to[e]]),support=width*1.5+Math.max(1,width*.35)+course.pads[e];
    const sagitta=1-Math.sqrt(Math.max(0,(1+dot(a,b))/2)),pad=support/R+sagitta+1e-12;
    const lo=a.map((v,k)=>bin(Math.min(v,b[k])-pad)),hi=a.map((v,k)=>bin(Math.max(v,b[k])+pad));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
      const id=key(x,y,z);let bucket=buckets.get(id);if(!bucket){bucket=[];buckets.set(id,bucket);}bucket.push(e);
    }
  }
  function riverCandidates(direction,candidates=buckets.get(key(...direction.map(bin)))||[],includeOutside=false){
    const found=[];
    for(const edge of candidates){
      const frame=course.project(edge,direction,includeOutside);if(!frame)continue;
      const {t,distanceM}=frame,s=sampleRiverEdge(p,edge,t),left=frame.signedDistanceM>=0,half=left?frame.leftHalfM:frame.rightHalfM,bank=left?frame.leftBankM:frame.rightBankM;
      if(!includeOutside&&distanceM>half+bank+1e-6)continue;
      const insideChannel=distanceM<=half;
      const freeboardM=p.freeboardM[p.from[edge]]+(p.freeboardM[p.to[edge]]-p.freeboardM[p.from[edge]])*t;
      found.push({...frame,edge,t,distanceM,waterM:s.waterM,bedM:s.bedM,widthM:frame.widthM,designDepthM:s.designDepthM,freeboardM,
        wet:s.wet,insideChannel,designBedM:insideChannel?s.waterM-(s.waterM-s.bedM)*(1-(distanceM/half)**(left?frame.leftExponent:frame.rightExponent)):null});
    }
    return found;
  }
  function nearest(rivers){return rivers.sort((a,b)=>Math.abs(a.distanceM-b.distanceM)>1e-7?a.distanceM-b.distanceM:Number(b.wet)-Number(a.wet)||a.edge-b.edge)[0]||null;}
  function sample(lon,lat){
    const q=mesh.locate(lon,lat),geometry=waterScaffold.interpolate(q),planes=geometry.planes;let standingWater=null;
    for(const p of planes.values())if(geometry.terrainM<p.waterM&&(!standingWater||p.waterM>standingWater.waterM))standingWater={kind:p.kind,id:p.id,waterM:p.waterM,depthM:p.waterM-geometry.terrainM};
    const rivers=riverCandidates(q.direction),plane=standingWater?planes.get(standingWater.id):[...planes.values()].sort((a,b)=>b.support-a.support)[0]||null;
    const fitted=composeWaterSurface(geometry.terrainM,plane,rivers.map(contacts.fit));
    return {lon:q.lon,lat:q.lat,terrainM:q.terrainM,triangle:{cells:q.cells,weights:q.weights},standingWater,waterPlane:plane?{id:plane.id,waterM:plane.waterM,kind:plane.kind}:null,river:nearest(rivers),fitted};
  }
  // Conservative index query for a complete minor arc, including corridor support.
  function shoreArc(a,b){
    const sagitta=1-Math.sqrt(Math.max(0,(1+dot(a,b))/2)),ids=new Set();
    const lo=a.map((v,k)=>bin(Math.min(v,b[k])-sagitta-1e-12)),hi=a.map((v,k)=>bin(Math.max(v,b[k])+sagitta+1e-12));
    for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(const e of buckets.get(key(x,y,z))||[])ids.add(e);
    const edges=[...ids];
    return {edges,clearance(direction){
      let margin=Infinity;
      for(const edge of edges){
        const center=bounds.subarray(edge*4,edge*4+3),bound=R*Math.atan2(Math.hypot(...cross(direction,center)),clamp(dot(direction,center),-1,1))-bounds[edge*4+3];
        if(bound>0){margin=Math.min(margin,bound);continue;}
        const r=riverCandidates(direction,[edge],true)[0];if(r)margin=Math.min(margin,(r.distanceM-(r.signedDistanceM>=0?r.leftHalfM:r.rightHalfM))/(course.protectedEdges[edge]?1+2*Math.abs(p.widthM[p.from[edge]]-p.widthM[p.to[edge]])/Math.max(1e-9,p.lengthM[edge]):4+8*Math.max(p.widthM[p.from[edge]],p.widthM[p.to[edge]])/Math.max(1e-9,p.lengthM[edge])));
      }
      return margin;
    }};
  }
  return {sample,mesh,grid:g,contacts,course,shoreArc,waterScaffold,channelsAtDirection(direction){return riverCandidates(normalize(direction));},riverAtDirection(direction){return nearest(riverCandidates(normalize(direction)));},
    stats:{globalEdges:E,buckets:buckets.size,indexResolution:B,scaffoldCells:g.count,...contacts.stats,...waterScaffold.stats}};
}
