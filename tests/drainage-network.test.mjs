import test from 'node:test';
import assert from 'node:assert/strict';
import {solveDrainageDomain,crossesOldMacroBoundary,domainOfMacro,domainOfWorld} from '../drainage-network.js';

test('one drainage graph traverses former macro boundaries',()=>{
  const N=32,S=128;
  const w=solveDrainageDomain({ix:0,iz:0,N,S,
    height:(x,z)=>Math.max(0,300-x*.085+Math.abs(z-N*S*.5)*.25)});
  let seam=0,seaConnected=0;
  for(let id=0;id<w.C;id++){
    if(crossesOldMacroBoundary(w,id)){
      seam++;
      if(w.ocean[id])seaConnected++;
    }
  }
  assert.ok(seam>0,'flow graph should cross its old internal macro seams');
  assert.ok(seaConnected>0,'those rivers must remain in connected sea basins');
  assert.equal(w.stats.internalEnds,0);
});

test('domain identity and boundaries remain stable for negative world coordinates',()=>{
  assert.deepEqual(domainOfMacro(-1,-1),{ix:-1,iz:-1});
  assert.deepEqual(domainOfMacro(0,1),{ix:0,iz:0});
  assert.deepEqual(domainOfMacro(2,2),{ix:1,iz:1});
  assert.deepEqual(domainOfWorld(-.01,-.01),{ix:-1,iz:-1});
  assert.deepEqual(domainOfWorld(32768,32768),{ix:1,iz:1});
});

test('flow accumulation only moves downstream; ocean versus boundary is explicit',()=>{
  const N=16,S=128;
  const w=solveDrainageDomain({ix:0,iz:0,N,S,
    height:(x,z)=>Math.max(0,100-x*.1)+Math.abs(z-1024)*.01});
  for(let id=0;id<w.C;id++){
    const down=w.parent[id];if(down<0)continue;
    assert.ok(w.acc[down]>=w.acc[id]);
    assert.ok(w.level[id]>=w.level[down]-.03);
    assert.equal(w.ocean[id]+w.landBoundary[id],1);
  }
});
