import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectionRoute,inspectionStation,designSection,longitudinalSvg,sectionSvg} from '../profile-view.mjs';

function profiles(){
  return {kind:Uint8Array.of(1,1,2,2,3),edgeAtCell:Int32Array.of(0,1,-1,-1,-1),from:Int32Array.of(0,1),to:Int32Array.of(1,2),lengthM:Float64Array.of(100,300),
    waterM:Float64Array.of(10,8,5,5,0),bedM:Float64Array.of(9,7,2,3,-10),widthM:Float64Array.of(2,4,6,0,0),
    designDepthM:Float64Array.of(1,1,1,0,0),freeboardM:Float64Array.of(.3,.3,.3,0,0),wetEdge:Uint8Array.of(0,1)};
}
test('inspection follows the real downstream edges and stops at the first lake contact',()=>{
  const p=profiles(),r=inspectionRoute(p,0);
  assert.deepEqual([...r.cells],[0,1,2]);assert.deepEqual([...r.distanceM],[0,100,400]);
  assert.equal(r.totalLengthM,400);assert.equal(inspectionRoute(p,2),null);assert.equal(inspectionRoute(p,-1),null);
});
test('station distance uses actual segment lengths, exact shared junctions and clamped endpoints',()=>{
  const p=profiles(),r=inspectionRoute(p,0),junction=inspectionStation(p,r,100),middle=inspectionStation(p,r,250);
  assert.equal(junction.waterM,8);assert.equal(junction.bedM,7);assert.equal(junction.widthM,4);
  assert.equal(junction.t,0);assert.equal(junction.edge,1);assert.equal(junction.wet,true);
  assert.equal(middle.t,.5);assert.equal(middle.waterM,6.5);assert.equal(middle.widthM,5);
  assert.equal(inspectionStation(p,r,-1).waterM,10);assert.equal(inspectionStation(p,r,999).waterM,5);
  assert.throws(()=>inspectionStation(p,r,NaN));
});
test('design sections match the saved minimum depth, bank-freeboard and waterline width',()=>{
  const s={waterM:10,bedM:8,designDepthM:2,widthM:4,freeboardM:.5,wet:true},points=designSection(s);
  assert.equal(points[32].xM,0);assert.equal(points[32].bedM,8);
  for(const x of [-2,2]){const point=points.find(p=>p.xM===x);assert.equal(point.bedM,10);assert.equal(point.waterM,10);}
  assert.equal(points[0].bedM,10.5);assert.equal(points.at(-1).bedM,10.5);
  assert.ok(designSection({...s,wet:false}).every(p=>p.waterM===null));
});
test('minimum design sections do not turn a deeper ocean contact into artificial high banks',()=>{
  const section=designSection({waterM:0,bedM:-50,designDepthM:.6,widthM:9,freeboardM:.4,wet:true});
  assert.equal(section[32].bedM,-.6);assert.equal(section[0].bedM,.4);
});
test('dry station and SVG output retain explicit dry styling without filled cross-section water',()=>{
  const p=profiles(),r=inspectionRoute(p,0),dry=inspectionStation(p,r,50);
  assert.equal(dry.wet,false);assert.ok(!sectionSvg(dry).includes('class="profile-water-fill"'));
  const svg=longitudinalSvg(p,r,dry);assert.ok(svg.includes('profile-dry'));assert.ok(!svg.includes('NaN'));
  assert.ok(!sectionSvg(inspectionStation(p,r,400)).includes('NaN'));
});
