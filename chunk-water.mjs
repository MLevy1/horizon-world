/** Clip a single water union to the sampled ground. Canonical edge ordering
 * makes shore roots identical in independent chunks and stitched LOD borders.
 * Fixed standing-water planes never interpolate toward a dry-node fake head.
 */
const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const mix=(a,b,t)=>a+(b-a)*t;
export function clipChunkWater(ground,samples,keys,radiusM){
  const P=ground.elevationsM.length,positions=[...ground.positions],heights=[...ground.elevationsM],normals=ground.normals?[...ground.normals]:[],heads=[...samples.headM],wet=[...samples.waterM].map(Number.isFinite),waterHeads=[...samples.waterM],rootVertices=new Set(),roots=new Map(),groundIndices=[],waterIndices=[],waterPositions=[],waterNormals=[],waterElevations=[],waterGround=[],waterAt=new Map();
  let ambiguousTriangles=0;
  const point=id=>positions.slice(id*3,id*3+3),normal=id=>samples.waterNormals?Array.from(samples.waterNormals.subarray(id*3,id*3+3)):normalize(point(id));
  const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
  function shore(a,b){
    if(keys[a]>keys[b])[a,b]=[b,a];
    const cacheKey=edgeKey(a,b);if(roots.has(cacheKey))return roots.get(cacheKey);
    const w=wet[a]?a:b,d=wet[a]?b:a,level=waterHeads[w],fixed=samples.fixed[w];
    let dryHead=Number.isFinite(heads[d])?Math.min(heads[d],heights[d]):heights[d]-.25,conflict=false;
    if(fixed){if(heights[d]<level-1e-7)conflict=true;else dryHead=level;}
    const hA=wet[a]?waterHeads[a]:dryHead,hB=wet[b]?waterHeads[b]:dryHead,da=wet[a]?hA-heights[a]:Math.min(0,hA-heights[a]),db=wet[b]?hB-heights[b]:Math.min(0,hB-heights[b]);
    let t=da/(da-db);if(!Number.isFinite(t))throw Error('Invalid chunk shore intersection');t=Math.max(0,Math.min(1,t));
    let id;
    if(t<1e-12)id=a;else if(t>1-1e-12)id=b;
    else{
      id=heights.length;const A=normalize(point(a)),B=normalize(point(b)),direction=normalize(A.map((v,k)=>mix(v,B[k],t))),height=mix(hA,hB,t);
      positions.push(...direction.map(v=>v*(radiusM+height)));heights.push(height);heads.push(height);waterHeads.push(height);wet.push(false);
      if(normals.length){const n=normalize([0,1,2].map(k=>mix(normals[a*3+k],normals[b*3+k],t)));normals.push(...n);}
    }
    rootVertices.add(id);const head=heights[id],na=normal(a),nb=normal(b),n=fixed?normalize(point(id)):normalize(na.map((v,k)=>mix(v,nb[k],t))),result={id,head,normal:n,conflict};roots.set(cacheKey,result);return result;
  }
  const shoreData=new Map();
  function waterVertex(id){
    if(waterAt.has(id))return waterAt.get(id);
    const index=waterElevations.length,root=shoreData.get(id),head=root?heights[id]:waterHeads[id];
    if(!Number.isFinite(head))throw Error('Water vertex has no surface level');
    if(root)waterPositions.push(...point(id));else waterPositions.push(...normalize(point(id)).map(v=>v*(radiusM+head)));
    waterNormals.push(...(root?root.normal:normal(id)));waterElevations.push(head);waterGround.push(id);waterAt.set(id,index);return index;
  }
  function clean(poly){return poly.filter((id,k)=>!k||id!==poly[k-1]).filter((id,k,all)=>k!==all.length-1||all.length===1||id!==all[0]);}
  function fan(poly,target,index=id=>id){for(let k=1;k<poly.length-1;k++){const a=index(poly[0]),b=index(poly[k]),c=index(poly[k+1]);if(a!==b&&b!==c&&c!==a)target.push(a,b,c);}}
  for(let k=0;k<ground.indices.length;k+=3){
    const tri=Array.from(ground.indices.subarray(k,k+3)),count=tri.reduce((s,id)=>s+Number(wet[id]),0);
    if(!count){groundIndices.push(...tri);continue;}
    let ambiguous=false;
    for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(wet[a]&&wet[b]&&samples.fixed[a]&&samples.fixed[b]&&Math.abs(waterHeads[a]-waterHeads[b])>1e-6)ambiguous=true;}
    if(count===3){groundIndices.push(...tri);if(ambiguous)ambiguousTriangles++;else fan(tri,waterIndices,waterVertex);continue;}
    const wetPoly=[],dryPoly=[];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3];(wet[a]?wetPoly:dryPoly).push(a);
      if(wet[a]!==wet[b]){const root=shore(a,b);shoreData.set(root.id,root);wetPoly.push(root.id);dryPoly.push(root.id);ambiguous ||=root.conflict;}
    }
    const W=clean(wetPoly),D=clean(dryPoly);fan(W,groundIndices);fan(D,groundIndices);if(ambiguous)ambiguousTriangles++;else fan(W,waterIndices,waterVertex);
  }
  const boundary=[];
  for(let k=0;k<(ground.boundaryIndices?.length||0);k+=2){const a=ground.boundaryIndices[k],b=ground.boundaryIndices[k+1],root=roots.get(edgeKey(a,b));if(root&&root.id!==a&&root.id!==b)boundary.push(a,root.id,root.id,b);else boundary.push(a,b);}
  const fittedGround={positions:Float64Array.from(positions),elevationsM:Float64Array.from(heights),indices:Uint32Array.from(groundIndices),boundaryIndices:Uint32Array.from(boundary)};
  if(normals.length)fittedGround.normals=Float32Array.from(normals);
  const water={positions:Float64Array.from(waterPositions),elevationsM:Float64Array.from(waterElevations),normals:Float32Array.from(waterNormals),groundVertex:Uint32Array.from(waterGround),indices:Uint32Array.from(waterIndices)};
  return {ground:fittedGround,water,stats:{waterVertices:waterElevations.length,waterTriangles:waterIndices.length/3,shoreVertices:rootVertices.size,ambiguousWaterTriangles:ambiguousTriangles}};
}
