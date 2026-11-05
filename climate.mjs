/** Annual climate and water budgets. This is a procedural climate estimate,
 * not a weather simulation. mm/year, degrees C, km² and m³/s are explicit. */
export const YEAR_SECONDS=365.25*86400;
export const ZONES=['Cold','Desert','Dryland','Seasonal','Humid'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Turc–Pike annual partition: actual evaporation cannot exceed water or energy.
export function annualPartition(precipitation,potentialEvaporation){
  const p=Math.max(0,precipitation),e=Math.max(0,potentialEvaporation);
  const evaporation=p&&e?p*e/Math.hypot(p,e):0;
  return {evaporation,runoff:Math.max(0,p-evaporation)};
}

export function makeClimate({grid:g,height,ocean,noise}){
  const {width:w,height:h,count:N}=g;
  const temperature=new Float32Array(N),precipitation=new Float32Array(N),potentialEvaporation=new Float32Array(N);
  const runoffMm=new Float32Array(N),aridity=new Float32Array(N),zone=new Uint8Array(N);
  // A closed zonal circulation approximation: begin at ocean on each latitude
  // ring, transport moisture through a full wrap, and repeat for convergence.
  for(let y=0;y<h;y++){
    const lat=90-(y+.5)/h*180,p=lat*Math.PI/180,abs=Math.abs(lat),cos=Math.cos(p),py=Math.sin(p);
    const tropical=1650*Math.exp(-((abs/15)**2)),temperate=1000*Math.exp(-(((abs-51)/14)**2));
    const belt=95+tropical+temperate,wind=abs<30||abs>=65?-1:1;
    let start=0;for(let x=0;x<w;x++)if(ocean[y*w+x]){start=x;break;}
    let moisture=.65,previous=0;
    for(let pass=0;pass<3;pass++)for(let step=0;step<w;step++){
      const x=((start+step*wind)%w+w)%w,i=y*w+x,z=Math.max(0,height[i]);
      const lon=(x+.5+(y&1)*.5)/w*Math.PI*2-Math.PI,px=cos*Math.cos(lon),pz=cos*Math.sin(lon);
      const uplift=Math.max(0,z-previous),fall=Math.max(0,previous-z);
      if(ocean[i])moisture+=.18*(1-moisture);
      else moisture=clamp(moisture*Math.exp(-.003-uplift/1500)+.0008,.035,1);
      previous=z;
      if(pass<2)continue;
      const texture=1+noise(px*4+62,py*4-13,pz*4+9)*.24;
      const rain=clamp(belt*(.10+1.15*moisture)*texture*(1+Math.min(1.5,uplift/100))*Math.exp(-Math.min(1,fall/180)),12,4200);
      const temp=28-52*Math.sin(p)**2-z*.006+noise(px*2+5,py*2+19,pz*2-17)*1.6;
      temperature[i]=temp;precipitation[i]=rain;
      potentialEvaporation[i]=Math.max(35,75+37*Math.max(0,temp+7));
    }
  }
  for(const [i,row] of [[g.north,0],[g.south,h-1]]){
    let rain=0,temp=0,pet=0;
    for(let x=0;x<w;x++){rain+=precipitation[row*w+x];temp+=temperature[row*w+x];pet+=potentialEvaporation[row*w+x];}
    precipitation[i]=rain/w;temperature[i]=temp/w;potentialEvaporation[i]=pet/w;
  }
  let desertAreaKm2=0,coldAreaKm2=0;
  for(let i=0;i<N;i++){
    runoffMm[i]=annualPartition(precipitation[i],potentialEvaporation[i]).runoff;
    aridity[i]=precipitation[i]/potentialEvaporation[i];
    zone[i]=temperature[i]<-3?0:aridity[i]<.25?1:aridity[i]<.5?2:aridity[i]<1?3:4;
    if(!ocean[i]&&i<g.north){const area=g.rowArea[(i/w)|0];if(zone[i]===1)desertAreaKm2+=area;if(zone[i]===0)coldAreaKm2+=area;}
  }
  return {temperature,precipitation,potentialEvaporation,runoffMm,aridity,zone,desertAreaKm2,coldAreaKm2};
}

export function wetFraction(bed,spill,surface){
  return clamp((surface-bed)/Math.max(.001,Math.min(1,spill-bed)),0,1);
}

/** A water-limited lake contracts below its spill. Its possible spill link is
 * retained in the geographic graph, but its active outflow is zero. */
export function lakeBalance({cells,grid:g,height,climate,spillM,availableM3s}){
  const precipitation=climate.liquidInputMm||climate.precipitation,evaporativeDemand=climate.effectiveEvaporationMm||climate.potentialEvaporation;
  const areaAt=i=>i<g.north?g.rowArea[(i/g.width)|0]:0;
  let min=Infinity,capacity=0;
  for(const i of cells){
    min=Math.min(min,height[i]);
    const extra=Math.max(0,evaporativeDemand[i]-precipitation[i]+climate.runoffMm[i]);
    capacity+=areaAt(i)*extra*1000/YEAR_SECONDS;
  }
  const closed=availableM3s<capacity-1e-10;
  let surface=spillM;
  if(closed){
    let lo=min,hi=spillM;
    for(let iteration=0;iteration<42;iteration++){
      const mid=(lo+hi)/2;let loss=0;
      for(const i of cells){const f=wetFraction(height[i],spillM,mid),extra=Math.max(0,evaporativeDemand[i]-precipitation[i]+climate.runoffMm[i]);loss+=areaAt(i)*extra*1000/YEAR_SECONDS*f;}
      if(loss>availableM3s)hi=mid;else lo=mid;
    }
    surface=(lo+hi)/2;
  }
  let area=0,volume=0,evaporation=0,rain=0,wetBaseRunoff=0,netLoss=0,lonX=0,lonZ=0,latSum=0;
  for(const i of cells){
    const f=wetFraction(height[i],spillM,surface),a=areaAt(i)*f;
    area+=a;volume+=a*1e6*Math.max(0,surface-height[i]);
    evaporation+=a*evaporativeDemand[i]*1000/YEAR_SECONDS;
    rain+=a*precipitation[i]*1000/YEAR_SECONDS;
    wetBaseRunoff+=a*climate.runoffMm[i]*1000/YEAR_SECONDS;
    if(i<g.north){const y=(i/g.width)|0,lon=(i%g.width+.5+(y&1)*.5)/g.width*Math.PI*2-Math.PI;lonX+=Math.cos(lon)*a;lonZ+=Math.sin(lon)*a;latSum+=(90-(y+.5)/g.height*180)*a;}
  }
  netLoss=Math.min(availableM3s,Math.max(0,evaporation-rain+wetBaseRunoff));
  return {closed,waterLevelM:surface,wetAreaKm2:area,wetVolumeM3:volume,evaporationM3s:evaporation,
    directRainM3s:rain,wetBaseRunoffM3s:wetBaseRunoff,netEvaporationM3s:netLoss,
    outflowM3s:closed?0:Math.max(0,availableM3s-netLoss),
    status:area<.015?'playa':closed?'closed':'overflowing',wetLon:Math.atan2(lonZ,lonX)*180/Math.PI,wetLat:area?latSum/area:0};
}

export function flowRegime(dischargeM3s,areaKm2){
  const annualYield=areaKm2>0?dischargeM3s*YEAR_SECONDS/(areaKm2*1000):0;
  return dischargeM3s<1e-9?'dry':annualYield<15?'ephemeral':annualYield<100?'seasonal':'perennial';
}
