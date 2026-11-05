import test from 'node:test';
import assert from 'node:assert/strict';
import {channelBed,createGeography,ramp} from '../geography.js';

test('shared cross section never adds terrain or exceeds maximum cut',()=>{
  const c={kind:'river',distance:0,width:5,water:100,depth:1.2,bankWidth:3,shoulder:10};
  for(let d=0;d<=30;d+=.25){
    const ground=channelBed(110,{...c,distance:d},14);
    assert.ok(ground<=110+1e-9);
    assert.ok(ground>=96-1e-9);
  }
  assert.equal(channelBed(110,{...c,distance:30},14),110);
});

test('river water, bed, shoreline and wetness agree at the same point',()=>{
  const world=createGeography({
    baseHeight:()=>105,
    resolveFeature:(x,z)=>({kind:'river',distance:Math.abs(x),width:5,water:100,depth:1,bankWidth:3,shoulder:9})
  });
  const mid=world.sample(0,0),bank=world.sample(7,0),outside=world.sample(25,0);
  assert.equal(mid.waterElevation,100.09);
  assert.ok(mid.ground<mid.waterElevation);
  assert.ok(mid.wetness>bank.wetness);
  assert.equal(bank.substrate,'gravel');
  assert.equal(bank.waterElevation,null);
  assert.equal(outside.ground,105);
  assert.equal(outside.waterElevation,null);
  assert.equal(world.terrain(0,0),mid.ground);
  assert.equal(world.water(0,0),mid.waterElevation);
});

test('ponds have a level surface and excavate an irregular basin',()=>{
  const world=createGeography({
    baseHeight:()=>12,
    resolveFeature:(x,z)=>({kind:'pond',shapeDistance:Math.hypot(x,z)-20,water:10,bedDepth:2,shorelineBlend:12})
  });
  assert.equal(world.water(0,0),world.water(10,0));
  assert.equal(world.water(35,0),null);
  assert.ok(world.terrain(0,0)<world.water(0,0));
  assert.equal(world.terrain(35,0),12);
});

test('seeded resolver is independent of traversal or tile order',()=>{
  const feature=(x,z)=>({
    kind:'river',distance:Math.abs(z-Math.sin(x/20)*3),
    width:3,water:80-x*.001
  });
  const world=createGeography({baseHeight:()=>90,resolveFeature:feature});
  const points=[[1,4],[100,3],[-40,-2],[0,0]];
  const first=points.map(([x,z])=>world.sample(x,z));
  const second=[...points].reverse().map(([x,z])=>world.sample(x,z)).reverse();
  assert.deepEqual(first,second);
  assert.equal(ramp(0,1,-2),0);
  assert.equal(ramp(0,1,2),1);
});
