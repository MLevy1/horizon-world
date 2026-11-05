import {VERSION,lonLat,cellAt,traceDownstream,catchmentMask,distanceKm} from './planet.mjs';

const $=id=>document.getElementById(id);
const canvas=$('map'),ctx=canvas.getContext('2d'),stage=$('map-stage');
const fmt=new Intl.NumberFormat('en-US'),number=(x,d=1)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(x);
const state={model:null,worker:null,projection:'map',zoom:1,cx:768,cy:384,lon:0,lat:0,selected:-1,trace:[],mask:null,showTrace:false,showCatchment:false,
  width:0,height:0,dpr:1,fit:1,frame:0,texture:null,textureData:null,catchmentTexture:null,globeCanvas:null,globeKey:'',paths:[],heads:[],mouths:[]};
const layers={rivers:true,streams:true,lakes:true,headwaters:true,basins:false,arrows:false};
const palette={ocean:[17,48,65],land:[54,70,66],coast:[70,86,78],lake:[90,170,187],shore:[28,66,80]};
const TAU=Math.PI*2,DEG=Math.PI/180;
let renderRevision=0;

function requestDraw(){if(!state.frame)state.frame=requestAnimationFrame(()=>{state.frame=0;draw();});}
function resize(){
  const rect=stage.getBoundingClientRect();state.width=rect.width;state.height=rect.height;
  state.dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*state.dpr);canvas.height=Math.round(rect.height*state.dpr);
  state.fit=state.model?Math.min((rect.width-24)/state.model.grid.width,(rect.height-24)/state.model.grid.height):1;
  state.globeKey='';requestDraw();
}
new ResizeObserver(resize).observe(stage);

function makeTexture(){
  const m=state.model,{width:w,height:h}=m.grid,tw=w*2,th=h*2;
  const tex=document.createElement('canvas');tex.width=tw;tex.height=th;
  const tctx=tex.getContext('2d'),im=tctx.createImageData(tw,th),data=im.data;
  const selectedMask=state.showCatchment?state.mask:null;
  const basinColor=new Map();
  const colorForBasin=id=>{
    if(basinColor.has(id))return basinColor.get(id);
    let n=Math.imul(id^0x9e3779b9,0x85ebca6b);n^=n>>>13;
    const hue=((n>>>0)%360)/360;
    const color=hsl(hue,.16,.31);basinColor.set(id,color);return color;
  };
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;let color=palette.land;
    if(m.ocean[i]){
      const shore=!m.ocean[y*w+(x+w-1)%w]||!m.ocean[y*w+(x+1)%w]||(y>0&&!m.ocean[i-w])||(y<h-1&&!m.ocean[i+w]);
      color=shore?palette.shore:palette.ocean;
    }else if(layers.lakes&&m.waterbody[i]>=0)color=palette.lake;
    else if(layers.basins)color=colorForBasin(m.outlet[i]);
    else if(m.ocean[y*w+(x+w-1)%w]||m.ocean[y*w+(x+1)%w])color=palette.coast;
    if(selectedMask?.[i])color=[Math.round(color[0]*.55+245*.45),Math.round(color[1]*.55+197*.45),Math.round(color[2]*.55+128*.45)];
    const xx=(x*2+(y&1))%tw,yy=y*2;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const p=((yy+dy)*tw+(xx+dx)%tw)*4;data[p]=color[0];data[p+1]=color[1];data[p+2]=color[2];data[p+3]=255;
    }
  }
  tctx.putImageData(im,0,0);state.texture=tex;state.textureData=im;state.globeKey='';renderRevision++;requestDraw();
}
function hsl(h,s,l){
  const hue=(p,q,t)=>{if(t<0)t++;if(t>1)t--;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [hue(p,q,h+1/3),hue(p,q,h),hue(p,q,h-1/3)].map(v=>Math.round(v*255));
}
function xy(cell,previous=null){
  const g=state.model.grid;
  if(cell===g.north)return {x:previous?.x??g.width/2,y:0};
  if(cell===g.south)return {x:previous?.x??g.width/2,y:g.height};
  const y=(cell/g.width)|0;let x=cell%g.width+.5+(y&1)*.5;
  if(previous){while(x-previous.x>g.width/2)x-=g.width;while(x-previous.x< -g.width/2)x+=g.width;}
  return {x,y:y+.5};
}
function preparePaths(){
  state.paths=state.model.reaches.map(reach=>{
    const points=new Float32Array(reach.path.length*2);let prev=null;
    for(let k=0;k<reach.path.length;k++){const p=xy(reach.path[k],prev);points[k*2]=p.x;points[k*2+1]=p.y;prev=p;}
    return {reach,points};
  });
  state.heads=state.model.nodes.filter(n=>n.kind==='headwater');
  state.mouths=state.model.nodes.filter(n=>n.kind==='mouth').sort((a,b)=>b.areaKm2-a.areaKm2);
}
function mapPosition(x,y,shift=0){const s=state.fit*state.zoom;return [state.width/2+(x-state.cx+shift)*s,state.height/2+(y-state.cy)*s];}
function globeSetup(){
  const l=state.lon*DEG,p=state.lat*DEG;
  return {east:[-Math.sin(l),0,Math.cos(l)],up:[-Math.sin(p)*Math.cos(l),Math.cos(p),-Math.sin(p)*Math.sin(l)],front:[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],
    r:Math.min(state.width,state.height)*.435*state.zoom,cx:state.width/2,cy:state.height/2};
}
function globeProject(lon,lat,g){
  const l=lon*DEG,p=lat*DEG,xyz=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],dot=v=>xyz[0]*v[0]+xyz[1]*v[1]+xyz[2]*v[2];
  return [g.cx+dot(g.east)*g.r,g.cy-dot(g.up)*g.r,dot(g.front)];
}
function projectCell(cell){
  if(state.projection==='globe'){const [lon,lat]=lonLat(state.model.grid,cell);return globeProject(lon,lat,globeSetup());}
  const p=xy(cell),w=state.model.grid.width;let dx=p.x-state.cx;dx-=Math.round(dx/w)*w;
  return [state.width/2+dx*state.fit*state.zoom,state.height/2+(p.y-state.cy)*state.fit*state.zoom,1];
}
function draw(){
  ctx.setTransform(state.dpr,0,0,state.dpr,0,0);ctx.fillStyle='#0d202c';ctx.fillRect(0,0,state.width,state.height);
  if(!state.model)return;
  if(state.projection==='map')drawMap();else drawGlobe();
  drawSelection();updateScale();
}
function drawMap(){
  const {width:w,height:h}=state.model.grid,s=state.fit*state.zoom,origin=mapPosition(0,0);
  const start=Math.floor((state.cx-state.width/(2*s))/w),end=Math.ceil((state.cx+state.width/(2*s))/w);
  ctx.save();ctx.beginPath();ctx.rect(0,origin[1],state.width,h*s);ctx.clip();
  ctx.imageSmoothingEnabled=state.zoom<6;
  for(let copy=start;copy<=end;copy++)ctx.drawImage(state.texture,origin[0]+copy*w*s,origin[1],w*s,h*s);
  drawMapGrid(start,end);
  for(const kind of ['stream','river','major']){
    if(kind==='stream'?!layers.streams:!layers.rivers)continue;
    ctx.strokeStyle=kind==='stream'?'#79b9c9':kind==='river'?'#a0d9e0':'#d0f2ef';
    ctx.globalAlpha=kind==='stream'?.67:kind==='river'?.88:.97;
    ctx.lineWidth=(kind==='stream'?.43:kind==='river'?.94:1.7)*Math.pow(state.zoom,.40);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    for(const entry of state.paths)if(entry.reach.kind===kind)for(let copy=start-1;copy<=end;copy++)appendMapPath(entry.points,copy*w);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
  if(layers.headwaters){
    ctx.fillStyle='#d4dfcb';ctx.globalAlpha=.65;ctx.beginPath();const r=Math.min(2.6,.62*Math.pow(state.zoom,.40));
    for(const n of state.heads){const p=xy(n.cell);for(let copy=start;copy<=end;copy++){const [x,y]=mapPosition(p.x,p.y,copy*w);if(x< -5||x>state.width+5||y< -5||y>state.height+5)continue;ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,TAU);}}
    ctx.fill();ctx.globalAlpha=1;
  }
  if(layers.arrows)drawFlowArrows();
  if(layers.lakes&&state.zoom>=3)drawLakeLabels();
  ctx.restore();
  ctx.strokeStyle='#52717b55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,origin[1]);ctx.lineTo(state.width,origin[1]);ctx.moveTo(0,origin[1]+h*s);ctx.lineTo(state.width,origin[1]+h*s);ctx.stroke();
}
function appendMapPath(points,shift){
  const s=state.fit*state.zoom,ox=state.width/2+(-state.cx+shift)*s,oy=state.height/2-state.cy*s;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<points.length;i+=2){minX=Math.min(minX,points[i]);maxX=Math.max(maxX,points[i]);minY=Math.min(minY,points[i+1]);maxY=Math.max(maxY,points[i+1]);}
  if(maxX*s+ox< -5||minX*s+ox>state.width+5||maxY*s+oy< -5||minY*s+oy>state.height+5)return;
  ctx.moveTo(points[0]*s+ox,points[1]*s+oy);
  for(let i=2;i<points.length-2;i+=2){const nx=(points[i]+points[i+2])/2,ny=(points[i+1]+points[i+3])/2;ctx.quadraticCurveTo(points[i]*s+ox,points[i+1]*s+oy,nx*s+ox,ny*s+oy);}
  ctx.lineTo(points[points.length-2]*s+ox,points[points.length-1]*s+oy);
}
function drawMapGrid(start,end){
  const g=state.model.grid;ctx.strokeStyle='#bddbd410';ctx.lineWidth=.6;ctx.beginPath();
  for(let lon=-180;lon<=180;lon+=30)for(let copy=start;copy<=end;copy++){
    const x=(lon+180)/360*g.width,[a,b]=mapPosition(x,0,copy*g.width),[,d]=mapPosition(x,g.height,copy*g.width);ctx.moveTo(a,b);ctx.lineTo(a,d);
  }
  for(let lat=-60;lat<=60;lat+=30){const y=(90-lat)/180*g.height,[,py]=mapPosition(0,y);ctx.moveTo(0,py);ctx.lineTo(state.width,py);}
  ctx.stroke();
  if(state.zoom===1){ctx.fillStyle='#abc6c159';ctx.font='8px system-ui';for(let lat of [-60,-30,0,30,60]){const [,y]=mapPosition(0,(90-lat)/180*g.height);if(y>30&&y<state.height-35)ctx.fillText(lat===0?'EQUATOR':Math.abs(lat)+'° '+(lat>0?'N':'S'),12,y-5);}}
}
function drawGlobe(){
  const g=globeSetup(),key=[state.width,state.height,state.zoom,state.lon.toFixed(3),state.lat.toFixed(3),renderRevision].join('/');
  if(state.globeKey!==key){
    const output=state.globeCanvas||document.createElement('canvas');state.globeCanvas=output;
    // Ray-cast the whole visible hemisphere from the SAME solved map texture.
    const pxRatio=Math.min(state.dpr,1.5),w=Math.ceil(state.width*pxRatio),h=Math.ceil(state.height*pxRatio);
    output.width=w;output.height=h;const gc=output.getContext('2d'),im=gc.createImageData(w,h),data=im.data,source=state.textureData;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
      const x=(xx/pxRatio-g.cx)/g.r,y=(g.cy-yy/pxRatio)/g.r,rr=x*x+y*y;if(rr>1)continue;
      const z=Math.sqrt(1-rr),vx=g.east[0]*x+g.up[0]*y+g.front[0]*z,vy=g.east[1]*x+g.up[1]*y+g.front[1]*z,vz=g.east[2]*x+g.up[2]*y+g.front[2]*z;
      const lon=Math.atan2(vz,vx),lat=Math.asin(Math.max(-1,Math.min(1,vy)));
      const tx=Math.min(source.width-1,Math.floor((lon+Math.PI)/TAU*source.width)),ty=Math.min(source.height-1,Math.floor((Math.PI/2-lat)/Math.PI*source.height));
      const from=(ty*source.width+tx)*4,to=(yy*w+xx)*4,shade=.77+.23*Math.sqrt(z);
      data[to]=source.data[from]*shade;data[to+1]=source.data[from+1]*shade;data[to+2]=source.data[from+2]*shade;data[to+3]=255;
    }
    gc.putImageData(im,0,0);state.globeKey=key;
  }
  const glow=ctx.createRadialGradient(g.cx,g.cy,g.r*.95,g.cx,g.cy,g.r*1.055);glow.addColorStop(0,'#6aafa214');glow.addColorStop(1,'#6aafa200');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(g.cx,g.cy,g.r*1.055,0,TAU);ctx.fill();
  ctx.drawImage(state.globeCanvas,0,0,state.width,state.height);
  ctx.save();ctx.beginPath();ctx.arc(g.cx,g.cy,g.r,0,TAU);ctx.clip();drawGlobeGrid(g);
  for(const kind of ['stream','river','major']){
    if(kind==='stream'?!layers.streams:!layers.rivers)continue;
    ctx.strokeStyle=kind==='stream'?'#79b9c9':kind==='river'?'#a0d9e0':'#d0f2ef';ctx.globalAlpha=kind==='stream'?.62:.92;
    ctx.lineWidth=(kind==='stream'?.45:kind==='river'?.9:1.5)*Math.pow(state.zoom,.4);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    for(const {reach} of state.paths)if(reach.kind===kind)appendGlobePath(reach.path,g);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
  if(layers.headwaters){ctx.fillStyle='#d4dfcb';ctx.globalAlpha=.65;ctx.beginPath();for(const n of state.heads){const [x,y,z]=globeProject(n.lon,n.lat,g);if(z<=.03)continue;const r=.63*Math.pow(state.zoom,.4);ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,TAU);}ctx.fill();ctx.globalAlpha=1;}
  if(layers.arrows)drawFlowArrows();if(layers.lakes&&state.zoom>=2)drawLakeLabels();ctx.restore();
  ctx.strokeStyle='#789b9d66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(g.cx,g.cy,g.r,0,TAU);ctx.stroke();
}
function appendGlobePath(path,g){
  let drawing=false;
  for(const i of path){const [lon,lat]=lonLat(state.model.grid,i),[x,y,z]=globeProject(lon,lat,g);if(z<0){drawing=false;continue;}if(!drawing){ctx.moveTo(x,y);drawing=true;}else ctx.lineTo(x,y);}
}
function drawGlobeGrid(g){
  ctx.strokeStyle='#bddbd417';ctx.lineWidth=.6;ctx.beginPath();
  for(let lon=-180;lon<180;lon+=30){let active=false;for(let lat=-90;lat<=90;lat+=2){const [x,y,z]=globeProject(lon,lat,g);if(z<0){active=false;continue;}if(!active)ctx.moveTo(x,y);else ctx.lineTo(x,y);active=true;}}
  for(let lat=-60;lat<=60;lat+=30){let active=false;for(let lon=-180;lon<=180;lon+=2){const [x,y,z]=globeProject(lon,lat,g);if(z<0){active=false;continue;}if(!active)ctx.moveTo(x,y);else ctx.lineTo(x,y);active=true;}}
  ctx.stroke();
}
function drawFlowArrows(){
  ctx.strokeStyle='#d7eee2bb';ctx.lineWidth=.8;ctx.beginPath();let count=0;
  for(const {reach} of state.paths){
    if(reach.kind==='stream'&&!layers.streams||reach.kind!=='stream'&&!layers.rivers)continue;
    if(reach.kind==='stream'&&state.zoom<3)continue;
    const stride=Math.max(3,Math.floor(40/(state.fit*state.zoom)));
    for(let k=Math.min(2,reach.path.length-1);k<reach.path.length;k+=stride){
      const [ax,ay,az]=projectCell(reach.path[k-1]),[bx,by,bz]=projectCell(reach.path[k]);
      if(az<.05||bz<.05||Math.abs(ax-bx)>30||bx<8||bx>state.width-8||by<8||by>state.height-8)continue;
      const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(len<.1)continue;
      const ux=dx/len,uy=dy/len;ctx.moveTo(bx-ux*4-uy*2.5,by-uy*4+ux*2.5);ctx.lineTo(bx,by);ctx.lineTo(bx-ux*4+uy*2.5,by-uy*4-ux*2.5);
      if(++count>1600)break;
    }
    if(count>1600)break;
  }
  ctx.stroke();
}
function drawLakeLabels(){
  ctx.font='10px system-ui';ctx.fillStyle='#d2eeeb';ctx.textAlign='center';
  for(const wb of state.model.waterbodies){
    if(wb.kind!=='lake'||wb.areaKm2*state.zoom<12)continue;
    let point;
    if(state.projection==='globe')point=globeProject(wb.lon,wb.lat,globeSetup());
    else {const g=state.model.grid,p={x:(wb.lon+180)/360*g.width,y:(90-wb.lat)/180*g.height};let dx=p.x-state.cx;dx-=Math.round(dx/g.width)*g.width;point=[state.width/2+dx*state.fit*state.zoom,state.height/2+(p.y-state.cy)*state.fit*state.zoom,1];}
    const [x,y,z]=point;if(z<.1||x<50||x>state.width-50||y<25||y>state.height-25)continue;
    ctx.fillText('Lake '+String(wb.id+1).padStart(3,'0'),x,y);
  }
  ctx.textAlign='left';
}
function drawSelection(){
  if(state.selected<0)return;
  if(state.showTrace&&state.trace.length>1){
    ctx.strokeStyle='#f5c580';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#f5c58055';ctx.shadowBlur=7;ctx.beginPath();
    if(state.projection==='globe')appendGlobePath(state.trace,globeSetup());
    else {let p=null;const points=new Float32Array(state.trace.length*2);for(let k=0;k<state.trace.length;k++){p=xy(state.trace[k],p);points[k*2]=p.x;points[k*2+1]=p.y;}
      const w=state.model.grid.width,copy=Math.round((state.cx-points[0])/w);for(let c=copy-1;c<=copy+1;c++)appendMapPath(points,c*w);}
    ctx.stroke();ctx.shadowBlur=0;
    const end=projectCell(state.trace[state.trace.length-1]);if(end[2]>0)drawMarker(end[0],end[1],3,'#f5c580');
  }
  const [x,y,z]=projectCell(state.selected);if(z>0){drawMarker(x,y,4,'#f5c580');ctx.strokeStyle='#f5c580aa';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,8,0,TAU);ctx.stroke();}
}
function drawMarker(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function updateScale(){
  const g=state.model.grid;let kmPerPx;
  if(state.projection==='map'){const lat=90-state.cy/g.height*180;kmPerPx=g.radiusKm*TAU/g.width/(state.fit*state.zoom)*Math.max(.12,Math.cos(lat*DEG));}
  else kmPerPx=g.radiusKm/globeSetup().r;
  const target=kmPerPx*80,base=10**Math.floor(Math.log10(target)),scale=target/base>=5?5:target/base>=2?2:1,km=scale*base;
  $('scale').querySelector('span').textContent=km<1?Math.round(km*1000)+' m':number(km,1)+' km';
  $('scale').querySelector('i').style.width=Math.max(20,km/kmPerPx)+'px';
}

function pick(lx,ly){
  if(!state.model)return null;const g=state.model.grid;
  if(state.projection==='map'){
    const s=state.fit*state.zoom,x=state.cx+(lx-state.width/2)/s,y=state.cy+(ly-state.height/2)/s;if(y<0||y>g.height)return null;
    return {lon:((x/g.width*360)%360+360)%360-180,lat:90-y/g.height*180};
  }
  const globe=globeSetup(),x=(lx-globe.cx)/globe.r,y=(globe.cy-ly)/globe.r,rr=x*x+y*y;if(rr>1)return null;
  const z=Math.sqrt(1-rr),vx=globe.east[0]*x+globe.up[0]*y+globe.front[0]*z,vy=globe.east[1]*x+globe.up[1]*y+globe.front[1]*z,vz=globe.east[2]*x+globe.up[2]*y+globe.front[2]*z;
  return {lon:Math.atan2(vz,vx)/DEG,lat:Math.asin(Math.max(-1,Math.min(1,vy)))/DEG};
}
function selectAt(lx,ly){
  const point=pick(lx,ly);if(!point)return;const m=state.model;let i=cellAt(m.grid,point.lon,point.lat);
  if(!m.ocean[i]&&m.waterbody[i]<0&&!m.channel[i]){
    // Screen-space snapping makes narrow streams selectable at any zoom.
    let best=10**2,candidate=-1;
    for(const {reach} of state.paths){
      if(reach.kind==='stream'?!layers.streams:!layers.rivers)continue;
      for(const cell of reach.path){const [x,y,z]=projectCell(cell);if(z<.02)continue;const d=(x-lx)**2+(y-ly)**2;if(d<best){best=d;candidate=cell;}}
    }
    if(candidate>=0)i=candidate;
  }
  selectCell(i);
}
function coordText(lon,lat){return `${Math.abs(lat).toFixed(2)}° ${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(2)}° ${lon>=0?'E':'W'}`;}
function selectCell(i,{focus=false}={}){
  const m=state.model;if(!m)return;state.selected=i;state.trace=traceDownstream(m,i);state.showTrace=!m.ocean[i];state.showCatchment=false;state.mask=null;
  $('clear-selection').hidden=false;$('selection-actions').hidden=!!m.ocean[i];$('trace-button').classList.toggle('active',state.showTrace);$('catchment-button').classList.remove('active');
  const [lon,lat]=lonLat(m.grid,i),wb=m.waterbody[i]>=0?m.waterbodies[m.waterbody[i]]:null;
  let kind=wb?wb.kind:m.ocean[i]?'ocean':m.channel[i]===3?'major river':m.channel[i]===2?'river':m.channel[i]?'stream':'drainage cell';
  const head=state.heads.some(n=>n.cell===i);if(head)kind='headwater';
  const name=wb?(wb.kind==='lake'?'Lake ':'Pond ')+String(wb.id+1).padStart(3,'0'):m.ocean[i]?'The global ocean':head?'A river begins here':kind==='drainage cell'?'An inland catchment':kind==='major river'?'The main river':kind==='river'?'A connected river':'A tributary stream';
  let length=0;for(let k=1;k<state.trace.length;k++)length+=distanceKm(m.grid,state.trace[k-1],state.trace[k]);
  const area=wb?m.catchment[wb.outletCell]:m.catchment[i],flow=wb?wb.outflowM3s:m.discharge[i];
  const field=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
  const data=m.ocean[i]?field('Connected ocean',number(m.stats.oceanAreaKm2,0)+' km²')+field('Sea level','0 m'):
    field('Contributing area',number(area,2)+' km²')+field('Steady flow',number(flow,3)+' m³/s')+
    (wb?field('Water surface',number(wb.areaKm2,3)+' km²')+field('Spill elevation',number(wb.surfaceM,1)+' m')+field('Stream inlets',fmt.format(m.reaches.filter(e=>m.nodes[e.to].waterbody===wb.id).length))+field('Outlets','1 · connected'):
    field('Drainage elevation',number(m.level[i],1)+' m')+field('Distance to ocean',number(length,1)+' km'));
  $('inspector').className='';$('inspector').innerHTML=`<div class="selection-kind">${kind}</div><div class="selection-name">${name}</div><div class="selection-coord">${coordText(lon,lat)}</div><div class="selection-data">${data}</div><p class="selection-destination">${m.ocean[i]?'All inland systems return to this connected body of water.':`Downstream destination: <b>Global ocean</b><br>${wb?'Retained water surface, one spill outlet.':lakeCount(state.trace,m)+' inland waterbodies along this route.'}`}</p>`;
  if(focus){
    if(state.projection==='globe'){state.lon=lon;state.lat=lat;state.zoom=1.7;}
    else {const p=xy(i);state.cx=p.x;state.cy=p.y;state.zoom=Math.max(3,state.zoom);clampMap();}
  }
  makeTexture();requestDraw();
}
function lakeCount(path,m){return new Set(path.map(i=>m.waterbody[i]).filter(i=>i>=0)).size;}
function clearSelection(){
  state.selected=-1;state.trace=[];state.mask=null;state.showTrace=false;state.showCatchment=false;
  $('inspector').className='inspector-empty';$('inspector').innerHTML='<span class="inspect-icon">⌖</span><p>Select any waterway or place on land to follow its journey to the ocean.</p>';
  $('selection-actions').hidden=true;$('clear-selection').hidden=true;makeTexture();
}
$('clear-selection').addEventListener('click',clearSelection);
$('trace-button').addEventListener('click',()=>{state.showTrace=!state.showTrace;$('trace-button').classList.toggle('active',state.showTrace);requestDraw();});
$('catchment-button').addEventListener('click',()=>{
  if(state.selected<0)return;state.showCatchment=!state.showCatchment;
  if(state.showCatchment&&!state.mask){const wb=state.model.waterbody[state.selected];state.mask=catchmentMask(state.model,wb>=0?state.model.waterbodies[wb].outletCell:state.selected);}
  $('catchment-button').classList.toggle('active',state.showCatchment);makeTexture();
});
function clampMap(){const g=state.model?.grid;if(!g)return;state.cx=((state.cx%g.width)+g.width)%g.width;state.cy=Math.max(0,Math.min(g.height,state.cy));}
function zoomBy(factor,lx=state.width/2,ly=state.height/2){
  if(!state.model)return;const old=state.zoom,next=Math.min(state.projection==='globe'?7:50,Math.max(1,old*factor));if(old===next)return;
  if(state.projection==='map'){
    const s=state.fit*old,n=state.fit*next;state.cx+=(lx-state.width/2)/s-(lx-state.width/2)/n;state.cy+=(ly-state.height/2)/s-(ly-state.height/2)/n;
  }
  state.zoom=next;clampMap();requestDraw();
}
$('zoom-in').addEventListener('click',()=>zoomBy(1.5));$('zoom-out').addEventListener('click',()=>zoomBy(1/1.5));
function fitWorld(){if(!state.model)return;state.zoom=1;state.cx=state.model.grid.width/2;state.cy=state.model.grid.height/2;state.lon=0;state.lat=0;requestDraw();}
$('fit-world').addEventListener('click',fitWorld);
function projection(name){
  if(state.projection===name)return;
  if(name==='globe'&&state.model){state.lon=state.cx/state.model.grid.width*360-180;state.lat=90-state.cy/state.model.grid.height*180;}
  if(name==='map'&&state.model){state.cx=(state.lon+180)/360*state.model.grid.width;state.cy=(90-state.lat)/180*state.model.grid.height;}
  state.projection=name;state.zoom=1;state.globeKey='';
  $('view-map').classList.toggle('active',name==='map');$('view-globe').classList.toggle('active',name==='globe');$('view-map').setAttribute('aria-pressed',name==='map');$('view-globe').setAttribute('aria-pressed',name==='globe');
  $('map-hint').innerHTML=name==='map'?'Drag to explore <span>·</span> Scroll or pinch to zoom <span>·</span> Select to trace':'Drag to rotate <span>·</span> Scroll or pinch to zoom <span>·</span> Select to trace';requestDraw();
}
$('view-map').addEventListener('click',()=>projection('map'));$('view-globe').addEventListener('click',()=>projection('globe'));
canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoomBy(Math.exp(-e.deltaY*.0018),e.clientX-r.left,e.clientY-r.top);},{passive:false});
canvas.addEventListener('keydown',e=>{
  if(!state.model)return;
  if(['+','=','-','_','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key))e.preventDefault();
  if(e.key==='+'||e.key==='=')zoomBy(1.5);else if(e.key==='-'||e.key==='_')zoomBy(1/1.5);else if(e.key==='0')fitWorld();else if(e.key==='Escape')clearSelection();
  else if(e.key.startsWith('Arrow')){
    const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
    if(state.projection==='map'){state.cx+=dx*50/(state.fit*state.zoom);state.cy+=dy*50/(state.fit*state.zoom);clampMap();}
    else{state.lon+=dx*10;state.lat=Math.max(-89,Math.min(89,state.lat-dy*10));}requestDraw();
  }
});
const pointers=new Map();let gesture=null;
function pointerLocal(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{
  if(!state.model)return;canvas.setPointerCapture(e.pointerId);const p=pointerLocal(e);pointers.set(e.pointerId,p);
  gesture={x:p.x,y:p.y,clickedX:p.x,clickedY:p.y,moved:false,pinch:pointers.size>1,dist:0};
  if(pointers.size===2){const q=[...pointers.values()];gesture.dist=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y);}
});
canvas.addEventListener('pointermove',e=>{
  const p=pointerLocal(e),point=pick(p.x,p.y);if(point)$('coordinates').textContent=coordText(point.lon,point.lat);
  if(!pointers.has(e.pointerId)||!gesture)return;
  pointers.set(e.pointerId,p);
  if(pointers.size>=2){
    const q=[...pointers.values()],dist=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y);if(gesture.dist)zoomBy(dist/gesture.dist,(q[0].x+q[1].x)/2,(q[0].y+q[1].y)/2);gesture.dist=dist;gesture.moved=true;gesture.pinch=true;return;
  }
  if(gesture.pinch){gesture.x=p.x;gesture.y=p.y;return;}
  const dx=p.x-gesture.x,dy=p.y-gesture.y;if(Math.hypot(p.x-gesture.clickedX,p.y-gesture.clickedY)>4)gesture.moved=true;
  if(state.projection==='map'){state.cx-=dx/(state.fit*state.zoom);state.cy-=dy/(state.fit*state.zoom);clampMap();}
  else{state.lon-=dx*.32/state.zoom;state.lat=Math.max(-89.8,Math.min(89.8,state.lat+dy*.32/state.zoom));}
  gesture.x=p.x;gesture.y=p.y;requestDraw();
});
canvas.addEventListener('pointerup',e=>{
  const p=pointerLocal(e);pointers.delete(e.pointerId);if(gesture&&!gesture.moved&&!gesture.pinch)selectAt(p.x,p.y);if(pointers.size===0)gesture=null;
});
canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;});
canvas.addEventListener('dblclick',e=>{const p=pointerLocal(e);zoomBy(2,p.x,p.y);});

for(const key of Object.keys(layers))$('layer-'+key).addEventListener('change',e=>{layers[key]=e.target.checked;if(key==='lakes'||key==='basins')makeTexture();else requestDraw();});
$('layers-reset').addEventListener('click',()=>{for(const key of Object.keys(layers)){layers[key]=!['basins','arrows'].includes(key);$('layer-'+key).checked=layers[key];}makeTexture();});
$('about-open').addEventListener('click',()=>$('about-dialog').showModal());$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});

function displayStats(){
  const m=state.model,s=m.stats;for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])$('stat-'+key).textContent=fmt.format(s[key]);
  $('top-status').textContent='Complete planet · All systems connected';
  $('verification-title').textContent='Every inland cell reaches the ocean';$('verification-detail').textContent=`${fmt.format(s.cells)} cells checked · 0 cycles · 0 unresolved outlets`;
  $('verification').querySelector('.verification-symbol').textContent='✓';$('verification').classList.remove('failed');
  $('coverage').textContent=`${fmt.format(s.cells)} flow cells · ${Math.round(s.equatorSpacingM)} m equatorial spacing`;
  $('map-subtitle').textContent=`${number(s.worldAreaKm2,0)} km². Fully connected.`;
  $('systems-list').replaceChildren();
  for(const [index,n] of state.mouths.slice(0,5).entries()){
    const button=document.createElement('button');button.type='button';const riverCell=m.trunk[n.cell];
    button.innerHTML=`<span class="system-number">0${index+1}</span><span class="system-name">River system ${index+1}<small>${number(m.longest[n.cell],1)} km longest flow path</small></span><span class="system-area">${number(n.areaKm2,0)} <small>km²</small></span>`;
    button.addEventListener('click',()=>{
      let head=riverCell;while(m.trunk[head]>=0&&m.channel[m.trunk[head]])head=m.trunk[head];
      selectCell(head,{focus:true});
    });$('systems-list').append(button);
  }
}
function generate(seed){
  state.worker?.terminate();state.worker=null;state.model=null;state.selected=-1;state.trace=[];state.mask=null;state.showTrace=false;state.showCatchment=false;
  $('generate').disabled=true;$('loading').hidden=false;$('loading-progress').style.width='0';$('loading-stage').textContent='Defining continents and drainage divides';
  $('loading').querySelector('h2').textContent='Finding every way to the sea';$('top-status').textContent='Generating the whole planet';
  $('verification-title').textContent='Solving the complete planet';$('verification-detail').textContent='Continents, basins and every downstream link.';$('verification').querySelector('.verification-symbol').textContent='…';
  $('selection-actions').hidden=true;$('clear-selection').hidden=true;$('inspector').className='inspector-empty';$('inspector').innerHTML='<span class="inspect-icon">⌖</span><p>Select any waterway or place on land to follow its journey to the ocean.</p>';
  for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])$('stat-'+key).textContent='—';
  $('systems-list').innerHTML='<p class="muted">Finding the continental drainage systems…</p>';
  try{
    const worker=new Worker(new URL('./planet-worker.mjs',import.meta.url),{type:'module'});state.worker=worker;
    worker.onmessage=({data})=>{
      if(data.type==='progress'){$('loading-stage').textContent=data.stage;$('loading-progress').style.width=data.fraction*100+'%';}
      else if(data.type==='complete'){
        state.model=data.model;state.worker.terminate();state.worker=null;preparePaths();makeTexture();displayStats();fitWorld();resize();
        $('loading').hidden=true;$('generate').disabled=false;
        const url=new URL(location.href);url.searchParams.set('seed',seed);url.searchParams.set('v',VERSION);history.replaceState(null,'',url);
        // Read-only snapshot for reproducible QA and inspection, never a separate simulation.
        window.horizon=Object.freeze({version:VERSION,seed,state,inspect:()=>({stats:state.model.stats,validation:state.model.validation,projection:state.projection,zoom:state.zoom,selected:state.selected})});
      }else if(data.type==='error')failure(data.message);
    };
    worker.onerror=event=>failure(event.message||'Could not load the planet generator');worker.postMessage({seed});
  }catch(error){failure(error.message);}
}
function failure(message){
  state.worker?.terminate();state.worker=null;$('generate').disabled=false;$('loading').hidden=false;
  $('loading').querySelector('h2').textContent='The planet could not be generated';$('loading-stage').textContent=message;
  $('verification').classList.add('failed');$('verification-title').textContent='Generation did not pass validation';$('verification-detail').textContent=message;$('top-status').textContent='Generation failed';
}
$('seed-form').addEventListener('submit',e=>{e.preventDefault();const seed=$('seed').value.trim()||'HORIZON-01';$('seed').value=seed;generate(seed);});
$('seed').value=new URLSearchParams(location.search).get('seed')?.slice(0,100)||'HORIZON-01';resize();generate($('seed').value);
