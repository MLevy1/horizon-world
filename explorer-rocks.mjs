import {terrainVertex,coordinateTile,tileNeighbor,EDGES,tileKey} from './terrain-chunks.mjs?v=0.9.18';
import {direction,coordinates,frame,dot,unit,createGroundCollider} from './explorer-world.mjs?v=0.9.18';
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const random=seed=>()=>{seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const topologies=new Map();
function topology(levels=2){if(topologies.has(levels))return topologies.get(levels);const t=(1+Math.sqrt(5))/2;let vertices=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(unit),faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 for(let level=0;level<levels;level++){const edges=new Map(),mid=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);const id=vertices.length;vertices.push(unit(vertices[a].map((v,k)=>v+vertices[b][k])));edges.set(key,id);return id;};faces=faces.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});}const sphere={vertices,faces};topologies.set(levels,sphere);return sphere;
}
/** Permanent cube-sphere addresses determine clusters, independent of view/LOD.
 * The caller supplies global environmental fields; only nearby geometry exists. */
export function buildRockField({seed,lon,lat,radiusM,mesh,environment,rangeM=155,clearance=0,collider=null,waterCollider=null}){
 const start=performance.now();const anchor=direction(lon,lat),ground=collider||createGroundCollider(mesh.ground,anchor,radiusM,{rangeM:rangeM+20,binSize:rangeM>200?32:12}),water=waterCollider||(mesh.water?createGroundCollider(mesh.water,anchor,radiusM,{rangeM:rangeM+20,binSize:32}):()=>null),positions=[],normals=[],colors=[],materials=[],indices=[],placements=[];
 const roots=[{tile:coordinateTile(lon,lat,11),distance:0}],seen=new Set([tileKey(roots[0].tile)]);for(let i=0;i<roots.length;i++){const item=roots[i];if(item.distance>=Math.ceil(rangeM/25)+2)continue;const center=terrainVertex(item.tile,4,2,2).direction;if(Math.hypot(...center.map((v,k)=>v-anchor[k]))*radiusM>rangeM+150)continue;for(const edge of EDGES){const tile=tileNeighbor(item.tile,edge),key=tileKey(tile);if(!seen.has(key)){seen.add(key);roots.push({tile,distance:item.distance+1});}}}
 const prepared=performance.now();let envCalls=0;const envRead=(lon,lat)=>{envCalls++;return environment(lon,lat);};
 for(const {tile} of roots)for(let candidate=0;candidate<10;candidate++){
  const id=tileKey(tile)+':'+candidate,rnd=random(hash(seed+':rocks:'+id)),center=terrainVertex(tile,256,1+Math.floor(rnd()*254),1+Math.floor(rnd()*254)).direction;
  if(Math.hypot(...center.map((v,k)=>v-anchor[k]))*radiusM>rangeM+10)continue;
  const horizontal=Math.hypot(...center.map((v,k)=>v-anchor[k]))*radiusM,viewDistance=Math.hypot(horizontal,clearance),roll=rnd(),count=2+Math.floor(rnd()*5),baseRoll=rnd(),possibleBase=Math.max(.16+baseRoll**2*3.25,.45+baseRoll**3*2.9);if(viewDistance>180&&possibleBase<viewDistance*.0018)continue;
  const ll=coordinates(center),env=envRead(ll.lon,ll.lat);if(env.depthM>.12||env.glacier>.8)continue;
  if(candidate>=3&&candidate>=3+Math.floor((env.talus||0)*7))continue;
  const density=Math.min(.92,.30+(env.talus||0)*.45+env.slope*.75+env.shore*.55+env.lava*.28)*(1-env.snow*.35);if(roll>density)continue;
  const base=env.sediment&&env.talus>.2?.16+baseRoll**2*(.35+2.9*env.sediment.coarse):.45+baseRoll**3*2.9,clusterFrame=frame(center);if(viewDistance>180&&base<viewDistance*.0018)continue;
  for(let member=0;member<count;member++){
   const rockRandom=random(hash(seed+':shape:'+id+':'+member)),angle=rockRandom()*Math.PI*2,spread=member?base*(1.8+rockRandom()*3):0,d=unit(center.map((v,k)=>v+(clusterFrame.east[k]*Math.cos(angle)+clusterFrame.north[k]*Math.sin(angle))*spread/radiusM));if(Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM>rangeM)continue;
   const at=coordinates(d),e=member?envRead(at.lon,at.lat):env;if(e.depthM>.12||e.glacier>.8)continue;const height=ground(d);if(height===null)continue;const waterM=water(d);if(waterM!==null&&waterM-height>.12)continue;
   const size=base*(member?.25+rockRandom()*.6:1),rx=size*(.75+rockRandom()*.6),ry=size*(.5+rockRandom()*.6),rz=size*(.6+rockRandom()*.65),yaw=rockRandom()*Math.PI*2,f=frame(d,yaw),origin=d.map(v=>v*(radiusM+height-ry*.34)),phase=rockRandom()*6.28,planes=Array.from({length:3},()=>({n:unit([rockRandom()*2-1,rockRandom()*2-1,rockRandom()*2-1]),limit:.72+rockRandom()*.22})),offset=positions.length/3;
   const distance=Math.hypot(Math.hypot(...d.map((v,k)=>v-anchor[k]))*radiusM,clearance);if(distance>180&&size<distance*.0018)continue;const {vertices,faces}=topology(distance<45?2:distance<160?1:0);
   for(const v of vertices){let a=v.slice();for(const p of planes){const dist=dot(a,p.n)-p.limit;if(dist>0)a=a.map((x,k)=>x-p.n[k]*dist);}const warp=1+.10*Math.sin(a[0]*3.1+a[1]*2.7+phase)*Math.cos(a[2]*3.7-phase);a=a.map(v=>v*warp);const world=origin.map((x,k)=>x+f.right[k]*a[0]*rx+d[k]*a[1]*ry+f.forward[k]*a[2]*rz);positions.push(...world);}
   const accumulated=vertices.map(()=>[0,0,0]);for(const face of faces){const [a,b,c]=face.map(i=>positions.slice((offset+i)*3,(offset+i)*3+3)),n=cross(b.map((v,k)=>v-a[k]),c.map((v,k)=>v-a[k]));for(const i of face)for(let k=0;k<3;k++)accumulated[i][k]+=n[k];indices.push(...face.map(i=>offset+i));}
   for(let i=0;i<vertices.length;i++){const n=unit(accumulated[i]),snow=e.snow*Math.max(0,(dot(n,d)-.35)/.65),lava=e.lava*(1-snow);normals.push(...n);colors.push(...[.43,.425,.39].map(v=>v*(.84+.14*Math.sin(phase))));materials.push(0,0,1-snow-lava,snow,lava,0);}
   placements.push({id:id+':'+member,direction:d,right:f.right,forward:f.forward,rx:rx*1.05,rz:rz*1.05,groundM:height,topM:height+ry*.76});
  }
 }
 return {stats:{prepareMs:prepared-start,totalMs:performance.now()-start,tiles:roots.length,envCalls,vertices:positions.length/3,triangles:indices.length/3},positions:Float64Array.from(positions),normals:Float32Array.from(normals),colors:Float32Array.from(colors),materials:Float32Array.from(materials),indices:Uint32Array.from(indices),placements};
}
/** Conservative horizontal footprint keeps the walker outside larger boulders. */
export function rockBlocks(rocks,d,footM,radiusM){
 for(const rock of rocks||[]){
  if(rock.topM-footM<.35)continue;
  const dx=(d[0]-rock.direction[0])*radiusM,dy=(d[1]-rock.direction[1])*radiusM,dz=(d[2]-rock.direction[2])*radiusM,bound=(rock.rx+rock.rz+.44)*1.01;
  // Most of the wider visible field is far from the walker. Reject it without
  // allocating vectors or doing ellipse projections on every movement step.
  if(Math.abs(dx)>bound||Math.abs(dy)>bound||Math.abs(dz)>bound)continue;
  const x=(dx*rock.right[0]+dy*rock.right[1]+dz*rock.right[2])/(rock.rx+.22),z=(dx*rock.forward[0]+dy*rock.forward[1]+dz*rock.forward[2])/(rock.rz+.22);
  if(x*x+z*z<1)return true;
 }
 return false;
}
