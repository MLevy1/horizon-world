/**
 * Horizon Alpha 4 — canonical water/ground interface.
 *
 * All distances and elevations are world metres. No Three.js dependency.
 * A feature is resolved in absolute world coordinates, never from a render tile.
 * Keep this module free of camera, LOD, and DOM state.
 */
export const GEOLOGY_VERSION = 'alpha4-surface-1';

export function smooth01(t) {
  t = Math.max(0, Math.min(1, t));
  return t*t*(3-2*t);
}
export function ramp(a, b, value) {
  return a === b ? (value >= b ? 1 : 0) : smooth01((value-a)/(b-a));
}
export function lerp(a, b, t) { return a+(b-a)*t; }

/**
 * River Lab cross-section shared by the lab and world.
 * width is a HALF-width (distance from centreline to water's edge).
 * Return a *target* height; callers may limit excavation using maxCut.
 * Never add terrain: this is an incision profile, not an embankment.
 */
export function channelBed(raw, feature, maxCut = Infinity) {
  if (!feature || feature.width <= 0) return raw;
  const d = Math.max(0, feature.distance);
  const w = Math.max(.01, feature.width);
  const depth = Math.max(.01, feature.depth ?? Math.min(1.65,.28+w*.08));
  const bank = Math.max(.01, feature.bankWidth ?? Math.max(1.4,w*.5));
  const shoulder = Math.max(.01, feature.shoulder ?? Math.max(4,w*1.6));
  const rise = feature.rise ?? .65;
  const water = feature.water;
  if (!Number.isFinite(water)) return raw;
  let target = raw;
  if (d <= w*.54) target = water-depth;
  else if (d <= w) target = lerp(water-depth,water-.015,ramp(w*.54,w,d));
  else if (d <= w+bank) target = lerp(water-.015,water+rise,ramp(w,w+bank,d));
  else if (d <= w+bank+shoulder)
    target = lerp(water+rise,raw,ramp(w+bank,w+bank+shoulder,d));
  return Math.max(raw-maxCut, Math.min(raw,target));
}

/**
 * One point-query source of truth for ground, wetness, water and land cover.
 * resolveFeature(x,z) may return a river reach, a pond/lake basin, or null.
 * A standing-water feature has shapeDistance (negative inside the shoreline),
 * water, bedDepth, and shorelineBlend; a river has distance/width as above.
 */
export function createGeography({baseHeight, resolveFeature}) {
  if (typeof baseHeight !== 'function' || typeof resolveFeature !== 'function')
    throw new TypeError('Geography needs baseHeight and resolveFeature callbacks');
  return {
    sample(x,z) {
      const raw = baseHeight(x,z);
      const feature = raw >= 0 ? resolveFeature(x,z) : null;
      let ground = raw, waterElevation = raw < 0 ? 0 : null;
      let shoreDistance = null, wetness = 0, substrate = 'ground';
      if (feature?.kind === 'river' && feature.width > 0) {
        ground = channelBed(raw,feature,feature.maxCut ?? 14);
        shoreDistance = feature.distance-feature.width;
        wetness = 1-ramp(-.5,Math.max(2,feature.bankWidth??feature.width*.5),shoreDistance);
        if (shoreDistance <= 0) {
          waterElevation = feature.water + (feature.surfaceOffset ?? .09);
          substrate = 'riverbed';
        } else if (wetness > .01) substrate = 'gravel';
      } else if ((feature?.kind === 'pond' || feature?.kind === 'lake')
                && Number.isFinite(feature.shapeDistance)) {
        const d = feature.shapeDistance; // signed distance: negative inside
        const level = feature.water;
        const depth = Math.max(.3,feature.bedDepth ?? 2);
        const blend = Math.max(1,feature.shorelineBlend ?? 12);
        if (d <= 0) {
          ground = Math.min(raw,level-depth);
          waterElevation = level + (feature.surfaceOffset ?? .09);
          substrate = 'lakebed';
        } else if (d < blend) {
          const target = lerp(level+.25,raw,ramp(0,blend,d));
          ground = Math.min(raw,target);
          substrate = 'shore';
        }
        shoreDistance = d;
        wetness = 1-ramp(-.4,blend,d);
      }
      return {x,z,raw,ground,waterElevation,feature,shoreDistance,wetness,substrate};
    },
    terrain(x,z) { return this.sample(x,z).ground; },
    water(x,z) { return this.sample(x,z).waterElevation; }
  };
}
