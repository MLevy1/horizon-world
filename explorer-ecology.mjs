import {neighbors} from './planet.mjs?v=0.9.18';
const clamp=x=>Math.max(0,Math.min(1,x));
/** A small coastal buffer on the existing planet grid; no new water or terrain. */
export function buildCoastalFields(model){
 const N=model.grid.count,band=new Uint8Array(N).fill(255),exposure=new Float32Array(N),queue=new Int32Array(N),near=new Int32Array(model.grid.width);let head=0,tail=0;
 for(let i=0;i<N;i++)if(model.ocean[i]){band[i]=0;exposure[i]=1;queue[tail++]=i;}
 while(head<tail){const i=queue[head++];if(band[i]>=3)continue;const n=neighbors(model.grid,i,near);for(let k=0;k<n;k++){const j=near[k];if(band[j]>band[i]+1){band[j]=band[i]+1;queue[tail++]=j;}}}
 for(let i=0;i<N;i++)if(band[i]>0&&band[i]<=3){const n=neighbors(model.grid,i,near);let sea=0;for(let k=0;k<n;k++)sea+=model.ocean[near[k]];exposure[i]=sea/Math.max(1,n);}
 return {band,exposure};
}
/** Coastal ecology is conditioned by elevation, climate, exposure and slope.
 * A forested cliff is valid; low shores need their own vegetation transition. */
export function ecologyHabitat(e){
 if(e.glacier>.2||e.lava>.3||e.snow>.72||e.temperature< -5)return null;
 if(e.coastNear>.1){
  if(e.elevationM<2&&e.slope<.004&&e.temperature>20&&e.aridity>.8&&e.coastExposure<.38)return {biome:'Mangrove margin',trees:'mangrove',treeFactor:.75,ground:'bank',density:.8};
  if(e.elevationM<4&&e.slope<.012&&e.temperature>2&&e.aridity>.75)return {biome:'Salt marsh',trees:'bare',treeFactor:0,ground:'bank',density:.95};
  if(e.elevationM<11&&e.slope<.18)return {biome:e.aridity<.7?'Dune scrub':'Coastal grassland',trees:'shrub',treeFactor:.2,ground:e.aridity<.7?'desert':'coastal',density:.72};
  if(e.slope>.18&&e.elevationM<45)return {biome:'Rocky coast',trees:'shrub',treeFactor:.14,ground:'scree',density:.6};
  if(e.elevationM<24&&e.aridity<.8)return {biome:e.aridity<.7?'Dune scrub':'Coastal grassland',trees:'shrub',treeFactor:.15,ground:e.aridity<.7?'desert':'coastal',density:.8};
  if(e.elevationM<24)return {biome:'Maritime woodland',trees:null,treeFactor:clamp((e.elevationM-10)/14)*.65,ground:'woodland',density:.8};
 }
 if(e.shore>.3&&e.slope<.04&&e.aridity>.8&&e.temperature>3)return {biome:'Riparian woodland',trees:null,treeFactor:.65,ground:'bank',density:.9};
 if(e.temperature>21&&e.aridity>1&&e.snow<.1)return {biome:'Tropical forest',trees:'tropical',treeFactor:1,ground:'woodland',density:1};
 if(e.temperature>3&&e.temperature<18&&e.aridity>1.4)return {biome:'Temperate rainforest',trees:null,treeFactor:1,ground:'woodland',density:.98};
 return null;
}

/** One complete land classification shared by readout, plants and ground cover. */
export function landHabitat(e){
 if(e.glacier>.25)return {biome:'Glacier',trees:'bare',treeFactor:0,ground:'snow',density:.18};
 if(e.lava>.3)return {biome:'Volcanic terrain',trees:'bare',treeFactor:0,ground:'rubble',density:.7};
 if(e.snow>.72)return {biome:'Snowfield',trees:'bare',treeFactor:0,ground:'snow',density:.18};
 if(e.elevationM>1600)return {biome:'Alpine mountains',trees:'bare',treeFactor:0,ground:'scree',density:.5};
 if(e.temperature< -4)return {biome:'Tundra',trees:'bare',treeFactor:0,ground:'tundra',density:.3};
 const eco=ecologyHabitat(e);if(eco)return {...eco,trees:eco.trees??(e.temperature<8||e.snow>.4?'conifer':'broadleaf')};
 if(e.slope>.32)return {biome:'Rocky slopes',trees:'bare',treeFactor:0,ground:'scree',density:.65};
 if(e.aridity<.4)return {biome:'Desert',trees:'shrub',treeFactor:.10,ground:'desert',density:.65};
 if(e.aridity<.7)return {biome:'Dry grassland',trees:'shrub',treeFactor:.10,ground:'grassland',density:.8};
 if(e.aridity<.8)return {biome:'Grassland',trees:'shrub',treeFactor:.12,ground:'grassland',density:.9};
 return {biome:e.temperature<8?'Boreal woodland':'Woodland',trees:e.temperature<8||e.snow>.4?'conifer':'broadleaf',treeFactor:clamp((e.aridity-.78)/.25),ground:'woodland',density:.9};
}

/** Continuous herb cover survives the detail radius; bare mineral biomes retain their materials. */
export function meadowAppearance(e){
 const h=landHabitat(e),open=h.ground==='grassland'||h.biome==='Coastal grassland';
 if(h.biome==='Tropical forest'&&e.depthM<=.02&&e.talus<=.2&&!(e.soilDepthM<.06)){
  const cover=.48*(1-clamp((e.slope-.10)/.23))*(1-.45*clamp(e.shore||0));
  return {cover,tint:[.19,.27,.105]};
 }
 if(!open||e.depthM>.02||e.talus>.2)return {cover:0,tint:[0,0,0]};
 const green=clamp((e.aridity-.45)/.5),exposed=clamp((e.slope-.12)/.28),wet=clamp(e.shore||0);
 return {cover:.94*(1-exposed)*(1-wet),tint:[.48-.25*green,.44-.08*green,.23-.11*green]};
}
