import {meshCamera,inspectionZoom} from './mesh-camera.mjs?v=0.7.11';
import {createSoftwareMeshPreview} from './mesh-raster.mjs?v=0.7.11';
/** Lightweight review of the real indexed buffers, not the atlas texture. */
export function createMeshPreview(canvas,mesh){
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:true});
  if(!gl)return createSoftwareMeshPreview(canvas,mesh);
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,`#version 300 es
  in vec3 position;uniform vec3 east;uniform vec3 up;uniform vec3 front;uniform vec3 origin;uniform float scale;uniform float aspect;out vec3 world;
  void main(){world=position;vec3 local=position-origin;gl_Position=vec4(dot(local,east)*scale/aspect,dot(local,up)*scale,-dot(local,front)/100000.0,1.0);}`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`#version 300 es
  precision highp float;in vec3 world;uniform bool water;uniform vec3 lightDirection;out vec4 color;
  void main(){vec3 n=normalize(cross(dFdx(world),dFdy(world)));if(dot(n,world)<0.0)n=-n;float light=.35+.65*max(0.0,dot(n,normalize(lightDirection)));vec3 base=water?vec3(.16,.46,.57):vec3(.49,.49,.43);color=vec4(base*light,1.0);}`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const location=gl.getAttribLocation(program,'position'),uniforms=Object.fromEntries(['east','up','front','scale','aspect','water','lightDirection','origin'].map(k=>[k,gl.getUniformLocation(program,k)])),resources=[];
  function upload(data){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.positions),gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);resources.push({vao,vertices,indices});return {vao,count:data.indices.length};}
  const ground=upload(mesh.ground),water=upload(mesh.standingWater);
  function draw(lon=-35,lat=20,showWater=true,zoom=1,tilt=0){
    const dpr=Math.min(devicePixelRatio||1,1.5),rect=canvas.getBoundingClientRect();canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.045,.09,.115,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.useProgram(program);
    const camera=meshCamera(lon,lat,zoom,tilt,mesh.radiusM,mesh.focus?.groundM||0);zoom=inspectionZoom(mesh,camera,canvas.width/canvas.height,zoom);
    for(const key of ['east','up','front','origin'])gl.uniform3fv(uniforms[key],camera[key]);gl.uniform3fv(uniforms.lightDirection,camera.light);gl.uniform1f(uniforms.scale,.9*zoom/(mesh.radiusM+4000));gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);
    gl.uniform1i(uniforms.water,0);gl.bindVertexArray(ground.vao);gl.drawElements(gl.TRIANGLES,ground.count,gl.UNSIGNED_INT,0);
    if(showWater){gl.uniform1i(uniforms.water,1);gl.bindVertexArray(water.vao);gl.drawElements(gl.TRIANGLES,water.count,gl.UNSIGNED_INT,0);}
    const error=gl.getError();if(error!==gl.NO_ERROR)throw Error('Mesh rendering failed (WebGL '+error+').');
  }
  return {draw,dispose(){for(const r of resources){gl.deleteBuffer(r.vertices);gl.deleteBuffer(r.indices);gl.deleteVertexArray(r.vao);}gl.deleteProgram(program);}};
}
