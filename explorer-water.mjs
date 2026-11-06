/** Water optics use the actual clipped water/bed mesh, never a fake depth plane. */
export const STANDING_EYE_M=1.7,CROUCH_EYE_M=.45;
export function waterState(groundM,waterM,crouched=false){const eyeM=crouched?CROUCH_EYE_M:STANDING_EYE_M;return {eyeM,depthM:waterM===null?0:Math.max(0,waterM-groundM),submerged:waterM!==null&&groundM+eyeM<waterM};}
export function meshWaterDepths(mesh){return Float32Array.from(mesh.water.elevationsM,(head,i)=>Math.max(0,head-mesh.ground.elevationsM[mesh.water.groundVertex[i]]));}
export function waterOpacity(depthM,cosine,submerged=false){const c=Math.max(.08,Math.min(1,Math.abs(cosine))),f=.02+.98*(1-c)**5;return submerged?.12+.65*f:Math.min(.98,1-Math.exp(-Math.max(0,depthM)*.55/c))*(1-f)+f;}
