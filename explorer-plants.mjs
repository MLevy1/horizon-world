import {terrainVertex,coordinateTile,tileNeighbor,EDGES,tileKey} from './terrain-chunks.mjs?v=0.8.4';
import {direction,coordinates,frame,dot,unit,createGroundCollider} from './explorer-world.mjs?v=0.8.4';
import {rockBlocks} from './explorer-rocks.mjs?v=0.8.4';
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
export function plantHabitat(e){
 if(e.depthM>.02||e.glacier>.2||e.lava>.3||e.slope>.3||e.temperature< -5||e.elevationM>2600)return {density:0,kind:'bare'};
 const warmth=clamp((e.temperature+3)/9),moisture=clamp((e.aridity-.15)/.7),slope=1-clamp(e.slope/.3),snow=1-clamp((e.snow-.55)/.4);
 const trees=warmth*moisture*slope*snow;
 return trees>.18?{density:trees*(.48+.12*e.shore),kind:e.temperature<8||e.snow>.4?'conifer':'broadleaf'}:{density:.16*warmth*slope*snow,kind:'shrub'};
}
/** Seeded plant addresses and per-plant shape seeds survive streaming and LOD. */
export function buildPlantField({seed,lon,lat,radiusM,mesh,environment,rangeM=140}){
 const anchor=direction(lon,lat),ground=createGroundCollider(mesh.ground,anchor,radiusM),positions=[],normals=[],colors=[],indices=[],placements=[],roots=[{tile:coordinateTile(lon,lat,11),distance:0}],seen=new Set([tileKey(roots[0].tile)]),phase=hash(seed+':groves')/4294967296*6.28;
 for(let i=0;i<roots.length;i++){const item=roots[i];if(item.distance===8)continue;for(const edge of EDGES){const tile=tileNeighbor(item.tile,edge),key=tileKey(tile);if(!seen.has(key)){seen.add(key);roots.push({tile,distance:item.distance+1});}}}
 function triangle(a,b,c,color,normal){const offset=positions.length/3,n=normal||unit(cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k])));for(const p of [a,b,c]){positions.push(...p);normals.push(...n);colors.push(...color);}indices.push(offset,offset+1,offset+2);}
 for(const {tile} of roots)for(let candidate=0;candidate<5;candidate++){
  const id=tileKey(tile)+':'+candidate,rnd=random(hash(seed+':plants:'+id)),d=terrainVertex(tile,256,1+Math.floor(rnd()*254),1+Math.floor(rnd()*254)).direction,dist=Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM;if(dist>rangeM)continue;
  const ll=coordinates(d),e=environment(ll.lon,ll.lat),habitat=plantHabitat(e),grove=.5+.25*Math.sin((d[0]*.8+d[2]*.6)*radiusM/85+phase)+.25*Math.sin((d[1]*.7-d[2]*.4)*radiusM/43-phase);if(rnd()>habitat.density*(.15+grove*.95))continue;
  const h=ground(d);if(h===null||rockBlocks(mesh.rocks?.placements,d,h,radiusM))continue;
  const shape=random(hash(seed+':plant-shape:'+id)),shrub=habitat.kind==='shrub',pine=habitat.kind==='conifer',height=shrub?.65+shape()*1.5:pine?6+shape()*8:4.5+shape()*7,width=height*(pine?.21:.34),yaw=shape()*6.28,f=frame(d,yaw),origin=d.map(v=>v*(radiusM+h-.12)),leanX=(shape()-.5)*height*.10,leanZ=(shape()-.5)*height*.10,trunk=shrub?.035:.09+height*.014,tone=.8+shape()*.3,bark=[.24,.19,.13].map(v=>v*tone),leaf=(pine?[.105,.23,.125]:shrub?[.25,.32,.14]:[.17,.32,.12]).map(v=>v*tone),near=dist<70;
  const world=p=>origin.map((v,k)=>v+f.right[k]*p[0]+d[k]*p[1]+f.forward[k]*p[2]);
  function branch(a,b,r0,r1){const axis=unit(b.map((v,k)=>v-a[k])),ref=Math.abs(axis[1])>.9?[1,0,0]:[0,1,0],right=unit(cross(axis,ref)),up=cross(axis,right),sides=near?7:5;for(let j=0;j<sides;j++){const ring=(base,r,t)=>base.map((v,k)=>v+r*(right[k]*Math.cos(t)+up[k]*Math.sin(t))),t=j/sides*6.283185,u=(j+1)/sides*6.283185,p=world(ring(a,r0,t)),q=world(ring(a,r0,u)),r=world(ring(b,r1,u)),s=world(ring(b,r1,t));triangle(p,q,r,bark);triangle(p,r,s,bark);}}
  let previous=[0,0,0];for(let j=1;j<=3;j++){const t=j/3,next=[leanX*t*t,height*t*(pine?1:.82),leanZ*t*t];branch(previous,next,trunk*(1-(j-1)/3)*.85+.008,trunk*(1-t)*.85+.008);previous=next;}
  const branchCount=shrub?5:pine?13:11;
  for(let b=0;b<branchCount;b++){
   const r=random(hash(seed+':plant-branch:'+id+':'+b)),t=shrub?.18+r()*.55:pine?.24+b/branchCount*.64:.28+r()*.46,angle=r()*6.28,reach=width*(pine?(1-t)*1.6:.55+r()*.55),start=[leanX*t*t,height*t,leanZ*t*t],end=[start[0]+Math.cos(angle)*reach,start[1]+height*(pine?.025:.14+r()*.17),start[2]+Math.sin(angle)*reach];branch(start,end,trunk*(1-t)*.45+.008,.008);
   const sprays=near?(pine?6:9):5;
   for(let s=0;s<sprays;s++){
    const leafRandom=random(hash(seed+':plant-leaves:'+id+':'+b+':'+s)),fraction=.4+leafRandom()*.65,spread=width*(pine?.20:.27),at=start.map((v,k)=>v+(end[k]-v)*fraction);at[0]+=(leafRandom()-.5)*spread;at[1]+=(leafRandom()-.3)*spread;at[2]+=(leafRandom()-.5)*spread;
    const leaves=near?9:7;
    for(let l=0;l<leaves;l++){const a=leafRandom()*6.28,pitch=(leafRandom()-.5)*1.1,length=(pine?.35:.28)+leafRandom()*(shrub?.24:pine?.5:.55),leafWidth=length*(pine?.22:.42),stem=[Math.cos(a)*length,Math.sin(pitch)*length,Math.sin(a)*length],side=[-Math.sin(a)*leafWidth,0,Math.cos(a)*leafWidth],base=world(at),tip=world(at.map((v,k)=>v+stem[k])),left=world(at.map((v,k)=>v+stem[k]*.45+side[k])),right=world(at.map((v,k)=>v+stem[k]*.45-side[k])),normal=unit(d.map((v,k)=>v*.8+f.right[k]*Math.cos(a)*.2+f.forward[k]*Math.sin(a)*.2)),color=leaf.map(v=>v*(.8+leafRandom()*.4));triangle(base,left,tip,color,normal);triangle(base,tip,right,color,normal);}
   }
  }
  placements.push({id,direction:d,right:f.right,forward:f.forward,rx:trunk,rz:trunk,groundM:h,topM:h+height,heightM:height,kind:habitat.kind});
 }
 return {positions:Float64Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),indices:Uint32Array.from(indices),placements,plants:true};
}
