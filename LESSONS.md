# Horizon — Lessons carried into the 0.1 restart

This is a synthesis of the repository's commit history (172 commits on `main` at the time of review, plus separate development-branch work), its four pull requests, and representative source changes. It is **not** a claim that every commit improved the visible game. Commits establish what code changed; visual success requires a browser/screenshot check.

## What deserves to survive

1. **Determinism is foundational.** Terrain, drainage, trees, and colors must depend on seed and absolute world coordinates, not on tile load order or camera position. The early terrain/forest work repeatedly corrected tile-boundary inconsistencies (Alpha 0.8–1.1).
2. **Geographic features come before rendering.** The Alpha 3.13 watershed work established a coherent drainage graph; Alpha 4 introduced shared geography, and Alpha 5 finally made drainage feed final terrain elevation. That *dependency order* matters more than any of those implementations.
3. **Ocean/land classification is a useful invariant.** Broad elevations intersecting one sea level produce coastlines naturally. Inland lakes and rivers must eventually be modeled with the same level of geographic authority—not with decorative overlays.
4. **River Lab was successful partly because it was constrained.** Its sequence from sub-meter headwaters to widening tributaries, controlled cross-sections, pond inlets, and unified water surfaces (River Lab 1.4–1.10) produced specific inspectable changes. Keep isolated tests for uncertain geometry, but do not maintain a second permanent game engine.
5. **Separate 'potential drainage' from 'visible water.'** A runoff path is not necessarily a perennial stream. Many versions drew blue lines for lines too narrow or too intermittent to justify visible water.
6. **Geometry and display resolution are inseparable.** A 1 m channel cannot reliably be represented by terrain triangles several meters wide without constrained topology or appropriate sub-grid detail. Both water and banks need consistent contours and tile boundaries.
7. **Scenery must be anchored to displayed ground.** Repeated Alpha 1.4–2.8 and 5.1–5.2 fixes were necessary because the physical elevation function and rendered triangles disagreed. A single, explicit display-surface query prevents floating trees and grass.
8. **Performance has to be an initial constraint, not a last-minute patch.** Mobile instancing, bounded geometry work, deterministic caching, and profiling were important. The 32 km watershed solver and expensive test workflows showed the cost of letting computation spread invisibly.
9. **The browser is part of validation.** Shader compilation, mobile controls, cached modules, transparency and water/ground z-fighting can all pass geometry tests and still look broken on an iPhone. A passed CI run is not proof of visual quality.
10. **The repository workflow should match the actual project.** Many commits and preview copies were testing/packaging changes rather than meaningful simulation improvements. For a single-person, rapidly iterated visual prototype: one primary version, one URL, a compact test suite, and descriptive commits are enough.

## What we are deliberately *not* copying

- The previous 185 KB `index.html` monolith and its web of overlapping pilot flags and old debug toggles.
- Region-local drainage outlets masquerading as ocean outlets.
- Freestanding river ribbons forced into independently generated terrain.
- Hard minimum stream width, hard opacity switches, fixed-depth trenches, or pond surfaces disguised as widened river strips.
- Several permanent preview copies, multiple active hydrology branches, and automatic deployment re-triggers for every small file change.
- Automatic claims of success based only on tests or code review.

## Architecture contract for the new engine

```
seed + broad relief
       ↓
priority-flood drainage graph and true outlet identity
       ↓
final ground elevation (including valleys)
       ↓
rendered terrain + coastline + grounded scenery
       ↓
future: perennial-flow classification + bathymetry + continuous water geometry
```

The drainage graph is immutable for a given seed. The renderer cannot change flow. Every later water feature must have a real bed, an explicit surface elevation, and a consistent inlet/outlet relationship **before** being rendered.

## Version 0.1 deliberately small

- One **finite** 8 × 8 km region, seed 42.
- Broad hills, coast, ocean, valleys, terrain colors and simple forest.
- Priority-flood runoff graph calculated before final terrain; map displays its sea-connected routes.
- Mobile/desktop fly controls, world coordinates, and map travel.
- No 3D river water, lake/pond surfaces, building, or procedural infinite-world streaming yet. The absence of those features is intentional, not hidden.
- No GitHub Actions workflows. Simulation tests run locally with `node --test tests.mjs`.

## Next gates (not promises of visual quality)

**0.2:** agree on representative test river and validated 2D channel planform/flow boundaries.
**0.3:** render one near-field channel with a submerged bed and continuous water surface, inspected above and below water.
**0.4:** tributaries and mouths, then lake basins.
**Later:** streamed scenery, LOD and extended geography after the above is reliable.

## Source milestones reviewed

- Initial commit `15f32434b` and Alpha 0.8 `2cb8fbfcd`: minimal app and tile streaming.
- Alpha 3.13 `c003e5ec0`: connected watershed graph.
- River Lab introduction `53d3a776c` and river/pond unified surface `8a0bd2618`.
- Alpha 3.19 `33ffaa2b2`: joined river runs.
- Alpha 4 geography `d10b05c5d` and Alpha 4.3 merge `009d5f0ce`.
- Alpha 5 geographic pipeline `e41a5926`.
- Alpha 5.4 shared-triangulation attempt `7bc44bf3` and rollback `de1e754e2`.

Git history remains accessible for forensic reference. Replacing the project files is **not** the same as deleting history; history rewriting should be a separate deliberate decision.