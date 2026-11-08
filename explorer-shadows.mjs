import {dot,frame,unit,createGroundCollider} from './explorer-world.mjs?v=0.9.14';
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function sunlight(d){const f=frame(d);return unit(d.map((x,k)=>x*.8+f.east[k]*.35+f.north[k]*.5));}
/** Coordinates are relative to the current terrain anchor, never planet-sized floats. */
export function shadowFrame(mesh){
 const light=sunlight(mesh.anchor),right=unit(cross(frame(mesh.anchor).north,light)),up=cross(light,right),h=createGroundCollider(mesh.ground,mesh.anchor,mesh.radiusM)(mesh.anchor)??0;
 return {light,right,up,center:mesh.anchor.map(v=>v*h),half:150,depth:512,range:100,fade:125};
}
export function shadowCoordinates(p,s){const q=p.map((v,k)=>v-s.center[k]);return [.5+dot(q,s.right)/(2*s.half),.5+dot(q,s.up)/(2*s.half),.5-dot(q,s.light)/(2*s.depth)];}
/** Nearby object sun map (terrain receives; distant terrain occlusion is deferred): one alpha-tested depth pass per streamed mesh, not per frame. */
export function createSunShadows(gl,compile,leafTexture,groundTexture){
 const size=Math.min(1024,gl.getParameter(gl.MAX_TEXTURE_SIZE)),program=gl.createProgram();
 gl.attachShader(program,compile(gl.VERTEX_SHADER,`#version 300 es
 precision highp float;layout(location=0) in vec3 position;layout(location=5) in vec3 leafUV;
 uniform vec3 shadowCenter;uniform vec3 shadowRight;uniform vec3 shadowUp;uniform vec3 sun;uniform vec2 shadowExtent;out vec3 leaf;
 void main(){vec3 p=position-shadowCenter;gl_Position=vec4(dot(p,shadowRight)/shadowExtent.x,dot(p,shadowUp)/shadowExtent.x,-dot(p,sun)/shadowExtent.y,1.);leaf=leafUV;}`));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,`#version 300 es
 precision highp float;in vec3 leaf;uniform sampler2D foliageTexture;uniform sampler2D groundTexture;
 void main(){if(leaf.z>.5){float alpha=leaf.z>1.5?texture(groundTexture,leaf.xy).a:texture(foliageTexture,leaf.xy).a;if(alpha<.45)discard;}}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const uniforms=Object.fromEntries(['shadowCenter','shadowRight','shadowUp','sun','shadowExtent','foliageTexture','groundTexture'].map(k=>[k,gl.getUniformLocation(program,k)])),texture=gl.createTexture(),buffer=gl.createFramebuffer();
 gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,size,size,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);const available=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 return {texture,size,available,render(resources,s){if(!available)return;gl.bindFramebuffer(gl.FRAMEBUFFER,buffer);gl.viewport(0,0,size,size);gl.colorMask(false,false,false,false);gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
   gl.uniform3fv(uniforms.shadowCenter,s.center);gl.uniform3fv(uniforms.shadowRight,s.right);gl.uniform3fv(uniforms.shadowUp,s.up);gl.uniform3fv(uniforms.sun,s.light);gl.uniform2f(uniforms.shadowExtent,s.half,s.depth);
   gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,leafTexture);gl.uniform1i(uniforms.foliageTexture,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,groundTexture);gl.uniform1i(uniforms.groundTexture,2);
   for(const r of resources)if(!r.water&&!r.terrain&&r.castShadow!==false){gl.bindVertexArray(r.vao);gl.drawElements(gl.TRIANGLES,r.count,gl.UNSIGNED_INT,0);}
   gl.bindVertexArray(null);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.colorMask(true,true,true,true);
 },dispose(){gl.deleteFramebuffer(buffer);gl.deleteTexture(texture);gl.deleteProgram(program);}};
}
