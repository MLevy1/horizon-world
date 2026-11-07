/** Whole-tree cutouts for distant geometry; close trees retain their branch models. */
export function makeForestTexture(){
 const size=512,canvas=document.createElement('canvas');canvas.width=size*2;canvas.height=size;const ctx=canvas.getContext('2d');let seed=7491;const rnd=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return (seed>>>0)/4294967296;};
 const line=(a,b,w,color)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();},leaf=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,(rnd()-.5)*1.4,0,Math.PI*2);ctx.fill();};
 for(let kind=0;kind<2;kind++){ctx.save();ctx.translate(kind*size,0);line([256,512],[252,75],9,'#51402b');
  if(kind===0){const clusters=[[256,100,105,68],[135,178,101,91],[365,172,101,85],[220,228,149,96],[310,270,128,71]];for(const [x,y,rx,ry] of clusters){line([255,350],[x,y],5,'#51432e');for(let j=0;j<1050;j++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd()),px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r,tone=.75+rnd()*.45;leaf(px,py,3+rnd()*7,2+rnd()*5,`rgb(${Math.round(50*tone)},${Math.round(98*tone)},${Math.round(31*tone)})`);}}}
  else {for(let tier=0;tier<13;tier++){const y=35+tier*29,w=12+tier*12;line([256,y-18],[256-w,y+15],2,'#4a432d');line([256,y-18],[256+w,y+15],2,'#4a432d');for(let j=0;j<250;j++){const x=(rnd()-.5)*2*w,py=y+Math.abs(x)*.12+(rnd()-.5)*34,tone=.72+rnd()*.5;leaf(256+x,py,2+rnd()*6,2+rnd()*4,`rgb(${Math.round(40*tone)},${Math.round(76*tone)},${Math.round(36*tone)})`);}}}
  ctx.restore();
 }
 const levels=[];let current=canvas;while(true){levels.push({width:current.width,height:current.height,data:current.getContext('2d').getImageData(0,0,current.width,current.height).data});if(current.height===1)break;const next=document.createElement('canvas');next.width=Math.max(1,current.width>>1);next.height=Math.max(1,current.height>>1);next.getContext('2d').drawImage(current,0,0,next.width,next.height);current=next;}return {image:canvas,levels};
}
