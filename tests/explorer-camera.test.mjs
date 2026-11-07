import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraClip,depthResolution,logDepthResolution} from '../explorer-camera.mjs';
test('flight clipping and logarithmic depth retain lakebed separation at high altitude',()=>{
 assert.equal(cameraClip().near,.08);for(const height of [128,1000,3338,6000]){const clip=cameraClip({flying:true,clearance:height});assert.ok(clip.near>=.08&&clip.near<=50);assert.ok(logDepthResolution(height,clip.far)<.005);}
 assert.ok(depthResolution(3338,.08,160000)>5);assert.ok(logDepthResolution(3338)<.003);assert.ok(logDepthResolution(.1)<.000001);
});
