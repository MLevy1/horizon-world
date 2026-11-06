/** Standing-water boundaries on the shared spherical scaffold. Channel cores
 * cut explicit portals in those boundaries; no line is drawn across a mouth.
 * Rings retain the standing-water footprint; paths exclude the open portals.
 */
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const mix=(a,b,t)=>norm(a.map((v,k)=>v+(b[k]-v)*t));
const angle=(a,b)=>2*Math.asin(Math.min(1,Math.hypot(...a.map((v,k)=>v-b[k]))/2));
const DEG=180/Math.PI;

/** Exactly the same wrapped staggered triangles and single polar fans used by
 * createSphereSampler. Each face is emitted once, independent of map projection.
 */
export function* sphereFaces(g){
  const w=g.width,h=g.height;
  for(let x=0;x<w;x++)yield [g.north,x,(x+1)%w];
  for(let y=0;y<h-1;y++)for(let x=0;x<w;x++){
    const a=y*w+x,b=y*w+(x+1)%w,c=(y+1)*w+(x+(y&1))%w,d=(y+1)*w+(x+(y&1)+w-1)%w;
    yield [a,b,c];yield [a,d,c];
  }
  for(let x=0;x<w;x++)yield [g.south,(h-1)*w+x,(h-1)*w+(x+1)%w];
}
export function shorePoint(direction,waterM){
  return {direction,lon:Math.atan2(direction[2],direction[0])*DEG,lat:Math.asin(Math.max(-1,Math.min(1,direction[1])))*DEG,waterM};
}

/** Split an arc wherever channel cores intersect it. A distance bound prevents
 * narrow off-centre mouths from being missed. The maximum unresolved interval
 * is toleranceM, in metres on the sphere, not a longitude-dependent pixel size.
 */
export function splitShoreArc(a,b,probe,radiusM,toleranceM=.02){
  if(!(toleranceM>0&&Number.isFinite(toleranceM)))throw Error('Invalid shoreline tolerance');
  const length=angle(a,b)*radiusM,leaves=[];
  function visit(t0,t1,p0,p1,f0,f1){
    const span=angle(p0,p1)*radiusM;
    // The probe normalizes distance by a conservative width-taper bound.
    // A factor of four leaves additional room for chord/arc conversion.
    if(Math.min(f0,f1)>span*4){leaves.push([t0,t1,false]);return;}
    if(Math.max(f0,f1)<-span*4){leaves.push([t0,t1,true]);return;}
    const tm=(t0+t1)/2,pm=mix(a,b,tm),fm=probe(pm);
    if(span<=toleranceM){leaves.push([t0,t1,fm<0]);return;}
    visit(t0,tm,p0,pm,f0,fm);visit(tm,t1,pm,p1,fm,f1);
  }
  if(!length)return [];
  visit(0,1,a,b,probe(a),probe(b));
  const spans=[];
  for(const [lo,hi,portal] of leaves){const last=spans.at(-1);if(last&&last.portal===portal)last.to=hi;else spans.push({from:lo,to:hi,portal});}
  for(let i=1;i<spans.length;i++){
    const boundary=spans[i].from,previous=leaves.findLast(s=>s[1]<=boundary+1e-15),next=leaves.find(s=>s[0]>=boundary-1e-15);
    let lo=(previous[0]+previous[1])/2,hi=(next[0]+next[1])/2;const left=spans[i-1].portal;
    for(let k=0;k<40&&(hi-lo)*length>1e-7;k++){const t=(lo+hi)/2;if((probe(mix(a,b,t))<0)===left)lo=t;else hi=t;}
    spans[i-1].to=spans[i].from=(lo+hi)/2;
  }
  return spans.map(s=>({...s,a:mix(a,b,s.from),b:mix(a,b,s.to)}));
}

export function extractShorelines(m,surface,{toleranceM=.02}={}){
  const {grid:g}=m,R=g.radiusKm*1000,vertices=[],segments=[],edgePoints=new Map(),groups=new Map();
  let faceCount=0,wetFaces=0;
  function crossing(a,b,p){
    if(a.key>b.key)[a,b]=[b,a];
    const t=(p.waterM-a.heightM)/(b.heightM-a.heightM);
    const k=p.id+':'+(t===0?a.key:t===1?b.key:a.key+'|'+b.key);
    if(edgePoints.has(k))return edgePoints.get(k);
    const id=vertices.length,d=mix(a.direction,b.direction,t);
    vertices.push({...shorePoint(d,p.waterM),id,body:p.id});edgePoints.set(k,id);return id;
  }
  for(const cells of sphereFaces(g)){
    faceCount++;
    const owners=cells.map(i=>surface.waterScaffold.owner[i]);
    if(owners.every(id=>id===-2)||owners.every(id=>id===owners[0]))continue;
    wetFaces++;
    for(const tri of surface.waterScaffold.face(cells)){
      const planes=new Map();for(const v of tri)if(v.body!==-2)planes.set(v.body,surface.waterScaffold.plane(v.body));
      for(const p of planes.values()){
        const hits=[];
        for(let k=0;k<3;k++){
          const a=tri[k],b=tri[(k+1)%3],ha=a.heightM-p.waterM,hb=b.heightM-p.waterM;
          if((ha<0)!==(hb<0))hits.push(crossing(a,b,p));
        }
        if(hits.length!==2||hits[0]===hits[1])continue;
        const id=segments.length;segments.push({body:p.id,kind:p.kind,waterM:p.waterM,vertices:hits});
        if(!groups.has(p.id))groups.set(p.id,[]);groups.get(p.id).push(id);
      }
    }
  }
  // Closed rings use shared vertex IDs rather than rounded longitude keys.
  const rings=[];
  for(const [body,ids] of groups){
    const adjacency=new Map();
    for(const id of ids)for(const v of segments[id].vertices){if(!adjacency.has(v))adjacency.set(v,[]);adjacency.get(v).push(id);}
    for(const [v,edges] of adjacency)if(edges.length%2)throw Error(`Unclosed shoreline at body ${body}, vertex ${v}: ${edges.length}`);
    const visited=new Set();
    for(const first of ids){
      if(visited.has(first))continue;
      const start=segments[first].vertices[0],path=[start],edgeIds=[];let v=start,e=first;
      do{visited.add(e);edgeIds.push(e);const s=segments[e];v=s.vertices[0]===v?s.vertices[1]:s.vertices[0];path.push(v);e=adjacency.get(v).find(j=>!visited.has(j));}while(v!==start&&e!==undefined);
      if(v!==start)throw Error('Open standing-water ring');
      // At an exact dry saddle several even-degree contours may touch. Split
      // the closed walk at repeated vertices so each lobe remains its own ring.
      const stack=[path[0]],stackEdges=[],positions=new Map([[path[0],0]]);
      for(let k=0;k<edgeIds.length;k++){
        const next=path[k+1];stackEdges.push(edgeIds[k]);
        if(positions.has(next)){
          const at=positions.get(next);
          rings.push({body,kind:segments[first].kind,waterM:segments[first].waterM,vertices:[...stack.slice(at),next],segments:stackEdges.slice(at)});
          for(let j=at+1;j<stack.length;j++)positions.delete(stack[j]);
          stack.length=at+1;stackEdges.length=at;
        }else{positions.set(next,stack.length);stack.push(next);}
      }
    }
  }
  const paths=[],portals=[];
  for(const ring of rings){
    const pieces=[];
    for(let k=0;k<ring.vertices.length-1;k++){
      const a=vertices[ring.vertices[k]],b=vertices[ring.vertices[k+1]],arc=surface.shoreArc(a.direction,b.direction);
      for(const s of splitShoreArc(a.direction,b.direction,arc.clearance,R,toleranceM))pieces.push({portal:s.portal,points:[shorePoint(s.a,ring.waterM),shorePoint(s.b,ring.waterM)]});
    }
    const runs=[];
    for(const piece of pieces){const last=runs.at(-1);if(last&&last.portal===piece.portal)last.points.push(piece.points[1]);else runs.push(piece);}
    if(runs.length>1&&runs[0].portal===runs.at(-1).portal){runs[0].points=[...runs.at(-1).points.slice(0,-1),...runs[0].points];runs.pop();}
    for(const run of runs)(run.portal?portals:paths).push({body:ring.body,kind:ring.kind,waterM:ring.waterM,closed:runs.length===1,points:run.points});
  }
  return {vertices,segments,rings,paths,portals,stats:{faces:faceCount,wetFaces,standingRings:rings.length,shoreSegments:segments.length,shorePaths:paths.length,channelPortals:portals.length,toleranceM}};
}

/** Compact transferable display geometry; extraction diagnostics stay in tests. */
export function packShorelines(shores){
  const pack=path=>({body:path.body,kind:path.kind,waterM:path.waterM,closed:path.closed,
    coordinates:Float64Array.from(path.points.flatMap(p=>[p.lon,p.lat]))});
  return {paths:shores.paths.map(pack),portals:shores.portals.map(pack),stats:shores.stats};
}
