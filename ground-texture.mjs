/** Deterministic botanical cutouts: fine blades and branching foliage, not solid wedges. */
export function makeGroundTexture(){
 const size=256,canvas=document.createElement('canvas');canvas.width=size*4;canvas.height=size;const ctx=canvas.getContext('2d');let seed=9127;const rnd=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
 function line(x,y,u,v,width,color){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();}
 function leaf(x,y,rx,ry,a,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,a,0,Math.PI*2);ctx.fill();}
 for(let type=0;type<4;type++){ctx.save();ctx.translate(type*size,0);
  if(type===0){for(let j=0;j<65;j++){const x=80+rnd()*96,y=240,tipX=15+rnd()*226,tipY=20+rnd()*150;ctx.strokeStyle=`rgb(${95+rnd()*65},${115+rnd()*65},${35+rnd()*45})`;ctx.lineWidth=1+rnd()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+(tipX-x)*.2,tipY+35,tipX,tipY);ctx.stroke();}}
  if(type===1){for(let j=0;j<9;j++){const a=-1.35+j*.3375,tx=128+Math.sin(a)*115,ty=30+Math.abs(a)*75;line(128,247,tx,ty,2,'#70833b');for(let k=2;k<15;k++){const t=k/16,x=128+(tx-128)*t,y=247+(ty-247)*t,w=23*Math.sin(t*Math.PI);for(const sign of [-1,1]){const ex=x+sign*w,ey=y+8;line(x,y,ex,ey,1,'#5c792b');leaf((x+ex)/2,(y+ey)/2,w*.6,2.6,sign*.3,'#819846');}}}}
  if(type===2){for(let j=0;j<26;j++){const tx=12+rnd()*232,ty=25+rnd()*170;line(128,249,tx,ty,1+rnd()*2,'#8c7953');for(let k=0;k<15;k++){const t=.25+rnd()*.75,x=128+(tx-128)*t,y=249+(ty-249)*t,ex=x+(rnd()-.5)*50,ey=y-rnd()*28;line(x,y,ex,ey,.7,'#9e9569');for(let n=0;n<4;n++)leaf(ex+(rnd()-.5)*13,ey+(rnd()-.5)*12,2+rnd()*3,1.5+rnd()*2,rnd()*6.28,`rgb(${105+rnd()*65},${112+rnd()*50},${56+rnd()*35})`);}}}
  if(type===3){line(36,232,218,24,2.5,'#6c7043');for(let j=0;j<32;j++){const t=j/32,x=36+182*t,y=232-208*t,width=13+28*Math.sin(t*Math.PI);for(const sign of [-1,1]){const ex=x+sign*width,ey=y+sign*width*.65;line(x,y,ex,ey,1.2,'#557340');for(let n=0;n<9;n++){const a=n/9,px=x+(ex-x)*a,py=y+(ey-y)*a;line(px,py,px+sign*(5+rnd()*6),py-7-rnd()*7,.9,'#6d8a4a');line(px,py,px-sign*4,py-8,.8,'#3f6237');}}}}
  ctx.restore();
 }
 const levels=[];let current=canvas;while(true){const c=current.getContext('2d');levels.push({width:current.width,height:current.height,data:c.getImageData(0,0,current.width,current.height).data});if(current.height===1)break;const next=document.createElement('canvas');next.width=Math.max(1,current.width>>1);next.height=Math.max(1,current.height>>1);next.getContext('2d').drawImage(current,0,0,next.width,next.height);current=next;}
 return {image:canvas,levels};
}
