const n=(v,d=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(v);
/** Dots are fitted queries; connecting lines visualize the finite constraints.
 * This does not invent a smooth bank or cap water at the nominal channel width.
 */
export function constraintSectionSvg(section){
  const samples=section.samples,wet=samples.filter(p=>p.waterM!==null),elevations=samples.flatMap(p=>p.waterM===null?[p.groundM]:[p.groundM,p.waterM]);
  let low=Math.min(...elevations),high=Math.max(...elevations),pad=Math.max(.08,(high-low)*.1);low-=pad;high+=pad;
  const extent=Math.max(...samples.map(p=>Math.abs(p.offsetM))),x=d=>48+(d+extent)/(extent*2)*642,y=z=>180-(z-low)/(high-low)*150,xy=(x,y)=>`${x.toFixed(3)},${y.toFixed(3)}`;
  const drawnHeads=samples.map((p,k)=>p.waterM!==null?p.waterM:[samples[k-1],samples[k+1]].some(q=>q?.waterM!==null&&q?.waterM!==undefined&&Math.abs(q.waterM-p.groundM)<1e-6)?p.groundM:null);
  let axes='',fill='',water='';
  for(let k=0;k<3;k++){const z=low+(high-low)*k/2;axes+=`<path class="profile-grid" d="M48 ${y(z)}H690"/><text x="42" y="${y(z)+4}" text-anchor="end">${n(z)}</text>`;}
  for(let k=1;k<samples.length;k++){
    const a=samples[k-1],b=samples[k],ha=drawnHeads[k-1],hb=drawnHeads[k];if(ha===null||hb===null)continue;
    water+=`M${xy(x(a.offsetM),y(ha))}L${xy(x(b.offsetM),y(hb))}`;
    fill+=`<path class="profile-water-fill" d="M${xy(x(a.offsetM),y(ha))}L${xy(x(b.offsetM),y(hb))}L${xy(x(b.offsetM),y(b.groundM))}L${xy(x(a.offsetM),y(a.groundM))}Z"/>`;
  }
  const bed=samples.map((p,k)=>`${k?'L':'M'}${xy(x(p.offsetM),y(p.groundM))}`).join('');
  const points=samples.map(p=>`<circle class="profile-dot" cx="${x(p.offsetM)}" cy="${y(p.groundM)}" r="${p.offsetM===0?4:2.5}"/>`).join('');
  const heads=wet.map(p=>`<circle class="fitted-water-dot" cx="${x(p.offsetM)}" cy="${y(p.waterM)}" r="2.5"/>`).join('');
  return `<svg viewBox="0 0 720 235" role="img" aria-label="Fitted mesh section. Nine actual surface queries across channel core, nominal width, shoulders and outer support."><title>Fitted surface constraints at a saved global section</title><text x="48" y="15">Elevation (m)</text>${axes}${fill}<path class="profile-bed" d="${bed}"/><path class="profile-water" d="${water}"/>${points}${heads}<path class="profile-marker" d="M${x(0)} 25V185"/><text x="48" y="199">${n(-extent)}</text><text x="369" y="199" text-anchor="middle">0</text><text x="690" y="199" text-anchor="end">${n(extent)}</text><text x="369" y="224" text-anchor="middle">Offset from channel center (m)</text></svg>`;
}
