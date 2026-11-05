/**
 * Horizon 5: geography-first world generation.
 *
 * Ordering is explicit:
 *   1. broad relief (including coast and mountains)
 *   2. drainage graph computed from that relief, BEFORE final terrain
 *   3. final valley + channel geometry and water elevations
 *   4. renderer, vegetation, collision, and navigation sample the result
 *
 * Pure world-coordinate queries; no camera, tile size, LOD, or Three.js state.
 * The owner supplies a stable drainage resolver based solely on broad relief.
 */
import {channelBed,ramp,lerp} from './geography.js';

export function valleyProfile(raw,feature){
  if(!feature||feature.kind!=='river'||!(feature.width>0))return raw;
  const width=Math.max(.2,feature.width);
  const d=Math.max(0,feature.distance);
  const flow=Math.max(0,feature.acc??0);
  // River Lab channel is the inner profile. The enclosing landscape extends
  // farther than the wetted channel, especially at mature downstream reaches.
  const depth=Math.max(.25,feature.depth??Math.min(3.8,.32+.11*width));
  const bankWidth=Math.max(1.5,feature.bankWidth??width*.65);
  const shoulder=Math.max(4,feature.shoulder??width*2.1);
  const maxCut=Math.max(14,feature.maxCut??14);
  // The occupied channel must be genuinely submerged. A fixed excavation
  // cap previously left the *ground above the water* where relief was high.
  // Outside the wetted channel retain bounded earthworks.
  const requiredCut=Math.max(0,raw-(feature.water-depth));
  const channelCut=d<=width
    ?Math.max(maxCut,requiredCut+0.25)
    :maxCut;
  const inner=channelBed(raw,{
    ...feature,depth,bankWidth,shoulder
  },channelCut);
  // Valley width scales with watershed accumulation. Tiny headwaters start
  // with almost no valley, rather than carving an artificial long trench.
  const valleyHalfWidth=Math.max(width+bankWidth+shoulder,
    (8+Math.sqrt(flow)*3.2)*Math.min(1,Math.max(.14,width/2)),
    Math.min(240,requiredCut*3));
  const channelEdge=width+bankWidth;
  const basinFloor=feature.water+Math.max(.5,depth*.7);
  const valleyCut=Math.max(0,Math.min(maxCut*.85,raw-basinFloor));
  const valleyWeight=1-ramp(channelEdge,valleyHalfWidth,d);
  const valley=raw-valleyCut*.58*valleyWeight;
  return Math.min(raw,inner,valley);
}
export function createWorldGenerator({broadHeight,drainageAt}){
  if(typeof broadHeight!=='function'||typeof drainageAt!=='function')
    throw new TypeError('World generator requires broadHeight and drainageAt');
  // All consumers share one exact sample, not independent river & terrain rules.
  function sample(x,z){
    const broad=broadHeight(x,z);
    if(!Number.isFinite(broad))throw new Error('Nonfinite broad relief');
    if(broad<0)return {x,z,broad,ground:broad,waterElevation:0,
      feature:null,substrate:'seabed',shoreDistance:null,wetness:0};
    const feature=drainageAt(x,z);
    if(!feature||feature.kind!=='river'||feature.width<=0){
      return {x,z,broad,ground:broad,waterElevation:null,feature:null,
        substrate:'ground',shoreDistance:null,wetness:0};
    }
    const ground=valleyProfile(broad,feature);
    const shoreDistance=feature.distance-feature.width;
    const bankWidth=Math.max(1.5,feature.bankWidth??feature.width*.65);
    const wetness=1-ramp(-.5,bankWidth*2,shoreDistance);
    const underwater=shoreDistance<=0;
    // Water follows a solved, gently descending river elevation.
    // Its level cannot be deduced from render tiles or snapped to their edges.
    const waterElevation=underwater?feature.water+(feature.surfaceOffset??.08):null;
    return {x,z,broad,ground,waterElevation,feature,shoreDistance,wetness,
      substrate:underwater?'riverbed':wetness>.01?'bank':'ground'};
  }
  return {
    sample,
    terrain(x,z){return sample(x,z).ground},
    water(x,z){return sample(x,z).waterElevation},
    // Drainage is a property of broad relief. This accessor makes the
    // dependency explicit and prevents accidentally routing from final terrain.
    broadHeight,
    drainageAt
  };
}
