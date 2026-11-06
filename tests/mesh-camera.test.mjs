import test from 'node:test';
import assert from 'node:assert/strict';
import {meshCamera,inspectionZoom} from '../mesh-camera.mjs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
test('local inspection tilt preserves an orthonormal camera and centers the sampled ground elevation',()=>{
  const c=meshCamera(135,-45,4096,45,64000,1200);
  for(const axis of [c.east,c.up,c.front])assert.ok(Math.abs(Math.hypot(...axis)-1)<1e-12);
  for(const [a,b] of [[c.east,c.up],[c.east,c.front],[c.up,c.front]])assert.ok(Math.abs(dot(a,b))<1e-12);
  assert.ok(Math.abs(Math.hypot(...c.origin)-65200)<1e-8);assert.ok(dot(c.light,c.front)>0);assert.deepEqual(meshCamera(0,0,1,45,64000).origin,[0,0,0]);
});

test('inspection framing keeps the view inside the loaded chunk boundary',()=>{
  const camera=meshCamera(0,0,4096,0,64000),mesh={radiusM:64000,ground:{positions:Float64Array.of(64000,-10,-20,64000,-10,20,64000,10,20,64000,10,-20),boundaryIndices:Uint32Array.of(0,1,1,2,2,3,3,0)}};
  const zoom=inspectionZoom(mesh,camera,2,4096),halfHeight=68000/(.9*zoom);assert.ok(Math.hypot(halfHeight,halfHeight*2)<10);assert.ok(zoom>4096);
});
