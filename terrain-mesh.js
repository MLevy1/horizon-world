/**
 * Channel-aware terrain tessellation.
 * River Lab resolves narrow channels with dense terrain vertices adjacent to
 * the waterline. This module brings that principle to streamed world tiles.
 *
 * Each coarse grid cell stays coarse or is refined 8x8 near a channel. A
 * neighboring coarse cell with a refined neighbor adds boundary vertices to
 * its polygon fan, avoiding T-junctions inside the same tile.
 *
 * All elevations come from the canonical final world generator; render
 * topology never changes river position or final geographic ground height.
 */
export function channelAwareGrid({x,z,size,segments,ground,nearChannel,subdivision=8}){
 if(!Number.isInteger(segments)||segments<1)throw new RangeError('Invalid segments');
 if(!Number.isInteger(subdivision)||subdivision<2||subdivision%2)throw new RangeError('Invalid subdivision');
 const N=segments,R=subdivision,step=size/N;
 const dense=new Uint8Array(N*N),cell=(i,j)=>j*N+i;
 // Keep the outer ring consistent with existing tile edges. Exact stitching
 // across DIFFERENT tile sizes is a separate multi-LOD task.
 for(let j=1;j<N-1;j++)for(let i=1;i<N-1;i++){
  const cx=x+(i+.5)*step,cz=z+(j+.5)*step;
  if(nearChannel(cx,cz,step*.9))dense[cell(i,j)]=1;
 }
 const positions=[],indices=[],coords=[],lookup=new Map();
 const cellStart=new Uint32Array(N*N),cellEnd=new Uint32Array(N*N);
 function vertex(i,j){
  // i,j in subcell steps, canonical absolute positions.
  const key=i+','+j;
  if(lookup.has(key))return lookup.get(key);
  const wx=x+i*step/R,wz=z+j*step/R;
  const h=ground(wx,wz);
  if(!Number.isFinite(h))throw new Error('Nonfinite terrain height');
  const id=positions.length/3;
  positions.push(wx,h,wz);coords.push([wx,wz]);lookup.set(key,id);
  return id;
 }
 function tri(a,b,c){indices.push(a,b,c)}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){
  const i0=i*R,j0=j*R;
  cellStart[cell(i,j)]=indices.length;
  if(dense[cell(i,j)]){
   for(let b=0;b<R;b++)for(let a=0;a<R;a++){
    const tl=vertex(i0+a,j0+b),tr=vertex(i0+a+1,j0+b),
      bl=vertex(i0+a,j0+b+1),br=vertex(i0+a+1,j0+b+1);
    tri(tl,bl,tr);tri(tr,bl,br);
   }
   cellEnd[cell(i,j)]=indices.length;
   continue;
  }
  const left=i>0&&dense[cell(i-1,j)],right=i<N-1&&dense[cell(i+1,j)];
  const top=j>0&&dense[cell(i,j-1)],bottom=j<N-1&&dense[cell(i,j+1)];
  if(!left&&!right&&!top&&!bottom){
   const tl=vertex(i0,j0),tr=vertex(i0+R,j0),
     bl=vertex(i0,j0+R),br=vertex(i0+R,j0+R);
   tri(tl,bl,tr);tri(tr,bl,br);
   cellEnd[cell(i,j)]=indices.length;
   continue;
  }
  // The polygon perimeter is counterclockwise when viewed from +Y:
  // left top->bottom, bottom left->right, right bottom->top, top right->left.
  const ring=[];
  const add=(a,b)=>ring.push(vertex(a,b));
  const countLeft=left?R:1,countBottom=bottom?R:1,
    countRight=right?R:1,countTop=top?R:1;
  for(let k=0;k<countLeft;k++)add(i0,j0+k*R/countLeft);
  for(let k=0;k<countBottom;k++)add(i0+k*R/countBottom,j0+R);
  for(let k=0;k<countRight;k++)add(i0+R,j0+R-k*R/countRight);
  for(let k=0;k<countTop;k++)add(i0+R-k*R/countTop,j0);
  const center=vertex(i0+R/2,j0+R/2);
  for(let k=0;k<ring.length;k++)tri(ring[k],ring[(k+1)%ring.length],center);
  cellEnd[cell(i,j)]=indices.length;
 }
 return {x,z,size,positions,indices,coords,dense,segments:N,subdivision:R,cellStart,cellEnd};
}

/**
 * Find the visible triangle height in an adaptive terrain cell.
 * The old regular-grid interpolation used vertex IDs (j*(N+1)+i), which
 * are invalid after tessellation and caused floating plants and rocks.
 * This samples only the triangles within the relevant coarse cell.
 */
export function channelAwareHeight(mesh,wx,wz){
 const {x,z,size,segments:N,positions,indices,cellStart,cellEnd}=mesh;
 const step=size/N;
 const i=Math.max(0,Math.min(N-1,Math.floor((wx-x)/step)));
 const j=Math.max(0,Math.min(N-1,Math.floor((wz-z)/step)));
 const cell=j*N+i,eps=1e-6;
 for(let k=cellStart[cell];k<cellEnd[cell];k+=3){
  const ai=indices[k]*3,bi=indices[k+1]*3,ci=indices[k+2]*3;
  const ax=positions[ai],az=positions[ai+2],
        bx=positions[bi],bz=positions[bi+2],
        cx=positions[ci],cz=positions[ci+2];
  const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
  if(Math.abs(den)<1e-12)continue;
  const u=((bz-cz)*(wx-cx)+(cx-bx)*(wz-cz))/den;
  const v=((cz-az)*(wx-cx)+(ax-cx)*(wz-cz))/den;
  const w=1-u-v;
  if(u>=-eps&&v>=-eps&&w>=-eps){
   return u*positions[ai+1]+v*positions[bi+1]+w*positions[ci+1];
  }
 }
 // Null signals no matching displayed triangle: never guess a vertex ID.
 return null;
}
