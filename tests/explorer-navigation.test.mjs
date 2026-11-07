import test from 'node:test';
import assert from 'node:assert/strict';
import {flightStep,mapGeometry,mapPoint,zoomMap,panMap,WALK_SPEEDS,FLY_SPEEDS} from '../explorer-navigation.mjs';
import {direction} from '../explorer-world.mjs';
import {selectTerrainTiles} from '../terrain-lod.mjs';
test('flight moves horizontally and vertically at the selected speed without diagonal acceleration',()=>{
 const base={direction:direction(179.99,30),yaw:Math.PI/2,pitch:0,height:100,dt:.1,radiusM:64000,speed:100};
 const a=flightStep({...base,forward:1}),b=flightStep({...base,forward:1,right:1,vertical:1});assert.ok(Math.abs(a.distance-10)<1e-12);assert.ok(Math.abs(b.distance-10)<1e-12);assert.ok(Math.abs(Math.hypot(...b.direction)-1)<1e-12);assert.ok(b.height>100);assert.ok(a.yaw===a.yaw);assert.equal(flightStep({...base,vertical:1}).height,110);assert.equal(flightStep({...base,forward:1,pitch:Math.PI/2}).height,110);assert.equal(flightStep({...base,vertical:1,height:5999}).height,6000);assert.equal(flightStep({...base,vertical:1,dt:20}).height,110);assert.ok(FLY_SPEEDS.at(-1)>WALK_SPEEDS.at(-1));
});
test('map zoom stays anchored to the pointed location and keeps a bounded scale',()=>{
 const view={cx:.5,cy:.5,zoom:4},w=800,h=400,x=600,y=160,p=mapPoint(view,x,y,w,h),next=zoomMap(view,2,x,y,w,h),q=mapPoint(next,x,y,w,h);assert.ok(Math.abs(p.lon-q.lon)<1e-10);assert.ok(Math.abs(p.lat-q.lat)<1e-10);assert.equal(zoomMap(view,100,x,y,w,h).zoom,64);assert.equal(zoomMap(view,.0001,x,y,w,h).zoom,1);const pan=panMap(view,400,0,w,h);assert.ok(pan.cx<view.cx);assert.equal(mapPoint({cx:.999,cy:.5,zoom:8},800,200,w,h).lon<0,true);
 const polar=panMap(view,0,1e9,w,h);assert.ok(polar.cy>=0&&polar.cy<=1);assert.equal(mapPoint({cx:.5,cy:.5,zoom:1},400,0,800,600),null);assert.equal(mapGeometry({cx:.5,cy:.5,zoom:1},800,400).w,800);
});
test('aerial LOD can cover a wider footprint than ground walking without an unbounded tile count',()=>{
 for(const [lon,lat] of [[0,0],[45,35.26],[-180,89]]){const wide=selectTerrainTiles(lon,lat,{level:6}),near=selectTerrainTiles(lon,lat,{level:12});assert.ok(wide.length<=160);assert.ok(wide.reduce((s,v)=>s+4**-v.tile.level,0)>near.reduce((s,v)=>s+4**-v.tile.level,0));}
});
