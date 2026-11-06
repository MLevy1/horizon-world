import {terrainVertex,coordinateTile,tileNeighbor,EDGES,tileKey} from './terrain-chunks.mjs?v=0.8.7';
import {direction,coordinates,frame,unit,createGroundCollider} from './explorer-world.mjs?v=0.8.7';
import {rockBlocks} from './explorer-rocks.mjs?v=0.8.7';
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Bare climates retain mineral structure; living cover follows moisture and thaw. */
export function groundHabitat(e){
 if(e.depthM>.03)return {kind:'water',density:0};
 if(e.glacier>.5||e.snow>.72)return {kind:'snow',density:.18};
 if(e.lava>.25)return {kind:'rubble',density:.7};
 if(e.slope>.32)return {kind:'scree',density:.65};
 if(e.shore>.25)return {kind:'bank',density:.85};
 if(e.temperature< -4)return {kind:'tundra',density:.3};
 if(e.aridity<.4)return {kind:'desert',density:.32};
 return {kind:'woodland',density:.9};
}
/** Stable addresses, one merged draw batch, bounded geometry and no new collision obstacles.
 * Ground hits use the displayed terrain, so details sit on its actual triangles. */
export function buildGroundField({seed,lon,lat,radiusM,mesh,environment,rangeM=72}){
 const anchor=direction(lon,lat),ground=createGroundCollider(mesh.ground,anchor,radiusM),positions=[],normals=[],colors=[],indices=[],shade=[],placements=[],roots=[{tile:coordinateTile(lon,lat,11),distance:0}],seen=new Set([tileKey(roots[0].tile)]);
 for(let i=0;i<roots.length;i++){const item=roots[i];if(item.distance===5)continue;for(const edge of EDGES){const tile=tileNeighbor(item.tile,edge),key=tileKey(tile);if(!seen.has(key)){seen.add(key);roots.push({tile,distance:item.distance+1});}}}
 const habitats=new Map();
 for(const {tile} of roots){
  // Climate samples are shared within ~8 m subcells; each placement still checks water.
  for(let candidate=0;candidate<460;candidate++){
   const id=tileKey(tile)+':'+candidate,r=random(hash(seed+':ground:'+id)),ix=1+Math.floor(r()*254),iy=1+Math.floor(r()*254),d=terrainVertex(tile,256,ix,iy).direction,dist=Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM;if(dist>rangeM)continue;
   const key=tileKey(tile)+':'+(ix>>6)+':'+(iy>>6);let e=habitats.get(key);if(!e){const ll=coordinates(terrainVertex(tile,256,(ix>>6)*64+32,(iy>>6)*64+32).direction);e=environment(ll.lon,ll.lat);habitats.set(key,e);}
   const habitat=groundHabitat(e),patch=.5+.25*Math.sin(d[0]*radiusM/7+d[2]*radiusM/11)+.25*Math.cos(d[1]*radiusM/9-d[2]*radiusM/13);if(r()>habitat.density*(.18+.82*patch))continue;
   const ll=coordinates(d),local=environment(ll.lon,ll.lat);if(local.depthM>.03||groundHabitat(local).kind!==habitat.kind)continue;
   const h=ground(d);if(h===null||rockBlocks(mesh.rocks?.placements,d,h,radiusM))continue;
   const f=frame(d,r()*6.283),origin=d.map(v=>v*(radiusM+h-.025)),kind=habitat.kind,tone=.72+r()*.5;
   const world=p=>origin.map((v,k)=>v+f.right[k]*p[0]+d[k]*p[1]+f.forward[k]*p[2]);
   function tri(a,b,c,color){const pts=[a,b,c].map(world),n=unit(cross(pts[1].map((v,k)=>v-pts[0][k]),pts[2].map((v,k)=>v-pts[0][k]))),i=positions.length/3;for(const p of pts){positions.push(...p);normals.push(...n);colors.push(...color.map(v=>v*tone));shade.push(kind==='woodland'?.72:1);}indices.push(i,i+1,i+2);}
   function stone(x,z,size){const top=[x+size*.12,size*.65,z-size*.1],base=[[x-size,0,z-size*.6],[x+size*.8,0,z-size*.8],[x+size,0,z+size*.5],[x-size*.7,0,z+size*.8]],color=kind==='snow'?[.39,.42,.43]:kind==='rubble'?[.19,.175,.16]:kind==='desert'?[.55,.44,.30]:[.38,.37,.31];for(let j=0;j<4;j++)tri(base[j],base[(j+1)%4],top,color);}
   function stem(a,b,width,color){const side=[width,0,width*.3];tri(a.map((v,k)=>v-side[k]),a.map((v,k)=>v+side[k]),b.map((v,k)=>v+side[k]*.5),color);tri(a.map((v,k)=>v-side[k]),b.map((v,k)=>v+side[k]*.5),b.map((v,k)=>v-side[k]*.5),color);}
   const pick=r();let form;
   if(['snow','rubble','scree'].includes(kind)||pick<.19){form='stones';for(let j=0;j<3;j++)stone((r()-.5)*1.4,(r()-.5)*1.4,.07+r()**2*(kind==='rubble'?.65:.27));}
   else if((kind==='woodland'&&pick<.32)||(kind==='bank'&&pick<.35)){form='deadwood';const length=.5+r()*2.4,thick=.025+r()*.07,bark=[.27,.20,.12];stem([-length/2,.05,0],[length/2,.08,.2],thick,bark);stem([0,.07,.1],[length*.2,.09,.55],thick*.45,bark);}
   else if(kind==='woodland'&&pick<.74){form='fern';const size=.55+r()*.95;for(let j=0;j<5;j++){const a=j*1.256+r()*.3,dx=Math.cos(a),dz=Math.sin(a);for(let k=1;k<4;k++){const t=k/4,at=[dx*size*t,Math.sin(t*2.3)*size*.65,dz*size*t],tip=[dx*size*(t+.3),Math.sin((t+.2)*2.3)*size*.65,dz*size*(t+.3)],w=size*(1-t)*.32;for(const sign of [-1,1])tri(at,[at[0]-dz*w*sign,at[1]+.025,at[2]+dx*w*sign],tip,[.19,.30,.085]);}}}
   else {form=kind==='bank'?'reeds':kind==='desert'?'scrub':'grass';const dry=kind==='desert'||kind==='tundra',color=dry?[.43,.40,.21]:[.25,.34,.10],height=kind==='bank'?.65+r()*.65:dry?.18+r()*.35:.22+r()*.45;for(let j=0;j<7;j++){const a=r()*6.28,x=(r()-.5)*1.2,z=(r()-.5)*1.2,w=.025+r()*.035;tri([x-w,0,z],[x+w,0,z],[x+Math.cos(a)*height*.4,height,z+Math.sin(a)*height*.4],color);if(kind==='bank')stem([x,height*.4,z],[x,height*1.15,z],.012,[.40,.33,.16]);}}
   placements.push({id,direction:d,groundM:h,kind,form});
  }
 }
 return {positions:Float64Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),indices:Uint32Array.from(indices),shade:Float32Array.from(shade),placements,plants:true};
}
