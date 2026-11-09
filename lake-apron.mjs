import {neighbors} from './planet.mjs?v=0.9.18';
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

/** Grade the foot of a steep lake margin while keeping its mapped waterline.
 * Positive heights are cut, submerged heights are filled, and both transitions
 * taper continuously. This is a landform proxy, not a sediment mass balance. */
export function apronProfile(above,strength){
  const window=smooth(-140,-70,above)*(1-smooth(150,450,above));
  const target=.45*above,delta=Math.max(-60,Math.min(42,target-above));
  return delta*window*Math.max(0,Math.min(1,strength))||0;
}

export function createLakeApron(model,mesh){
  const exposure=new Float32Array(model.grid.count),near=new Int32Array(model.grid.width),R=model.grid.radiusKm*1000;
  // Store source exposure on both sides of each steep lake edge. Interpolating
  // one shared field avoids independent, sharply bounded fan-shaped overlays.
  for(let i=0;i<model.grid.count;i++){
    if(model.height[i]<1000||model.ocean[i]||model.waterbody[i]>=0)continue;
    const n=neighbors(model.grid,i,near),d=mesh.directionAt(i);
    for(let k=0;k<n;k++){
      const j=near[k],id=model.waterbody[j],lake=model.waterbodies?.[id];
      if(id<0||!lake||lake.status==='playa')continue;
      const drop=model.height[i]-lake.waterLevelM;
      const distance=Math.hypot(...mesh.directionAt(j).map((v,k)=>v-d[k]))*R;
      const amount=smooth(80,200,drop)*smooth(.35,.8,drop/Math.max(1,distance));
      exposure[i]=Math.max(exposure[i],amount);exposure[j]=Math.max(exposure[j],amount);
    }
  }
  return {sample(q,terrainM,planes,{glacier=0,lava=0,riverMarginM=Infinity}={}){
    const e=smooth(0,1,q.cells.reduce((s,i,k)=>s+exposure[i]*q.weights[k],0))
      *(1-smooth(.01,.2,glacier))*(1-smooth(.02,.3,lava))*smooth(0,150,riverMarginM);
    let delta=0,cover=0;
    for(const p of planes.values()){
      if(p.kind!=='pool')continue;
      let mask=smooth(0,.15,p.support);
      // Keep the separating saddle between incompatible water planes intact.
      for(const other of planes.values())if(other.id!==p.id)mask*=1-smooth(0,.05,other.support);
      const a=terrainM-p.waterM;
      delta+=apronProfile(a,e*mask);
      cover=Math.max(cover,e*mask*smooth(-100,-30,a)*(1-smooth(150,280,a)));
    }
    return {deltaM:Math.max(-60,Math.min(42,delta)),cover};
  }};
}
