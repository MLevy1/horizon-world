import test from 'node:test';
import assert from 'node:assert/strict';
import {software} from '../explorer-render.mjs';
import {direction,frame} from '../explorer-world.mjs';
test('grassland ground cover remains visible beyond the nearby prop radius in compatibility rendering',()=>{
 const R=64000,d=direction(0,0),f=frame(d),positions=Float64Array.from([[-300,200],[300,200],[300,1000],[-300,1000]].flatMap(([x,z])=>d.map((v,k)=>v*R+f.right[k]*x+f.forward[k]*z))),normals=Float32Array.from({length:12},(_,i)=>d[i%3]),colors=Float32Array.from({length:12},(_,i)=>[.23,.36,.12][i%3]),materials=Float32Array.from({length:24},(_,i)=>i%6===0?1:0),ground={positions,normals,colors,materials,indices:Uint32Array.of(0,1,2,0,2,3)},water={positions:new Float64Array(),normals:new Float32Array(),indices:new Uint32Array(),depths:new Float32Array(),elevationsM:new Float32Array()};
 let pixels;const canvas={getContext:()=>({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:i=>pixels=i.data.slice()}),getBoundingClientRect:()=>({width:100,height:100})},texture={image:{width:1},levels:[{width:1,height:1,data:Uint8Array.of(50,100,30,255)}]},renderer=software(canvas,texture,texture,texture),camera={direction:d,height:50,yaw:0,pitch:-.15,fogDensity:0};
 renderer.setMesh({radiusM:R,anchor:d,ground,water});renderer.draw(camera);const before=pixels;
 renderer.setMesh({radiusM:R,anchor:d,ground:{...ground,meadow:new Float32Array(4).fill(.94)},water});renderer.draw(camera);
 let changed=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+1]>before[i+1]+5&&pixels[i]<before[i])changed++;
 assert.ok(changed>500,'distant ground pixels must receive the grass material');
});
