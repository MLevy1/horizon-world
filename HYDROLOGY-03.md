# Horizon 0.3.1 — One drainage graph for terrain and scenery

The 65.536 km × 65.536 km atlas graph is now solved **before** the
first 3D terrain tile. The same solved graph supplies world-space drainage
features to the final terrain sampler (`hydrology-terrain.mjs`).
Terrain meshes, vegetation roots, tree exclusion, rocks, collision and
walking/flying ground-height queries all use that sampler.

The module spatially indexes the atlas's connected channels. It makes modest
erosion cuts into the seeded base terrain, with no local watershed solves and
no flow-area reset at rendering-tile boundaries. Old regional drainage map
options, legacy River Lab pilot and experimental river-water switch are
disabled in the player interface. The Atlas is the supported flow inspection.

**Important limits:** This is a bounded geographic model, not infinite
planetary hydrology. The original base terrain remains outside the domain,
and erosion blends out near its boundary. The 256 m network resolution is
insufficient for finished river meanders or realistic riverbanks. The graph
does not yet determine retained lakes, overflow heights or precise water
surface elevations, so **inland water isn't rendered**. Oceans are preserved.
Dormant old river-generation code remains in the source for careful removal
after mobile testing; it is no longer on the active terrain path.

Tests cover atlas receiver consistency, seed determinism, bounded erosion,
and continuity at rendering-tile boundaries.

Next: basin storage/overflow, a finer connected channel graph, shared
terrain-and-water geometry, then retiring dead legacy modules.

Run `node --test tests/hydrology.test.mjs tests/hydrology-terrain.test.mjs`.
