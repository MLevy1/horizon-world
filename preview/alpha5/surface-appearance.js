/**
 * Horizon 5.3 surface appearance. Deterministic color from a geographic sample,
 * not from river ribbon triangles or camera distance.
 *
 * The bank occupies a narrow, irregular transition; it must not be the same
 * pale sand strip at every width, elevation and biome.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const palette=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
export function bankSurfaceColor(base,sample,x,z,noise=()=>0){
 const river=sample?.feature;
 if(!river||river.kind!=='river'||!Number.isFinite(sample.shoreDistance))return [...base];
 const d=sample.shoreDistance;
 const width=Math.max(.1,river.width);
 const grain=clamp(.5+.5*noise(x,z,6,153));
 const patches=clamp(.5+.5*noise(x,z,23,157));
 const soil=clamp(.5+.5*noise(x,z,52,161));
 const shoreWidth=Math.max(2.4,Math.min(13,3+width*.52));
 // The shore is not parallel color rings: ground-cover varies along the reach.
 const offset=(patches-.5)*3.6+(grain-.5)*.8;
 const bankDist=d+offset;
 const gravel=[.34,.37,.34],sand=[.57,.53,.41],earth=[.38,.37,.28];
 // Close to water: dark damp pebbles. Further away: irregular mixed deposits.
 const sediment=palette(gravel,sand,clamp(.18+soil*.67));
 const inner=1-smooth(-1.6,1.1,bankDist);
 const outer=(1-smooth(1.0,shoreWidth,bankDist));
 const depositional=outer*clamp(.48+patches*.38);
 let rgb=palette(base,sediment,depositional*.82);
 rgb=palette(rgb,gravel,inner*.64);
 rgb=palette(rgb,earth,Math.max(0,outer-inner)*grain*.27);
 // Avoid a solid uniformly light band: preserve original vegetation color at
 // irregular patches and at the outside of the shore transition.
 const organic=clamp((1-soil)*.27*outer);
 rgb=palette(rgb,base,organic);
 return rgb.map(v=>clamp(v));
}

/** This color is multiplied by the procedural water texture. RGB represents
 * approximate depth/turbidity, alpha represents the source/mouth transition.
 * It is *not* a full volumetric scattering simulation.
 */
export function waterDepthColor(depth,sourceDistance=1000,mouthFade=1,edgeFraction=0){
 const deep=smooth(.12,3.8,Math.max(0,depth));
 const shallow=[.92,.98,.92],middle=[.65,.94,1],deepWater=[.34,.76,.91];
 let rgb=palette(shallow,middle,smooth(.12,1.5,depth));
 rgb=palette(rgb,deepWater,deep*.78);
 // The source never becomes a series of invisible dashes after the first
 // few metres. The physical channel still narrows independently of opacity.
 const emergence=smooth(0,330,Math.max(0,sourceDistance));
 const edge=smooth(.8,1,Math.abs(edgeFraction));
 const opacity=(.72+.26*emergence)*(1-.13*edge)*clamp(mouthFade);
 return [...rgb.map(v=>clamp(v)),clamp(opacity)];
}
