# Horizon restart — saved task checkpoints

The requested result is one complete, connected hydrology map of a closed
planet. Every stage works on the entire planet. No bounded trial regions.
Detailed terrain, vegetation and the old explorer are excluded from the new app.

1. **Global solver — completed.** `planet.mjs` implements the full spherical
   drainage model. `planet-worker.mjs` computes it off the UI thread.
   `tests/planet.test.mjs` passes eight tests covering the full default planet,
   connected ocean, reciprocal longitude/polar topology, pond/lake outlets,
   compact network coverage, runoff/area conservation and seed determinism.
   Default: 1,179,650 cells, 10,342 headwaters, 14,014 stream reaches,
   1,734 river reaches, 320 ponds, 324 lakes, 2,345 ocean mouths.
   No unresolved inland terminals, cycles or uphill links.
2. **Hydrology map — viewable checkpoint.** The standalone full-planet atlas is
   published on GitHub Pages for inspection. Visual refinement is still pending.
3. **Inspection and touch controls — pending.** Check tracing to ocean,
   catchment highlighting, map/globe navigation and responsive layout.
4. **Pages viewer — published.** The existing main page now opens the
   hydrology-only atlas. Retired terrain/explorer source has been removed.

The current atlas is available at https://mlevy1.github.io/horizon-world/?v=0.7.8.
It displays the complete global solver, with no detailed terrain or vegetation.
This is a viewable work checkpoint; the remaining visual and touch-control
review continues in small tasks.

## Climate checkpoint — 0.5.0

Completed: visible global temperature, precipitation and moisture/aridity layers;
climate-dependent runoff; annual evaporation budgets; contracting lakes, closed
basins, playa estimates and active flow destinations. Potential overflow routes
remain globally connected. Dashed waterways indicate annual estimates of seasonal
or ephemeral flow; dormant spills are a separate optional layer.

The full default planet and an alternate seed pass twelve tests. Tests include
annual precipitation conservation, zero/energy-limited runoff cases, lake
contraction versus sustained overflow and valid closed-basin destinations.

Snow and glacier storage are completed in the next checkpoint below. No
detailed terrain, vegetation or active lava simulation is part of this checkpoint.

## World contract

A fictional closed planet, radius 64 km (128 km diameter), 402.124 km
circumference, 51,471.854 km² surface. The staggered triangular grid has
1,536 × 768 cells plus two unique polar nodes. Equatorial spacing is 261.8 m;
latitude cell areas integrate the spherical surface. Zooming never changes
the solved network. The grid resolution is explicit; subcell waterways are
not represented.

The largest connected below-sea-level component is the ocean. Priority-Flood
resolves every inland cell to its lowest escape level. Enclosed depressions
retain flat water surfaces and one spill outlet each. Ponds have mapped area
below 0.35 km²; larger waterbodies are lakes. Annual rainfall produces steady
runoff partitioned against evaporative demand, accumulated globally without
tile boundaries. Lake inputs, open-water evaporation and outflows balance.
Closed basins retain water below their possible spill; available runoff is
accounted for by liquid runoff, evaporation, sublimation, retained ice,
seasonal snow storage changes and sea calving. Dynamic river seasons and
groundwater remain future tasks.

Algorithm background: Barnes, Lehman & Mulla (2014),
[Priority-Flood](https://doi.org/10.1016/j.cageo.2013.04.024).
The implementation is original and uses the closed spherical mesh.

Run the completed solver checks with:

```sh
node --test tests/planet.test.mjs
```

## Snow and glacier checkpoint — 0.6.0

Completed: monthly snow accumulation/melt and sublimation, glacier/ice region
inventory, downward ice routing, explicit retained ice, sea calving, meltwater
supply to the existing hydrology graph, snow/ice and meltwater map views, and
melt-outlet inspection shortcuts. This covers the complete planet.

Default seed: 66 modeled glacier/ice regions, about 3,310 km² of glacier region
and 9,077 km² with modeled snow. Newly retained ice is about 0.323 km³ per modeled
year. These are procedural estimates; the ice-routing retention fraction is an
explicit parameter. Detailed glacier movement and ice-surface deformation are
not simulated. All 15 tests cover both the original global model and the new
snow, seasonal, glacier and combined water-budget checks.

Volcanic locations and geography are completed in the checkpoint below.
Detailed terrain and vegetation remain outside this hydrology-first map.

## Volcanic geography checkpoint — 0.7.0

Completed: deterministic volcanic belts/hotspot chain placement across the
complete sphere; composite cones, shields, calderas and cinder cones; cooled
lava-deposit paths; elevation changes applied before the global water solve;
geology map view, centre markers and inspection shortcuts. The current default
has 22 volcanic centres, 38 cooled deposit paths and 14 summit/crater basins.
A basin may be wet or dry under the modeled climate.

All 19 tests cover the original hydrology/climate/snow model and volcanic
profiles, spherical footprint continuity, descending pre-deposit lava paths,
linked water inventories and demonstrable changes to globally solved drainage.
The site retains its 128 km diameter and 1,179,650-cell global network.

## Next work — small, resumable chunks

The previous proposed geometry checkpoint bundled too much work into one turn.
It is replaced by the tasks below. Each row is a separate work session and saved
commit, with a brief handoff recording what passed and the next task. Stop after
one row; do not expand the session to include the next row. Publish visible
changes through the existing GitHub Pages workflow.

All production features still cover the complete planet. Smaller tasks refer to
the implementation scope, never bounded map regions. Focused automated examples
support, rather than replace, complete-planet validation.

| Task | Scope | Completion check |
| --- | --- | --- |
| 1a. Basin structure — completed in 0.7.1 | Inventory local depressions and the ridges/spill connections inside every potential lake basin. Preserve the current viewer while adding this foundation. | Deterministic inventory for the full planet; every connection uses adjacent mesh cells. |
| 1b. Independent pools — completed in 0.7.2 | Solve water levels and exchanges between depressions, allowing a contracted lake to separate into pools at different levels. | Conservation and spill-direction checks, including independent closed pools and merging when water reaches a connecting ridge. |
| 1c. Global lake integration — completed in 0.7.3 | Connect those pools to active global drainage, channels and the atlas inspector. | Full-planet water budget; every active path ends at an ocean or a valid closed pool; no drainage cycles. Publish the lake checkpoint. |
| 2a. River profiles — completed in 0.7.4 | Establish shared river water heights, bed depths and widths along the entire active network. | Water never flows uphill; junctions share heights; beds remain below water. |
| 2b. Profile inspection — completed in 0.7.5 | Add a river cross-section/profile view using those shared definitions. | Inspector displays the same geometry data that terrain generation will consume. Publish the river checkpoint. |
| 3a. Terrain sampling — completed in 0.7.6 | Add one spherical terrain-and-water sampler used across the whole world. | Consistent values across longitude wrap and at both poles; river/lake contacts agree. |
| 3b. Physical shorelines — completed in 0.7.8 | Derive lake/ocean shores and river contacts from that shared surface. | Shore heights agree with water levels; no separate overlapping water patches at mouths. Publish the shoreline checkpoint. |
| 4a. Bare global mesh | Build the full-planet land and water meshes from the shared sampler. | Complete spherical coverage and connected water geometry; no vegetation or decorative terrain detail. |
| 4b. 3D navigation | Add navigation and inspect the bare world at global and local scales. | Usable navigation and visible terrain/water joins on the published Pages viewer. |

Task 1a, saved in **0.7.1**, adds `basins.mjs` and the model's
`basinStructure` inventory: local-depression membership, downhill paths, pit
elevations, lowest saddle connections and the existing potential outer spill
for every lake/pond basin. Equal-height components route toward lower edges
where present; enclosed flat floors share one pit. This inventory does not
change the current water levels, annual budgets or displayed drainage.

Verification: all **25 tests pass**, including full-default-planet cell coverage,
connected basin graphs, exhaustive lowest-saddle checks, same-seed inventory
determinism, a second complete planet, flat floors/shelves, seam wrapping and
polar connections. Existing hydrology, climate, snow and geology checks pass.
The static build succeeds and the browser worker finishes the full planet.

Task 1b, saved in **0.7.2**. `pools.mjs` solves separate annual
pool levels, directed spill exchanges and connected-pool merging throughout
the complete basin inventory. `model.poolBalances` contains the results and a
separate conserved global liquid-runoff budget through potential outer spills.
The displayed water model and active cell receivers remain the 0.7.1 model.

The fixed one-metre fractional wet-area ramp makes evaporation continuous under
merging. Stored volume integrates that same area-stage relationship. Empty
pools stay dry; supplied pools can spill toward a lower pool without forcing
equal levels; sufficient supply can join pools and eventually overflow the
outer basin. Equal-height saddle ties use deterministic mesh-edge IDs.

Verification: all **34 tests pass**. New checks cover distinct pool stages,
reverse-direction spill exchange, merging with and without outer overflow,
zero input/zero evaporation, equal-height saddle ties and consistent wet
area/stored volume. Complete-planet checks independently recalculate pool
evaporation and wet areas and verify the global liquid budget. Existing tests
also exercise another full planet and same-seed determinism. The static build
succeeds and the browser worker completes the entire default planet.

Task 1c, saved in **0.7.3**. Solved pool levels and spill directions
now drive `receiver`, `level`, `waterbody`, channel extraction, catchments and
the atlas. `lake-routing.mjs` routes each pool catchment toward its actual wet
footprint and outlet. Closed pools own real sinks; the compact active network
ends at an ocean or a closed pool. Exposed basin margins can carry streams.
The original potential graph is preserved separately. Dormant spills are
optional adjacent-edge overlays, never active flow links.

The default planet has 679 original basins and 1,052 resolved pools, with 123
basins split into multiple pools. Catchment area delivered to the ocean plus
area terminating at closed pools equals all land area. Active water fluxes agree
with the independent pool budgets. Drainage/water levels use double precision
so small stage differences at high elevations do not create rounding slopes.

The atlas offers a split-basin shortcut and an Inspect next pool control, with
pool counts, separate levels, spill heights and current destinations. Pond/lake
counts use actual wet area; dry/playa pools are counted separately.

Verification: all **36 tests pass**, including independently checked connected
wet footprints, routing over dry margins, closed-pool sinks, channel coverage,
potential-spill separation, complete-planet conservation and another global
seed. The static build succeeds. Map inspection verifies distinct pool levels
and the pool navigation control.

Task 2a, saved in **0.7.4**. `river-profiles.mjs` defines shared
water heights, bed elevations, widths, design depths and directed longitudinal
segments for the complete active network. The default has 84,959 channel cells
and 85,338 adjacent profile edges, including active lake outlets. Lake/ocean
levels and receiving-bank spill crests anchor the same shared vertex data used
at junctions. Dry channels retain explicit dry flags.

Dimensions are documented procedural parameters based on mean annual flow.
They are not a calibrated hydraulic model. Channel beds are design cuts; the
underlying elevation scaffold and hydrology budgets are unchanged. Local bank
shaping and river/lake shoreline intersections belong to later geometry tasks.
The atlas still uses schematic line widths; no profile viewer is added here.

Verification: all **44 tests pass**, covering global channel coverage,
non-rising water profiles, submerged beds, exact confluence endpoints, lake
backwater, receiving-bank spill crests, dimension bounds, dry edges, lake-port flow accounting and wet spill crests, another
complete seed and deterministic generation. Existing global budgets remain
conserved.

Task 2b, saved in **0.7.5**. The atlas offers Inspect river profile
on river cells and active lake outlets. Its dialog shows a downstream elevation
plot, a slider, current dimensions and an illustrative minimum channel section.
Routes follow the saved global edges and stop at the next lake or ocean.
Cross-section dimensions are read from the same saved profile data. Deeper
lake/ocean beds remain in the longitudinal chart and actual-depth readouts;
the minimum design diagram does not depict them as narrow channel trenches.
Dry design sections use dashed levels and no filled water. Axes use independent
horizontal and vertical scales. Terrain banks/shorelines are not sampled yet.

Verification: all **50 tests pass**, including complete-planet inspection-route
coverage of every profile edge, exact terminal contacts, distance/station
interpolation, dry styling, section dimensions and deeper waterbody contacts.
Existing global topology and budgets remain unchanged. The static build and
browser inspection verify opening the dialog and updating stations.

Task 3a, saved in **0.7.6**. `surface-sampler.mjs` exposes one
read-only global query for scaffold elevation, standing-water planes and nearby
channel profile/design data. It uses the real spherical triangular mesh and
projective interpolation, with unique polar caps and longitude wrapping.
Compact trigonometric caches and a 3D bucket index cover all 85,338 active
profile edges. The index includes arc curvature and bank-support bounds; it
never clips a search to a geographic test region.

The atlas adds a Surface sample readout. Map clicks probe their continuous
coordinates; shortcuts probe the selected node. Scaffold, standing water and
river design are intentionally separate query fields at this stage. The
sampler does not yet carve banks, blend river/lake surfaces or create meshes.

Verification: all **57 tests pass**. Every default-planet scaffold vertex is
reproduced; every profile midpoint and canonical endpoint is found; wet pool
nodes keep their own water plane and exposed margins remain unfilled. Tests
also cover shared-edge interpolation, all latitude bands, wrapped longitudes,
both poles and invalid queries. Existing hydrology/budgets are unchanged.
The static build succeeds; browser probes verify both a channel node and an
arbitrary off-node ocean coordinate.

Previous checkpoint: **0.7.7**, task 3b1. `water-contact.mjs` fits profiles to
actual scaffold shore crossings and combines channel cores/banks with fixed
water planes. Surface queries now include a `fitted` ground/water/depth result.
Overlapping channel patches blend through shared anchors. Standing water stays
flat and submerged ground is never filled by a channel bank. Dry designs stay
dry unless standing water occupies an opened shoreline throat.

The Surface sample block is moved near the top of the inspector. It reports
scaffold elevation, fitted ground, standing/fitted water levels and fitted water
depth. The separate river design viewer retains the original design profiles.
The fit does not rewrite receivers, annual budgets or reservoir inventories.

Verification: all **67 tests pass**. Complete-planet checks cover every profile's
anchors and downhill contact fitting, all channel midpoints, all wet pool nodes,
and both sides of every represented shore intersection through its center and
lateral banks. Focused checks cover overlap order, dry designs, shoreline
continuity and protection from submerged bank fills. Existing topology, climate,
snow, geology and water-budget checks pass. The static build succeeds.

Current checkpoint: **0.7.8**, task **3b2 complete**. `shorelines.mjs`
extracts lake/ocean contours from the same spherical geometry and fixed planes
used by fitted queries. Shared vertex IDs close the rings across longitude and
polar fans; touching saddle lobes remain separate closed rings. Channel cores
cut paired portals rather than receiving a shoreline across their mouths.

`water-scaffold.mjs` closes geometric support gaps beyond discrete pool masks
and supplies shared separating saddles where independent pool levels meet.
These constraints affect the shared geometry, not the drainage graph or annual
water accounting. `packShorelines` transfers compact path coordinates from the
worker. Physical shores are visible by default in both atlas projections.
The original water fill is still the cell texture; the bare mesh is task 4a.

Verification: **74 tests pass**, including all default-planet exposed shore
vertices and span midpoints (within 1 cm of their fixed plane), paired portal
endpoints, all global contour edges accounted for once, an alternate full-size
seed with touching saddle lobes, polar/seam triangulation and a narrow off-centre
channel opening. Existing water, snow, geology and river-profile checks pass.
Adaptive unresolved tangencies are at most 2 cm long; these are numeric, not
physical-accuracy promises.

**Next task: 4a, bare global mesh only.** Consume these shared geometry queries,
shore paths and portal constraints for full-planet land and water meshes.
Keep 3D navigation (4b), vegetation and decorative detail as separate work.
