import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoftwareMeshPreview} from '../mesh-raster.mjs';

test('the compatibility renderer draws indexed ground and nearer water, supports hiding water and changes hemisphere',()=>{
  let frame;
  const context={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>frame=image,clearRect(){}};
  const canvas={getContext:()=>context,getBoundingClientRect:()=>({width:200,height:200})};
  const triangle=x=>({positions:Float64Array.of(x,-20000,-20000,x,-20000,20000,x,20000,0),indices:Uint32Array.of(0,2,1)});
  const preview=createSoftwareMeshPreview(canvas,{radiusM:64000,ground:triangle(64000),standingWater:triangle(65000)});
  const center=()=>[...frame.data.subarray((100*200+100)*4,(100*200+100)*4+3)];
  preview.draw(0,0,false);const land=center();assert.ok(land[0]>land[2]);
  preview.draw(0,0,true);const water=center();assert.ok(water[2]>water[0]);assert.notDeepEqual(land,water);
  preview.draw(180,0,true);assert.deepEqual(center(),[11,23,29]);preview.dispose();
});
