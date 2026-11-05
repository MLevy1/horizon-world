# Horizon 0.3.0 — connected hydrology foundation

The new [hydrology atlas](hydrology.html) operates on a **bounded**
65.536 km × 65.536 km geographic region, using a shared 256 m grid
(65,536 cells). The entire domain is solved at once. No drainage statistics
are restarted at the smaller terrain rendering tile boundaries.

## Implemented
- Broad relief sampled from Horizon's same seed-based terrain formula.
- One whole-domain priority-flood determines drainage receivers and fills
  local sinks for routing. The resulting directed graph is acyclic.
- Catchment area is accumulated from upstream to downstream.
- Sea outlets and unresolved outer-boundary outlets are distinguished.
- Three interactive atlas views: elevation, drainage and outlet basins.
- Select any location; see coordinates, elevation, contributing area, outlet
  type, and inspect the continuous upstream/downstream tracing.
- Pure hydrology model, independent of Three.js, rendering, terrain tiles and
  water materials. Tests cover connectivity, downhill flow and tile seams.

## Important limits
This is **not yet an infinite or planetary world hydrology solver**. The
modeled area is bounded. Rivers that reach land edges are marked unresolved;
we do not assert what happens beyond the domain. Priority-flood filling
implies possible depressions, but lakes, sediment, physical erosion and
seasonal discharge are not independently modeled. Flow quantity is currently
upstream area (km²), not volumetric discharge.

The existing Horizon exploration world is preserved for comparison. The
experimental 3D river toggle remains off by default and has not been rebuilt
around the new hydrology data.

## Next steps
- Reconcile outlets when expanding the geographic coverage.
- Classify standing-water basins, retained lakes and overflow outlets.
- Generate channel dimensions from accumulated contributing area.
- Carve final terrain and floodplains from the resolved connected graph.
- Create water meshes only from that final geography.
