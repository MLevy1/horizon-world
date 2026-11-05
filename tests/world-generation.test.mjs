import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldGenerator,valleyProfile} from '../world-generation.js';

test('drainage is based on broad geography, not the finished carved terrain',()=>{
 let calls=0;
 const broad=(x,z)=>120+x*.02;
 const drainage=(x,z)=>{calls++;return {kind:'river',distance:Math.abs(z),width:4,water:115+x*.01,acc:180,depth:1.5,maxCut:18}};
 const world=createWorldGenerator({broadHeight:broad,drainageAt:drainage});
 const a=world.sample(20,0),b=world.sample(20,16);
 assert.equal(world.broadHeight(20,0),120.4);
 assert.ok(a.ground<a.broad);
 assert.ok(a.ground<a.waterElevation);
 assert.ok(b.ground<=b.broad);
 assert.equal(b.waterElevation,null);
 assert.ok(calls>=2);
 assert.equal(world.drainageAt,drainage);
});

test('large rivers make broader valleys than small headwaters',()=>{
 const raw=135,base={kind:'river',distance:35,water:120,maxCut:20};
 const small=valleyProfile(raw,{...base,width:1,acc:8});
 const mature=valleyProfile(raw,{...base,width:8,acc:700});
 assert.ok(mature<small,'downstream valley must affect more surrounding land');
 assert.ok(mature<=raw,'valleys never create an embankment');
});

test('stable absolute coordinates are independent of tile sampling order',()=>{
 const broad=(x,z)=>125+Math.sin(x*.001)*10;
 const drainage=(x,z)=>({kind:'river',distance:Math.abs(z-Math.sin(x*.004)*6),width:3,water:119,acc:250,maxCut:16});
 const w=createWorldGenerator({broadHeight:broad,drainageAt:drainage});
 const points=[[10929,458],[10929,459],[10931,455],[-18,-2]];
 const first=points.map(([x,z])=>w.sample(x,z));
 const second=[...points].reverse().map(([x,z])=>w.sample(x,z)).reverse();
 assert.deepEqual(first,second);
});

test('ocean remains an elevation feature without a river mesh',()=>{
 const w=createWorldGenerator({broadHeight:()=>-3,drainageAt:()=>{throw Error('No drainage on submerged geography')}});
 const a=w.sample(2,5);
 assert.equal(a.ground,-3);assert.equal(a.waterElevation,0);
 assert.equal(a.substrate,'seabed');
});
