/** The complete profile graph, expressed as bounded spherical Hermite curves.
 * Routing, budgets and longitudinal heads remain authoritative. Only degree-2
 * inland geometry may move; junctions, sources and water-contact neighborhoods
 * remain pinned. Curves derive their tangents from the actual flow graph.
 */
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),clamp(dot(a,b),-1,1));
const tangent=(a,b)=>norm(b.map((v,k)=>v-a[k]*dot(a,b)));
function noise(p,scale,seed){
  const q=p.map(v=>v*scale),i=q.map(Math.floor),f=q.map((v,k)=>smooth(v-i[k]));let sum=0;
  for(let k=0;k<8;k++){const x=i[0]+(k&1),y=i[1]+((k>>1)&1),z=i[2]+(k>>2);let h=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^seed;h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);const value=((h^(h>>>16))>>>0)/4294967295*2-1;sum+=value*((k&1)?f[0]:1-f[0])*((k&2)?f[1]:1-f[1])*((k&4)?f[2]:1-f[2]);}return sum;
}
export function createRiverCourse(m,mesh,{protectedNode=()=>false}={}){
  const p=m.riverProfiles,g=m.grid,E=p.from.length,R=g.radiusKm*1000,primary=new Int32Array(g.count).fill(-1),incoming=new Uint16Array(g.count),locked=new Uint8Array(E),nodes=new Float64Array(E*3),shift=new Float64Array(E),nodeWidthNoise=new Float64Array(E),nodeBankNoise=new Float64Array(E),nodeBend=new Float64Array(E);
  let seed=2166136261;for(const ch of String(m.seed||'HORIZON-01'))seed=Math.imul(seed^ch.charCodeAt(0),16777619);
  for(let e=0;e<E;e++){const b=p.to[e];incoming[b]++;const old=primary[b];if(old<0||p.widthM[p.from[e]]>p.widthM[p.from[old]])primary[b]=e;}
  for(let e=0;e<E;e++){const i=p.from[e],prior=primary[i];locked[e]=Number(p.kind[i]!==1||p.kind[p.to[e]]!==1||protectedNode(i)||protectedNode(p.to[e])||i>=g.north||p.to[e]>=g.north);nodes.set(mesh.directionAt(i),e*3);}
  let movedNodes=0,maxShiftM=0;
  for(let e=0;e<E;e++){
    const i=p.from[e],prior=primary[i];if(locked[e]||prior<0||locked[prior]||incoming[i]!==1)continue;
    const a=mesh.directionAt(p.from[prior]),n=mesh.directionAt(i),b=mesh.directionAt(p.to[e]),target=norm(a.map((v,k)=>v+b[k])),length=angle(n,target)*R,spacing=2*Math.PI*R/g.width*Math.hypot(n[0],n[2]),cap=Math.min(p.lengthM[e],p.lengthM[prior],spacing)*.18;
    const amount=length?Math.min(.7,cap/length):0,d=amount?norm(n.map((v,k)=>mix(v,target[k],amount))):n;nodes.set(d,e*3);shift[e]=angle(n,d)*R;if(shift[e]>1e-6)movedNodes++;maxShiftM=Math.max(maxShiftM,shift[e]);
  }
  function nodeDirection(i){const e=p.edgeAtCell[i];return e>=0?Array.from(nodes.subarray(e*3,e*3+3)):mesh.directionAt(i);}
  function nodeTangent(i){
    const n=nodeDirection(i),out=p.edgeAtCell[i],prior=primary[i],next=out>=0?tangent(n,nodeDirection(p.to[out])):null,prev=prior>=0?tangent(n,nodeDirection(p.from[prior])).map(v=>-v):null;
    if(!prev)return next;if(!next)return prev;
    if(locked[out])return next;if(locked[prior])return prev;
    const v=prev.map((x,k)=>x+next[k]);return Math.hypot(...v)>1e-8?norm(v):next;
  }
  for(let e=0;e<E;e++){
    const i=p.from[e],n=nodeDirection(i),prior=primary[i];nodeWidthNoise[e]=noise(n,R/1100,seed);nodeBankNoise[e]=.7*noise(n,R/700,seed^15619)+.3*noise(n,R/190,seed^93713);
    if(prior>=0&&incoming[i]===1&&!locked[e]&&!locked[prior]){const a=tangent(n,nodeDirection(p.from[prior])).map(v=>-v),b=tangent(n,nodeDirection(p.to[e]));nodeBend[e]=clamp(Math.atan2(dot(cross(a,b),n),dot(a,b))*p.widthM[i]*3/Math.max(1,(p.lengthM[e]+p.lengthM[prior])*.5),-.5,.5);}
  }
  const ends=new Float64Array(E*3),forward=new Float64Array(E*3),normal=new Float64Array(E*3),coefficients=new Float64Array(E*6),pads=new Float64Array(E),protectedEdges=locked;
  let curvedEdges=0,exampleEdge=-1,exampleT=.5,best=0,maxCurveM=0;
  const poly=(e,t)=>{const k=e*6,c=coefficients;return {x:t*(c[k]+t*(c[k+1]+t*c[k+2])),y:t*(c[k+3]+t*(c[k+4]+t*c[k+5])),dx:c[k]+t*(2*c[k+1]+3*t*c[k+2]),dy:c[k+3]+t*(2*c[k+4]+3*t*c[k+5]),ddx:2*c[k+1]+6*t*c[k+2],ddy:2*c[k+4]+6*t*c[k+5]};};
  for(let e=0;e<E;e++){
    const a=nodeDirection(p.from[e]),b=nodeDirection(p.to[e]),T=tangent(a,b),N=norm(cross(a,b)),ab=dot(a,b),L=R*Math.tan(angle(a,b)),spacing=2*Math.PI*R/g.width*Math.min(Math.hypot(a[0],a[2]),Math.hypot(b[0],b[2])),cap=Math.min(L*.15,spacing*.18);
    ends.set(b,e*3);forward.set(T,e*3);normal.set(N,e*3);let dx0=L,dx1=L,dy0=0,dy1=0;
    if(!locked[e]){
      const handle=(v,end)=>{let x=dot(v,T),y=dot(v,N);if(end){x=(x*ab-dot(b,T)*dot(v,a))/(ab*ab);y=(y*ab-dot(b,N)*dot(v,a))/(ab*ab);}const n=Math.hypot(x,y);x/=n;y/=n;if(x<.15)return [L,0];const h=Math.min(L,Math.abs(y)>1e-12?3*cap/Math.abs(y):L);return [h*x,h*y];};
      [dx0,dy0]=handle(nodeTangent(p.from[e]),false);[dx1,dy1]=handle(nodeTangent(p.to[e]),true);
    }
    coefficients.set([dx0,3*L-2*dx0-dx1,dx0+dx1-2*L,dy0,-2*dy0-dy1,dy0+dy1],e*6);
    const offset=Math.max(Math.abs(dy0),Math.abs(dy1))/3,other=p.edgeAtCell[p.to[e]];pads[e]=offset+Math.max(shift[e],other>=0?shift[other]:0);maxCurveM=Math.max(maxCurveM,offset);if(offset>1e-4)curvedEdges++;
    if(!locked[e]&&p.wetEdge[e])for(const t of [.25,.5,.75]){const score=Math.abs(poly(e,t).y)*Math.min(p.widthM[p.from[e]],p.widthM[p.to[e]]);if(score>best){best=score;exampleEdge=e;let strongest=-1;for(const u of [.15,.25,.35,.5,.65,.75,.85]){const v=poly(e,u),curvature=Math.abs(v.dx*v.ddy-v.dy*v.ddx)/Math.max(1e-12,(v.dx*v.dx+v.dy*v.dy)**1.5);if(curvature>strongest){strongest=curvature;exampleT=u;}}}}
  }
  function sample(edge,t){
    if(!Number.isInteger(edge)||edge<0||edge>=E||!Number.isFinite(t)||t<0||t>1)throw Error('Invalid river course station');
    const a=p.from[edge],b=p.to[edge],i=edge*3,A=nodes.subarray(i,i+3),T=forward.subarray(i,i+3),N=normal.subarray(i,i+3),v=poly(edge,t),direction=t===0?Array.from(A):t===1?Array.from(ends.subarray(i,i+3)):locked[edge]?norm(A.map((x,k)=>mix(x,ends[i+k],t))):norm(A.map((x,k)=>x+(T[k]*v.x+N[k]*v.y)/R)),velocity=T.map((x,k)=>x*v.dx+N[k]*v.dy),sideNormal=norm(cross(direction,velocity)),other=p.edgeAtCell[b],w=mix(p.widthM[a],p.widthM[b],t),u=smooth(t);
    const endpointFade=(incoming[a]===1&&!locked[primary[a]]?1:smooth(t*p.lengthM[edge]/Math.max(1,w*2)))*(incoming[b]===1&&other>=0&&!locked[other]?1:smooth((1-t)*p.lengthM[edge]/Math.max(1,w*2))),fade=locked[edge]?0:endpointFade;
    const widthNoise=mix(nodeWidthNoise[edge],other>=0?nodeWidthNoise[other]:0,u),bankNoise=mix(nodeBankNoise[edge],other>=0?nodeBankNoise[other]:0,u),bend=mix(nodeBend[edge],other>=0?nodeBend[other]:0,u),asym=clamp(bend+.22*bankNoise,-.55,.55)*fade,widthM=w*(1+.12*widthNoise*fade),half=widthM/2,bank=Math.max(1,widthM*.35);
    return {edge,t,direction,normal:sideNormal,widthM,leftHalfM:half*(1-asym),rightHalfM:half*(1+asym),leftBankM:bank*(1+asym*.8),rightBankM:bank*(1-asym*.8),leftExponent:2-asym,rightExponent:2+asym,leftFreeboard:1-asym*.2,rightFreeboard:1+asym*.2,bend:asym};
  }
  function project(edge,direction,includeOutside=false){
    const i=edge*3,A=nodes.subarray(i,i+3),T=forward.subarray(i,i+3),N=normal.subarray(i,i+3),den=dot(direction,A);if(den<=0)return null;
    const X=dot(direction,T)/den*R,Y=dot(direction,N)/den*R,L=poly(edge,1).x,support=1.9*Math.max(p.widthM[p.from[edge]],p.widthM[p.to[edge]])+2;
    if(!includeOutside&&(X< -support||X>L+support||Math.abs(Y)>pads[edge]+support))return null;
    let t=locked[edge]?clamp(X/(R*dot(ends.subarray(i,i+3),T)+X*(1-dot(A,ends.subarray(i,i+3)))),0,1):clamp(X/L,0,1);
    if(!locked[edge]){
      let lo=0,hi=1;
      if(X>0&&X<L)for(let k=0;k<10;k++){const v=poly(edge,t),error=v.x-X;if(Math.abs(error)<1e-9)break;if(error<0)lo=t;else hi=t;const next=t-error/v.dx;t=next>lo&&next<hi?next:(lo+hi)/2;}
      lo=0;hi=1;
      for(let k=0;k<10;k++){const v=poly(edge,t),f=(v.x-X)*v.dx+(v.y-Y)*v.dy,df=v.dx*v.dx+v.dy*v.dy+(v.x-X)*v.ddx+(v.y-Y)*v.ddy;if(Math.abs(f)<1e-8)break;if(f<0)lo=t;else hi=t;const next=df>0?t-f/df:NaN;const u=next>=lo&&next<=hi?next:(lo+hi)/2;if(Math.abs(u-t)<1e-12){t=u;break;}t=u;}
    }
    let v=poly(edge,t),best=(v.x-X)**2+(v.y-Y)**2;if(!locked[edge]&&X*X+Y*Y<best){t=0;best=X*X+Y*Y;}if(!locked[edge]&&(X-L)**2+Y*Y<best)t=1;if(t<1e-9)t=0;else if(t>1-1e-9)t=1;
    const frame=sample(edge,t),distanceM=angle(direction,frame.direction)*R,signedDistanceM=dot(direction,frame.normal)>=0?distanceM:-distanceM;
    return {...frame,distanceM,signedDistanceM};
  }
  return {sample,project,nodeDirection,protectedEdges,pads,stats:{edges:E,movedNodes,curvedEdges,protectedEdges:locked.reduce((s,v)=>s+v,0),maxShiftM,maxCurveM,exampleEdge,exampleT}};
}
