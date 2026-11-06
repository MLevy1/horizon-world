/** Inspection camera, with a local origin at the sampled ground height. */
export function meshCamera(lon,lat,zoom,tilt,radiusM,heightM=0){
  const l=lon*Math.PI/180,p=lat*Math.PI/180,t=zoom>1?tilt*Math.PI/180:0,east=[-Math.sin(l),0,Math.cos(l)],north=[-Math.sin(p)*Math.cos(l),Math.cos(p),-Math.sin(p)*Math.sin(l)],radial=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)];
  const up=north.map((v,k)=>v*Math.cos(t)-radial[k]*Math.sin(t)),front=radial.map((v,k)=>v*Math.cos(t)+north[k]*Math.sin(t)),origin=zoom>1?radial.map(v=>v*(radiusM+heightM)):[0,0,0],light=zoom>1?front.map((v,k)=>v*.7+up[k]*.6+east[k]*.8):[.5,.8,.7];
  return {east,up,front,origin,light};
}

/** Keep the inspection rectangle inside the currently requested neighborhood. */
export function inspectionZoom(mesh,camera,aspect,requested){
  const edges=mesh.ground.boundaryIndices;if(requested<=1||!edges?.length)return requested;
  const p=mesh.ground.positions,project=id=>{const v=[p[id*3]-camera.origin[0],p[id*3+1]-camera.origin[1],p[id*3+2]-camera.origin[2]];return [v.reduce((s,x,k)=>s+x*camera.east[k],0),v.reduce((s,x,k)=>s+x*camera.up[k],0)];};
  let radius=Infinity;
  for(let k=0;k<edges.length;k+=2){const a=project(edges[k]),b=project(edges[k+1]),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/length)):0;radius=Math.min(radius,Math.hypot(a[0]+t*dx,a[1]+t*dy));}
  return radius>1e-6?Math.max(requested,(mesh.radiusM+4000)*Math.hypot(1,aspect)/(.81*radius)):requested;
}
