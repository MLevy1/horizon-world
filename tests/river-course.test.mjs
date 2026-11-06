import test from 'node:test';
import assert from 'node:assert/strict';
import {createRiverCourse} from '../river-course.mjs';
import {sampleRiverEdge} from '../river-profiles.mjs';
import {composeWaterSurface} from '../water-contact.mjs';
const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]))*64000;
function fixture(){
  const points=[[0,0],[.20,.08],[.42,0],[.65,.05],[.20,.3]].map(([lon,lat])=>{const l=lon*Math.PI/180,p=lat*Math.PI/180;return [Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)];}),mesh={directionAt:i=>points[i]},from=Int32Array.of(0,1,2,4),to=Int32Array.of(1,2,3,2),p={from,to,edgeAtCell:Int32Array.of(0,1,2,-1,3),kind:Uint8Array.of(1,1,1,3,1),widthM:Float64Array.of(12,15,20,20,8),waterM:Float64Array.of(20,18,16,0,19),bedM:Float64Array.of(18,16,14,-3,17),designDepthM:Float64Array.of(2,2,2,2,2),wetEdge:Uint8Array.of(1,1,1,1),lengthM:Float64Array.from(from,(a,e)=>distance(points[a],points[to[e]]))},m={seed:'bend fixture',grid:{count:5,width:1536,north:5,radiusKm:64},riverProfiles:p};
  return {m,p,mesh,course:createRiverCourse(m,mesh)};
}
test('degree-2 courses smooth within bounds while confluences, headwaters and ports stay pinned',()=>{
  const {course:c,mesh}=fixture();assert.ok(c.stats.movedNodes>0&&c.stats.curvedEdges>0);for(const i of [0,2,3,4])assert.deepEqual(c.nodeDirection(i),mesh.directionAt(i));assert.ok(distance(c.nodeDirection(1),mesh.directionAt(1))>1);assert.ok(c.stats.maxShiftM<32);
  assert.deepEqual(c.sample(0,1).direction,c.sample(1,0).direction);assert.deepEqual(c.sample(1,1).direction,c.sample(2,0).direction);assert.deepEqual(c.sample(3,1).direction,c.sample(2,0).direction);
  const a=c.sample(0,1).normal,b=c.sample(1,0).normal;assert.ok(a.reduce((s,v,k)=>s+v*b[k],0)>.999999,'continuous main-stem tangent');
});
test('projection finds the curved centerline and signed cross sections on both sides without a straight-edge approximation',()=>{
  const {course:c}=fixture();for(let edge=0;edge<4;edge++)for(const t of [0,.03,.25,.5,.8,.99,1]){
    const f=c.sample(edge,t),q=c.project(edge,f.direction);assert.ok(q.distanceM<1e-6,JSON.stringify({edge,t,qt:q.t,d:q.distanceM}));assert.ok(Math.abs(q.t-t)<1e-8);
    for(const offset of [-2,2]){const a=offset/64000,d=norm(f.direction.map((v,k)=>v*Math.cos(a)+f.normal[k]*Math.sin(a))),r=c.project(edge,d);assert.ok(Math.abs(r.distanceM-Math.abs(offset))<.002);assert.equal(Math.sign(r.signedDistanceM),Math.sign(offset));}
  }
});
test('protected contact edges keep the original spherical chord parameter and symmetric bank design',()=>{
  const {m,mesh,p}=fixture(),c=createRiverCourse(m,mesh,{protectedNode:()=>true});assert.equal(c.stats.curvedEdges,0);assert.equal(c.stats.movedNodes,0);
  for(let e=0;e<4;e++)for(const t of [.13,.5,.79]){const a=mesh.directionAt(p.from[e]),b=mesh.directionAt(p.to[e]),expected=norm(a.map((v,k)=>v+(b[k]-v)*t)),f=c.sample(e,t);assert.ok(distance(f.direction,expected)<1e-8);assert.ok(Math.abs(c.project(e,expected).t-t)<1e-10);assert.equal(f.leftHalfM,f.rightHalfM);assert.equal(f.widthM,sampleRiverEdge(p,e,t).widthM);}
});
test('bank asymmetry varies continuously and leaves all center beds and downhill design heads intact',()=>{
  const {course:c,p}=fixture();let asym=0;
  for(let e=0;e<4;e++){let last=Infinity;for(let k=0;k<=32;k++){const t=k/32,f=c.sample(e,t),s=sampleRiverEdge(p,e,t);assert.ok(s.waterM<=last);last=s.waterM;assert.ok(f.leftHalfM>0&&f.rightHalfM>0&&f.leftBankM>0&&f.rightBankM>0);if(Math.abs(f.leftHalfM-f.rightHalfM)>.01)asym++;
    const q=composeWaterSurface(30,null,[{...f,...s,widthM:f.widthM,distanceM:0,signedDistanceM:0,freeboardM:.5}]);assert.ok(Math.abs(q.groundM-s.bedM)<1e-8);assert.ok(Math.abs(q.waterM-s.waterM)<1e-8);
  }}assert.ok(asym>0);
  const a=c.sample(0,1),b=c.sample(1,0);for(const key of ['widthM','leftHalfM','rightHalfM','leftBankM','rightBankM'])assert.equal(a[key],b[key]);
});
test('the same seed and global graph reproduce all course and bank samples',()=>{
  const {m,mesh,course:c}=fixture(),d=createRiverCourse(m,mesh);for(let e=0;e<4;e++)for(const t of [0,.25,.5,.75,1])assert.deepEqual(c.sample(e,t),d.sample(e,t));assert.throws(()=>c.sample(-1,.5));assert.throws(()=>c.sample(0,NaN));
});
