/** Snow and glacier storage in water-equivalent units. An annual budget model,
 * with monthly temperature-index snowmelt, not a glacier-motion simulator. */
import {annualPartition,YEAR_SECONDS} from './climate.mjs?v=0.7.0';
const DAYS=[31,28.25,31,30,31,30,31,31,30,31,30,31];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function seasonalCycle(latitude){
  const amplitude=3+17*Math.sin(Math.abs(latitude)*Math.PI/180);
  const offsets=[],weights=[];let sum=0;
  for(let month=0;month<12;month++){
    const summer=Math.cos((month-6)/12*Math.PI*2)*(latitude>=0?1:-1);
    offsets.push(amplitude*summer);weights.push((1-.2*summer)/12);sum+=weights[month];
  }
  weights[11]+=1-sum;
  return {amplitude,offsets,weights};
}

/** Two repeat years establish the starting snowpack. The third year's surplus
 * becomes firn/ice; any seasonal storage release is explicitly signed. */
export function annualSnowBudget({temperature,precipitation,potentialEvaporation,latitude,cycle=seasonalCycle(latitude)}){
  const p=Math.max(0,precipitation),pet=Math.max(0,potentialEvaporation);
  if(temperature-cycle.amplitude>=1)return {rainMm:p,snowfallMm:0,meltMm:0,sublimationMm:0,formationMm:0,
    seasonalChangeMm:0,startSnowMm:0,endSnowMm:0,peakSnowMm:0,snowMonths:0,freezeMonths:0,
    iceMeltCapacityMm:cycle.offsets.reduce((s,t,m)=>s+Math.max(0,temperature+t)*DAYS[m]*5,0)};
  let snow=0,start=0,rain=0,fall=0,melt=0,sub=0,peak=0,snowMonths=0,freezeMonths=0,iceCapacity=0;
  for(let year=0;year<3;year++){
    if(year===2){start=snow;peak=snow;}
    for(let month=0;month<12;month++){
      const t=temperature+cycle.offsets[month],input=p*cycle.weights[month],sf=clamp((1-t)/2,0,1);
      snow+=input*sf;
      const sublimation=Math.min(snow,t<2?pet/12*.1:0);snow-=sublimation;
      const degreeDays=Math.max(0,t)*DAYS[month],snowmelt=Math.min(snow,degreeDays*3);snow-=snowmelt;
      if(year===2){
        rain+=input*(1-sf);fall+=input*sf;melt+=snowmelt;sub+=sublimation;peak=Math.max(peak,snow);
        if(snow>10)snowMonths++;if(t<=0)freezeMonths++;
        iceCapacity+=Math.max(0,degreeDays-snowmelt/3)*5;
      }
    }
  }
  const change=snow-start,formation=Math.max(0,change);
  return {rainMm:rain,snowfallMm:fall,meltMm:melt,sublimationMm:sub,formationMm:formation,
    seasonalChangeMm:Math.min(0,change),startSnowMm:start,endSnowMm:snow-formation,peakSnowMm:peak,
    snowMonths,freezeMonths,iceMeltCapacityMm:iceCapacity};
}

export function solveCryosphere({grid:g,height,ocean,receiver,order,climate,neighbors}){
  const N=g.count,w=g.width;
  const snowfallMm=new Float32Array(N),snowmeltMm=new Float32Array(N),peakSnowMm=new Float32Array(N),snowWaterMm=new Float32Array(N);
  const iceGainMm=new Float32Array(N),iceMeltMm=new Float32Array(N),iceFlowM3s=new Float32Array(N),iceExportM3s=new Float32Array(N);
  const glacier=new Uint8Array(N),snowMonths=new Uint8Array(N),freezeMonths=new Uint8Array(N);
  const glacierId=new Int32Array(N);glacierId.fill(-1);
  const liquid=new Float64Array(N),iceSupply=new Float64Array(N),iceCapacity=new Float64Array(N);
  const effectivePET=new Float32Array(N),cycles=[];
  for(let y=0;y<g.height;y++)cycles.push(seasonalCycle(90-(y+.5)/g.height*180));
  const areaAt=i=>i<g.north?g.rowArea[(i/w)|0]:0;
  let snowfall=0,snowmelt=0,sublimation=0,formation=0,seasonalChange=0,initialSnow=0,endSnow=0;
  for(let i=0;i<N;i++){
    const row=i<g.north?(i/w)|0:i===g.north?0:g.height-1,cycle=cycles[row],temp=climate.temperature[i];
    if(ocean[i]){
      for(const offset of cycle.offsets)if(temp+offset<=-1.8)freezeMonths[i]++;
      effectivePET[i]=climate.potentialEvaporation[i];climate.runoffMm[i]=0;continue;
    }
    const b=annualSnowBudget({temperature:temp,precipitation:climate.precipitation[i],potentialEvaporation:climate.potentialEvaporation[i],cycle});
    const factor=areaAt(i)*1000/YEAR_SECONDS;
    liquid[i]=b.rainMm+b.meltMm;iceSupply[i]=b.formationMm*factor;iceCapacity[i]=b.iceMeltCapacityMm*factor;
    effectivePET[i]=Math.max(0,climate.potentialEvaporation[i]-b.sublimationMm);
    snowfallMm[i]=b.snowfallMm;snowmeltMm[i]=b.meltMm;peakSnowMm[i]=b.peakSnowMm;snowWaterMm[i]=b.endSnowMm;
    snowMonths[i]=b.snowMonths;freezeMonths[i]=b.freezeMonths;
    snowfall+=b.snowfallMm*factor;snowmelt+=b.meltMm*factor;sublimation+=b.sublimationMm*factor;
    formation+=b.formationMm*factor;seasonalChange+=b.seasonalChangeMm*factor;
    initialSnow+=b.startSnowMm*factor*YEAR_SECONDS;endSnow+=b.endSnowMm*factor*YEAR_SECONDS;
  }
  let melted=0,retained=0,calving=0,glacierArea=0,snowArea=0;
  for(let k=0;k<N;k++){
    const i=order[k];if(ocean[i])continue;
    const area=areaAt(i),factor=area*1000/YEAR_SECONDS,available=iceSupply[i],p=receiver[i];
    const melt=Math.min(available,iceCapacity[i]),remaining=Math.max(0,available-melt);
    if(factor){liquid[i]+=melt/factor;iceMeltMm[i]=melt/factor;}
    melted+=melt;iceFlowM3s[i]=available;
    // Cold pits retain their ice. Export uses existing adjacent drainage links
    // only when bed elevation descends, never an artificial filled-lake slope.
    const descends=p>=0&&height[p]<height[i];
    const stored=remaining*(descends?.08:1),exported=remaining-stored;
    retained+=stored;if(factor)iceGainMm[i]=stored/factor;
    iceExportM3s[i]=exported;
    if(exported){if(ocean[p])calving+=exported;else iceSupply[p]+=exported;}
    const annualFluxMm=factor?available/factor:0;
    if(annualFluxMm>=40){glacier[i]=1;glacierArea+=area;}
    if(peakSnowMm[i]>=20)snowArea+=area;
    climate.runoffMm[i]=annualPartition(liquid[i],effectivePET[i]).runoff;
  }
  // Both views and lake evaporation use the same liquid-water supply.
  climate.liquidInputMm=liquid;climate.effectiveEvaporationMm=effectivePET;
  const near=new Int32Array(w),queue=new Int32Array(N),glaciers=[];
  for(let start=0;start<N;start++)if(glacier[start]&&glacierId[start]<0){
    const id=glaciers.length;let a=0,b=1,area=0,gain=0,melt=0,outletCell=start,best=-1,peakCell=start;
    queue[0]=start;glacierId[start]=id;
    while(a<b){
      const i=queue[a++],ca=areaAt(i);area+=ca;gain+=iceGainMm[i]*ca*1000;melt+=iceMeltMm[i]*ca*1000;
      if(peakSnowMm[i]>peakSnowMm[peakCell])peakCell=i;
      if(iceMeltMm[i]*ca>best){best=iceMeltMm[i]*ca;outletCell=i;}
      const n=neighbors(g,i,near);for(let j=0;j<n;j++){const cell=near[j];if(glacier[cell]&&glacierId[cell]<0){glacierId[cell]=id;queue[b++]=cell;}}
    }
    glaciers.push({id,areaKm2:area,cells:b,storedGainM3:gain,meltwaterM3s:melt/YEAR_SECONDS,outletCell,peakCell});
  }
  const iceBalanceErrorM3s=Math.abs(formation-melted-retained-calving);
  if(iceBalanceErrorM3s>Math.max(1e-8,formation*1e-8))throw Error('Glacier water budget failed');
  return {snowfallMm,snowmeltMm,peakSnowMm,snowWaterMm,iceGainMm,iceMeltMm,iceFlowM3s,iceExportM3s,
    glacier,glacierId,snowMonths,freezeMonths,glaciers,
    stats:{snowAreaKm2:snowArea,glacierAreaKm2:glacierArea,glaciers:glaciers.length,snowfallM3s:snowfall,snowmeltM3s:snowmelt,
      sublimationM3s:sublimation,glacierFormationM3s:formation,glacierMeltM3s:melted,iceStorageChangeM3s:retained,
      calvingM3s:calving,seasonalStorageChangeM3s:seasonalChange,initialSnowWaterM3:initialSnow,endSnowWaterM3:endSnow,
      annualIceStoredM3:retained*YEAR_SECONDS,iceBalanceErrorM3s}};
}
