/**
 * Horizon 4.3: deterministic 32.768 km drainage domain at 128 m resolution.
 * A domain spans FOUR former 16.384 km watershed quadrants, which are no
 * longer independent hydrological outlets. Only the domain's exterior and
 * genuine sea cells are allowed as terminal seeds.
 *
 * Pure simulation: no Three.js, browser or camera dependencies.
 * Exterior LAND exits remain provisional; adjoining 32 km domains still
 * require higher-level reconciliation.
 */
export const DRAINAGE_N=256;
export const DRAINAGE_STEP=128;
export const DRAINAGE_SIZE=DRAINAGE_N*DRAINAGE_STEP;
const OFFSETS=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
export function domainOfMacro(macroX,macroZ){
  return {ix:Math.floor(macroX/2),iz:Math.floor(macroZ/2)};
}
export function domainOfWorld(x,z){
  return {ix:Math.floor(x/DRAINAGE_SIZE),iz:Math.floor(z/DRAINAGE_SIZE)};
}
/**
 * Solve a priority-flood graph on a world-aligned domain.
 * Resolution can be overridden in tests (N must be positive and even).
 */
export function solveDrainageDomain({ix,iz,height,N=DRAINAGE_N,S=DRAINAGE_STEP}){
  if(typeof height!=='function')throw new TypeError('height must be a function');
  if(!Number.isInteger(N)||N<4||N%2)throw new RangeError('N must be even and >= 4');
  const C=N*N,ox=ix*N*S,oz=iz*N*S;
  const base=new Float32Array(C),level=new Float32Array(C);
  const seen=new Uint8Array(C),parent=new Int32Array(C),acc=new Float32Array(C),root=new Int32Array(C);
  const order=[],heap=[],ocean=new Uint8Array(C),landBoundary=new Uint8Array(C);
  parent.fill(-1);acc.fill(1);
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
    const id=z*N+x;
    base[id]=height(ox+(x+.5)*S,oz+(z+.5)*S);
  }
  // Binary min-heap with stable tie-breaking.
  function less(a,b){return a.h<b.h||(a.h===b.h&&a.id<b.id)}
  function push(id,h){
    const entry={id,h};let i=heap.length;heap.push(entry);
    while(i){const p=(i-1)>>1;if(!less(entry,heap[p]))break;heap[i]=heap[p];i=p}
    heap[i]=entry;
  }
  function pop(){
    const first=heap[0],tail=heap.pop();
    if(heap.length){
      let i=0;
      while(true){
        const l=2*i+1;if(l>=heap.length)break;
        const r=l+1,m=r<heap.length&&less(heap[r],heap[l])?r:l;
        if(!less(heap[m],tail))break;
        heap[i]=heap[m];i=m;
      }
      heap[i]=tail;
    }
    return first;
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){
    const id=z*N+x,h=base[id];
    if(x===0||x===N-1||z===0||z===N-1||h<=0){
      seen[id]=1;level[id]=Math.max(0,h);push(id,level[id]);
    }
  }
  while(heap.length){
    const {id}=pop(),x=id%N,z=Math.floor(id/N);
    order.push(id);
    for(const [dx,dz] of OFFSETS){
      const nx=x+dx,nz=z+dz;
      if(nx<0||nz<0||nx>=N||nz>=N)continue;
      const k=nz*N+nx;if(seen[k])continue;
      seen[k]=1;parent[k]=id;
      level[k]=Math.max(base[k],level[id]+.02);
      push(k,level[k]);
    }
  }
  for(let k=order.length-1;k>=0;k--){
    const id=order[k],to=parent[id];if(to>=0)acc[to]+=acc[id];
  }
  for(const id of order){
    const to=parent[id];root[id]=to<0?id:root[to];
    const r=root[id];ocean[id]=base[r]<=0?1:0;
    landBoundary[id]=base[r]>0?1:0;
  }
  const outlets=[],stats={landOutlets:0,seaOutlets:0,minor:0,tributaries:0,trunks:0,uphill:0,internalEnds:0};
  for(let id=0;id<C;id++){
    const to=parent[id],x=id%N,z=Math.floor(id/N);
    if(to>=0){
      const a=acc[id];if(a>=180)stats.trunks++;else if(a>=32)stats.tributaries++;else if(a>=5)stats.minor++;
      if(level[id]+.001<level[to])stats.uphill++;
    }else{
      if(x!==0&&x!==N-1&&z!==0&&z!==N-1&&base[id]>0)stats.internalEnds++;
      if(acc[id]>=32){
        const sea=base[id]<=0;
        outlets.push({x,z,sea,acc:acc[id],id});
        if(sea)stats.seaOutlets++;else stats.landOutlets++;
      }
    }
  }
  return {ix,iz,ox,oz,N,S,C,base,level,parent,acc,root,ocean,landBoundary,outlets,stats};
}
/** Read an actual edge by world grid cell ID, including through the former
 * 16.384km boundary (local midpoint, N/2). */
export function crossesOldMacroBoundary(domain,id){
  const {N,parent}=domain,to=parent[id];
  if(to<0)return false;
  const x=id%N,z=Math.floor(id/N),tx=to%N,tz=Math.floor(to/N);
  return (x<N/2)!==(tx<N/2)||(z<N/2)!==(tz<N/2);
}
