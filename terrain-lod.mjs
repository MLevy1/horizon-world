import {coordinateTile,terrainVertex,tileNeighbor,tileKey,neighborhood,EDGES} from './terrain-chunks.mjs?v=0.9.11';
const length=a=>Math.hypot(...a),distance=(a,b)=>length(a.map((v,k)=>v-b[k]));
const children=t=>[0,1,2,3].map(k=>({face:t.face,level:t.level+1,x:t.x*2+k%2,y:t.y*2+(k>>1)}));
export function coveringTile(tiles,tile){
  for(let level=tile.level;level>=0;level--){const shift=2**(tile.level-level),found=tiles.get(tileKey({face:tile.face,level,x:Math.floor(tile.x/shift),y:Math.floor(tile.y/shift)}));if(found)return found;}
  return null;
}
/** Camera footprint in a globally addressed quadtree. Only geometry is local;
 * every height and water value still comes from the complete planetary solve. */
export function selectTerrainTiles(lon,lat,{level=12,aspect=1.8,tilt=45,radiusM=64000}={}){
  if(!Number.isFinite(level)||level<6||level>14||!Number.isFinite(aspect)||aspect<=0||aspect>8||!Number.isFinite(tilt)||Math.abs(tilt)>60)throw Error('Invalid terrain view');
  const finest=Math.ceil(level),base=finest-2,l=lon*Math.PI/180,p=lat*Math.PI/180,focus=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],zoom=2**level*Math.max(1,aspect/1.6),footprint=(radiusM+4000)*Math.hypot(aspect,1/Math.cos(tilt*Math.PI/180))/(.9*zoom*radiusM),leaves=new Map();
  const visit=t=>{
    const center=terrainVertex(t,4,2,2).direction,bound=Math.max(...[[0,0],[4,0],[4,4],[0,4]].map(([i,j])=>distance(center,terrainVertex(t,4,i,j).direction)));
    if(t.level<finest&&distance(center,focus)<bound+footprint*2**(finest-t.level-1)*1.15)for(const child of children(t))visit(child);else leaves.set(tileKey(t),t);
  };
  for(const root of neighborhood(coordinateTile(lon,lat,base),2))visit(root);
  // A fine leaf discovers any adjacent coarser leaf, including across faces.
  // Split until every touching pair differs by at most one quadtree level.
  let changed=true;
  while(changed){changed=false;for(const t of [...leaves.values()])for(const edge of EDGES){const other=coveringTile(leaves,tileNeighbor(t,edge));if(other&&t.level-other.level>1){leaves.delete(tileKey(other));for(const child of children(other))leaves.set(tileKey(child),child);changed=true;}}}
  return [...leaves.values()].sort((a,b)=>tileKey(a).localeCompare(tileKey(b))).map(tile=>({tile,coarseEdges:EDGES.filter(edge=>coveringTile(leaves,tileNeighbor(tile,edge))?.level===tile.level-1)}));
}

export function panTerrainView(view,dx,dy,{width,height,radiusM=64000,tilt=45}){
  if(!(width>0&&height>0)||![dx,dy].every(Number.isFinite))throw Error('Invalid terrain movement');
  const aspect=width/height,zoom=2**view.level*Math.max(1,aspect/1.6),scale=2*(radiusM+4000)/(.9*zoom*height*radiusM),l=view.lon*Math.PI/180,p=view.lat*Math.PI/180,d=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],east=[-Math.sin(l),0,Math.cos(l)],north=[-Math.sin(p)*Math.cos(l),Math.cos(p),-Math.sin(p)*Math.sin(l)],v=d.map((x,k)=>x-dx*scale*east[k]+dy*scale/Math.cos(tilt*Math.PI/180)*north[k]),n=length(v);
  return {...view,lon:Math.atan2(v[2],v[0])*180/Math.PI,lat:Math.asin(Math.max(-1,Math.min(1,v[1]/n)))*180/Math.PI};
}
