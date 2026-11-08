import {neighbors} from './planet.mjs?v=0.9.12';
const blend=(values,w)=>values.reduce((s,v,k)=>s+v*w[k],0);
const normalize=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
/** Geometric support for fixed planes. Flood only strictly lower connected
 * scaffold nodes; annual inventories/budgets are not changed. At incompatible
 * pool contacts a shared edge saddle keeps different planes physically apart.
 */
export function createWaterScaffold(m,mesh){
  const N=m.grid.count,owner=new Int32Array(N).fill(-2),queue=new Int32Array(N),near=new Int32Array(m.grid.width);let a=0,b=0,extendedNodes=0;
  const plane=id=>id===-1?{id,kind:'ocean',waterM:0}:id>=0?{id,kind:'pool',waterM:m.waterbodies[id].waterLevelM}:null;
  for(let i=0;i<N;i++){
    const id=m.ocean[i]?-1:m.waterbody[i],p=(m.ocean[i]||id>=0)?plane(id):null;
    if(p&&m.height[i]<p.waterM){owner[i]=id;queue[b++]=i;}
  }
  while(a<b){const i=queue[a++],id=owner[i],p=plane(id),n=neighbors(m.grid,i,near);
    for(let k=0;k<n;k++){const j=near[k];if(owner[j]===-2&&m.height[j]<p.waterM){owner[j]=id;queue[b++]=j;extendedNodes++;}}
  }
  const node=i=>({key:'v'+i,direction:mesh.directionAt(i),heightM:m.height[i],body:owner[i],weights:null});
  function edge(i,j){
    const ni=node(i),nj=node(j),ids=[...new Set([ni.body,nj.body].filter(id=>id!==-2))];
    let heightM=(ni.heightM+nj.heightM)/2,body=-2;
    if(ids.length>1)heightM=Math.max(heightM,...ids.map(id=>plane(id).waterM));
    else if(ids.length&&heightM<plane(ids[0]).waterM)body=ids[0];
    return {key:'e'+Math.min(i,j)+':'+Math.max(i,j),direction:normalize(ni.direction.map((v,k)=>v+nj.direction[k])),heightM,body};
  }
  function face(cells){
    const nodes=cells.map(node),ids=[...new Set(nodes.map(n=>n.body).filter(id=>id!==-2))];
    const mids=cells.map((i,k)=>edge(i,cells[(k+1)%3]));
    let heightM=nodes.reduce((s,n)=>s+n.heightM,0)/3,body=-2;
    if(ids.length>1)heightM=Math.max(heightM,...ids.map(id=>plane(id).waterM));
    else if(ids.length&&heightM<plane(ids[0]).waterM)body=ids[0];
    const center={key:'f'+[...cells].sort((a,b)=>a-b).join(':'),direction:normalize([0,1,2].map(k=>nodes.reduce((s,n)=>s+n.direction[k],0))),heightM,body};
    nodes.forEach((n,k)=>n.weights=[0,1,2].map(j=>j===k?1:0));
    mids.forEach((n,k)=>n.weights=[0,1,2].map(j=>j===k||j===(k+1)%3?.5:0));center.weights=[1/3,1/3,1/3];
    const triangles=[];for(let k=0;k<3;k++){triangles.push([nodes[k],mids[k],center]);triangles.push([nodes[k],center,mids[(k+2)%3]]);}
    return triangles;
  }
  function interpolate(q){
    const ids=[...new Set(q.cells.map(i=>owner[i]).filter(id=>id!==-2))];
    if(ids.length<=1){
      const planes=new Map();
      if(ids.length){const id=ids[0],support=q.cells.reduce((s,i,k)=>s+(owner[i]===id?q.weights[k]:0),0);if(support>1e-10)planes.set(id,{...plane(id),support});}
      return {terrainM:q.terrainM,planes};
    }
    // Homogeneous/projective weights: a normalized midpoint's local weight is
    // scaled by its unnormalized chord length to preserve the spherical query.
    const original=q.cells.map(mesh.directionAt),triangles=face(q.cells);
    for(const tri of triangles){
      const columns=tri.map(n=>{
        const length=Math.hypot(...[0,1,2].map(k=>blend(original.map(d=>d[k]),n.weights)));
        return n.weights.map(w=>w/length);
      });
      const [A,B,C]=columns,W=q.weights;
      const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],dot=(u,v)=>u.reduce((s,x,k)=>s+x*v[k],0);
      const det=dot(A,cross(B,C)),weights=[dot(W,cross(B,C))/det,dot(A,cross(W,C))/det,dot(A,cross(B,W))/det];
      if(weights.some(w=>w< -1e-9))continue;
      const sum=weights.reduce((s,v)=>s+Math.max(0,v),0),w=weights.map(v=>Math.max(0,v)/sum),planes=new Map();
      tri.forEach((n,k)=>{if(n.body===-2||w[k]<1e-10)return;const p=plane(n.body);if(planes.has(p.id))planes.get(p.id).support+=w[k];else planes.set(p.id,{...p,support:w[k]});});
      const terrainM=blend(tri.map(n=>n.heightM),w);
      // A contour can lie exactly on a dry saddle. Retain its touching plane
      // for bank fitting without flooding either side of the separating crest.
      for(const id of ids){const p=plane(id);if(Math.abs(terrainM-p.waterM)<1e-7&&!planes.has(id))planes.set(id,{...p,support:1});}
      return {terrainM,planes};
    }
    throw Error('No water scaffold triangle contains query');
  }
  return {owner,node,face,plane,interpolate,stats:{extendedNodes}};
}
