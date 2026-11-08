const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
/** A bounded formative episode, not years of resolved landscape evolution.
 * Weathering converts bedrock into three loose grain inventories. Synchronous
 * gravity transport conserves their area-weighted volumes on the spherical grid.
 * Hydrology must be solved AFTER this function changes height. Units: metres. */
export function generateSediment({grid:g,height,neighbors,distanceKm,lava=null,passes=8}){
 const started=performance.now(),N=g.count,bedrock=height.slice(),coarse=new Float32Array(N),gravel=new Float32Array(N),fines=new Float32Array(N),changeM=new Float32Array(N),near=new Int32Array(g.width);
 const area=i=>i<g.north?g.rowArea[(i/g.width)|0]*1e6:0;
 let weatheredM3=0,initialM3=0;
 for(let i=0;i<g.north;i++){
  if(height[i]<=0||lava?.[i]>.3)continue;
  const n=neighbors(g,i,near);let slope=0;
  for(let k=0;k<n;k++){const j=near[k];if(j>=g.north)continue;slope=Math.max(slope,Math.abs(height[i]-height[j])/Math.max(1,distanceKm(g,i,j)*1000));}
  const latitude=90-(((i/g.width)|0)+.5)*180/g.height;
  const temperature=28-52*Math.sin(latitude*Math.PI/180)**2-Math.max(0,height[i])*.006;
  const alpine=smooth(700,1800,height[i]),exposure=smooth(.25,.9,slope),frost=1-smooth(0,18,Math.abs(temperature+2));
  const weathered=(1.5+95*alpine*exposure*(.65+.35*frost))*(1-(lava?.[i]||0));
  const blocks=.10+.65*alpine*exposure,small=.25;
  coarse[i]=weathered*blocks;gravel[i]=weathered*small;fines[i]=weathered*(1-blocks-small);
  bedrock[i]=height[i]-coarse[i]-gravel[i]-fines[i];changeM[i]=coarse[i]+gravel[i]+fines[i];
  weatheredM3+=weathered*area(i);initialM3+=changeM[i]*area(i);
 }
 const old=[new Float32Array(N),new Float32Array(N),new Float32Array(N)],layers=[coarse,gravel,fines],repose=[.65,.50,.28];
 let transportedM3=0;
 for(let pass=0;pass<passes;pass++){
  old.forEach((v,k)=>v.set(layers[k]));
  for(let i=0;i<g.north;i++){
   if(old[0][i]+old[1][i]+old[2][i]<.001)continue;
   const n=neighbors(g,i,near);let target=-1,gradient=0,run=1;
   for(let k=0;k<n;k++){const j=near[k];if(j>=g.north)continue;const d=Math.max(1,distanceKm(g,i,j)*1000),s=(height[i]-height[j])/d;if(s>gradient){gradient=s;target=j;run=d;}}
   if(target<0)continue;
   const ratio=area(i)/area(target);
   // All grain fluxes share a height budget, avoiding overshoot or inversion.
   let availableDrop=(height[i]-height[target])*.45/(1+ratio);
   for(let k=0;k<3;k++){
    const excess=Math.max(0,(gradient-repose[k])*run)/(1+ratio);
    const amount=Math.min(old[k][i]*.8,excess*.45,availableDrop);
    if(amount<=0)continue;
    layers[k][i]-=amount;layers[k][target]+=amount*ratio;availableDrop-=amount;transportedM3+=amount*area(i);
   }
  }
  for(let i=0;i<g.north;i++)height[i]=bedrock[i]+coarse[i]+gravel[i]+fines[i];
 }
 let finalM3=0,depositedM3=0,erodedM3=0,maxDepositM=0,changedCells=0;
 for(let i=0;i<g.north;i++){
  const depth=coarse[i]+gravel[i]+fines[i],net=depth-changeM[i];changeM[i]=net;finalM3+=depth*area(i);
  if(net>0){depositedM3+=net*area(i);maxDepositM=Math.max(maxDepositM,net);}else erodedM3-=net*area(i);
  if(Math.abs(net)>.01)changedCells++;
 }
 return {bedrock,coarse,gravel,fines,changeM,stats:{passes,initialM3,finalM3,weatheredM3,transportedM3,depositedM3,erodedM3,maxDepositM,changedCells,relativeVolumeError:Math.abs(finalM3-initialM3)/Math.max(1,initialM3),generationMs:performance.now()-started,retainedBytes:5*N*4}};
}
/** The same continuous substrate query drives materials, clasts and vegetation. */
export function sampleSediment(s,cells,weights){
 if(!s)return {thicknessM:0,depositM:0,coarse:0,gravel:0,fines:0,stoneCover:0,soilDepthM:0};
 const blend=a=>cells.reduce((sum,i,k)=>sum+a[i]*weights[k],0),coarse=blend(s.coarse),gravel=blend(s.gravel),fines=blend(s.fines),thicknessM=coarse+gravel+fines,depositM=Math.max(0,blend(s.changeM));
 const mineral=smooth(.3,3,coarse+gravel),coarseFraction=(coarse+gravel)/Math.max(.001,thicknessM),stoneCover=mineral*smooth(.25,.7,coarseFraction);
 return {thicknessM,depositM,coarse:coarse/Math.max(.001,thicknessM),gravel:gravel/Math.max(.001,thicknessM),fines:fines/Math.max(.001,thicknessM),stoneCover,soilDepthM:Math.min(3,fines)*(1-stoneCover)};
}
