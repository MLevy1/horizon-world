# Alpha 5: geography-first world-generation replacement

**Alpha 5.4 experimental shared-channel preview. Do not merge without visual and performance validation.**

## The dependency order

```
Seed and broad relief (mountain belts, uplands, coastlines)
                 |
                 v
Drainage on BROAD relief: flow accumulation, watershed graph, outlets
                 |
                 v
Final world ground: valleys, floodplains, riverbed, banks
                 |
                 v
Water, substrate, vegetation, terrain meshes, collision and LOD
```

The crucial rule: **never calculate drainage from final terrain**, because the terrain
itself is shaped by the drainage. This avoids circular dependencies and inconsistent
height queries. Drainage regions are an implementation detail, not hydrological features.

## Implemented first vertical slice

- `world-generation.js` is independent of the renderer and creates the shared final
  ground/water/shore sample from precomputed geographic drainage and broad relief.
- The main world calls it instead of the old `createGeography` wrapper.
- Valley width now scales with accumulated flow; narrow headwaters don't carve a
  full mature valley. The inner channel shares River Lab's `channelBed` profile.
- Surface placement, vegetation positions and gameplay ground height query the
  same world model, maintaining deterministic coordinates.
- Geography-first unit tests cover sample order, drainage dependency, sea-level
  behavior, and valley scaling.
- Visible version is 5.0.0 on the branch only; production remains 4.3.0.

## New in Alpha 5.1

- `terrain-mesh.js`: refine regular terrain cells around channels in fine near-field
  tiles (4× or 8× based on tile size), with matching vertices at *internal cell*
  boundaries. This reduces ground triangles cutting across narrow water channels.
- Preserve established low-detail geometry outside the watercourse.
- Ensure that a wetted channel is actually excavated beneath the water surface,
  even when local terrain would exceed the former 14 m excavation limit.
- Unit tests check internal triangulation continuity, upward triangle winding,
  deterministic coordinates, and riverbed submersion in steep relief.
- The test location X 10,929 / Z 458 remains a mandatory visual benchmark.

## New in Alpha 5.2

- Fix floating ground cover: tile-owned grass/shrub placement now interpolates the actual adaptive triangles instead of using obsolete regular-grid vertex IDs.
- Extend near-field root reanchoring for larger rocks and trees and widen watercourse vegetation exclusion.
- Water no longer begins abruptly at a 0.65 m visual threshold. The mesh begins as a trickle and its opacity grows gradually through the first 350 m of contributing flow.
- Sea-connected terminal river reaches fade over their last ~95 m into the receiving ocean surface, avoiding an exposed rectangle at the mouth.
- Retain a mostly opaque blue river tint while using per-vertex fades, to avoid the near-black water regression in Alpha 4.4.
- Regression tests exercise adaptive triangle height interpolation for ground-cover placement.

**Known gaps:** Ocean mouth treatment is a visual overlap, not a true shared river/ocean contour triangulation. True river and lake basins, cross-LOD seam stitching and hydrological domain routing remain unfinished.

## New in Alpha 5.4 — shared channel triangulation

- A new pure `shared-channel-mesh.js` splits the same indexed terrain triangles
  into dry ground and wetted river polygons at the geographic waterline.
  Both the riverbed boundary and the water surface use the **identical x/z
  intersection vertices**, preventing independently drawn water ribbons from
  slicing across their corresponding banks.
- The old freestanding river ribbon construction is disabled in the Alpha 5.4
  world renderer. Tile-owned water and terrain geometry are cleaned up together.
- Connected headwater distance now reaches the geographic profile; dry source
  swales have modest excavation, growing continuously toward mature channels.
  Water is drawn only where the geographic ground lies beneath the waterline
  and the width is adequately resolved by the current terrain tile.
- Cross-section transitions are tested for deterministic positions, matching
  bank/water boundaries, correct triangle winding, and full-tile channel
  continuity, including the avoidance of subpixel dotted polygons.
- Medium-distance terrain tiles can carry coarser, shared water geometry;
  water that is too narrow for a distant grid remains unresolved rather than
  being represented by intermittent thin strips.

**Limitations requiring evaluation:** LOD seams between tiles of different
sizes still need explicit stitching; narrow streams may not show at distance.
Ocean/river and pond/river transitions need shared basin contour geometry.
The water shader is still a surface approximation, not volumetric refraction.
Validate X 11,543 / Z 919, X 10,265 / Z 272, both sides of terrain-tile seams,
tributary junctions, underwater flight, and distant aerial views on iOS before
considering a merge.



1. **Drainage between domains:** route across adjoining 32.768 km boundaries rather
   than treating every land boundary as an unresolved terminus.
2. **Standing-water basins:** define ponds and lakes in the geographic graph,
   with inlets, outlets, flat water elevations, basin contours, and bathymetry,
   before final geometry is built.
3. **Channel-aware geometry:** the first adaptive internal grid is implemented,
   but it must still be tested visually for bank fidelity, tributary junctions,
   river-to-pond mouths, and *cross-tile LOD stitching*. The outermost ring is
   deliberately left coarse until a shared seam-stitching contract exists.
4. **One water/terrain interface:** river and pond surfaces must use precisely
   the same boundaries and elevations as the final ground. Disallow geometry
   clipping against uncarved `baseTerrain`. Restore translucent water and
   camera submersion only after the riverbed is physically beneath it.
5. **Performance:** 32.8 km drainage domains are synchronous today. Introduce
   bounded caching and off-main-thread generation where practical; benchmark
   mobile startup, map opening, panning and travel.
6. **Regression:** benchmark X=10,929 / Z=458, the pond transition locations,
   tributary junctions, negative world coordinates, all former watershed seams,
   near/far LOD behavior, and flight below river water.
7. **Removal:** retire legacy hydrology only after the new engine is validated.

## What this is not

This initial integration does **not** make true lakes, produce watertight riverbank
triangulation or solve all adjacent regional boundaries. It moves valley and
riverbed shaping into the correct stage of world generation, allowing those
improvements to be implemented without another overlay-based rewrite.
