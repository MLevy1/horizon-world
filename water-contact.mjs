/** Procedural surface fitting only. Annual water budgets and receivers remain
 * authoritative and unchanged. This is not a transient fluid simulation.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;

export function createContactFitter(m){
  const p=m.riverProfiles,E=p.from.length,start=new Float64Array(E),end=new Float64Array(E).fill(1);
  let waterContacts=0,shoreIntersections=0;
  for(let e=0;e<E;e++){
    const a=p.from[e],b=p.to[e],ha=m.height[a],hb=m.height[b];
    if(p.kind[a]===2||p.kind[b]===2||p.kind[b]===3)waterContacts++;
    if(p.kind[a]===2&&ha<p.waterM[a]&&hb>p.waterM[a])start[e]=clamp((p.waterM[a]-ha)/(hb-ha),0,1);
    if((p.kind[b]===2||p.kind[b]===3)&&ha>p.waterM[b]&&hb<p.waterM[b])end[e]=clamp((p.waterM[b]-ha)/(hb-ha),0,1);
    if(start[e]>end[e])throw Error('Overlapping incompatible water contacts');
    if(start[e]>0||end[e]<1)shoreIntersections++;
  }
  function fit(r){
    const e=r.edge,a=p.from[e],b=p.to[e],t=r.t,s=start[e],f=end[e];
    const ds=mix(p.designDepthM[a],p.designDepthM[b],s),df=mix(p.designDepthM[a],p.designDepthM[b],f);
    const bs=s>0?p.waterM[a]-ds:p.bedM[a],bf=f<1?p.waterM[b]-df:p.bedM[b];
    let waterM,bedM;
    if(s>0&&t<s){waterM=p.waterM[a];bedM=mix(p.bedM[a],bs,t/s);}
    else if(f<1&&t>f){waterM=p.waterM[b];bedM=mix(bf,p.bedM[b],(t-f)/(1-f));}
    else{const u=f>s?clamp((t-s)/(f-s),0,1):0;waterM=mix(p.waterM[a],p.waterM[b],u);bedM=mix(bs,bf,u);}
    if(t===0){waterM=p.waterM[a];bedM=p.bedM[a];}
    if(t===1){waterM=p.waterM[b];bedM=p.bedM[b];}
    return {...r,waterM,bedM,centerTerrainM:mix(m.height[a],m.height[b],t),startContactT:s,endContactT:f};
  }
  return {fit,start,end,stats:{profileEdges:E,waterContacts,shoreIntersections}};
}

/** A continuous distance-weighted blend of overlapping channel patches.
 * Near a centerline its own profile dominates; shared junction endpoints
 * have identical anchors. Outside every support, the original scaffold wins.
 * Wet standing-water areas keep a flat plane and can only be cut, never filled.
 */
export function composeWaterSurface(terrainM,plane,rivers){
  const standing=plane&&terrainM<plane.waterM,baseHead=standing?plane.waterM:plane?Math.max(plane.waterM,terrainM-.25):terrainM-.25;
  if(!rivers.length)return {groundM:terrainM,waterM:standing?plane.waterM:null,depthM:standing?plane.waterM-terrainM:0,kind:standing?plane.kind:'land',potentialWaterM:plane?plane.waterM:null};
  const exact=rivers.filter(r=>r.distanceM<1e-6),active=exact.length?exact:rivers;
  let sum=0,ground=0,head=0,maxFade=0,wetCore=false;
  for(const r of active){
    const left=(r.signedDistanceM??r.distanceM)>=0,half=(left?r.leftHalfM:r.rightHalfM)??r.widthM/2,bank=(left?r.leftBankM:r.rightBankM)??Math.max(1,r.widthM*.35),exponent=(left?r.leftExponent:r.rightExponent)??2,u=r.distanceM/half;
    const fade=1-smooth((r.distanceM-half)/bank);if(!fade)continue;
    const weight=fade/(u*u+1e-8);maxFade=Math.max(maxFade,fade);
    let h=r.waterM;
    if(plane){
      const delta=Math.max(0,terrainM-plane.waterM),scale=Math.max(.25,Math.abs(h-plane.waterM)+r.freeboardM);
      const influence=standing?1:smooth(plane.support*scale/Math.max(1e-9,delta));
      h=mix(h,plane.waterM,influence);
    }
    const depth=Math.max(r.designDepthM,r.waterM-r.bedM),freeboard=r.freeboardM*((left?r.leftFreeboard:r.rightFreeboard)??1)*(plane?smooth((terrainM-plane.waterM)/Math.max(1,r.freeboardM)):1);
    let g;
    if(u<=1)g=h-depth*(1-u**exponent);
    else{
      const s=clamp((r.distanceM-half)/bank,0,1),peak=Math.max(terrainM,h+freeboard);
      g=s<.5?mix(h,peak,smooth(s*2)):mix(peak,terrainM,smooth(s*2-1));
    }
    if(standing){h=plane.waterM;g=Math.min(terrainM,g);}
    wetCore ||=r.wet&&u<1;
    sum+=weight;ground+=weight*g;head+=weight*h;
  }
  const base=1-maxFade;sum+=base;ground+=base*terrainM;head+=base*baseHead;
  if(!sum)return {groundM:terrainM,waterM:standing?plane.waterM:null,depthM:standing?plane.waterM-terrainM:0,kind:standing?plane.kind:'land',potentialWaterM:plane?plane.waterM:null};
  ground/=sum;head/=sum;
  if(standing){ground=Math.min(ground,terrainM);head=plane.waterM;}
  const flooded=plane&&ground<plane.waterM;
  if(flooded)head=Math.max(head,plane.waterM);
  const wet=(standing||wetCore||flooded)&&head-ground>1e-7;
  return {groundM:ground,waterM:wet?head:null,depthM:wet?head-ground:0,
    kind:wet?(plane&&Math.abs(head-plane.waterM)<1e-8?plane.kind:'river'):'land',potentialWaterM:plane||active.some(r=>r.wet)?head:null};
}
