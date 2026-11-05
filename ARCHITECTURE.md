# Horizon Alpha 4 — Unified Geography & Hydrology

Status: **development branch; first integrated vertical slice, not a complete hydrology replacement**.

## Design principles

1. Geographic facts are deterministic in absolute world coordinates. Camera position, render tile size and LOD cannot change where a river or shoreline exists.
2. All surface consumers query one geography interface for ground height, water level, water feature, wetness, and substrate.
3. River Lab and the explorer share the channel cross-section math from `geography.js`. The lab remains a geometry test harness.
4. The source of water features is logically separate from their surface representation and Three.js geometry.
5. Water is initially a geographic and visual simulation, **not** a real-time fluid solver.

## Implemented in this branch

- `geography.js`: dependency-free `createGeography`, `channelBed`, interpolation and shore profile primitives.
- The main explorer's natural-waterway path gets ground and surface water from `worldGeography`, including shared river feature lookup; legacy routing remains as a comparison path.
- The near-field terrain builder obtains river metadata and terrain height from one point sample.
- River Lab calls the same channel-profile function as the world.
- Pond reach generation is enabled throughout the existing natural-watershed pipeline, rather than only in the selected pilot region.
- Natural-waterway meshes use continuous channel-run ribbons with world-space flowing UVs, and all active natural waterways receive a consistent sediment shore palette.
- `tests/geography.test.mjs`: deterministic queries, no raised ground, water/bed coherence, basin model, and incision depth invariants.

## Development / testing

Launch a local HTTP server (not `file://`, because ES modules load `geography.js`):

```sh
python -m http.server 8000
```

Open `http://localhost:8000/` and `http://localhost:8000/river-lab.html`.

Run fast geometry unit tests:

```sh
npm test
```

Manual visual regression: enable natural waterways, find a waterway, inspect pond mouths, travel across 4.096 km stream-cell boundaries, change terrain detail and view distance, and compare sediment / water placement / tree anchors. Repeat with several seeds.

## Still required for the full Alpha 4 architecture

### Stage 2 — global routing
The existing 16.384 km macro watershed and 65.536 km regional routing calculations terminate at provisional boundaries. Build a deterministic multi-region routing contract and reconcile flows, outlet identity, discharge and elevation across boundaries. Test negative coordinates and traversal-order independence. A regional macro grid must **not** be silently treated as an ocean.

### Stage 3 — real basins
The current pond selection widens connected channel reaches, and is **not** a general lake solver. Add individually identified pond/lake water bodies with stable flat water elevations, polygonal/contour shorelines, bathymetry, inlets and outlets. Closed depressions must be classified rather than automatically connected to the sea.

### Stage 4 — geometry near water
Replace uniform near-field tile subdivision with feature-aware shoreline constrained meshes, consistent edge stitching and nearby-vs-distant feature LOD. The bank and water mesh should be derived from the same boundary geometry; don't rely on a ribbon hovering over coarse terrain.

### Stage 5 — material, ecology, performance
Use shared feature queries for bank materials, vegetation exclusion, wet soils, rocks, movement and collision. Remove competing legacy hydrology implementations after reference-seed visual comparisons; limit cache growth and move expensive watershed work off the main thread where supported.

## Compatibility and limitations

- No changes to `main`; this is an opt-in development branch.
- Existing seed / heightfield / quadtree / movement behavior are preserved.
- This branch does **not** yet solve planet-wide watershed continuity, independent lakes, seasonal flooding, or hydraulic erosion.
- Wider pond reaches may still inherit sloping river surface elevations; a true basin water level is the next milestone.
- Rendering and cross-region behavior require browser inspection in addition to code-level checks.
