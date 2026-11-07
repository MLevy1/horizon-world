import {landHabitat} from './explorer-ecology.mjs?v=0.9.9';
import {terrainVertex,coordinateTile,tileNeighbor,EDGES,tileKey} from './terrain-chunks.mjs?v=0.9.9';
import {direction,coordinates,frame,unit,createGroundCollider} from './explorer-world.mjs?v=0.9.9';
import {rockBlocks} from './explorer-rocks.mjs?v=0.9.9';
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Bare climates retain mineral structure; living cover follows moisture and thaw. */
export function groundHabitat(e){
 if(e.depthM>.03)return {kind:'water',density:0};
 if(e.talus>.2)return {kind:'scree',density:.85};
 const habitat=landHabitat(e);return {kind:habitat.ground,density:habitat.density};
}
/** Stable addresses, one merged draw batch, bounded geometry and no new collision obstacles.
 * Ground hits use the displayed terrain, so details sit on its actual triangles. */
export function buildGroundField({seed,lon,lat,radiusM,mesh,environment,rangeM=72,tiles=null,collider=null}){
 const anchor=direction(lon,lat),ground=collider||createGroundCollider(mesh.ground,anchor,radiusM),positions=[],normals=[],colors=[],indices=[],foliage=[],shade=[],placements=[],roots=tiles?tiles.map(tile=>({tile,distance:5})):[{tile:coordinateTile(lon,lat,11),distance:0}],seen=new Set(roots.map(r=>tileKey(r.tile)));
 for(let i=0;i<roots.length;i++){const item=roots[i];if(item.distance===5)continue;for(const edge of EDGES){const tile=tileNeighbor(item.tile,edge),key=tileKey(tile);if(!seen.has(key)){seen.add(key);roots.push({tile,distance:item.distance+1});}}}
 const habitats=new Map();
 for(const {tile} of roots){
  // Climate samples are shared within ~8 m subcells; each placement still checks water.
  for(let candidate=0;candidate<460;candidate++){
   const id=tileKey(tile)+':'+candidate,r=random(hash(seed+':ground:'+id)),ix=1+Math.floor(r()*254),iy=1+Math.floor(r()*254),d=terrainVertex(tile,256,ix,iy).direction,dist=Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM;if(!tiles&&dist>rangeM)continue;
   const key=tileKey(tile)+':'+(ix>>6)+':'+(iy>>6);let e=habitats.get(key);if(!e){const ll=coordinates(terrainVertex(tile,256,(ix>>6)*64+32,(iy>>6)*64+32).direction);e=environment(ll.lon,ll.lat);habitats.set(key,e);}
   const habitat=groundHabitat(e),patch=.5+.25*Math.sin(d[0]*radiusM/7+d[2]*radiusM/11)+.25*Math.cos(d[1]*radiusM/9-d[2]*radiusM/13);if(r()>habitat.density*(.18+.82*patch))continue;
   const ll=coordinates(d),local=environment(ll.lon,ll.lat);if(local.depthM>.03||groundHabitat(local).kind!==habitat.kind)continue;
   const h=ground(d);if(h===null||rockBlocks(mesh.rocks?.placements,d,h,radiusM))continue;
   const f=frame(d,r()*6.283),origin=d.map(v=>v*(radiusM+h-.025)),kind=habitat.kind,tone=.72+r()*.5;
   const bases=new Map();
   const world=p=>{const key=p[0]+':'+p[2];let base=bases.get(key);if(!base){const lateral=origin.map((v,k)=>v+f.right[k]*p[0]+f.forward[k]*p[2]),at=unit(lateral),height=ground(at);if(height===null)return null;base=at.map(v=>v*(radiusM+height-.055));bases.set(key,base);}return base.map((v,k)=>v+d[k]*p[1]);};
   function tri(a,b,c,color){const pts=[a,b,c].map(world);if(pts.some(p=>!p))return;const n=unit(cross(pts[1].map((v,k)=>v-pts[0][k]),pts[2].map((v,k)=>v-pts[0][k]))),i=positions.length/3;for(const p of pts){positions.push(...p);normals.push(...n);colors.push(...color.map(v=>v*tone));foliage.push(0,0,0);shade.push(kind==='woodland'?.88:1);}indices.push(i,i+1,i+2);}
   function stone(x,z,size){const color=kind==='snow'?[.39,.42,.43]:kind==='rubble'?[.23,.21,.18]:kind==='desert'?[.57,.46,.32]:[.38,.37,.31],sides=7,ring=Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2,warp=.8+r()*.35;return [x+Math.cos(a)*size*warp,size*(.18+r()*.15),z+Math.sin(a)*size*.7*warp];}),top=[x+size*.1,size*.65,z-size*.12];for(let j=0;j<sides;j++){const next=(j+1)%sides,base=[ring[j][0],-.03,ring[j][2]],baseNext=[ring[next][0],-.03,ring[next][2]];tri(ring[j],ring[next],top,color);tri(base,baseNext,ring[next],color);tri(base,ring[next],ring[j],color);}}

   function stem(a,b,width,color){const side=[width,0,width*.3];tri(a.map((v,k)=>v-side[k]),a.map((v,k)=>v+side[k]),b.map((v,k)=>v+side[k]*.5),color);tri(a.map((v,k)=>v-side[k]),b.map((v,k)=>v+side[k]*.5),b.map((v,k)=>v-side[k]*.5),color);}
   const pick=r();let form;
   if(['snow','rubble','scree'].includes(kind)||pick<.19){form='stones';for(let j=0;j<2;j++)stone((r()-.5)*1.4,(r()-.5)*1.4,.07+r()**2*(kind==='rubble'?.65:.27));}
   else if((kind==='woodland'&&pick<.32)||(kind==='bank'&&pick<.35)){form='deadwood';const length=.5+r()*2.4,thick=.025+r()*.07,bark=[.27,.20,.12];stem([-length/2,.05,0],[length/2,.08,.2],thick,bark);stem([0,.07,.1],[length*.2,.09,.55],thick*.45,bark);}
   else {form=kind==='woodland'&&pick<.74?'fern':kind==='bank'?'reeds':kind==='desert'?'scrub':'grass';const type=form==='fern'?1:form==='scrub'?2:0,dry=kind==='desert'||kind==='tundra',height=form==='fern'?.35+r()*.4:form==='scrub'?.5+r()*1.1:form==='reeds'?.8+r()*.7:.25+r()*.5,width=height*(form==='scrub'?1.5:1.6),color=dry?[1.05,.99,.78]:[.88,1,.73];
    for(let j=0;j<3;j++){const angle=j*Math.PI/3,dx=Math.cos(angle)*width/2,dz=Math.sin(angle)*width/2,points=[[-dx,0,-dz],[dx,0,dz],[dx,height,dz],[-dx,height,-dz]],uv=[[type/4,1],[(type+1)/4,1],[(type+1)/4,0],[type/4,0]];
     const vertices=points.map(world);if(vertices.some(p=>!p))continue;for(const face of [[0,1,2],[0,2,3]]){const offset=positions.length/3;for(const i of face){positions.push(...vertices[i]);normals.push(...d);colors.push(...color.map(v=>v*tone));foliage.push(...uv[i],2);shade.push(kind==='woodland'?.8:1);}indices.push(offset,offset+1,offset+2);}
    }
   }
   placements.push({id,direction:d,groundM:h,kind,form});
  }
 }
 return {positions:Float64Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),foliage:Float32Array.from(foliage),indices:Uint32Array.from(indices),shade:Float32Array.from(shade),placements,plants:true};
}
