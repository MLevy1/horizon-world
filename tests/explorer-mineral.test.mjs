import test from 'node:test';
import assert from 'node:assert/strict';
import {software} from '../explorer-render.mjs';
import {direction,frame} from '../explorer-world.mjs';
test('gravel remains distinguishable from exposed rock beyond the close texture range and respects snow',()=>{
 const R=64000,d=direction(0,0),f=frame(d),positions=Float64Array.from([[-300,200],[300,200],[300,1000],[-300,1000]].flatMap(([x,z])=>d.map((v,k)=>v*R+f.right[k]*x+f.forward[k]*z))),normals=Float32Array.from({length:12},(_,i)=>d[i%3]),colors=new Float32Array(12).fill(.4),indices=Uint32Array.of(0,1,2,0,2,3),water={positions:new Float64Array(),normals:new Float32Array(),indices:new Uint32Array(),depths:new Float32Array(),elevationsM:new Float32Array()};
 let pixels;const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:i=>pixels=i.data.slice()}),getBoundingClientRect:()=>({width:100,height:100})},texture={image:{width:1},levels:[{width:1,height:1,data:Uint8Array.of(255,255,255,255)}]},r=software(canvas,texture,texture,texture),camera={direction:d,height:60,yaw:0,pitch:-.15,fogDensity:0};
 function render(material,talus){const materials=Float32Array.from({length:24},(_,i)=>i%6===material?1:0);r.setMesh({radiusM:R,anchor:d,ground:{positions,normals,colors,indices,materials,talus:new Float32Array(4).fill(talus)},water});r.draw(camera);return pixels;}
 const rock=render(2,0),gravel=render(2,1);let brighter=0;for(let i=0;i<rock.length;i+=4)if(gravel[i]>rock[i]+10&&gravel[i+1]>rock[i+1]+10)brighter++;assert.ok(brighter>1000,'mid-distance gravel must not collapse to the exposed-rock average');assert.deepEqual(render(3,0),render(3,1),'snow must conceal gravel');
});
