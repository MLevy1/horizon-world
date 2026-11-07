import {panTerrainView} from './terrain-lod.mjs?v=0.9.10';
import {createTerrainViewQueue} from './terrain-stream.mjs?v=0.9.10';
import {sampleConstraintSection} from './channel-constraints.mjs?v=0.9.10';
import {constraintSectionSvg} from './constraint-view.mjs?v=0.9.10';
import {VERSION,lonLat,cellAt,traceActive,catchmentMask,distanceKm} from './planet.mjs?v=0.9.10';
import {ZONES,flowRegime} from './climate.mjs?v=0.9.10';
import {inspectionRoute,inspectionStation,longitudinalSvg,sectionSvg} from './profile-view.mjs?v=0.9.10';
import {createSurfaceSampler} from './surface-sampler.mjs?v=0.9.10';

const $=id=>document.getElementById(id);
const canvas=$('map'),ctx=canvas.getContext('2d'),stage=$('map-stage');
const fmt=new Intl.NumberFormat('en-US'),number=(x,d=1)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(x);
const state={model:null,worker:null,projection:'map',climateLayer:'water',zoom:1,cx:768,cy:384,lon:0,lat:0,selected:-1,trace:[],mask:null,showTrace:false,showCatchment:false,
  width:0,height:0,dpr:1,fit:1,frame:0,texture:null,textureData:null,catchmentTexture:null,globeCanvas:null,globeKey:'',paths:[],heads:[],mouths:[]};
const layers={rivers:true,streams:true,lakes:true,headwaters:true,basins:false,arrows:false,dry:false,snow:true,volcanoes:true,shores:true};
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
  if(!state.model)return;
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
      if(state.climateLayer==='geology'&&m.geology.ids[i]>=0)color=climateColor(i);
    }else{
      const wb=m.waterbody[i]>=0?m.waterbodies[m.waterbody[i]]:null;
      if(state.climateLayer!=='water')color=climateColor(i);
      else if(m.climate.zone[i]===1)color=[99,86,58];
      else if(m.climate.zone[i]===2)color=[76,77,58];
      else if(m.climate.zone[i]===0)color=[63,77,82];
      if(layers.lakes&&!wb&&m.basinId[i]>=0&&state.climateLayer==='water')color=[109,94,74];
      if(layers.basins)color=colorForBasin(m.activeTerminal[i]);
      if(layers.lakes&&wb){
        if(wb.status!=='playa'&&m.wetness[i]>.35)color=palette.lake;
        else if(state.climateLayer==='water')color=wb.closed?[109,94,74]:palette.land;
      }
    }
    if(layers.snow&&(state.climateLayer==='water'||state.climateLayer==='snow')){
      const ice=m.cryosphere;
      if(m.ocean[i]&&ice.freezeMonths[i]>=6){
        const blend=Math.max(0,Math.min(.88,(-m.climate.temperature[i]-2)/20));
        color=color.map((v,k)=>Math.round(v*(1-blend)+[158,195,212][k]*blend));
      }
      else if(!m.ocean[i]&&ice.glacier[i])color=[169,219,232];
      else if(!m.ocean[i]&&layers.lakes&&m.wetness[i]>.35&&ice.freezeMonths[i]>=6)color=[170,202,219];
      else if(!m.ocean[i]&&ice.snowMonths[i]>=6&&ice.peakSnowMm[i]>=20){
        const blend=Math.min(.85,ice.snowMonths[i]/12*.85);color=color.map((v,k)=>Math.round(v*(1-blend)+[232,241,236][k]*blend));
      }
    }
    if(selectedMask?.[i])color=[Math.round(color[0]*.55+245*.45),Math.round(color[1]*.55+197*.45),Math.round(color[2]*.55+128*.45)];
    const xx=(x*2+(y&1))%tw,yy=y*2;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const p=((yy+dy)*tw+(xx+dx)%tw)*4;data[p]=color[0];data[p+1]=color[1];data[p+2]=color[2];data[p+3]=255;
    }
  }
  tctx.putImageData(im,0,0);state.texture=tex;state.textureData=im;state.globeKey='';renderRevision++;requestDraw();
}
const ramps={temperature:[[87,100,166],[90,165,183],[169,199,166],[218,187,104],[183,84,64]],
  precipitation:[[139,104,65],[179,151,98],[125,166,157],[53,127,168],[73,91,167]],
  aridity:[[153,104,64],[192,165,109],[151,168,126],[81,143,139],[53,111,142]],
  snow:[[54,70,66],[119,147,151],[184,208,212],[230,241,239],[169,219,232]],
  melt:[[44,62,71],[58,105,145],[74,160,186],[139,207,216],[212,244,239]],
  geology:[[71,79,76],[103,73,60],[166,100,57],[213,155,90],[90,54,46]]};
function climateColor(i){
  const c=state.model.climate,kind=state.climateLayer;
  if(kind==='geology'){
    const m=state.model,g=m.geology,id=g.ids[i];
    if(id<0){const h=Math.max(0,Math.min(1,m.height[i]/2600));return [66+h*42,76+h*40,72+h*37];}
    if(m.ocean[i])return [56,65,78];
    if(g.lava[i])return [176,108,60];
    if(g.crater[i])return [101,60,49];
    const rise=Math.max(0,Math.min(1,g.change[i]/850));return [130+rise*81,91+rise*65,72+rise*27];
  }
  if(kind==='snow'){
    const ice=state.model.cryosphere;
    if(ice.glacier[i])return [169,219,232];
    if(ice.snowMonths[i]>=11)return [230,241,239];
    const blend=Math.min(.8,ice.peakSnowMm[i]/400);return [54,70,66].map((v,k)=>Math.round(v*(1-blend)+[220,233,228][k]*blend));
  }
  const value=kind==='melt'?(state.model.cryosphere.snowmeltMm[i]+state.model.cryosphere.iceMeltMm[i])/1000:kind==='temperature'?(c.temperature[i]+25)/60:kind==='precipitation'?c.precipitation[i]/2200:c.aridity[i]/1.5;
  const t=Math.max(0,Math.min(1,value))*4,k=Math.min(3,Math.floor(t)),f=t-k,r=ramps[kind];
  return r[k].map((v,j)=>Math.round(v*(1-f)+r[k+1][j]*f));
}
function effectiveRegime(reach){return reach.dormantSpill?'dry':reach.regime;}
function styleReach(kind,regime){
  ctx.strokeStyle=regime==='dry'?'#b7a17b':kind==='stream'?'#79b9c9':kind==='river'?'#a0d9e0':'#d0f2ef';
  ctx.globalAlpha=regime==='dry'?.23:regime==='ephemeral'?.32:regime==='seasonal'?.57:.9;
  ctx.lineWidth=(kind==='stream'?.43:kind==='river'?.94:1.7)*Math.pow(state.zoom,.40)*(regime==='perennial'?1:.75);
  ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(regime==='perennial'?[]:regime==='seasonal'?[4,3]:[1,3]);
}
function updateClimateLegend(){
  const kind=state.climateLayer;
  const labels={water:['Water availability','Solid: persistent-flow estimate · Dashed: seasonal / ephemeral'],temperature:['Mean annual temperature','−25°C · −10°C · 5°C · 20°C · 35°C'],precipitation:['Annual precipitation','0 · 550 · 1,100 · 1,650 · 2,200+ mm/yr'],aridity:['Moisture balance · precipitation / evaporative demand','Dry / desert ← 0 · 0.25 · 0.5 · 1 → Humid'],snow:['Snow & ice · annual estimates','Gray: seasonal snow · White: persistent snow · Blue: glacier / frozen water'],melt:['Snow + glacier meltwater supply','0 · 250 · 500 · 750 · 1,000+ mm water/yr'],geology:['Volcanic geography · static landforms','Gray: base geography · Rust: volcano · Orange: cooled lava · Dark: crater']};
  $('climate-legend-title').textContent=labels[kind][0];$('climate-legend-labels').textContent=labels[kind][1];
  $('climate-ramp').style.background=kind==='water'?'linear-gradient(90deg,#9b8056,#344642,#5aaabb)':`linear-gradient(90deg,${ramps[kind].map(c=>'rgb('+c.join(',')+')').join(',')})`;
}
$('climate-layer').addEventListener('change',e=>{state.climateLayer=e.target.value;updateClimateLegend();if(state.model)makeTexture();});
updateClimateLegend();
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
function coursePath(cells){
  const g=state.model.grid,p=state.model.riverProfiles,course=state.surfaceSampler.course,out=[];let previous=null;
  function add(d){let x=Math.abs(d[1])>1-1e-15?(previous??g.width/2):(Math.atan2(d[2],d[0])*180/Math.PI+180)/360*g.width;const y=(90-Math.asin(Math.max(-1,Math.min(1,d[1])))*180/Math.PI)/180*g.height;if(previous!==null){while(x-previous>g.width/2)x-=g.width;while(x-previous< -g.width/2)x+=g.width;}out.push(x,y);previous=x;}
  for(let k=0;k<cells.length;k++){const e=p.edgeAtCell[cells[k]];if(k+1<cells.length&&e>=0&&p.to[e]===cells[k+1])for(const t of [0,.125,.25,.375,.5,.625,.75,.875])add(course.sample(e,t).direction);else add(course.nodeDirection(cells[k]));}
  return Float32Array.from(out);
}
function preparePaths(){
  state.paths=[...state.model.reaches,...state.model.potentialSpills].map(reach=>({reach,points:coursePath(reach.path)}));
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
  if(layers.volcanoes)drawVolcanoMarkers();
  if(layers.shores)drawShorelines();
  drawSelection();updateScale();
}
function drawShorelines(){
  const shores=state.model.shorelines;if(!shores)return;
  const grid=state.model.grid,g=state.projection==='globe'?globeSetup():null;
  ctx.save();if(!g){const [,top]=mapPosition(0,0),[,bottom]=mapPosition(0,grid.height);ctx.beginPath();ctx.rect(0,top,state.width,bottom-top);ctx.clip();}ctx.lineWidth=.8;ctx.strokeStyle='#c5e1c3';ctx.globalAlpha=.7;ctx.setLineDash([]);ctx.beginPath();
  for(const path of shores.paths){
    if(path.kind==='pool'&&!layers.lakes)continue;
    const p=path.coordinates;
    if(g){let drawing=false;for(let k=0;k<p.length;k+=2){const [x,y,z]=globeProject(p[k],p[k+1],g);if(z<=0){drawing=false;continue;}if(drawing)ctx.lineTo(x,y);else{ctx.moveTo(x,y);drawing=true;}}}
    else{
      const points=[];let previous=null;
      for(let k=0;k<p.length;k+=2){let x=(p[k]+180)/360*grid.width;const y=(90-p[k+1])/180*grid.height;if(previous!==null){while(x-previous>grid.width/2)x-=grid.width;while(x-previous< -grid.width/2)x+=grid.width;}points.push(x,y);previous=x;}
      let minX=Infinity,maxX=-Infinity;for(let k=0;k<points.length;k+=2){minX=Math.min(minX,points[k]);maxX=Math.max(maxX,points[k]);}const s=state.fit*state.zoom,first=Math.floor((state.cx-state.width/(2*s)-maxX)/grid.width),last=Math.ceil((state.cx+state.width/(2*s)-minX)/grid.width);
      for(let copy=first;copy<=last;copy++){let drawing=false;for(let k=0;k<points.length;k+=2){const [x,y]=mapPosition(points[k],points[k+1],copy*grid.width);if(drawing)ctx.lineTo(x,y);else{ctx.moveTo(x,y);drawing=true;}}}
    }
  }
  ctx.stroke();ctx.restore();
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
    for(const regime of ['dry','ephemeral','seasonal','perennial']){
      if(regime==='dry'&&!layers.dry)continue;
      styleReach(kind,regime);ctx.beginPath();
      for(const entry of state.paths)if(entry.reach.kind===kind&&effectiveRegime(entry.reach)===regime)
        for(let copy=start-1;copy<=end;copy++)appendMapPath(entry.points,copy*w);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
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
  for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i]*s+ox,points[i+1]*s+oy);
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
    for(const regime of ['dry','ephemeral','seasonal','perennial']){
      if(regime==='dry'&&!layers.dry)continue;
      styleReach(kind,regime);ctx.beginPath();
      for(const {reach,points} of state.paths)if(reach.kind===kind&&effectiveRegime(reach)===regime)appendGlobePath(reach.path,g,points);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha=1;
  if(layers.headwaters){ctx.fillStyle='#d4dfcb';ctx.globalAlpha=.65;ctx.beginPath();for(const n of state.heads){const [x,y,z]=globeProject(n.lon,n.lat,g);if(z<=.03)continue;const r=.63*Math.pow(state.zoom,.4);ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,TAU);}ctx.fill();ctx.globalAlpha=1;}
  if(layers.arrows)drawFlowArrows();if(layers.lakes&&state.zoom>=2)drawLakeLabels();ctx.restore();
  ctx.strokeStyle='#789b9d66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(g.cx,g.cy,g.r,0,TAU);ctx.stroke();
}
function appendGlobePath(path,g,points=coursePath(path)){
  let drawing=false;const grid=state.model.grid;
  for(let k=0;k<points.length;k+=2){const lon=points[k]/grid.width*360-180,lat=90-points[k+1]/grid.height*180,[x,y,z]=globeProject(lon,lat,g);if(z<0){drawing=false;continue;}if(!drawing){ctx.moveTo(x,y);drawing=true;}else ctx.lineTo(x,y);}
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
    if(reach.dormantSpill||reach.regime==='dry'||reach.dischargeM3s<1e-9)continue;
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
    if(wb.kind!=='lake'||wb.status==='playa'||wb.wetAreaKm2*state.zoom<12)continue;
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
    else {const points=coursePath(state.trace);
      const w=state.model.grid.width,copy=Math.round((state.cx-points[0])/w);for(let c=copy-1;c<=copy+1;c++)appendMapPath(points,c*w);}
    ctx.stroke();ctx.shadowBlur=0;
    const end=projectCell(state.trace[state.trace.length-1]);if(end[2]>0)drawMarker(end[0],end[1],3,'#f5c580');
  }
  const [x,y,z]=projectCell(state.selected);if(z>0){drawMarker(x,y,4,'#f5c580');ctx.strokeStyle='#f5c580aa';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,8,0,TAU);ctx.stroke();}
}
function drawVolcanoMarkers(){
  ctx.save();const r=Math.min(6,3+Math.log2(state.zoom)*.5);
  for(const site of state.model.geology.sites){
    const [x,y,z]=projectCell(site.centerCell);if(z<.03||x< -10||x>state.width+10||y< -10||y>state.height+10)continue;
    ctx.fillStyle=site.submerged?'#8c9dae':'#e4ac71';ctx.strokeStyle='#192b31';ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(x,y-r*1.3);ctx.lineTo(x-r,y+r*.7);ctx.lineTo(x+r,y+r*.7);ctx.closePath();ctx.fill();ctx.stroke();
    if(state.climateLayer==='geology'&&state.zoom>=2){ctx.font='9px system-ui';ctx.fillStyle='#f3d7b7';ctx.fillText(site.name,x+r+3,y+3);}
  }
  ctx.restore();
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
  if(layers.volcanoes){
    let closest=null,best=8*8;
    for(const site of m.geology.sites){const [x,y,z]=projectCell(site.centerCell),d=(x-lx)**2+(y-ly)**2;if(z>.03&&d<best){closest=site;best=d;}}
    if(closest){selectCell(closest.centerCell);return;}
  }
  if(!m.ocean[i]&&m.waterbody[i]<0&&!m.channel[i]){
    // Screen-space snapping makes narrow streams selectable at any zoom.
    let best=10**2,candidate=-1;
    for(const {reach} of state.paths){
      if(reach.kind==='stream'?!layers.streams:!layers.rivers)continue;
      if(reach.dormantSpill&&!layers.dry)continue;
      for(const cell of reach.path){const [x,y,z]=projectCell(cell);if(z<.02)continue;const d=(x-lx)**2+(y-ly)**2;if(d<best){best=d;candidate=cell;}}
    }
    if(candidate>=0)i=candidate;
  }
  selectCell(i,{probe:point});
}
function coordText(lon,lat){return `${Math.abs(lat).toFixed(2)}° ${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(2)}° ${lon>=0?'E':'W'}`;}
function selectCell(i,{focus=false,probe=null}={}){
  const m=state.model;if(!m)return;state.selected=i;state.trace=traceActive(m,i);state.showTrace=!m.ocean[i];state.showCatchment=false;state.mask=null;
  $('clear-selection').hidden=false;$('selection-actions').hidden=!!m.ocean[i];$('trace-button').classList.toggle('active',state.showTrace);$('catchment-button').classList.remove('active');
  const ice=m.cryosphere,glacierId=ice.glacierId[i],volcanoId=m.geology.ids[i],volcano=volcanoId>=0?m.geology.sites[volcanoId]:null;
  const [lon,lat]=lonLat(m.grid,i),poolId=m.cellPool[i],wb=poolId>=0?m.waterbodies[poolId]:null;
  const exposed=poolId>=0&&m.waterbody[i]<0,parts=wb?m.basins[wb.basinId].poolIds:[];
  const wetParts=[...parts].filter(id=>m.waterbodies[id].status!=='playa');
  const levelParts=wb?[wb.id,...wetParts.filter(id=>id!==wb.id)]:[];
  let kind=m.waterbody[i]>=0?(wb.status==='playa'?'dry pool':wb.kind):m.ocean[i]?'ocean':m.channel[i]===3?'major river':m.channel[i]===2?'river':m.channel[i]?'stream':'drainage cell';
  if(exposed&&!m.channel[i])kind='exposed basin margin';
  const head=state.heads.some(n=>n.cell===i);if(head)kind='headwater';if(glacierId>=0)kind='glacier / ice region';if(volcano)kind=volcano.typeName;
  const name=volcano?volcano.name:glacierId>=0?'Glacier region '+String(glacierId+1).padStart(2,'0'):wb&&!exposed?(wb.status==='playa'?'Dry basin ':wb.kind==='lake'?'Lake ':'Pond ')+String(wb.id+1).padStart(3,'0'):m.ocean[i]?'The global ocean':kind==='exposed basin margin'?'Exposed margin of pool '+String(wb.id+1).padStart(3,'0'):head?'A river begins here':kind==='drainage cell'?'An inland catchment':kind==='major river'?'The main river':kind==='river'?'A connected river':'A tributary stream';
  let length=0;for(let k=1;k<state.trace.length;k++)length+=distanceKm(m.grid,state.trace[k-1],state.trace[k]);
  const area=wb&&!exposed?m.catchment[wb.outletCell]:m.catchment[i],flow=wb&&!exposed?wb.outflowM3s:m.discharge[i];
  const terminal=m.activeTerminal[i],destinationBody=m.waterbody[terminal]>=0?m.waterbodies[m.waterbody[terminal]]:null;
  const destination=destinationBody?.closed?(destinationBody.status==='playa'?'Dry closed basin ':'Closed basin ')+String(destinationBody.id+1).padStart(3,'0'):'Global ocean';
  const field=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
  const surface=state.surfaceSampler.sample(probe?.lon??lon,probe?.lat??lat);state.selectedLocation={lon:surface.lon,lat:surface.lat};
  const surfaceData=`<div class="surface-sample"><h3>Surface sample</h3><p>${number(surface.lat,4)}° latitude · ${number(surface.lon,4)}° longitude</p><div class="selection-data">${field('Scaffold elevation',number(surface.terrainM,2)+' m')}${field('Fitted ground',number(surface.fitted.groundM,2)+' m')}${field('Standing water level',surface.standingWater?number(surface.standingWater.waterM,2)+' m':'None')}${field('Fitted water level',surface.fitted.waterM===null?'Dry':number(surface.fitted.waterM,2)+' m')}${field('Fitted water depth',number(surface.fitted.depthM,2)+' m')}${field('Nearby channel',surface.river?number(surface.river.distanceM,2)+' m from center':'Outside channel corridor')}</div></div>`;
  const data=m.ocean[i]?field('Connected ocean',number(m.stats.oceanAreaKm2,0)+' km²')+field('Sea level','0 m'):
    field('Contributing area',number(area,2)+' km²')+field('Mean annual flow',number(flow,3)+' m³/s')+
    (wb?field('Current water area',number(wb.wetAreaKm2,3)+' km²')+field('Water level',number(wb.waterLevelM,1)+' m')+field('Lake behavior',wb.status==='playa'?'Playa / dry basin':wb.closed?'Closed · no outflow':'Overflowing')+field('Lake evaporation',number(wb.evaporationM3s,3)+' m³/s')+field('Pools in this basin',parts.length)+field('Potential spill level',number(wb.spillM,1)+' m')+(parts.length>1?field('Water levels',levelParts.slice(0,5).map(id=>number(m.waterbodies[id].waterLevelM,1)+' m').join(' · ')+(levelParts.length>5?' · …':'')):''):
    field('Drainage elevation',number(m.level[i],1)+' m')+field('Route to destination',number(length,1)+' km'));
  const craterBasin=volcano?.craterWaterbody>=0?m.waterbodies[volcano.craterWaterbody]:null;
  const geologyData=volcano?field('Volcanic landform',volcano.typeName)+field('Ground elevation',number(m.height[i],1)+' m')+
    field('Edifice radius',number(volcano.radiusKm,2)+' km')+field('Geographic height change',number(m.geology.change[i],1)+' m')+
    field('Cooled lava deposit',number(m.geology.depositM[i],1)+' m')+
    field('Summit / crater water',craterBasin?(m.wetness[volcano.centerCell]>.35?'Waterbody ':'Dry basin ')+String(craterBasin.id+1).padStart(3,'0'):volcano.submerged?'Ocean-connected':'No retained water'):'';
  const frozenData=field('Annual snowfall',number(ice.snowfallMm[i],0)+' mm SWE')+field('Snowmelt supply',number(ice.snowmeltMm[i],0)+' mm water/yr')+
    field('Peak modeled snow',number(ice.peakSnowMm[i],0)+' mm SWE')+field('New ice retained',number(ice.iceGainMm[i],0)+' mm water/yr')+
    (glacierId>=0?field('Glacier melt supply',number(ice.iceMeltMm[i],0)+' mm water/yr')+field('Ice region area',number(ice.glaciers[glacierId].areaKm2,2)+' km²'):'');
  const climateData=field('Mean temperature',number(m.climate.temperature[i],1)+' °C')+field('Precipitation',number(m.rainfall[i],0)+' mm/yr')+
    field('Evaporative demand',number(m.climate.potentialEvaporation[i],0)+' mm/yr')+field('Climate estimate',ZONES[m.climate.zone[i]]);
  const hasProfile=m.riverProfiles.edgeAtCell[i]>=0;
  const profileEntry=hasProfile?`<div class="profile-entry"><button id="inspect-river-profile">Inspect river profile</button><span>${number(m.riverProfiles.widthM[i],2)} m wide · ${number(m.riverProfiles.designDepthM[i],2)} m design depth</span></div>`:'';
  $('inspector').className='';$('inspector').innerHTML=`<div class="selection-kind">${kind}</div><div class="selection-name">${name}</div><div class="selection-coord">${coordText(lon,lat)}</div>${profileEntry}${surfaceData}<div class="selection-data">${geologyData}${data}${climateData}${frozenData}</div><p class="selection-destination">${m.ocean[i]?'Connected planetary ocean.':`Meltwater / flow destination: <b>${destination}</b><br>${wb?'Water area follows this pool’s annual balance.':flowRegime(flow,area)+' flow estimate · '+lakeCount(state.trace,m)+' inland basins on this route.'}`}</p>${parts.length>1?'<button id=next-pool class=secondary type=button>Inspect next pool</button>':''}`;
  if(hasProfile)$('inspect-river-profile').addEventListener('click',()=>openRiverProfile(i));
  if(parts.length>1)$('next-pool').addEventListener('click',()=>{const cycle=wetParts.length>1?wetParts:[...parts],index=cycle.indexOf(wb.id),next=m.waterbodies[cycle[(index+1)%cycle.length]];selectCell(next.outletCell,{focus:true});});

  if(focus){
    if(state.projection==='globe'){state.lon=lon;state.lat=lat;state.zoom=1.7;}
    else {const p=xy(i);state.cx=p.x;state.cy=p.y;state.zoom=Math.max(3,state.zoom);clampMap();}
  }
  makeTexture();requestDraw();
}
function lakeCount(path,m){return new Set(path.map(i=>m.waterbody[i]).filter(i=>i>=0)).size;}
let profileRoute=null;
function openRiverProfile(cell){
  const m=state.model,p=m.riverProfiles;profileRoute=inspectionRoute(p,cell);if(!profileRoute)return;
  const end=profileRoute.cells.at(-1),id=m.waterbody[end],body=id>=0?m.waterbodies[id]:null;
  const destination=body?(body.status==='playa'?'dry pool':body.kind)+' '+String(body.id+1).padStart(3,'0'):'the ocean';
  const fall=p.waterM[cell]-p.waterM[end];
  $('river-profile-route').textContent=`Downstream from selection · ${number(profileRoute.totalLengthM/1000,2)} km to ${destination} · ${number(fall,2)} m surface fall`;
  const c=m.channelConstraints;profileRoute.meshStations=Array.from(profileRoute.edges).flatMap(e=>Array.from({length:c.edges.stationOffsets[e+1]-c.edges.stationOffsets[e]},(_,k)=>c.edges.stationOffsets[e]+k));
  $('profile-position').max=Math.max(0,profileRoute.meshStations.length-1);$('profile-position').value=0;updateRiverProfile();$('river-profile-dialog').showModal();
}
function updateRiverProfile(){
  if(!profileRoute||!state.model)return;
  const p=state.model.riverProfiles,c=state.model.channelConstraints,saved=profileRoute.meshStations[Number($('profile-position').value)],edge=c.stations.edge[saved],d=profileRoute.distanceM[profileRoute.edges.indexOf(edge)]+p.lengthM[edge]*c.stations.t[saved];
  const s=inspectionStation(p,profileRoute,d),field=(label,value)=>`<div><span>${label}</span><strong>${value}</strong></div>`;
  $('profile-distance').textContent=`${number(s.distanceM/1000,2)} / ${number(profileRoute.totalLengthM/1000,2)} km`;
  $('river-profile-state').textContent=s.wet?'Annual-flow estimate':'Dry channel design · no modeled annual surface flow';
  $('river-profile-metrics').innerHTML=field('Channel width',number(s.widthM,2)+' m')+field('Mapped center depth',number(s.waterM-s.bedM,2)+' m')+field('Design minimum depth',number(s.designDepthM,2)+' m')+field('Water / design elevation',number(s.waterM,2)+' m')+field('Center bed elevation',number(s.bedM,2)+' m')+field('Distance downstream',number(s.distanceM/1000,2)+' km');
  const section=sampleConstraintSection(c,state.surfaceSampler,saved),center=section.samples[4];
  const at=c.stations.t[saved]===0?c.anchors.from[section.edge]:c.stations.t[saved]===1?c.anchors.to[section.edge]:-1,incoming=at<0?0:c.anchors.incomingOffsets[at+1]-c.anchors.incomingOffsets[at];
  $('constraint-state').textContent='Section '+(Number($('profile-position').value)+1)+' of '+profileRoute.meshStations.length+' · '+number(section.t*100,2)+'% along this link'+(incoming>1?' · Shared junction with '+incoming+' incoming links':'');
  $('constraint-metrics').innerHTML=field('Fitted center ground',number(center.groundM,2)+' m')+field('Fitted center water',center.waterM===null?'Dry':number(center.waterM,2)+' m')+field('Fitted center depth',center.waterM===null?'0 m':number(center.waterM-center.groundM,2)+' m')+field('Nominal width',number(section.widthM,2)+' m')+field('Outer sampled water',[section.samples[0],section.samples.at(-1)].some(p=>p.waterM!==null)?'Continues beyond sample':'Dry at both ends')+field('Global mesh inputs',number(c.stats.edges,0)+' links');
  $('constraint-section').innerHTML=constraintSectionSvg(section);
  $('river-longitudinal').innerHTML=longitudinalSvg(p,profileRoute,s);$('river-cross-section').innerHTML=sectionSvg(s);
}
$('profile-position').addEventListener('input',updateRiverProfile);
$('channel-samples-open').addEventListener('click',()=>{const m=state.model,p=m.riverProfiles;let cell=state.selected;if(cell<0||p.edgeAtCell[cell]<0){let best=-1;for(const i of p.from)if(m.discharge[i]>best){best=m.discharge[i];cell=i;}}if(cell>=0&&p.edgeAtCell[cell]>=0){selectCell(cell,{focus:true});openRiverProfile(cell);}});
$('river-profile-close').addEventListener('click',()=>$('river-profile-dialog').close());
$('river-profile-dialog').addEventListener('click',e=>{if(e.target===e.currentTarget){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function clearSelection(){
  state.selected=-1;state.selectedLocation=null;state.trace=[];state.mask=null;state.showTrace=false;state.showCatchment=false;
  $('inspector').className='inspector-empty';$('inspector').innerHTML='<span class="inspect-icon">⌖</span><p>Select any waterway or place on land to follow its downstream destination.</p>';
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
$('layers-reset').addEventListener('click',()=>{for(const key of Object.keys(layers)){layers[key]=!['basins','arrows','dry'].includes(key);$('layer-'+key).checked=layers[key];}makeTexture();});
$('about-open').addEventListener('click',()=>$('about-dialog').showModal());$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});

function displayStats(){
  const m=state.model,s=m.stats;for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])$('stat-'+key).textContent=fmt.format(s[key]);
  $('top-status').textContent='Complete planet · Climate and water balanced';
  $('verification-title').textContent='Every flow has a valid destination';$('verification-detail').textContent=`${fmt.format(s.cells)} cells · 0 cycles · Annual water budget balanced`;
  $('verification').querySelector('.verification-symbol').textContent='✓';$('verification').classList.remove('failed');
  $('climate-summary').textContent=`${number(s.desertAreaKm2/s.landAreaKm2*100,0)}% desert land · ${s.closedLakes} closed waterbodies · ${s.playas} dry pools · ${s.splitBasins} split lake basins`;
  $('snow-summary').textContent=`${fmt.format(m.cryosphere.stats.glaciers)} glacier / ice regions · ${number(m.cryosphere.stats.snowAreaKm2,0)} km² with seasonal or persistent snow`;
  $('geology-summary').textContent=`${m.geology.stats.sites} volcanic centres · ${m.geology.stats.cooledFlows} cooled lava deposits · ${m.geology.stats.craterBasins} summit / crater basins`;
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
  const split=m.basins.filter(b=>[...b.poolIds].filter(id=>m.waterbodies[id].wetAreaKm2>.015).length>1).sort((a,b)=>b.areaKm2-a.areaKm2)[0];
  if(split){
    const button=document.createElement('button');button.type='button';
    const wet=[...split.poolIds].map(id=>m.waterbodies[id]).filter(p=>p.wetAreaKm2>.015).sort((a,b)=>b.wetAreaKm2-a.wetAreaKm2);
    button.innerHTML=`<span class="system-number">◇</span><span class="system-name">Split lake basin ${String(split.id+1).padStart(3,'0')}<small>${wet.length} wet pools · inspect separate water levels</small></span><span class="system-area">${number(wet.reduce((s,p)=>s+p.wetAreaKm2,0),2)} <small>km²</small></span>`;
    button.addEventListener('click',()=>selectCell(wet[0].outletCell,{focus:true}));$('systems-list').append(button);
  }
  const examples=m.waterbodies.filter(w=>w.closed&&w.status!=='playa').sort((a,b)=>b.wetAreaKm2-a.wetAreaKm2).slice(0,2);
  const playa=m.waterbodies.find(w=>w.status==='playa');if(playa)examples.push(playa);
  for(const wb of examples){
    const button=document.createElement('button');button.type='button';
    button.innerHTML=`<span class="system-number">◇</span><span class="system-name">${wb.status==='playa'?'Dry':'Closed'} basin ${String(wb.id+1).padStart(3,'0')}<small>${wb.closed?'No ocean outflow · evaporation balances inflow':''}</small></span><span class="system-area">${number(wb.wetAreaKm2,2)} <small>km²</small></span>`;
    button.addEventListener('click',()=>{
      let cell=wb.outletCell;for(let i=0;i<m.grid.north;i++)if(m.waterbody[i]===wb.id&&m.wetness[i]>.35){cell=i;break;}
      selectCell(cell,{focus:true});
    });$('systems-list').append(button);
  }
  for(const glacier of [...m.cryosphere.glaciers].sort((a,b)=>b.meltwaterM3s-a.meltwaterM3s).slice(0,3)){
    const button=document.createElement('button');button.type='button';
    button.innerHTML=`<span class="system-number">❄</span><span class="system-name">Glacier region ${String(glacier.id+1).padStart(2,'0')}<small>${number(glacier.meltwaterM3s,3)} m³/s estimated meltwater</small></span><span class="system-area">${number(glacier.areaKm2,0)} <small>km²</small></span>`;
    button.addEventListener('click',()=>selectCell(glacier.outletCell,{focus:true}));$('systems-list').append(button);
  }
  const examplesVolcanoes=[...new Map(m.geology.sites.map(site=>[site.type,site])).values()].sort((a,b)=>a.type-b.type);
  for(const site of examplesVolcanoes){
    const button=document.createElement('button');button.type='button';
    button.innerHTML=`<span class="system-number">△</span><span class="system-name">${site.name}<small>${site.typeName} · ${site.submerged?'submarine':'land / inland basin'}</small></span><span class="system-area">${number(site.radiusKm*2,1)} <small>km wide</small></span>`;
    button.addEventListener('click',()=>selectCell(site.centerCell,{focus:true}));$('systems-list').append(button);
  }
}
let meshPreview=null,chunkWorker=null,chunkMesh=null,chunkLocation={lon:0,lat:0,level:12},chunkTimer=null,chunkDrag=null,terrainSize='';
const chunkQueue=createTerrainViewQueue(sendTerrainView,data=>displayChunkMesh(data.patch));
function terrainViewport(){const r=$('mesh-canvas').getBoundingClientRect();return {width:r.width,height:r.height,radiusM:state.model?.grid.radiusKm*1000||64000,tilt:$('chunk-oblique').checked?45:0};}
function drawMeshPreview(){
  if(!meshPreview||!chunkMesh)return;
  const view=chunkMesh.view,aspect=view.aspect,zoom=2**view.level*Math.max(1,aspect/1.6);
  try{meshPreview.draw(view.lon,view.lat,$('chunk-water').checked,zoom,view.tilt);}catch(error){$('mesh-error').textContent=error.message;}
}
async function displayChunkMesh(patch){
  meshPreview?.dispose();meshPreview=null;chunkMesh=patch;
  $('mesh-counts').textContent=number(patch.stats.chunks,0)+' chunks · LOD '+patch.stats.minLevel+'–'+patch.stats.maxLevel+' · '+number(patch.stats.triangles,0)+' ground / '+number(patch.stats.waterTriangles,0)+' water triangles · '+number(patch.stats.bytes/1048576,1)+' MiB';
  $('chunk-cache').textContent=number(patch.stream.reused,0)+' reused · '+number(patch.stream.built,0)+' built · cache '+number(patch.stream.cacheBytes/1048576,1)+' / '+number(patch.stream.cacheLimitBytes/1048576,0)+' MiB';
  $('mesh-summary').textContent='Streaming terrain · '+number(patch.stats.chunks,0)+' chunks in the current view';$('mesh-error').textContent=patch.stats.ambiguousWaterTriangles?'Some water boundaries need a finer view.':'';
  try{const {createMeshPreview}=await import('./mesh-preview.mjs?v=0.9.10');if(chunkMesh!==patch)return;meshPreview=createMeshPreview($('mesh-canvas'),patch);drawMeshPreview();}catch(error){$('mesh-error').textContent=error.message;}
}
function terrainWorkerFailure(message){$('mesh-error').textContent=message;chunkWorker?.terminate();chunkWorker=null;chunkQueue.reset();}
function sendTerrainView(view){
  let model;
  if(!chunkWorker){
    const m=state.model;model={grid:m.grid,height:m.height,riverProfiles:m.riverProfiles,waterbody:m.waterbody,waterbodies:m.waterbodies,ocean:m.ocean,seed:m.seed};
    const worker=new Worker(new URL('./planet-worker.mjs?v='+VERSION,import.meta.url),{type:'module'});chunkWorker=worker;
    worker.onmessage=({data})=>{if(chunkWorker!==worker)return;if(data.type==='terrain-view')chunkQueue.finish(data);else if(data.type==='error')terrainWorkerFailure(data.message);};
    worker.onerror=event=>{if(chunkWorker===worker)terrainWorkerFailure(event.message||'Could not build the terrain view');};
  }
  chunkWorker.postMessage({...view,type:'terrain-view',model});
}
function requestTerrainChunks(lon,lat,{level=chunkLocation.level,delay=0}={}){
  if(!state.model)return;
  const rect=$('mesh-canvas').getBoundingClientRect();terrainSize=Math.round(rect.width)+'/'+Math.round(rect.height);
  chunkLocation={lon,lat,level};$('chunk-detail').value=[10,12,13].includes(level)?String(level):'';$('chunk-location').textContent=coordText(lon,lat)+' · '+number(lon,5)+'°, '+number(lat,5)+'°';$('mesh-error').textContent='Loading terrain for this view…';
  chunkQueue.invalidate();clearTimeout(chunkTimer);chunkTimer=setTimeout(()=>{const viewport=terrainViewport();chunkQueue.request({...chunkLocation,aspect:viewport.width/viewport.height,tilt:viewport.tilt});},delay);
}
function zoomTerrain(amount){requestTerrainChunks(chunkLocation.lon,chunkLocation.lat,{level:Math.max(8,Math.min(14,chunkLocation.level+amount)),delay:100});}
function focusTerrainSelection(){
  const m=state.model,p=m.riverProfiles,c=m.channelConstraints;let cell=state.selected;
  if(cell>=0&&p.edgeAtCell[cell]<0){const point=state.selectedLocation||{lon:lonLat(m.grid,cell)[0],lat:lonLat(m.grid,cell)[1]};requestTerrainChunks(point.lon,point.lat);return;}
  if(cell<0||p.edgeAtCell[cell]<0){let best=-1;for(const i of p.from)if(m.discharge[i]>best){best=m.discharge[i];cell=i;}}
  const e=p.edgeAtCell[cell];if(e<0)return;let station=c.edges.stationOffsets[e];while(c.stations.t[station]!==.5&&station<c.edges.stationOffsets[e+1]-1)station++;
  const point=c.stations.center[station],d=c.points.directions.subarray(point*3,point*3+3);requestTerrainChunks(Math.atan2(d[2],d[0])*180/Math.PI,Math.asin(d[1])*180/Math.PI);
}
$('mesh-open').addEventListener('click',()=>{$('mesh-dialog').showModal();focusTerrainSelection();});
$('mesh-close').addEventListener('click',()=>$('mesh-dialog').close());
$('chunk-focus').addEventListener('click',focusTerrainSelection);
$('chunk-bend').addEventListener('click',()=>{const course=state.surfaceSampler.course,{exampleEdge,exampleT}=course.stats;if(exampleEdge<0)return;const d=course.sample(exampleEdge,exampleT).direction;requestTerrainChunks(Math.atan2(d[2],d[0])*180/Math.PI,Math.asin(d[1])*180/Math.PI,{level:10});});
$('chunk-detail').addEventListener('change',()=>requestTerrainChunks(chunkLocation.lon,chunkLocation.lat,{level:Number($('chunk-detail').value)}));
$('chunk-oblique').addEventListener('change',()=>requestTerrainChunks(chunkLocation.lon,chunkLocation.lat));
$('chunk-water').addEventListener('change',drawMeshPreview);
$('chunk-zoom-in').addEventListener('click',()=>zoomTerrain(.5));
$('chunk-zoom-out').addEventListener('click',()=>zoomTerrain(-.5));
for(const [name,dx,dy] of [['west',1,0],['east',-1,0],['north',0,1],['south',0,-1]])$('chunk-'+name).addEventListener('click',()=>{
  const viewport=terrainViewport(),next=panTerrainView(chunkLocation,dx*viewport.height*.4,dy*viewport.height*.4,viewport);requestTerrainChunks(next.lon,next.lat);
});
const terrainCanvas=$('mesh-canvas');
terrainCanvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;terrainCanvas.setPointerCapture(event.pointerId);chunkDrag={id:event.pointerId,x:event.clientX,y:event.clientY};});
terrainCanvas.addEventListener('pointermove',event=>{
  if(chunkDrag?.id!==event.pointerId)return;const next=panTerrainView(chunkLocation,event.clientX-chunkDrag.x,event.clientY-chunkDrag.y,terrainViewport());chunkDrag.x=event.clientX;chunkDrag.y=event.clientY;requestTerrainChunks(next.lon,next.lat,{delay:80});
});
function finishTerrainDrag(event){if(chunkDrag?.id!==event.pointerId)return;chunkDrag=null;requestTerrainChunks(chunkLocation.lon,chunkLocation.lat);}
terrainCanvas.addEventListener('pointerup',finishTerrainDrag);terrainCanvas.addEventListener('pointercancel',finishTerrainDrag);terrainCanvas.addEventListener('lostpointercapture',()=>{chunkDrag=null;});
terrainCanvas.addEventListener('wheel',event=>{event.preventDefault();zoomTerrain(event.deltaY<0?.25:-.25);},{passive:false});
terrainCanvas.addEventListener('keydown',event=>{
  const directions={ArrowLeft:[1,0],ArrowRight:[-1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
  if(directions[event.key]){event.preventDefault();const [dx,dy]=directions[event.key],v=terrainViewport(),next=panTerrainView(chunkLocation,dx*v.height*.25,dy*v.height*.25,v);requestTerrainChunks(next.lon,next.lat);}
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoomTerrain(.5);}else if(event.key==='-'){event.preventDefault();zoomTerrain(-.5);}
});
new ResizeObserver(()=>{if(!$('mesh-dialog').open)return;const r=terrainCanvas.getBoundingClientRect(),key=Math.round(r.width)+'/'+Math.round(r.height);if(key!==terrainSize){terrainSize=key;requestTerrainChunks(chunkLocation.lon,chunkLocation.lat,{delay:100});}}).observe(terrainCanvas);
$('mesh-dialog').addEventListener('close',()=>{clearTimeout(chunkTimer);chunkDrag=null;chunkWorker?.terminate();chunkWorker=null;chunkQueue.reset();chunkMesh=null;meshPreview?.dispose();meshPreview=null;});
function generate(seed){
  $('river-profile-dialog').close();profileRoute=null;$('mesh-dialog').close();chunkWorker?.terminate();chunkWorker=null;chunkQueue.reset();clearTimeout(chunkTimer);chunkDrag=null;chunkMesh=null;meshPreview?.dispose();meshPreview=null;$('mesh-open').disabled=true;$('channel-samples-open').disabled=true;$('channel-summary').textContent='Linking the global channel constraints…';$('mesh-summary').textContent='Terrain is built on demand from the global water system.';
  state.worker?.terminate();state.worker=null;state.model=null;state.surfaceSampler=null;state.selected=-1;state.selectedLocation=null;state.trace=[];state.mask=null;state.showTrace=false;state.showCatchment=false;
  $('generate').disabled=true;$('loading').hidden=false;$('loading-progress').style.width='0';$('loading-stage').textContent='Defining continents and drainage divides';
  $('loading').querySelector('h2').textContent='Balancing the whole world’s water';$('top-status').textContent='Generating the whole planet';
  $('verification-title').textContent='Solving the complete planet';$('verification-detail').textContent='Continents, basins and every downstream link.';$('verification').querySelector('.verification-symbol').textContent='…';
  $('selection-actions').hidden=true;$('clear-selection').hidden=true;$('inspector').className='inspector-empty';$('inspector').innerHTML='<span class="inspect-icon">⌖</span><p>Select any waterway or place on land to follow its downstream destination.</p>';
  for(const key of ['headwaters','streams','rivers','ponds','lakes','mouths'])$('stat-'+key).textContent='—';
  $('systems-list').innerHTML='<p class="muted">Finding the continental drainage systems…</p>';
  try{
    const worker=new Worker(new URL('./planet-worker.mjs?v='+VERSION,import.meta.url),{type:'module'});state.worker=worker;
    worker.onmessage=({data})=>{
      if(data.type==='progress'){$('loading-stage').textContent=data.stage;$('loading-progress').style.width=data.fraction*100+'%';}
      else if(data.type==='complete'){
        state.model=data.model;$('mesh-open').disabled=false;$('channel-samples-open').disabled=false;const constraints=state.model.channelConstraints.stats;$('channel-summary').textContent=number(constraints.edges,0)+' channel links · '+number(constraints.stations,0)+' saved sections';const shores=state.model.shorelines.stats;$('shoreline-summary').textContent=number(shores.standingRings,0)+' standing-water rings · '+number(shores.channelPortals,0)+' channel openings';state.surfaceSampler=createSurfaceSampler(state.model);$('chunk-bend').disabled=state.surfaceSampler.course.stats.exampleEdge<0;$('mesh-summary').textContent=number(state.surfaceSampler.course.stats.curvedEdges,0)+' curved channel links · '+number(state.surfaceSampler.course.stats.movedNodes,0)+' smoothed inland anchors';state.worker.terminate();state.worker=null;preparePaths();makeTexture();displayStats();fitWorld();resize();
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
