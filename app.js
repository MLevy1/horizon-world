import * as THREE from 'three';
import {createWorld, SIZE, HALF, GRID, STEP, hash} from './world.mjs';

const $=id=>document.getElementById(id);
let world=null,renderer=null,camera=null,scene=null,terrainHeight=null,active=false;
let yaw=Math.PI/2,pitch=-.18,speed=65,joy={x:0,y:0},vertical=0,drag=null;
const keys=new Set();
const intervals={map:null},MAP_W=384;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const mapPoint={x:0,z:0,selected:false};
const WORLD_RES=257, TILE_STEP=SIZE/(WORLD_RES-1);
let lastTime=0,lastHUD=0,fast=false;

function colorFor(x,z,h,moisture,forest,slope){
  const snow=clamp((h-550)/210,0,1),stone=clamp((slope-.58)*1.3+(h-440)/440,0,.9);
  const sand=clamp((12-h)/14,0,1),deep=h<0;
  let r=.42+moisture*.10+forest*.08,g=.49+moisture*.15+forest*.10,b=.38+moisture*.08;
  if(deep){r=.32;g=.41;b=.40}
  const noise=(hash(Math.floor(x/34),Math.floor(z/34),world.seed+206)-.5)*.065;
  r+=noise;g+=noise;b+=noise;
  r=mix(r,.45,stone);g=mix(g,.45,stone);b=mix(b,.42,stone);
  r=mix(r,.65,sand);g=mix(g,.63,sand);b=mix(b,.51,sand);
  r=mix(r,.83,snow);g=mix(g,.85,snow);b=mix(b,.82,snow);
  return [clamp(r,0,1),clamp(g,0,1),clamp(b,0,1)];
}
function buildTerrain(){
  const positions=new Float32Array(WORLD_RES*WORLD_RES*3),colors=new Float32Array(positions.length);
  terrainHeight=new Float32Array(WORLD_RES*WORLD_RES);
  const at=(i,j)=>j*WORLD_RES+i;
  for(let j=0;j<WORLD_RES;j++)for(let i=0;i<WORLD_RES;i++){
    const x=-HALF+i*TILE_STEP,z=-HALF+j*TILE_STEP,h=world.height(x,z),n=at(i,j);
    terrainHeight[n]=h;positions[3*n]=x;positions[3*n+1]=h;positions[3*n+2]=z;
  }
  for(let j=0;j<WORLD_RES;j++)for(let i=0;i<WORLD_RES;i++){
    const n=at(i,j),x=positions[3*n],z=positions[3*n+2],h=terrainHeight[n];
    const a=terrainHeight[at(Math.max(0,i-1),j)],b=terrainHeight[at(Math.min(WORLD_RES-1,i+1),j)];
    const c=terrainHeight[at(i,Math.max(0,j-1))],d=terrainHeight[at(i,Math.min(WORLD_RES-1,j+1))];
    const slope=Math.hypot((a-b)/(2*TILE_STEP),(c-d)/(2*TILE_STEP));
    const co=colorFor(x,z,h,world.moisture(x,z),world.forest(x,z),slope);
    colors[3*n]=co[0];colors[3*n+1]=co[1];colors[3*n+2]=co[2];
  }
  const indices=new Uint32Array((WORLD_RES-1)**2*6);let k=0;
  for(let j=0;j<WORLD_RES-1;j++)for(let i=0;i<WORLD_RES-1;i++){
    const a=at(i,j),b=a+1,c=a+WORLD_RES,d=c+1;
    indices[k++]=a;indices[k++]=c;indices[k++]=b;
    indices[k++]=b;indices[k++]=c;indices[k++]=d;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geo.setIndex(new THREE.BufferAttribute(indices,1));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide}));
  mesh.frustumCulled=false;scene.add(mesh);
}
// Anchor trees to the *displayed triangle*, rather than an independent world
// query that can disagree with a coarse render mesh on mountain slopes.
function visibleHeight(x,z){
  let gx=clamp((x+HALF)/TILE_STEP,0,WORLD_RES-1-1e-6),gz=clamp((z+HALF)/TILE_STEP,0,WORLD_RES-1-1e-6);
  const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j;
  const a=terrainHeight[j*WORLD_RES+i],b=terrainHeight[j*WORLD_RES+i+1],
    c=terrainHeight[(j+1)*WORLD_RES+i],d=terrainHeight[(j+1)*WORLD_RES+i+1];
  return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v);
}
function placeForest(){
  const trees=[];const cell=78;
  for(let z=-HALF+30;z<HALF-30;z+=cell)for(let x=-HALF+30;x<HALF-30;x+=cell){
    const ix=Math.round(x/cell),iz=Math.round(z/cell),jitterX=(hash(ix,iz,world.seed+115)-.5)*57,
      jitterZ=(hash(ix,iz,world.seed+116)-.5)*57,wx=x+jitterX,wz=z+jitterZ;
    const p=world.forest(wx,wz),h=visibleHeight(wx,wz);
    if(h<8||h>630||hash(ix,iz,world.seed+117)>p*.78)continue;
    const scale=.72+hash(ix,iz,world.seed+118)*.9;
    trees.push({x:wx,z:wz,y:h,s:scale,variant:hash(ix,iz,world.seed+119)});
  }
  // Shared trunk and crown meshes: predictable draw calls on mobile.
  const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.48,.78,1,5),new THREE.MeshLambertMaterial({color:0x705844}),trees.length);
  const lower=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,6),new THREE.MeshLambertMaterial({color:0x2d654e,flatShading:true}),trees.length);
  const upper=new THREE.InstancedMesh(new THREE.ConeGeometry(1,1,6),new THREE.MeshLambertMaterial({color:0x37755a,flatShading:true}),trees.length);
  const dummy=new THREE.Object3D();
  trees.forEach((t,i)=>{
    let h=(10+t.variant*9)*t.s,w=(3+t.variant*1.2)*t.s;
    dummy.position.set(t.x,t.y+h*.16,t.z);dummy.scale.set(.7*t.s,h*.32,.7*t.s);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
    dummy.position.set(t.x,t.y+h*.51,t.z);dummy.scale.set(w,h*.56,w);dummy.updateMatrix();lower.setMatrixAt(i,dummy.matrix);
    dummy.position.set(t.x,t.y+h*.76,t.z);dummy.scale.set(w*.72,h*.47,w*.72);dummy.updateMatrix();upper.setMatrixAt(i,dummy.matrix);
  });
  for(const obj of [trunk,lower,upper]){obj.instanceMatrix.needsUpdate=true;obj.frustumCulled=false;scene.add(obj)}
  return trees.length;
}
function buildScene(){
  scene=new THREE.Scene();scene.background=new THREE.Color(0xb3d7e3);scene.fog=new THREE.FogExp2(0xb3d7e3,.00023);
  camera=new THREE.PerspectiveCamera(73,innerWidth/innerHeight,.5,13000);
  renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:false,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight(0xeaf8ff,0x61745d,2.25));
  const sun=new THREE.DirectionalLight(0xffebca,2.4);sun.position.set(-900,1700,1000);scene.add(sun);
  buildTerrain();
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(SIZE,SIZE),new THREE.MeshPhongMaterial({color:0x3c879e,shininess:55,transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:true}));
  ocean.rotation.x=-Math.PI/2;ocean.position.y=.05;scene.add(ocean);
  const treeCount=placeForest();
  camera.position.set(480,visibleHeight(480,600)+165,600);
  $('stats').textContent='8 km region · '+treeCount.toLocaleString()+' trees';
  window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false)});
}
function applyLook(){camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch}
function frame(now){
  if(!active)return;const dt=Math.min(.045,(now-lastTime)/1000||0);lastTime=now;
  const forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-joy.y;
  const side=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+joy.x;
  const length=Math.hypot(forward,side),m=dt*(speed/3.6)/(length>1?length:1);
  camera.position.x+=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*m;
  camera.position.z+=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*m;
  const v=(keys.has('KeyE')?1:0)-(keys.has('KeyQ')?1:0)+vertical;
  camera.position.y+=v*m;
  camera.position.x=clamp(camera.position.x,-HALF+70,HALF-70);
  camera.position.z=clamp(camera.position.z,-HALF+70,HALF-70);
  camera.position.y=Math.max(visibleHeight(camera.position.x,camera.position.z)+2,camera.position.y);
  applyLook();renderer.render(scene,camera);
  if(now-lastHUD>240){lastHUD=now;const {x,y,z}=camera.position;
    const h=visibleHeight(x,z);$('coords').textContent=`${Math.round(x).toLocaleString()} E · ${Math.round(z).toLocaleString()} N · ${Math.round(h)} m ground`;
    $('heightLabel').textContent=`FLYING · ${Math.round(speed)} km/h · ${Math.round(y-h)} m above ground`;
    $('hud').querySelector('b').textContent=world.forest(x,z)>.45?'Wooded Highlands':h<15?'Coast & Shoreline':h>480?'Highlands':'Open Landscape';
  }
  requestAnimationFrame(frame);
}
function bindMotion(){
  $('scene').addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};$('scene').setPointerCapture(e.pointerId)});
  $('scene').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    yaw-=dx*.0038;pitch=clamp(pitch-dy*.0038,-1.45,1.3);
  });$('scene').addEventListener('pointerup',()=>drag=null);
  $('scene').addEventListener('pointercancel',()=>drag=null);
  const circle=$('joystick'),stick=$('stick');let stickID=null;
  function moveStick(e){const rect=circle.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    const dx=e.clientX-cx,dy=e.clientY-cy,rad=Math.min(42,Math.hypot(dx,dy)),a=Math.atan2(dy,dx);
    joy.x=Math.cos(a)*rad/42;joy.y=Math.sin(a)*rad/42;
    stick.style.transform=`translate(${joy.x*42}px,${joy.y*42}px)`;
  }
  circle.addEventListener('pointerdown',e=>{stickID=e.pointerId;circle.setPointerCapture(e.pointerId);moveStick(e)});
  circle.addEventListener('pointermove',e=>{if(stickID===e.pointerId)moveStick(e)});
  const reset=()=>{stickID=null;joy.x=joy.y=0;stick.style.transform='none'};
  circle.addEventListener('pointerup',reset);circle.addEventListener('pointercancel',reset);
  for(const [id,v] of [['rise',1],['descend',-1]]){
    const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);vertical=v});
    b.addEventListener('pointerup',()=>vertical=0);b.addEventListener('pointercancel',()=>vertical=0);
  }
  window.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE'].includes(e.code)){keys.add(e.code);e.preventDefault()}});
  window.addEventListener('keyup',e=>keys.delete(e.code));
  $('speedButton').addEventListener('click',()=>{fast=!fast;speed=fast?330:65;$('speedButton').textContent=speed+' km/h'});
}
function renderMap(){
  if(!world)return;const cv=$('map'),ctx=cv.getContext('2d');const w=cv.width,h=cv.height;
  if(!intervals.map){const pix=ctx.createImageData(w,h);for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const x=-HALF+px/(w-1)*SIZE,z=-HALF+py/(h-1)*SIZE,e=world.height(x,z),mo=world.moisture(x,z);
    const k=(py*w+px)*4;
    const rgb=e<0?[44,112,145]:e<16?[172,167,135]:e>525?[160,164,154]:[Math.round(106+mo*21),Math.round(126+mo*28),Math.round(97+mo*19)];
    pix.data[k]=rgb[0];pix.data[k+1]=rgb[1];pix.data[k+2]=rgb[2];pix.data[k+3]=255;
  }intervals.map=pix}
  ctx.putImageData(intervals.map,0,0);ctx.save();ctx.lineCap='round';
  for(const edge of world.lines){ctx.strokeStyle=edge.flow>250?'#50edff':'#8dd7e4';ctx.lineWidth=edge.flow>250?1.7:.8;
    ctx.beginPath();ctx.moveTo((edge.x+HALF)/SIZE*w,(edge.z+HALF)/SIZE*h);ctx.lineTo((edge.toX+HALF)/SIZE*w,(edge.toZ+HALF)/SIZE*h);ctx.stroke()}
  if(camera){const px=(camera.position.x+HALF)/SIZE*w,py=(camera.position.z+HALF)/SIZE*h;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#143f45';ctx.lineWidth=1;ctx.stroke()}
  if(mapPoint.selected){const px=(mapPoint.x+HALF)/SIZE*w,py=(mapPoint.z+HALF)/SIZE*h;
    ctx.strokeStyle='#ffe391';ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.stroke()}
  ctx.restore();
}
function bindMap(){
  const panel=$('mapPanel');$('mapOpen').onclick=()=>{if(!world)return;panel.classList.remove('hidden');renderMap()};
  $('mapClose').onclick=()=>panel.classList.add('hidden');
  $('map').addEventListener('pointerdown',e=>{const r=$('map').getBoundingClientRect();
    mapPoint.x=clamp(-HALF+(e.clientX-r.left)/r.width*SIZE,-HALF,HALF);
    mapPoint.z=clamp(-HALF+(e.clientY-r.top)/r.height*SIZE,-HALF,HALF);
    mapPoint.selected=true;const p=world.inspect(mapPoint.x,mapPoint.z);
    $('mapCoords').textContent=`X ${Math.round(mapPoint.x).toLocaleString()} · Z ${Math.round(mapPoint.z).toLocaleString()} · ${Math.round(p.ground)} m · drainage ${Math.round(p.drainage)} cells`;
    renderMap();
  });
  $('mapTravel').onclick=()=>{if(!mapPoint.selected)return;camera.position.set(mapPoint.x,visibleHeight(mapPoint.x,mapPoint.z)+120,mapPoint.z);panel.classList.add('hidden')};
  $('helpOpen').onclick=()=>$('helpPanel').classList.remove('hidden');
  $('helpClose').onclick=()=>$('helpPanel').classList.add('hidden');
}
$('start').addEventListener('click',async()=>{
  const btn=$('start'),status=$('status');btn.disabled=true;status.textContent='Generating broad geography and drainage…';
  try{await new Promise(resolve=>setTimeout(resolve,40));world=createWorld(42);
    status.textContent='Building final terrain and forest…';await new Promise(resolve=>setTimeout(resolve,40));
    buildScene();bindMotion();bindMap();$('intro').classList.add('hidden');active=true;lastTime=performance.now();requestAnimationFrame(frame);
  }catch(err){console.error(err);status.textContent='Unable to start world: '+err.message;btn.disabled=false}
});