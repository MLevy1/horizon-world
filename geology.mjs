/** Deterministic volcanic geography on a closed sphere. These are broad static
 * landforms and cooled deposits, prepared BEFORE the global hydrology solve. */
export const VOLCANO_TYPES=['Composite cone','Shield volcano','Caldera','Cinder cone'];
const RAD=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
function randomFor(seed){
  let h=2166136261;for(const c of String(seed))h=Math.imul(h^c.charCodeAt(0),16777619);
  return ()=>{h=(h+0x6D2B79F5)|0;let n=Math.imul(h^(h>>>15),1|h);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function greatCircleKm(a,b,radiusKm){
  const p=a.lat*RAD,q=b.lat*RAD,l=(a.lon-b.lon)*RAD;
  return radiusKm*Math.acos(clamp(Math.sin(p)*Math.sin(q)+Math.cos(p)*Math.cos(q)*Math.cos(l),-1,1));
}
export function destination(point,bearing,distanceKm,radiusKm){
  const p=point.lat*RAD,l=point.lon*RAD,b=bearing*RAD,d=distanceKm/radiusKm;
  const lat=Math.asin(clamp(Math.sin(p)*Math.cos(d)+Math.cos(p)*Math.sin(d)*Math.cos(b),-1,1));
  const lon=l+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p),Math.cos(d)-Math.sin(p)*Math.sin(lat));
  return {lon:((lon/RAD+180)%360+360)%360-180,lat:lat/RAD};
}
export function volcanicProfile(site,distanceKm){
  const t=distanceKm/site.radiusKm;if(t>=1)return {heightM:site.baseM,blend:0,crater:false};
  const blend=1-smooth(clamp((t-.65)/.35,0,1));
  let rise;
  if(site.type===1)rise=site.reliefM*(1-t*t)**2;
  else if(site.type===2)rise=site.reliefM*(1-t*t)**2;
  else rise=site.reliefM*(1-t)**1.45;
  const craterRadius=site.type===2?.35:site.type===3?.28:site.type===0?.16:0;
  const crater=t<craterRadius;
  if(crater){const depth=site.type===2?.80:site.type===3?.45:.35;rise-=site.reliefM*depth*(1-(t/craterRadius)**2)**2;}
  return {heightM:site.baseM+rise,blend,crater};
}

/** Spherical dot products, including the longitude seam and both poles. */
export function applyVolcanicSites({grid:g,height,sites}){
  const ids=new Int16Array(g.count),crater=new Uint8Array(g.count),change=new Float32Array(g.count);
  ids.fill(-1);
  const lonCos=[new Float64Array(g.width),new Float64Array(g.width)],lonSin=[new Float64Array(g.width),new Float64Array(g.width)];
  for(let parity=0;parity<2;parity++)for(let x=0;x<g.width;x++){
    const l=(x+.5+parity*.5)/g.width*Math.PI*2-Math.PI;lonCos[parity][x]=Math.cos(l);lonSin[parity][x]=Math.sin(l);
  }
  function sculpt(site,i,d){
    const p=volcanicProfile(site,d);if(!p.blend)return;
    const before=height[i];height[i]=before*(1-p.blend)+p.heightM*p.blend;
    change[i]+=height[i]-before;ids[i]=site.id;if(p.crater)crater[i]=1;
  }
  for(const site of sites){
    const p=site.lat*RAD,l=site.lon*RAD,cx=Math.cos(p)*Math.cos(l),cy=Math.sin(p),cz=Math.cos(p)*Math.sin(l);
    const angle=site.radiusKm/g.radiusKm,cutoff=Math.cos(angle),latSpan=angle/RAD;
    const from=Math.max(0,Math.floor((90-site.lat-latSpan)/180*g.height)),to=Math.min(g.height-1,Math.ceil((90-site.lat+latSpan)/180*g.height));
    for(let y=from;y<=to;y++){
      const lat=(90-(y+.5)/g.height*180)*RAD,cp=Math.cos(lat),sp=Math.sin(lat),parity=y&1;
      for(let x=0;x<g.width;x++){
        const dot=sp*cy+cp*(lonCos[parity][x]*cx+lonSin[parity][x]*cz);
        if(dot<cutoff)continue;sculpt(site,y*g.width+x,g.radiusKm*Math.acos(clamp(dot,-1,1)));
      }
    }
    for(const [i,lat] of [[g.north,90],[g.south,-90]]){
      const d=greatCircleKm(site,{lon:0,lat},g.radiusKm);if(d<site.radiusKm)sculpt(site,i,d);
    }
  }
  return {ids,crater,change};
}

export function makeVolcanicGeography({grid:g,height,seed,neighbors,cellAt,lonLat,enabled=true}){
  const random=randomFor(seed+'|volcanic-geography'),sites=[],chains=[];
  const coordinates=i=>{const [lon,lat]=lonLat(g,i);return {lon,lat};};
  const separated=(point,radius)=>sites.every(s=>greatCircleKm(point,s,g.radiusKm)>Math.max(2.3,radius+s.radiusKm)*1.1);
  const profiles=[{radius:[1.5,2.4],relief:[500,900]},{radius:[2.9,4.5],relief:[270,520]},
    {radius:[2.2,3.3],relief:[500,850]},{radius:[.8,1.3],relief:[210,400]}];
  function add(point,chain){
    const cell=cellAt(g,point.lon,point.lat),base=height[cell];
    if(base< -850||base>1600)return false;
    const type=sites.length%4,profile=profiles[type],radius=profile.radius[0]+random()*(profile.radius[1]-profile.radius[0]);
    if(!separated(point,radius))return false;
    const id=sites.length,snapped=coordinates(cell),relief=profile.relief[0]+random()*(profile.relief[1]-profile.relief[0]);
    sites.push({id,name:'Volcano '+String(id+1).padStart(2,'0'),type,typeName:VOLCANO_TYPES[type],chain,
      ...snapped,centerCell:cell,radiusKm:radius,reliefM:relief,baseM:base,flowBearing:random()*360,waterbodyIds:[]});
    return true;
  }
  if(enabled){
    for(let chain=0;chain<4;chain++){
      let anchor=null,best=Infinity;
      for(let attempt=0;attempt<500;attempt++){
        const cell=Math.floor(random()*g.north),p=coordinates(cell),target=chain===3?-300:450;
        const score=Math.abs(height[cell]-target);
        if(Math.abs(p.lat)<77&&height[cell]>-700&&height[cell]<1400&&separated(p,4)&&score<best){anchor=p;best=score;}
      }
      if(!anchor)continue;
      let bearing=random()*360,point=anchor;const members=[];
      for(let member=0;member<5;member++){
        if(add(point,chain))members.push(sites.length-1);
        bearing+=(random()-.5)*34;point=destination(point,bearing,7+random()*5,g.radiusKm);
      }
      chains.push({id:chain,kind:chain===3?'Oceanic hotspot chain':'Procedural volcanic arc',sites:members});
    }
    // Isolated centers supplement the chains wherever suitable global geography exists.
    for(let attempt=0;attempt<300&&sites.length<22;attempt++){
      const cell=Math.floor(random()*g.north),p=coordinates(cell);
      if(height[cell]>-600&&height[cell]<1300)add(p,-1);
    }
  }
  const original=height.slice(),{ids,crater,change}=applyVolcanicSites({grid:g,height,sites});
  const lava=new Uint8Array(g.count),depositM=new Float32Array(g.count),flows=[],near=new Int32Array(g.width);
  for(const site of sites){
    const sources=site.type===1?3:2;
    for(let source=0;source<sources;source++){
      const flank=destination(site,site.flowBearing+source*137,site.radiusKm*(site.type===2?.62:.30),g.radiusKm);
      let cell=cellAt(g,flank.lon,flank.lat),length=0;const path=[],before=[];
      while(path.length<110&&length<site.radiusKm*2.8){
        path.push(cell);before.push(height[cell]);if(height[cell]<=-40)break;
        const n=neighbors(g,cell,near);let next=-1,best=0;
        for(let k=0;k<n;k++){
          const j=near[k],d=greatCircleKm(coordinates(cell),coordinates(j),g.radiusKm);
          const slope=(height[cell]-height[j])/Math.max(1e-5,d);
          if(slope>best){best=slope;next=j;}
        }
        if(next<0)break;
        length+=greatCircleKm(coordinates(cell),coordinates(next),g.radiusKm);cell=next;
      }
      if(path.length<2)continue;
      length=0;for(let k=1;k<path.length;k++)length+=greatCircleKm(coordinates(path[k-1]),coordinates(path[k]),g.radiusKm);
      const thickness=4+random()*10;
      for(let k=0;k<path.length;k++){
        const i=path[k],deposit=thickness*(1-.65*k/path.length);
        height[i]+=deposit;depositM[i]+=deposit;lava[i]=1;ids[i]=site.id;
        const n=neighbors(g,i,near);
        for(let t=0;t<n;t++){
          const j=near[t];if(j>=g.north)continue;
          height[j]+=deposit*.20;depositM[j]+=deposit*.20;lava[j]=1;if(ids[j]<0)ids[j]=site.id;
        }
      }
      flows.push({id:flows.length,site:site.id,path:Int32Array.from(path),preDepositElevations:Float32Array.from(before),lengthKm:length,nominalThicknessM:thickness});
    }
  }
  let affected=0,lavaCells=0,addedLand=0;
  for(let i=0;i<g.count;i++){
    change[i]=height[i]-original[i];if(change[i]!==0)affected++;if(lava[i])lavaCells++;
    if(original[i]<=0&&height[i]>0)addedLand++;
  }
  for(const site of sites)site.centerElevationM=height[site.centerCell];
  return {sites,chains,ids,crater,change,lava,depositM,flows,
    stats:{sites:sites.length,chains:chains.length,cooledFlows:flows.length,affectedCells:affected,lavaCells,newLandCells:addedLand}};
}

export function linkVolcanoWater(model){
  const {geology,waterbody,ocean,height}=model;
  const inventories=geology.sites.map(()=>new Set());
  for(let i=0;i<geology.ids.length;i++)if(geology.ids[i]>=0&&waterbody[i]>=0)inventories[geology.ids[i]].add(waterbody[i]);
  for(const site of geology.sites){
    site.waterbodyIds=[...inventories[site.id]];
    site.craterWaterbody=waterbody[site.centerCell];site.submerged=!!ocean[site.centerCell];
    site.centerElevationM=height[site.centerCell];
  }
  geology.stats.craterBasins=geology.sites.filter(s=>s.craterWaterbody>=0).length;
}
