/**
 * Horizon Alpha 5.4 — shared shoreline triangulation.
 *
 * Split existing terrain triangles at the geographic wet/dry contour, and
 * derive BOTH the riverbed edge and water geometry from the same intersection
 * vertices. There is no independent ribbon/riverbank shoreline in this path.
 * All coordinates are absolute; clipping happens per indexed triangle.
 *
 * Thin source rivulets smaller than the sampling scale remain dry/vegetated
 * swales, rather than appearing as dashed strips in isolated grid cells.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const indexOf=(arr,i)=>arr[i*3];
export function sharedChannelMesh(grid,{sample,waterColor,minimumHalfWidth=.7}){
 if(typeof sample!=='function'||typeof waterColor!=='function')throw new TypeError('Missing shared geographic sample or water color');
 const {positions,indices}=grid,N=positions.length/3;
 const queries=new Array(N);
 const verts=[],faces=[],waterVerts=[],waterFaces=[],waterColors=[],waterUV=[];
 const cache=new Map(),waterCache=new Map();
 let waterTriangles=0,contourEdges=0;
 function resolve(i){
  if(queries[i])return queries[i];
  const x=positions[i*3],z=positions[i*3+2],p=sample(x,z);
  const river=p.feature?.kind==='river'?p.feature:null;
  // A tiny stream cannot be resolved reliably by the rendered triangles.
  const wet=!!river && river.width>=minimumHalfWidth && p.shoreDistance<=0 &&
    Number.isFinite(p.waterElevation) && p.waterElevation>p.ground+.025;
  const signed=river?Math.max(-1000,Math.min(1000,p.shoreDistance)):(wet?-1:1000);
  return queries[i]={x,z,ground:positions[i*3+1],water:river?.water??p.waterElevation,
    wet,signed,feature:river,flowDistance:river?.flowDistance??0};
 }
 function corner(i){
  const q=resolve(i);return {...q,key:'v'+i};
 }
 function cross(a,b){
  const key=[a.key,b.key].sort().join('/');
  const id='e'+key;
  const t=clamp(a.signed/(a.signed-b.signed));
  const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  const p=sample(x,z);
  const water=Number.isFinite(p.feature?.water)?p.feature.water:
    (Number.isFinite(a.water)?a.water:b.water);
  return {x,z,ground:Math.min(a.ground+(b.ground-a.ground)*t,water-.025),
    water,wet:true,signed:0,key:id,feature:p.feature||a.feature||b.feature,
    flowDistance:a.flowDistance+(b.flowDistance-a.flowDistance)*t,boundary:true};
 }
 function clip(poly,keepWet){
  const result=[];
  for(let j=0;j<poly.length;j++){
   const a=poly[j],b=poly[(j+1)%poly.length];
   const ia=keepWet?a.wet:!a.wet,ib=keepWet?b.wet:!b.wet;
   if(ia)result.push(a);
   if(ia!==ib)result.push(cross(a,b));
  }
  return result;
 }
 function terrainVertex(v){
  const key=v.key;
  if(cache.has(key))return cache.get(key);
  const y=v.boundary?Math.min(v.ground,v.water-.025):v.wet&&Number.isFinite(v.water)
    ?Math.min(v.ground,v.water-.05):v.ground;
  const id=verts.length/3;verts.push(v.x,y,v.z);cache.set(key,id);return id;
 }
 function waterVertex(v){
  if(waterCache.has(v.key))return waterCache.get(v.key);
  const y=(Number.isFinite(v.water)?v.water:v.ground)+.09;
  const ground=v.boundary?y-.09:v.ground;
  const depth=Math.max(0,y-ground);
  const col=waterColor(depth,v.flowDistance,1,0);
  const id=waterVerts.length/3;
  waterVerts.push(v.x,y,v.z);waterColors.push(...col);
  waterUV.push(v.x/12,v.z/22);
  waterCache.set(v.key,id);
  return id;
 }
 function fan(poly,wet,waterOnly=false){
  if(poly.length<3)return;
  const ids=poly.map(waterOnly?waterVertex:terrainVertex);
  for(let j=1;j+1<ids.length;j++){
   // The source mesh is consistently wound +Y; clipping preserves winding.
   (waterOnly?waterFaces:faces).push(ids[0],ids[j],ids[j+1]);
   if(waterOnly)waterTriangles++;
  }
 }
 for(let k=0;k<indices.length;k+=3){
  const trio=[corner(indices[k]),corner(indices[k+1]),corner(indices[k+2])];
  const count=trio.filter(v=>v.wet).length;
  if(count===0){fan(trio,false);continue}
  if(count===3){fan(trio,true);fan(trio,true,true);continue}
  contourEdges+=2;
  fan(clip(trio,false),false);
  const wet=clip(trio,true);
  fan(wet,true);fan(wet,true,true);
 }
 return {terrain:{positions:verts,indices:faces},water:{
  positions:waterVerts,indices:waterFaces,uvs:waterUV,colors:waterColors
 },stats:{waterTriangles,contourEdges,triangles:indices.length/3}};
}
