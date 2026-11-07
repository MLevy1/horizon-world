import {mapGeometry,mapPoint,zoomMap,panMap} from './explorer-navigation.mjs?v=0.9.9';
export function createExplorerMap({canvas,getPosition,onSelect}){
 const ctx=canvas.getContext('2d'),pointers=new Map();let source,places=[],view={cx:.5,cy:.5,zoom:1},selected=null,gesture=false,press=null;
 const size=()=>{const r=canvas.getBoundingClientRect();return {w:r.width,h:r.height};},point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 function select(p){selected=p;onSelect(p);draw();}
 function draw(){const {w,h}=size();if(!source||w<1||h<1)return;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#10232e';ctx.fillRect(0,0,w,h);const g=mapGeometry(view,w,h);ctx.imageSmoothingEnabled=false;
  for(let wrap=-1;wrap<=1;wrap++)ctx.drawImage(source,g.x+wrap*g.w,g.y,g.w,g.h);
  ctx.strokeStyle='#b6d4ce33';ctx.lineWidth=1;for(let wrap=-1;wrap<=1;wrap++)for(let x=0;x<=12;x++){const px=g.x+wrap*g.w+x*g.w/12;if(px<0||px>w)continue;ctx.beginPath();ctx.moveTo(px,Math.max(0,g.y));ctx.lineTo(px,Math.min(h,g.y+g.h));ctx.stroke();}for(let y=0;y<=6;y++){const py=g.y+y*g.h/6;if(py<0||py>h)continue;ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();}
  function mark(p,color,r,label){let dx=(p.lon+180)/360-view.cx;dx-=Math.round(dx);const x=w/2+dx*g.w,y=g.y+(90-p.lat)/180*g.h;if(x< -20||x>w+20||y< -20||y>h+20)return;ctx.fillStyle=color;ctx.strokeStyle='#10232e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();if(label){ctx.font='12px system-ui';ctx.lineWidth=3;ctx.strokeText(label,x+8,y-8);ctx.fillText(label,x+8,y-8);}}
  for(const p of places)mark(p,'#d4e8e2',3,view.zoom>=4?p.name:'');const player=getPosition();if(player)mark(player,'#ffe29a',6,'You');if(selected){mark(selected,'#73efd4',7,'Selected');}
 }
 function zoom(factor,x,y){const {w,h}=size();view=zoomMap(view,factor,x??w/2,y??h/2,w,h);draw();}
 function center(p,minimum=1){view={cx:(p.lon+180)/360,cy:(90-p.lat)/180,zoom:Math.max(minimum,view.zoom)};draw();}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(Math.exp(-e.deltaY*.002),p.x,p.y);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);const p=point(e);pointers.set(e.pointerId,p);if(pointers.size===1){press={id:e.pointerId,...p,moved:false};gesture=false;}else{gesture=true;if(press)press.moved=true;}});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;e.preventDefault();const before=[...pointers.values()],old=pointers.get(e.pointerId),p=point(e);pointers.set(e.pointerId,p);const after=[...pointers.values()],{w,h}=size();if(press&&Math.hypot(p.x-press.x,p.y-press.y)>7)press.moved=true;
  if(pointers.size===1){view=panMap(view,p.x-old.x,p.y-old.y,w,h);}
  else {gesture=true;const mid=a=>({x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2}),distance=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),a=mid(before),b=mid(after);view=zoomMap(view,Math.max(.01,distance(after))/Math.max(.01,distance(before)),a.x,a.y,w,h);view=panMap(view,b.x-a.x,b.y-a.y,w,h);}
  draw();
 });
 function release(e,cancel=false){if(!pointers.has(e.pointerId))return;const p=point(e);if(!cancel&&!gesture&&press?.id===e.pointerId&&!press.moved){const {w,h}=size();select(mapPoint(view,p.x,p.y,w,h));}pointers.delete(e.pointerId);if(!pointers.size){press=null;gesture=false;}}
 canvas.addEventListener('pointerup',e=>release(e));canvas.addEventListener('pointercancel',e=>release(e,true));canvas.addEventListener('lostpointercapture',e=>release(e,true));
 canvas.addEventListener('keydown',e=>{const {w,h}=size(),steps={ArrowLeft:[70,0],ArrowRight:[-70,0],ArrowUp:[0,70],ArrowDown:[0,-70]};if(steps[e.key]){e.preventDefault();view=panMap(view,...steps[e.key],w,h);draw();}else if(['+','=','-','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter')select(mapPoint(view,w/2,h/2,w,h));else zoom(e.key==='-'?1/1.6:1.6);}});
 new ResizeObserver(draw).observe(canvas);
 return {draw,zoom,center,get selected(){return selected;},select(p){center(p,8);select(p);},reset(){view={cx:.5,cy:.5,zoom:1};draw();},setWorld(image,nextPlaces){source=document.createElement('canvas');source.width=image.width;source.height=image.height;source.getContext('2d').putImageData(image,0,0);places=nextPlaces;view={cx:.5,cy:.5,zoom:1};select(null);}};
}
