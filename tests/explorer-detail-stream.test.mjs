import test from 'node:test';
import assert from 'node:assert/strict';
import {planGroundDetail,createGroundDetailCache,copyGroundDetail,detailVisibility} from '../explorer-detail-stream.mjs';
import {direction,coordinates,moveDirection} from '../explorer-world.mjs';
import {coordinateTile,tileKey} from '../terrain-chunks.mjs';
test('motion-predicted detail tiles cover the camera, flight corridor and edges across cube seams and poles',()=>{
 for(const [lon,lat,yaw] of [[0,0,0],[44.99,0,Math.PI/2],[179.99,70,1],[20,89.9,0]]){
  const plan=planGroundDetail({lon,lat,yaw,radiusM:64000,forward:1,right:0,speed:100,latency:3}),ids=new Set(plan.tiles.map(t=>t.id)),d=direction(lon,lat);
  for(const along of [0,60,120,180,240])for(const side of [-90,0,90]){
   const center=moveDirection(d,yaw,1,0,along,64000),p=coordinates(moveDirection(center,yaw,0,1,side,64000));assert.ok(ids.has(tileKey(coordinateTile(p.lon,p.lat,11))));
  }
  assert.equal(ids.size,plan.tiles.length);assert.ok(ids.size<700);assert.ok(plan.tiles[0].distance<100);
 }
});
test('incremental motion reuses tile identities and visibility blends independently of arrival',()=>{
 const a=planGroundDetail({lon:0,lat:0,radiusM:64000,speed:30,forward:1,latency:3}),p=coordinates(moveDirection(direction(0,0),0,1,0,16,64000)),b=planGroundDetail({...p,radiusM:64000,speed:30,forward:1,latency:3}),ids=new Set(a.tiles.map(t=>t.id));assert.ok(b.tiles.filter(t=>ids.has(t.id)).length>b.tiles.length*.8);
 assert.equal(detailVisibility(20,0),0);assert.ok(detailVisibility(20,.35)>0&&detailVisibility(20,.35)<1);assert.equal(detailVisibility(20,1),1);assert.ok(detailVisibility(80,1)>0&&detailVisibility(80,1)<1);assert.equal(detailVisibility(96,1),0);assert.equal(detailVisibility(20,1,140),0);
});
test('detail geometry cache is bounded and transferred copies leave reusable buffers intact',()=>{
 const cache=createGroundDetailCache({limitBytes:48}),a={positions:Float64Array.of(1,2,3),indices:Uint32Array.of(0,1,2)},b={positions:Float64Array.of(4,5,6),indices:Uint32Array.of(0,1,2)};cache.put('a',a);const copy=copyGroundDetail(cache.get('a'));structuredClone(copy,{transfer:[copy.positions.buffer,copy.indices.buffer]});assert.equal(copy.positions.byteLength,0);assert.deepEqual([...cache.get('a').positions],[1,2,3]);cache.put('b',b);assert.equal(cache.get('a'),undefined);assert.ok(cache.stats().bytes<=48);cache.clear();assert.equal(cache.stats().bytes,0);
});
