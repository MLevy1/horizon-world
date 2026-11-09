import {crownLobes} from './forest-structure.mjs?v=0.9.18';
/** Three rows per species: whole tree, individual crown lobe, top canopy.
 * Whole-tree silhouettes are projected from the actual shared crown template. */
export function makeForestTexture(){
 const size=256,canvas=document.createElement('canvas');canvas.width=size*4;canvas.height=size*3;const ctx=canvas.getContext('2d');let seed=7491;const rnd=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
 const kinds=['broadleaf','conifer','tropical','mangrove'],palettes=[[45,91,29],[32,69,40],[31,96,48],[49,91,42]];
 function cluster(x,y,rx,ry,kind){const base=palettes[kind];for(let j=0,count=Math.max(100,Math.ceil(rx*ry*(kind===1?.65:kind===2?.25:.45)));j<count;j++){const a=rnd()*6.283,r=Math.sqrt(rnd()),px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r,tone=.7+rnd()*.55;ctx.fillStyle=`rgb(${base.map(v=>Math.round(v*tone)).join(',')})`;ctx.beginPath();ctx.ellipse(px,py,kind===2?2+rnd()*5:1+rnd()*3,kind===1?.7+rnd():1+rnd()*2,(rnd()-.5)*2.5,0,6.283);ctx.fill();}}
 for(let kind=0;kind<4;kind++){
  ctx.save();ctx.translate(kind*size,0);ctx.strokeStyle='#51402b';ctx.lineWidth=kind===2?3:5;ctx.beginPath();ctx.moveTo(128,256);ctx.lineTo(128,90);ctx.stroke();
  for(const c of crownLobes(kinds[kind]))cluster(128+c.x*size/2.2,(1-c.y)*size,c.rx*size/2.2,c.ry*size,kind);
  cluster(128,size*1.5,119,116,kind);
  for(const c of crownLobes(kinds[kind]))cluster(128+c.x*size/2.2,size*2.5+c.z*size/2.2,c.rx*size/2.2,c.rz*size/2.2,kind);
  ctx.restore();
 }
 const levels=[];let current=canvas;while(true){levels.push({width:current.width,height:current.height,data:current.getContext('2d').getImageData(0,0,current.width,current.height).data});if(current.width===1&&current.height===1)break;const next=document.createElement('canvas');next.width=Math.max(1,current.width>>1);next.height=Math.max(1,current.height>>1);next.getContext('2d').drawImage(current,0,0,next.width,next.height);current=next;}return {image:canvas,levels};
}
