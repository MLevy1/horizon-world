import {sampleRiverEdge} from './river-profiles.mjs?v=0.9.18';

/** Inspection only. Follow existing profile edges to the next fixed water
 * plane; never bridge an unprofiled lake interior or generate new drainage.
 */
export function inspectionRoute(p,start){
  if(!Number.isInteger(start)||start<0||start>=p.kind.length||p.edgeAtCell[start]<0)return null;
  const edges=[],cells=[start],distanceM=[0];let i=start;
  while(p.edgeAtCell[i]>=0){
    const edge=p.edgeAtCell[i],next=p.to[edge],length=p.lengthM[edge];
    if(p.from[edge]!==i||!(length>0&&Number.isFinite(length)))throw Error('Invalid inspection route');
    edges.push(edge);cells.push(next);distanceM.push(distanceM.at(-1)+length);
    if(edges.length>p.kind.length)throw Error('Cyclic inspection route');
    if(p.kind[next]===2||p.kind[next]===3)break;
    i=next;
  }
  return {edges:Int32Array.from(edges),cells:Int32Array.from(cells),distanceM:Float64Array.from(distanceM),totalLengthM:distanceM.at(-1)};
}

export function inspectionStation(p,route,distanceM){
  if(!route?.edges.length||!Number.isFinite(distanceM))throw Error('Invalid inspection station');
  const distance=Math.max(0,Math.min(route.totalLengthM,distanceM));let lo=0,hi=route.edges.length-1;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(route.distanceM[mid]<=distance)lo=mid;else hi=mid-1;}
  const index=lo,edge=route.edges[index],t=distance===route.totalLengthM?1:Math.min(1,(distance-route.distanceM[index])/p.lengthM[edge]);
  const a=p.from[edge],b=p.to[edge],s=sampleRiverEdge(p,edge,t);
  return {...s,edge,index,t,distanceM:distance,freeboardM:p.freeboardM[a]+(p.freeboardM[b]-p.freeboardM[a])*t};
}

/** Illustrative minimum channel section from the shared design dimensions. This
 * curve is not a sampled terrain shoreline and does not alter the model.
 */
export function designSection(s){
  const points=[],half=s.widthM/2,depth=s.designDepthM;
  for(let k=0;k<=64;k++){
    const xM=(k-32)/40*s.widthM,abs=Math.abs(xM);
    const bedM=abs<=half?s.waterM-depth*(1-(xM/half)**2):s.waterM+s.freeboardM*Math.min(1,(abs-half)/(s.widthM*.3));
    points.push({xM,bedM,waterM:s.wet&&abs<=half?s.waterM:null});
  }
  return points;
}

const n=(v,d=1)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(v);
const xy=(x,y)=>`${x.toFixed(2)},${y.toFixed(2)}`;
function axes(xLabel,low,high,y){
  let out=`<text x="48" y="15">Elevation (m)</text><text x="368" y="212" text-anchor="middle">${xLabel}</text>`;
  for(let k=0;k<3;k++){const value=low+(high-low)*k/2,py=y(value);out+=`<path class="profile-grid" d="M48 ${py}H690"/><text x="42" y="${py+4}" text-anchor="end">${n(value)}</text>`;}
  return out;
}
export function longitudinalSvg(p,route,station){
  const cells=[...route.cells];let low=Infinity,high=-Infinity;
  for(const i of cells){low=Math.min(low,p.bedM[i]);high=Math.max(high,p.waterM[i]);}
  const pad=Math.max(.15,(high-low)*.08);low-=pad;high+=pad;
  const x=d=>48+d/route.totalLengthM*642,y=z=>180-(z-low)/(high-low)*150;
  let water='',dry='',fill='',bed='';
  for(let k=0;k<cells.length;k++){const i=cells[k];bed+=`${k?'L':'M'}${xy(x(route.distanceM[k]),y(p.bedM[i]))}`;}
  for(let k=0;k<route.edges.length;k++){
    const e=route.edges[k],a=p.from[e],b=p.to[e],xa=x(route.distanceM[k]),xb=x(route.distanceM[k+1]);
    const line=`M${xy(xa,y(p.waterM[a]))}L${xy(xb,y(p.waterM[b]))}`;
    if(p.wetEdge[e]){water+=line;fill+=`<path class="profile-water-fill" d="${line}L${xy(xb,y(p.bedM[b]))}L${xy(xa,y(p.bedM[a]))}Z"/>`;}else dry+=line;
  }
  const marker=x(station.distanceM);
  return `<svg viewBox="0 0 720 220" role="img" aria-label="Downstream river profile. Water and bed elevations against distance; dry design levels are dashed."><title>Downstream profile to the next lake or ocean</title>${axes('Downstream distance (km)',low,high,y)}${fill}<path class="profile-bed" d="${bed}"/><path class="profile-water" d="${water}"/><path class="profile-dry" d="${dry}"/><path class="profile-marker" d="M${marker} 25V185"/><circle class="profile-dot" cx="${marker}" cy="${y(station.waterM)}" r="4"/><text x="48" y="197">0</text><text x="690" y="197" text-anchor="end">${n(route.totalLengthM/1000,2)}</text></svg>`;
}

export function sectionSvg(station){
  const points=designSection(station),low=station.waterM-station.designDepthM-Math.max(.05,station.designDepthM*.08);
  const high=station.waterM+station.freeboardM*1.4,x=d=>369+d/(station.widthM*.8)*321,y=z=>180-(z-low)/(high-low)*150;
  const line=points.map((p,k)=>`${k?'L':'M'}${xy(x(p.xM),y(p.bedM))}`).join('');
  const wet=points.filter(p=>p.waterM!==null);
  const fill=wet.length?`<path class="profile-water-fill" d="M${xy(x(wet[0].xM),y(station.waterM))}L${xy(x(wet.at(-1).xM),y(station.waterM))}${[...wet].reverse().map(p=>'L'+xy(x(p.xM),y(p.bedM))).join('')}Z"/>`:'';
  const water=`M${xy(x(-station.widthM/2),y(station.waterM))}H${x(station.widthM/2)}`;
  return `<svg viewBox="0 0 720 220" role="img" aria-label="Design river cross-section. Saved channel width and minimum design depth; horizontal and vertical scales differ."><title>Minimum design cross-section${station.wet?'':' — dry channel'}</title>${axes('Distance from channel center (m)',low,high,y)}${fill}<path class="profile-bed" d="${line}"/><path class="${station.wet?'profile-water':'profile-dry'}" d="${water}"/><text x="48" y="197">${n(-station.widthM*.8,2)}</text><text x="369" y="197" text-anchor="middle">0</text><text x="690" y="197" text-anchor="end">${n(station.widthM*.8,2)}</text></svg>`;
}
