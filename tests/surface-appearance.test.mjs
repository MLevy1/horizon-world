import test from 'node:test';
import assert from 'node:assert/strict';
import {bankSurfaceColor,waterDepthColor} from '../surface-appearance.js';

const base=[.3,.46,.28];
const feature={kind:'river',width:5,water:120,acc:200};
const sample=d=>({feature,shoreDistance:d,ground:119,wetness:1});
const noise=(x,z,scale,seed)=>Math.sin(x/scale+z/scale*.71+seed);
test('bank materials preserve original biome away from water',()=>{
 assert.deepEqual(bankSurfaceColor(base,null,0,0,noise),base);
 const far=bankSurfaceColor(base,sample(80),100,200,noise);
 assert.deepEqual(far,base);
});
test('river banks are irregular world-space sediments, not one pale stripe',()=>{
 const wet=bankSurfaceColor(base,sample(.1),20,45,noise);
 const upper=bankSurfaceColor(base,sample(5),20,45,noise);
 const distant=bankSurfaceColor(base,sample(15),20,45,noise);
 assert.ok(wet[0]<.5,'wet bank must remain dark instead of uniformly sandy');
 assert.notDeepEqual(wet,upper);
 assert.ok(distant.every(Number.isFinite));
 const another=bankSurfaceColor(base,sample(5),55,45,noise);
 assert.notDeepEqual(upper,another,'sediment varies along the river');
});
test('depth-aware water tint changes systematically across realistic depths',()=>{
 const shallow=waterDepthColor(.08),medium=waterDepthColor(1),deep=waterDepthColor(4);
 assert.ok(shallow[0]>medium[0]&&medium[0]>deep[0], 'deeper water has less red/less visible bed');
 assert.ok(deep[2]>deep[0], 'deep water remains blue-green');
 assert.ok(shallow.slice(0,3).every(c=>c>=0&&c<=1));
 assert.equal(shallow[3],deep[3],'same flow distance should have same opacity');
});
test('visible headwaters do not create zero-alpha dashed water after emergence',()=>{
 const beginning=waterDepthColor(.4,0)[3];
 const after=waterDepthColor(.4,150)[3],full=waterDepthColor(.4,1000)[3];
 assert.ok(beginning>.5);
 assert.ok(after>beginning&&full>=after);
 assert.equal(waterDepthColor(.5,1000,0)[3],0,'real sea-mouth fade still reaches zero');
});
