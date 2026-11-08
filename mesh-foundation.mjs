import {sphereFaces} from './shorelines.mjs?v=0.9.15';
const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
class BufferBuilder{
  constructor(Type,capacity){this.Type=Type;this.data=new Type(Math.max(16,capacity));this.length=0;}
  push(...values){if(this.length+values.length>this.data.length){const next=new this.Type(Math.max(this.length+values.length,this.data.length*2));next.set(this.data);this.data=next;}this.data.set(values,this.length);this.length+=values.length;}
  finish(){return this.data.slice(0,this.length);}
}
/** Checkpoint 4a1: the complete indexed sphere and fixed standing-water sheets.
 * Shore crossings are shared by ground and water. Subcell river cores/banks
 * and the corresponding open mouth cuts are intentionally checkpoint 4a2.
 * No second hydrology solve, noise, vegetation or texture-based elevations.
 */
export function buildMeshFoundation(m,surface,{progress=()=>{}}={}){
  const g=m.grid,N=g.count,R=g.radiusKm*1000,scaffold=surface.waterScaffold,owner=scaffold.owner;
  const gp=new BufferBuilder(Float64Array,(N+150000)*3),gh=new BufferBuilder(Float32Array,N+150000),gi=new BufferBuilder(Uint32Array,(2*N+200000)*3);
  const wp=new BufferBuilder(Float64Array,(N+100000)*3),wh=new BufferBuilder(Float32Array,N+100000),wb=new BufferBuilder(Int32Array,N+100000),wi=new BufferBuilder(Uint32Array,(2*N+100000)*3),wg=new BufferBuilder(Uint32Array,N+100000);
  const baseWater=new Int32Array(N).fill(-1),extraWater=new Map(),extraGround=new Map(),refineEdges=new Set();
  let processedFaces=0,shoreFaces=0;
  for(let i=0;i<N;i++){const d=surface.mesh.directionAt(i),r=R+m.height[i];gp.push(d[0]*r,d[1]*r,d[2]*r);gh.push(m.height[i]);}
  // Only incompatible plane contacts require extra saddle vertices. Mark all
  // edges of those faces first so their neighbours use identical edge splits.
  for(const cells of sphereFaces(g)){
    const ids=new Set(cells.map(i=>owner[i]).filter(id=>id!==-2));
    if(ids.size>1)for(let k=0;k<3;k++)refineEdges.add(edgeKey(cells[k],cells[(k+1)%3]));
  }
  function ground(v){
    if(v.id!==undefined)return v.id;
    if(v.key[0]==='v'){v.id=Number(v.key.slice(1));return v.id;}
    if(extraGround.has(v.key)){v.id=extraGround.get(v.key);return v.id;}
    v.id=gh.length;const r=R+v.heightM;gp.push(...v.direction.map(x=>x*r));gh.push(v.heightM);extraGround.set(v.key,v.id);return v.id;
  }
  function water(v,body,level){
    const id=ground(v),key=id+':'+body,cached=id<N&&baseWater[id]>=0&&wb.data[baseWater[id]]===body?baseWater[id]:extraWater.get(key);
    if(cached!==undefined&&cached>=0&&wb.data[cached]===body)return cached;
    const result=wh.length,r=R+level;
    // At a shore the two buffers contain bit-identical shared positions in double-precision metre coordinates.
    if(v.heightM===level)wp.push(gp.data[id*3],gp.data[id*3+1],gp.data[id*3+2]);else wp.push(...v.direction.map(x=>x*r));
    wh.push(level);wb.push(body);wg.push(id);if(id<N&&baseWater[id]<0)baseWater[id]=result;else extraWater.set(key,result);return result;
  }
  function triangle(buffer,a,b,c,positions){
    if(a===b||b===c||c===a)return;
    const A=positions.data.subarray(a*3,a*3+3),B=positions.data.subarray(b*3,b*3+3),C=positions.data.subarray(c*3,c*3+3);
    const u=B.map((x,k)=>x-A[k]),v=C.map((x,k)=>x-A[k]);
    const outward=(u[1]*v[2]-u[2]*v[1])*A[0]+(u[2]*v[0]-u[0]*v[2])*A[1]+(u[0]*v[1]-u[1]*v[0])*A[2];
    if(outward===0)return;
    buffer.push(a,...(outward>0?[b,c]:[c,b]));
  }
  function fan(poly,buffer,index,positions){for(let k=1;k<poly.length-1;k++)triangle(buffer,index(poly[0]),index(poly[k]),index(poly[k+1]),positions);}
  function cut(a,b,p){
    if(a.heightM===p.waterM)return a;if(b.heightM===p.waterM)return b;
    if(a.key>b.key)[a,b]=[b,a];
    const t=(p.waterM-a.heightM)/(b.heightM-a.heightM);
    return {key:'s'+p.id+':'+a.key+'|'+b.key,heightM:p.waterM,body:p.id,direction:normalize(a.direction.map((x,k)=>x+(b.direction[k]-x)*t))};
  }
  function clip(tri,p,wet){
    const poly=[];
    for(let k=0;k<tri.length;k++){
      const a=tri[k],b=tri[(k+1)%tri.length],insideA=wet?a.heightM<p.waterM:a.heightM>=p.waterM,insideB=wet?b.heightM<p.waterM:b.heightM>=p.waterM;
      if(insideA)poly.push(a);if(insideA!==insideB)poly.push(cut(a,b,p));
    }
    return poly.filter((v,k)=>!k||v.key!==poly[k-1].key).filter((v,k,all)=>k!==all.length-1||all.length===1||v.key!==all[0].key);
  }
  function emit(tri){
    const ids=[...new Set(tri.map(v=>v.body).filter(id=>id!==-2))];
    if(ids.length>1)throw Error('Mesh subface contains incompatible water planes');
    if(!ids.length){fan(tri,gi,ground,gp);return;}
    const p=scaffold.plane(ids[0]),wet=clip(tri,p,true),dry=clip(tri,p,false);
    fan(wet,gi,ground,gp);fan(dry,gi,ground,gp);fan(wet,wi,v=>water(v,p.id,p.waterM),wp);
  }
  for(const cells of sphereFaces(g)){
    processedFaces++;
    const ids=cells.map(i=>owner[i]);
    if(ids[0]===ids[1]&&ids[1]===ids[2]&&!cells.some((i,k)=>refineEdges.has(edgeKey(i,cells[(k+1)%3])))){
      triangle(gi,...cells,gp);
      if(ids[0]!==-2){const p=scaffold.plane(ids[0]);triangle(wi,...cells.map(i=>water({...scaffold.node(i),id:i},p.id,p.waterM)),wp);}
    }else{
      shoreFaces++;
      const hasMixed=new Set(ids.filter(id=>id!==-2)).size>1;
      if(hasMixed)for(const tri of scaffold.face(cells))emit(tri);
      else{
        const nodes=cells.map(scaffold.node),boundary=[];
        const face=scaffold.face(cells),center=face[0][2];
        for(let k=0;k<3;k++){boundary.push(nodes[k]);if(refineEdges.has(edgeKey(cells[k],cells[(k+1)%3])))boundary.push(face[k*2][1]);}
        if(boundary.length===3)emit(nodes);else for(let k=0;k<boundary.length;k++)emit([boundary[k],boundary[(k+1)%boundary.length],center]);
      }
    }
    if(processedFaces%100000===0)progress(processedFaces/(2*N-4));
  }
  const groundMesh={positions:gp.finish(),elevationsM:gh.finish(),indices:gi.finish()},standingWater={positions:wp.finish(),elevationsM:wh.finish(),bodies:wb.finish(),groundVertex:wg.finish(),indices:wi.finish()};
  return {stage:'foundation',radiusM:R,ground:groundMesh,standingWater,stats:{sourceCells:N,sourceFaces:processedFaces,shoreFaces,groundVertices:gh.length,groundTriangles:gi.length/3,waterVertices:wh.length,waterTriangles:wi.length/3,bytes:Object.values(groundMesh).reduce((s,a)=>s+a.byteLength,0)+Object.values(standingWater).reduce((s,a)=>s+a.byteLength,0)},next:'Triangulate global channel constraints into ground and water (4a2b)'};
}
