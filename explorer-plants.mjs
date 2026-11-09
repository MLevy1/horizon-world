import {crownLobes} from './forest-structure.mjs?v=0.9.18';
import {landHabitat} from './explorer-ecology.mjs?v=0.9.18';
import {terrainVertex,coordinateTile,tileNeighbor,EDGES,tileKey} from './terrain-chunks.mjs?v=0.9.18';
import {direction,coordinates,frame,dot,unit,createGroundCollider} from './explorer-world.mjs?v=0.9.18';
import {rockBlocks} from './explorer-rocks.mjs?v=0.9.18';
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
export function plantHabitat(e){
 if(e.soilDepthM<.06||e.talus>.2||e.depthM>.02||e.glacier>.2||e.lava>.3||e.slope>.3||e.temperature< -5||e.elevationM>2600)return {density:0,kind:'bare'};
 const eco=landHabitat(e);if(eco.trees==='bare')return {density:0,kind:'bare'};if(eco.trees==='mangrove')return {density:.48,kind:'mangrove'};if(eco.trees==='shrub')return {density:eco.treeFactor,kind:'shrub'};
 const warmth=clamp((e.temperature+3)/9),moisture=clamp((e.aridity-.15)/.7),slope=1-clamp(e.slope/.3),snow=1-clamp((e.snow-.55)/.4),trees=warmth*moisture*slope*snow*eco.treeFactor;
 return trees>.18?{density:trees*(.78+.15*e.shore),kind:eco.trees}:{density:.08*warmth*slope*snow,kind:'shrub'};
}
/** Canonical addresses and shapes shared by detailed trees and distant stand-ins. */
export function plantAddress(seed,tile,candidate){const id=tileKey(tile)+':'+candidate,rnd=random(hash(seed+':plants:'+id)),d=terrainVertex(tile,256,1+Math.floor(rnd()*254),1+Math.floor(rnd()*254)).direction;return {id,direction:d,roll:rnd()};}
export function plantGrove(seed,d,R){const phase=hash(seed+':groves')/4294967296*6.28;return .5+.25*Math.sin((d[0]*.8+d[2]*.6)*R/85+phase)+.25*Math.sin((d[1]*.7-d[2]*.4)*R/43-phase);}
export function plantShape(seed,id,kind){
 const shape=random(hash(seed+':plant-shape:'+id));
 const mangrove=kind==='mangrove',tropical=kind==='tropical',understory=kind==='tropical-understory';
 const shrub=kind==='shrub'||understory,pine=kind==='conifer';
 const size=shape();
 let height=mangrove?3+size*4:shrub?.6+size*1.2:pine?12+size*12:14+size*12;
 let widthFactor=mangrove?.65:shrub?.9:pine?.26:.46;
 if(tropical){
  // One seeded size distribution feeds both the crown and woody geometry.
  if(size<.22)height=7+size/.22*8;
  else if(size>.9)height=30+(size-.9)*120;
  else height=16+(size-.22)/.68*14;
  widthFactor=.37+.18*shape();
 }
 if(understory){
  height=1.4+size*3;
  widthFactor=.63;
 }
 const width=height*widthFactor,yaw=shape()*6.28;
 const leanX=(shape()-.5)*height*(tropical?.24:.14);
 const leanZ=(shape()-.5)*height*(tropical?.24:.14);
 const trunk=shrub?(understory?.045+height*.02:.055):.18+height*.018;
 const tone=tropical?.72+shape()*.56:.8+shape()*.3;
 return {mangrove,tropical,shrub,pine,height,width,yaw,leanX,leanZ,trunk,tone};
}
/** Seeded plant addresses and per-plant shape seeds survive streaming and LOD. */
export function buildPlantField({seed,lon,lat,radiusM,mesh,environment,rangeM=140,collider=null,treeRecord=null,waterCollider=null,cameraHeightM=null}){
 let cachedGround=null;const anchor=direction(lon,lat),ground=collider||((d)=>{cachedGround ||= createGroundCollider(mesh.ground,anchor,radiusM);return cachedGround(d);}),positions=[],normals=[],colors=[],indices=[],placements=[],foliage=[],shade=[],canopies=[],treeLOD=[],roots=[{tile:coordinateTile(lon,lat,11),distance:0}],seen=new Set([tileKey(roots[0].tile)]),phase=hash(seed+':groves')/4294967296*6.28;
 for(let i=0;i<roots.length;i++){const item=roots[i];if(item.distance===8)continue;for(const edge of EDGES){const tile=tileNeighbor(item.tile,edge),key=tileKey(tile);if(!seen.has(key)){seen.add(key);roots.push({tile,distance:item.distance+1});}}}
 let treeMeta=[0,0,0,0];
 function triangle(a,b,c,color,normal){const offset=positions.length/3,n=normal||unit(cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])));for(const p of [a,b,c]){positions.push(...p);normals.push(...n);colors.push(...color);foliage.push(0,0,0);shade.push(.8);treeLOD.push(...treeMeta);}indices.push(offset,offset+1,offset+2);}
 for(const {tile} of roots)for(let candidate=0;candidate<48;candidate++){
  const address=plantAddress(seed,tile,candidate),id=address.id,d=address.direction,dist=Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM;if(dist>rangeM)continue;
  const ll=coordinates(d),e=environment(ll.lon,ll.lat),habitat=plantHabitat(e),grove=plantGrove(seed,d,radiusM);if(candidate>=32){
   if(habitat.kind==='bare'||habitat.kind==='shrub')continue;
   if(habitat.kind==='tropical'){
    habitat.kind='tropical-understory';
    habitat.density=Math.min(1,habitat.density*1.35);
   }else{
    habitat.kind='shrub';
    habitat.density*=.6;
   }
  }if(address.roll>habitat.density*(.15+grove*.95))continue;
  if(treeRecord&&habitat.kind!=='shrub'&&habitat.kind!=='tropical-understory'&&!treeRecord(address))continue;
  const h=ground(d);if(h===null||waterCollider&&(waterCollider(d)??-Infinity)>h+.03||rockBlocks(mesh.rocks?.placements,d,h,radiusM))continue;
  if(cameraHeightM!==null&&Math.hypot(dist,h-cameraHeightM)>290)continue;
  const {mangrove,tropical,shrub,pine,height,width,yaw,leanX,leanZ,trunk,tone}=plantShape(seed,id,habitat.kind),f=frame(d,yaw),origin=d.map(v=>v*(radiusM+h-.12)),bark=[.24,.19,.13].map(v=>v*tone),leaf=(pine?[.105,.23,.125]:shrub?[.25,.32,.14]:[.17,.32,.12]).map(v=>v*tone),near=dist<40;
  treeMeta=[...origin,(hash(id+':lod')>>>0)/4294967296];
  const world=p=>origin.map((v,k)=>v+f.right[k]*p[0]+d[k]*p[1]+f.forward[k]*p[2]);
  function branch(a,b,r0,r1){const axis=unit(b.map((v,k)=>v-a[k])),ref=Math.abs(axis[1])>.9?[1,0,0]:[0,1,0],right=unit(cross(axis,ref)),up=cross(axis,right),sides=near?7:5;for(let j=0;j<sides;j++){const ring=(base,r,t)=>base.map((v,k)=>v+r*(right[k]*Math.cos(t)+up[k]*Math.sin(t))),t=j/sides*6.283185,u=(j+1)/sides*6.283185,p=world(ring(a,r0,t)),q=world(ring(a,r0,u)),r=world(ring(b,r1,u)),s=world(ring(b,r1,t));triangle(p,q,r,bark);triangle(p,r,s,bark);}}
  if(mangrove){for(let root=0;root<5;root++){const a=root/5*6.283;branch([0,height*.24,0],[Math.cos(a)*width*.65,-.15,Math.sin(a)*width*.65],trunk*.28,.025);}}
  let previous=[0,0,0];for(let j=1;j<=3;j++){const t=j/3,next=[leanX*t*t,height*t*(pine?1:.82),leanZ*t*t];branch(previous,next,trunk*(1-(j-1)/3)*.85+.008,trunk*(1-t)*.85+.008);previous=next;}
  if(shrub){
  const branchCount=habitat.kind==='tropical-understory'?4:5;
  for(let b=0;b<branchCount;b++){
   const r=random(hash(seed+':plant-branch:'+id+':'+b)),t=shrub?.18+r()*.55:pine?.18+Math.floor(b/3)/(branchCount/3)*.70:.25+r()*.40,angle=pine?(b%3)*2.094+t*4+r()*.3:r()*6.28,reach=width*(pine?(1-t)*1.6:.55+r()*.55),start=[leanX*t*t,height*t,leanZ*t*t],end=[start[0]+Math.cos(angle)*reach,start[1]+height*(pine?.025:.17+r()*.18),start[2]+Math.sin(angle)*reach];branch(start,end,trunk*(1-t)*.45+.008,.008);
   const sprays=habitat.kind==='tropical-understory'?3:near?5:3;
   for(let s=0;s<sprays;s++){
    const cr=random(hash(seed+':crown:'+id+':'+b+':'+s)),fraction=pine?.25+cr()*.75:.55+cr()*.6,at=start.map((v,k)=>v+(end[k]-v)*fraction),a=cr()*6.28,tilt=(cr()-.5)*1.8,size=width*(shrub?.8:pine?.65:.75)*(0.75+cr()*.5),right=[Math.cos(a),0,Math.sin(a)],up=[-Math.sin(a)*Math.sin(tilt),Math.cos(tilt),Math.cos(a)*Math.sin(tilt)],n=unit(d.map((v,k)=>v*.65+f.right[k]*Math.sin(a)*.2+f.forward[k]*Math.cos(a)*.2)),corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>world(at.map((v,k)=>v+right[k]*x*size*.5+up[k]*y*size*.5))),uvs=pine?[[.75,1],[1,1],[1,0],[.75,0]]:[[0,1],[1,1],[1,0],[0,0]],color=(pine?[.90,1,.82]:[.78,.86,.67]).map(v=>v*(.82+cr()*.25));
    for(const face of [[0,1,2],[0,2,3]]){const offset=positions.length/3;for(const i of face){positions.push(...corners[i]);normals.push(...n);colors.push(...color);foliage.push(...uvs[i],pine?3:1);shade.push(.85);treeLOD.push(...treeMeta);}indices.push(offset,offset+1,offset+2);}
   }
  }
  }else{
   for(const [index,crown] of crownLobes(habitat.kind).entries()){
    const variation=hash(id+':branch-base:'+index)/4294967296;
    const base=tropical?.48+.23*variation:.45;
    const trunkFraction=base/.82;
    const start=tropical?[leanX*trunkFraction**2,height*base,leanZ*trunkFraction**2]:[0,height*base,0];
    const end=[crown.x*width+leanX*crown.y,crown.y*height,crown.z*width+leanZ*crown.y];
    branch(start,end,trunk*.3,.015);
   }
  }
  canopies.push({direction:d,heightM:height*.67,radiusM:width*.95});

  placements.push({id,direction:d,right:f.right,forward:f.forward,rx:trunk,rz:trunk,groundM:h,topM:h+height,heightM:height,kind:habitat.kind});
 }
 return {positions:Float64Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),indices:Uint32Array.from(indices),foliage:Float32Array.from(foliage),shade:Float32Array.from(shade),treeLOD:Float32Array.from(treeLOD),canopies,placements,plants:true,nearPlants:true};
}

/** Broad canopy occlusion and leaf-litter influence, not a full shadow map. */
export function applyCanopyLighting(mesh){
 const R=mesh.radiusM,f=frame(mesh.anchor),bins=new Map(),size=24,xy=d=>[dot(d,f.east)*R,dot(d,f.north)*R],add=(x,z,c)=>{const key=x+':'+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(c);};
 for(const c of mesh.plants.canopies){const [x,z]=xy(c.direction),sx=x-c.heightM*.4375,sz=z-c.heightM*.625,r=c.radiusM*2.2,record={x,z,sx,sz,r:c.radiusM};for(let a=Math.floor((Math.min(x,sx)-r)/size);a<=Math.floor((Math.max(x,sx)+r)/size);a++)for(let b=Math.floor((Math.min(z,sz)-r)/size);b<=Math.floor((Math.max(z,sz)+r)/size);b++)add(a,b,record);}
 for(const data of [mesh.ground,mesh.rocks]){data.shade=new Float32Array(data.positions.length/3).fill(1);data.forest=new Float32Array(data.positions.length/3);for(let i=0;i<data.shade.length;i++){const d=unit(Array.from(data.positions.subarray(i*3,i*3+3))),[x,z]=xy(d);let cover=0,shadow=0;for(const c of bins.get(Math.floor(x/size)+':'+Math.floor(z/size))||[]){const a=((x-c.x)**2+(z-c.z)**2)/(c.r*c.r),b=((x-c.sx)**2+(z-c.sz)**2)/(c.r*c.r*1.3);cover+=Math.max(0,1-a/4);shadow+=Math.max(0,1-b);}const dapple=.8+.2*Math.sin(d[0]*R*2.3+d[2]*R*1.7)*Math.cos(d[1]*R*2.9-d[2]*R*.8);data.shade[i]=1-.65*(1-Math.exp(-shadow*1.2))*dapple;data.forest[i]=data===mesh.ground?1-Math.exp(-cover):0;}}
}
