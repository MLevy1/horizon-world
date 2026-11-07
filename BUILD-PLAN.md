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

The current atlas is available at https://mlevy1.github.io/horizon-world/?v=0.7.15.
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

The complete water/climate/elevation model remains global. Terrain geometry is
requested in connected chunks at the resolution needed for the view. Every
world location uses the same global fields and shared border rules. Automated
fixtures supplement complete-planet model checks.

| Task | Scope | Completion check |
| --- | --- | --- |
| 1a. Basin structure — completed in 0.7.1 | Inventory local depressions and the ridges/spill connections inside every potential lake basin. Preserve the current viewer while adding this foundation. | Deterministic inventory for the full planet; every connection uses adjacent mesh cells. |
| 1b. Independent pools — completed in 0.7.2 | Solve water levels and exchanges between depressions, allowing a contracted lake to separate into pools at different levels. | Conservation and spill-direction checks, including independent closed pools and merging when water reaches a connecting ridge. |
| 1c. Global lake integration — completed in 0.7.3 | Connect those pools to active global drainage, channels and the atlas inspector. | Full-planet water budget; every active path ends at an ocean or a valid closed pool; no drainage cycles. Publish the lake checkpoint. |
| 2a. River profiles — completed in 0.7.4 | Establish shared river water heights, bed depths and widths along the entire active network. | Water never flows uphill; junctions share heights; beds remain below water. |
| 2b. Profile inspection — completed in 0.7.5 | Add a river cross-section/profile view using those shared definitions. | Inspector displays the same geometry data that terrain generation will consume. Publish the river checkpoint. |
| 3a. Terrain sampling — completed in 0.7.6 | Add one spherical terrain-and-water sampler used across the whole world. | Consistent values across longitude wrap and at both poles; river/lake contacts agree. |
| 3b. Physical shorelines — completed in 0.7.8 | Derive lake/ocean shores and river contacts from that shared surface. | Shore heights agree with water levels; no separate overlapping water patches at mouths. Publish the shoreline checkpoint. |
| 4a1. Mesh foundation — completed in 0.7.9 | Build the entire ground scaffold and fixed lake/ocean sheets with shared shore vertices. | Closed global indexed ground; shared shore positions; preview actual buffers on Pages. |
| 4a2a. Global channel constraints — completed in 0.7.10 | Define shared junction anchors, core/bank sampling stations, terrain-face references and links to all standing-water openings. | Every global profile covered; sampled constraints agree with the shared fitted surface and can be inspected. |
| C1. On-demand ground chunks — completed in 0.7.11 | Replace detailed whole-planet triangulation with globally addressed ground chunks and shared borders. | Identical same-level borders, correct 2:1 stitched edges/corners, local inspection and bounded cache. |
| C2. Chunk water surfaces | Clip and join river/lake/ocean water within the same chunks. | Shared terrain/water boundary vertices, level standing water, continuous junctions and chunk borders. |
| C3. Streaming and LOD | Select/evict chunks around the camera and balance neighboring detail levels. | Bounded mesh memory, stable transitions and full global addressability. |
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

Previous checkpoint: **0.7.8**, task **3b2 complete**. `shorelines.mjs`
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

Previous checkpoint: **0.7.9**, task **4a1 complete**. Task 4a is split into
foundation and river integration so one turn remains a small global checkpoint.
`mesh-foundation.mjs` builds the complete indexed ground and lake/ocean sheets.
It clips both surfaces at identical shore vertices and preserves shared saddle
constraints. Every source cell and spherical face is included. The default has
2,469,672 ground and 1,569,797 standing-water triangles (~107.1 MiB).

Map layers → View mesh foundation opens the actual buffers with simple globe
orientation controls and a water toggle. A WebGL renderer and a software
compatibility renderer use the same data. The atlas remains available. The
preview clearly labels the missing 4a2 channel integration; it does not present
this scaffold as a finished river/terrain mesh. Detailed navigation stays 4b.

Verification: **78 tests pass**. Ground edges each have exactly two incident
faces and Euler characteristic 2; every source node is used. Every water-boundary
vertex exactly matches a ground vertex at its fixed water level. All geometry
is finite, indexed and outward-facing. Double positions avoid losing very thin
shore triangles, and pool-specific caches preserve touching independent pools.
Software rendering checks cover depth, water visibility and opposite hemispheres.
Existing global hydrology, climate, snow, geology and shoreline checks pass.

Previous checkpoint: **0.7.10**, task **4a2a complete**. River mesh integration
is split into global constraints and their triangulation to keep each checkpoint
small. `channel-constraints.mjs` covers all 85,338 profile links, 89,897 endpoint
anchors, 7,818 shared junctions and 261,899 saved sections. Each link references
two actual spherical faces. Endpoints, midpoints and intermediate shore contacts
are retained; incident edges share their centre anchor IDs.

All 6,110 standing-water opening records retain their source path references and
contributing channel links. Open portals have paired endpoints; closed loops use
a shared seed without pretending the whole submerged loop is a dry shoreline.
Nine-point cross-sections are procedural definitions sampled through the shared
fitted surface when consumed. Saved typed data adds about 20 MB. No hydrology or
budget changes, new regions or detached water-strip geometry are introduced.

Map layers → Inspect fitted channel opens actual fitted samples. The original
river designs remain expandable. The route slider now steps through saved
sections, so exact contact stations can be selected. Wet outer samples stay wet.
The separate bare-planet preview is still the 4a1 foundation.

Verification: **85 tests pass**, including every global profile's two face
references, full face numbering at seam/poles, all endpoint/contact stations,
shared junction IDs, all saved fitted values and all nine-point cross-sections.
All source opening records link to channels and retain their endpoint/loop
geometry. Existing mesh topology and hydrology checks pass. Browser inspection
confirms a fitted channel section, fixed ocean contact and retained design plots.

Current checkpoint: **0.7.11**, **C1 complete: global simulation with on-demand
terrain geometry**. Full-resolution whole-planet mesh generation is replaced
by connected cube-sphere chunks. The published 0.7.9 reference builder remains
for regression checks, but it no longer runs on page startup. The existing
map/globe provides the global overview, and all hydrology remains authoritative.

`terrain-chunks.mjs` gives every world position a dyadic tile address. Integer
direction keys agree across cube seams, polar faces and LODs. Shared samples
come from the same fitted query; 2×2 triangle fans stitch a fine edge directly
to a neighbor one level coarser, including multi-edge corners. Automatic LOD
selection is separate; the inspector currently draws a uniform-level patch.

Map layers → Inspect terrain chunks requests the selected place or river.
View detail, cardinal movement and oblique/top-down controls inspect actual
ground geometry. A typical view has 13 connected chunks, 106,496 triangles and
~3.3 MiB of mesh data. A persistent worker builds these requests with a bounded
65,536-sample LRU cache. It is reset when the world changes. The previous large
3D mesh is no longer built/transferred during initial generation.

Verification: **96 tests pass**. All six face seam/corner rules, neighbor
reciprocity, fine/coarse segment matching, every stitching-edge combination,
closed-sphere assembly, actual global field samples, disabled-cache border
identity and bounded cache behavior are checked. Wet/dry rivers and both poles
produce local patches. Existing hydrology, climate, geology, shared profile and
shoreline checks pass. Inspection lighting and local camera centering are tested.

**Next task: C2, chunk water surfaces.** Clip water to the fitted ground within
the same globally addressed chunks, preserving level standing-water surfaces,
river junctions and border continuity. Then implement C3 camera-driven streaming
and balanced LOD selection. Keep vegetation and decorative detail separate.


## C2 — clipped chunk water, 0.7.12

Completed: unified river/lake/ocean triangles clipped against fitted ground,
shared shoreline roots, fixed standing-water levels, downhill sampled river
heads, exact independently built borders and stitched 2:1 LOD borders. Dry
channel designs do not become water. Incompatible fixed heads request finer
sampling and are flagged if still unresolved at the resolution cap. The
inspector adds a Water surfaces toggle and separate water triangle counts.
Global surface normals smooth lighting consistently across chunk boundaries.

Natural shape refinement remains required: smooth lighting does not establish
realistic geography. Refine courses, bank asymmetry, shore outlines, valleys,
ridges and erosion/sediment forms in the common surface. No decorative detail
or vegetation has been added. Next small task: C3 camera-driven streaming and
balanced LOD selection.

Verification for 0.7.12: **106 tests pass**. New checks cover fixed-level
shore intersections, dry designs, downhill heads, ambiguous fixed planes,
shared shore roots, global normals across LODs, cube-face and stitched LOD
water borders, actual planetary ground/water edge topology and a real closed
lake's independent level. Build and whitespace checks pass.


## C3 — camera-driven chunk streaming, 0.7.13

Completed: camera-driven mixed LOD selection, balanced 2:1 edges across all cube
faces, bounded reusable chunk geometry (16 MiB LRU), one active worker request
with latest-view coalescing and stale-response rejection. Drag/touch, scroll,
keyboard, zoom buttons and presets navigate the inspector. Existing water and
ground clipping/stitching are used without a separate regional simulation.
The last complete view stays visible until its replacement is ready; continuous
first-person movement is later work. Closing the inspector releases caches.

Verification: **114 tests pass**. Selection partitions its roots without overlaps
or missing area, neighboring leaves stay 2:1 balanced, and assembled mixed-detail
meshes have no internal cracks at face corners, polar areas and shores. Transfer
and eviction preserve geometry. Rapid requests coalesce and old-world replies
cannot install themselves. A real default-planet river uses mixed detail and
reuses chunks after camera movement. Build and whitespace checks pass.

Next small task: natural landform shaping in the shared global surface. Start
with continuous river courses and asymmetric banks while preserving downstream
profiles, junction anchors and standing-water contacts. Then refine irregular
shorelines, valley/ridge structure and erosion/sediment forms. Keep these shared
between geometry, water clipping and inspection; avoid a detached showcase or
random noise intended only to disguise the underlying grid.


## D1 — shared river courses and banks, 0.7.14

Completed: a single complete course graph consumed by the atlas, fitted queries,
constraint stations/sections and chunk meshes. Degree-2 inland nodes can move
by at most 12% of local spacing/incident edge length; bounded spherical Hermite
curves derive tangents from the actual incoming/outgoing network. Sources,
confluences, ports, polar links and standing-water neighborhoods stay pinned.
Existing routing/budget and longitudinal profiles are preserved. This first pass
adds modest curves, not a full meander or erosion process.

Inside/outside waterline widths, slopes, bank spreads and freeboard now vary
with bend direction and bounded coherent seeded variation. Side properties join
at shared nodes and fade at protected contacts/junctions. A width-based physical
normal filter reduces narrow-bank sampling glare consistently across LODs.
The **Find a river bend** control focuses an existing globally solved wet bend.

Verification: **120 tests pass**, including both global quarter stations on every
profile, canonical shared endpoints, bank joins, projection, pinned contacts and
seed determinism. Existing hydrology, shore/portal, chunk/LOD and mesh topology
checks pass. All saved fitted points use actual curved locations. Original face
references and longitudinal lengths remain routing-design provenance.

Next small checkpoint: broaden the channel-shaped ground into coherent valley
floors and shoulders, preserving water profiles, shared nodes and shore contacts.
Independent ridge/erosion/sediment structure and irregular standing shores follow.


## Bank and bend correction — 0.7.15

Ordinary inland banks now transition monotonically from waterline to surrounding
higher ground, removing the artificial raised berm. Standing-water contact
fitting retains its existing rules. Inland node smoothing and curve control
bounds increase from 12% to 18% of local spacing so turns have more room to round;
junctions, sources, ports and protected water-contact neighborhoods stay pinned.

The inspector samples 64 subdivisions per chunk instead of 32. This costs about
four times as many base triangles per view but resolves narrow banks and curved
waterlines more closely. The reusable chunk cache is bounded at 32 MiB and the
refinement input budget is 1.2 million triangles. These limits describe geometry,
not total application memory. This correction does not finish landscape realism.

Verification: **121 tests pass**, including a new monotonic inland-bank check.
The same global bend was compared visually before publication. Remaining
terrain shaping and final appearance are still unfinished.


## Pivot to walking the world — 0.8.0

The terrain explorer becomes the default page. The atlas remains a separate
map/inspection tool at atlas.html. Exploration startup solves the same global
planet but skips expensive saved inspection sections and physical shoreline
extraction. Its worker retains the complete model and streams small mesh views
with a bounded reusable tile cache. This is global exploration, not a new region
or a separate showcase generator.

Completed for this checkpoint: first-person perspective, drag look, keyboard and
touch walking, visible-mesh ground collision, automatic near/far terrain loading,
whole-world click/touch travel, and actual region destinations. Colors identify
snow/ice, dry climate and cooled lava. A software perspective renderer supports
browsers without WebGL2. The first-person camera is 1.7 m above the visible ground;
steep steps are blocked. Submerged beds remain walkable; swimming and jumping
are not implemented. Draw distance is currently 260 m with fog.

Validation is limited to essential movement/collision/join checks and direct
browser exploration. No further hydrology-refinement work is part of this step.
Next work should be driven by walking: performance and distant terrain first,
then landscape forms and visual improvements noticed from ground level.

Browser verification: walked over 60 m with streaming, changed view direction,
travelled to volcanic ground, opened the full-world map, and selected another
location whose submerged terrain correctly enabled underwater viewing.
Essential movement/collision/join and request-queue checks pass.


## Ground material checkpoint — 0.8.1

The walking viewer now uses six shared seamless procedural image layers: soil,
sand, rock, snow, cooled lava and wet gravel. Continuous climate, slope and water
contact masks blend them over the existing mesh. World-space projection preserves
texture phase when streamed patches change. WebGL uses triplanar sampling, mipmaps
and small height-derived lighting relief; compatibility rendering uses a simpler
projected, distance-filtered texture path. No extra terrain triangles or external
texture downloads are introduced. The image set plus mips is about 2 MiB, in
addition to material masks and renderer buffers. Textures can be toggled during
exploration without rebuilding terrain.

Water appearance is the next separate checkpoint. This is an initial material
pass; final landforms, lighting, vegetation and photorealism remain unfinished.
Validation covers normalized masks, world phase/mip layout, existing essential
movement/streaming checks, and direct browser walking/visual comparison.


## Water appearance and shallow river access — 0.8.2

Water opacity/color now use the separation between each clipped water vertex and
its actual matching ground vertex. Shallow beds show through; deeper water darkens
and grazing angles reflect more sky. Ground renders before translucent water.
WebGL adds small animated normal ripples and a sun highlight at a maximum idle
water redraw rate of 20 Hz; it does not displace shorelines or water profiles.
Compatibility rendering uses static depth/angle optics and retains redraw-on-input
to avoid adding continuous CPU rasterization cost. No new water geometry is added.

The starting HORIZON-01 bend has about 0.61 m of visible mesh depth, consistent
with its fitted profile (~0.613 m). Its bed existed, but the opaque surface hid it
and a standing 1.7 m eye remained above water. A low crouch (0.45 m eye, slower
walking) now lets you inspect beneath sufficiently deep shallows, with a local
water-depth HUD. C toggles it on keyboard; a touch button provides the same action.
Shallow headwaters remain shallow. Swimming, diving movement, geometric waves,
scene reflections/refraction and flow-aligned rapids remain future work.

Validation: shallow channel mesh/eye/shore integration, essential existing movement
and material checks, and direct browser river entry and posture comparison.


## Rock and boulder checkpoint — 0.8.3

Seeded cube-sphere addresses place irregular clusters throughout the planet.
Slope, riverbank proximity, cooled lava, seasonal snow and glacier coverage
influence density and appearance. Deep water and glacier interiors are excluded.
Each stone varies in scale, proportions, rotation, clipped faces and coherent
surface distortion. Bases are buried into the visible terrain; exposed upper
faces can retain snow. Existing rock/lava textures cover their surfaces.

Only a 155 m neighborhood is materialized. Nearby stones use 320 triangles; beyond
80 m they use 80, with the existing fog masking the outer range. Rock meshes are
batched into one opaque draw before the translucent water. Conservative horizontal
footprints block larger stones; climbing/stepping onto stones and cast shadows
remain future work. Travel/install searches a nearby clear spot when a boulder
occupies the arrival point. Geometry is regenerated from stable IDs, never stored
for the whole planet. No tree or ground-cover implementation is part of this step.

Validation focuses on placement identity across overlapping views, deep-water
exclusion, finite geometry, blocking footprints, and browser inspection/walking.


## Trees and shrubs — 0.8.4

A global seeded placement layer now adds conifers, broadleaf trees and shrubs.
Temperature, moisture/aridity, annual snow, elevation, slope and water proximity
control habitat suitability. Broad coherent patches create gaps and clearings;
individual addresses use jittered cube-sphere cells, independent of terrain LOD.
Water, glacier interiors, steep slopes, fresh cooled-lava deposits and large
rock footprints remain clear. Existing snow-covered starting terrain can remain
treeless. The Woodland destination selects suitable inland climate in the actual
global model, rather than loading a separate vegetation showcase.

Plants have lean, tapered trunks, individually varied lateral branches and open
leaf sprays built from small geometry. There are no solid spherical canopy blobs.
Nearby plants have fuller branching/foliage; distant plants simplify, and only a
140 m neighborhood exists in memory. Trunks block walking and use the existing
clear-arrival search. Shrubs are passable except at their small woody base.
The layer renders as a single opaque mesh batch before water in both renderers.
This first pass establishes placement and silhouettes. Detailed botanical assets,
cast shadows, wind, seasonal changes and grass remain future visual work.

Validation is limited to climate exclusions, stable overlapping-view identities,
finite geometry/budget checks, essential existing movement checks and browser
inspection/walking.


## Woodland density correction — 0.8.5

Suitable woodland now has 12 candidate addresses per placement cell instead of
5, with higher acceptance in moist climates. This targets roughly three to five
times the previous stand density while retaining seeded clearings and habitat
exclusions. Foliage sprays are wider and near crowns fuller. Detailed branching
is limited to 40 m; distant trees use fewer leaf sprays to contain geometry cost.
The global placement identity and collision approach are preserved.


## Woodland canopy reconstruction — 0.8.6

The earlier sapling-like geometry and flat geometric leaves did not establish a
convincing woodland. Mature trees now reach roughly 14–26 m, with thicker leaning
trunks, wider branching crowns and overlapping foliage clusters. A generated
alpha-cutout oak/beech branch texture replaces individual green diamond geometry.
Both renderers sample its real transparent gaps and depth-test the remaining
leaves. Seeded understory shrubs provide a second vegetation height. The same
Woodland destination and global habitat rules are retained.

Broad projected canopy occlusion and dapple variation darken the floor and nearby
rocks. Brown-tinted fallen-leaf texture blends into forest-floor material around
crowns. This is a canopy-light approximation, not full scene shadow mapping.
The material, animated wind, needle-specific conifer assets and botanical models
remain unfinished. At the reviewed HORIZON-01 location, the canopy version keeps
roughly 240 mature trees locally while using about 32,000 plant triangles before
the separate understory pass. Assets are loaded once and shared by all plants.

Validation: stable placement/habitat and essential movement tests; alpha UV and
geometry checks; shader compilation/linking in a standalone GLES context; direct
rendered inspection with the actual compatibility renderer. Browser automation
was unavailable during this checkpoint (repeated service timeouts), so live
browser interaction was not verified.


## 0.8.7 — Ground detail across environments

Preserved the 0.8.6 canopy. Added a separate, seeded near-ground geometry layer: fern rosettes, grass tufts, dry scrub, reeds, branched deadwood and mineral clusters. Moisture, temperature, snow, lava, slope and bank proximity choose the cover. Samples reject water and existing large rock footprints; terrain-ray intersections place bases on the displayed mesh. All detail shares one batch in both renderers, with a 72 m range. No extra movement obstacles.

Validation: habitat, finite/indexed geometry, water exclusion and shared placement identities across streamed views; full-world worker checks at every travel destination. iPhone frame rate and the final appearance on device still require review. Snowfields intentionally keep sparse exposed rock. The existing Volcano travel destination can land on dry terrain outside lava, so its immediate ground may show desert scrub rather than rubble.


## 0.8.8 — Grounded botanical cover and desert structure

Replaced opaque fern and grass triangles with three crossed, alpha-tested botanical cards per clump. A deterministic, mipmapped canvas atlas supplies fine grass blades, fern pinnae and branching dry scrub. Both renderers select the ground atlas independently of tree foliage. Bases sample the displayed ground across each object width, embed 5.5 cm and reject missing ray hits instead of falling back to a potentially floating center height. Pebbles use irregular seven-sided rounded shoulders instead of four-face pyramids. Desert density doubles, shrub dimensions vary, larger dry shrubs are lower and wider, and desert materials blend patchy gravel/mineral surfaces into sand. The existing climate and topography are retained; this does not convert every desert to a Sonoran cactus ecosystem.

Validation: slope regression checks every cutout root against the displayed terrain; streamed identities, habitat selection, geometry bounds and water exclusion; explorer/plant/rock/water/material regression suite; build; compatibility-rendered woodland and desert review. Native iPhone WebGL performance and appearance remain to be reviewed.


## 0.8.9 — Nearby sun shadows and balanced lighting

Added a cached 1024² depth-only WebGL sun map for trunks, foliage, ground cover and rocks. Tree and ground atlases use the same alpha cutoff in the depth and color passes, so empty card areas do not cast rectangular shadows. The map updates once per streamed view. Nine depth taps soften edges; receiver-plane depth correction limits slope artifacts. Shadows fade over 100–125 m; the map covers a 300 m square and uses at most a 4 MiB depth allocation. Warm direct light and cooler sky fill are combined in approximate linear color space to keep shadows readable. Comparison control: Shadows on/off. Mobile controls wrap and the HUD clears the extra row.

Terrain receives object shadows, but terrain casting is deferred: the render comparison exposed severe terrain self-shadow artifacts on steep desert geometry. Excluding terrain casters also reduces map update cost. Far terrain occlusion, moving sun, ambient occlusion and night lighting remain later work. Compatibility mode preserves canopy shade and labels its disabled control accordingly.

Validation: projection tests across hemispheres/poles, caster exclusions and framebuffer state; actual terrain and depth shader compile/link; offscreen graphics comparisons at woodland and desert coordinates; explorer/ground/plant/rock/water/material regressions; production build. Desktop software graphics timings are diagnostic only and do not establish iPhone performance.


## 0.9.0 — Flight, map interaction, zoom protection and location information

Implemented the five requested usability changes. Walking/flight mode, speed selection and flight height controls remain on the main screen. Flight preserves the spherical heading, normalizes combined movement, clears loaded water/ground and uses altitude/speed-dependent terrain LOD. Stream requests are gated to one active view so continuous flight cannot invalidate every completed result. Landing switches back to terrain collision. Added a 20 km render clip distance and altitude-dependent fog; small objects are omitted from broad aerial views.

Replaced immediate map teleport with explicit pin selection and Travel here. App-owned pinch/wheel/button zoom is anchored under the gesture, drag pans, longitude wraps, polar bounds are constrained and multi-touch gestures cannot select a point. Whole world, Find me and named-destination lookup provide recovery/navigation. Raised the global raster from 384×192 to 1536×768. Added page gesture guards, viewport bounds, mobile form font sizes and conditional page-zoom reset control. Native browser zoom overrides remain browser-controlled.

The live HUD reads interpolated global climate: biome, annual mean surface temperature in °C, precipitation in mm/year, snow months, coordinates and elevation. Flight adds height above ground and speed. Added actual lakefront, non-volcanic mountain and glacier destinations. Features are discovered from the current seed; unavailable features are not invented. Existing glacier data are a coverage mask, not ice thickness.

Validation: flight speed/diagonal/heading and altitude checks; map anchor/wrap/scale/bounds and real controller tap-vs-drag/pinch tests; biome/units and destination exclusions; full HORIZON-01 worker run confirms all nine travel targets and 500 m / 4,000 m aerial views. Full regression suite and build checked. Browser interaction checks follow deployment; native iPhone gesture behavior still requires on-device review.


## 0.9.1 — Complete scenic coverage, clear air and coastal transitions

Replaced the explorer's bounded walk/flight patches with a complete six-face adaptive quadtree. All six root faces remain covered, every neighboring level is balanced and all internal edges stitch. Resolution 8 with near-ground level 13 preserves the previous effective finest spacing while allowing a coarse distant planet. Flight clearance changes refinement. The cache is capped at 24 MiB. Collision rays index a bounded local region, with larger bins in aerial views, avoiding unbounded gnomonic indexing of far-side geometry.

Raised the far clip to encompass the planet. Haze now has clear-air regional scales (24 km alpine, 18 km arid, 9–14 km elsewhere) and does not depend on speed. This exposes distant scenery instead of using fog to conceal a patch boundary. Cold alpine material weights favor exposed rock over sand, preserving seasonal snow coverage.

Added a three-cell coastal buffer and a local ocean-exposure proxy on the existing global grid. Slope, elevation, warmth and moisture select low-shore marsh, dune scrub, coastal grassland, rocky coast and maritime woodland transitions. Mangrove candidates require warm, wet, very low, flat, relatively sheltered settings and use shorter trees with prop roots. Tall temperate trees are set back from low marsh/grass shores; forested cliffs remain possible. Inland climate rules distinguish tropical forest, temperate rainforest and riparian woodland. Ground geometry, material masks, tree placement and HUD classification share the habitat rules. Coastal/tropical travel targets are discovered where valid, without inventing features absent from the seed. These are habitat proxies; tides, salinity and detailed species assets remain later work.

Validation: complete dyadic face coverage and balanced joins over altitude, seam and polar cases; closed combined mesh edge incidence and bounded collider; alpine contrast retention; coastal vegetation exclusions and climate restrictions; actual HORIZON-01 views at the user's alpine/lakefront coordinates report zero ground boundary indices. Cold/wet habitat, flight/map and existing geometry/hydrology regressions and production build checked. Native iPhone performance remains a device review item.


## 0.9.2 — Stabilize aerial depth, materials and biome consistency

Reproduced lake artifacts at 18.8668° S, 95.4222° E with the actual combined ground/water geometry at 3,876 m and 4,025 m camera elevations. A walking near plane with a conventional 24-bit depth buffer cannot reliably separate shallow water and terrain at these ranges. Added logarithmic fragment depth to every main render pass, including the water depth prepass, and altitude-aware clipping. The shadow camera retains its independent orthographic depth. An offscreen graphics comparison removed 2,528 and 1,610 falsely exposed ground pixels at the two heights. Unit checks bound high-flight depth resolution to millimetres. This removes the need to raise water artificially.

Detailed material color and relief fade over 25–150 m into broad, world-stable material variation. Periodic macro noise and a 4,096 m texture origin preserve streaming phase. Regional tree-cover color fades in beyond 90–350 m to soften the hard transition to bare-looking distant hills; it remains an approximation rather than distant tree geometry. Empty aerial scenes skip sun-map generation and sampling. Compatibility mode averages distant material images.

Added landHabitat as the complete shared classification for HUD, plant policy and ground cover. Dry grassland, grassland and deserts no longer receive dense woodland trees or fern floors; coastal policies remain conditioned by actual local inputs. The destination dropdown now says Travel destination because it retains the last travel target while the HUD follows the camera. Conifers now use a fourth, dedicated needle atlas cell, multi-spoke branch tiers and a leader tuft rather than oak cutouts and exposed top poles. Near broadleaf foliage remains unchanged.

Validation: real terrain/depth shader compile and link in an offscreen graphics context; actual-lake depth comparisons at both user screenshot elevations; logarithmic-depth precision, open-habitat tree exclusions, conifer atlas and geometry checks; streaming, map, hydrology and other regressions; build. Native iPhone timing and detailed tree asset quality remain review items.


## 0.9.3 — Distant forest silhouettes

Added a cached, lightweight forest representation through 1.8 km, using crossed whole-tree cutouts and horizontal canopy caps. Broadleaf and conifer silhouettes have separate atlas cells. Near and distant geometry share canonical seeded candidates, habitat decisions and tree dimensions. A 90–135 m screen-door transition replaces detailed trees with distant crowns in WebGL; high-flight views keep the distant layer beneath the camera. Terrain collision grounds the bases on the displayed mesh. Distant trees omit shadow casting/sampling, thin progressively beyond 300/700 m and use a bounded 32,000-entry cache. Regional ground cover remains the approximation beyond this range.

Validation: shared near/distant identities and dimensions, overlapping streamed views, bounded cache reuse, high-flight coverage, open-biome exclusions and geometry budgets. Offscreen rendering compiled the actual shaders and compared the user's HORIZON-01 coordinates before/after; distant hills now retain tree silhouettes. Actual worker views retained roughly 400 distant trees at that coastal location, with subsequent views reusing cached habitat samples. Full tests and production build checked. Native iPhone timing remains unverified.


## 0.9.4 — Preserve distant canopy coverage

Replaced the 20% / 6% distance thinning with a 50% distant stand sample and inverse-square-root crown-width compensation. Inverse-square-root compensation preserves expected projected crown area. An additional stand-footprint expansion ramps up over 140–300 m to close the exaggerated gaps between narrow cutouts. Seeded height, grove layout and crown tones provide an uneven canopy. Detailed handoff trees retain their original dimensions; distant cards remain six triangles each and omit shadow casting.

Added a bounded 8,000-tile habitat cache for distant interiors. Tiles whose corner classifications disagree use exact per-candidate habitat checks, including coastal edges. Near and regional placement cache keys are separate, so coarse habitat decisions cannot override nearby classification. Rejected distant interior candidates are not stored in the placement cache. The 1.8 km range remains unchanged. Shoreline and terrain geometry are unchanged in this canopy-focused pass.

Validation includes projected crown coverage across distance bands, minimum far-stand population, geometry budget, cache bounds, overlap stability, nearby tree dimensions and open-biome exclusions. A compatibility-renderer comparison at the supplied coastal coordinates confirms overlapping crown cover and an uneven tree line; the scene contains about 11,100 simplified trees / 66,500 triangles. Production build and full regression suite checked. Native iPhone performance remains unverified.


## 0.9.5 — Correct the bare grassland band

Traced HORIZON-01 at 35.5491 N, 33.1523 W in eight directions. The northward hillside from 250–1,800 m is mostly dry grassland / grassland (aridity about 0.41–0.74), not a missing forest. Displayed terrain and sampled ground agree to within local mesh approximation; trees were not hidden underneath it. The material set rendered these open habitats as exposed soil, while the 11–24 m coastal elevation rule forced maritime woodland regardless of moisture. Density-only checks in 0.9.4 did not diagnose this case.

Added a meadow-cover attribute and climate-colored straw/green tint on the complete terrain mesh. The WebGL material retains world-stable broad variation and fading close detail; compatibility rendering applies the same cover mask and tint. Exposed slope, wet bank and underwater masks reduce cover. Desert, glacier, snow, lava, alpine and woodland policies remain separate. Dry maritime elevations now remain dune scrub or coastal grassland, while sufficiently moist coasts retain woodland.

Validation: actual-coordinate habitat/height trace; regression inputs from the northward hillside; dry coastal tree exclusions, wet coastal woodland retention and mineral/water cover exclusions; actual worker scene in the compatibility renderer; real shader compile/link; full regression suite and build. The distant-tree geometry range remains 1.8 km; this change supplies persistent herb cover wherever the terrain is classified as grassland. Native iPhone timing remains unverified.


## 0.9.6 — Independent ground-detail streaming

Removed ground-detail geometry from the monolithic terrain response. After terrain installation, a separate stream sends full level-11 ground tiles in priority order, yielding between tiles so new movement/travel requests can supersede a job. The planner covers the current 112 m buffer plus a motion corridor, predicting ahead from measured terrain latency (bounded to six seconds and 240 m). Terrain refreshes wait for an active detail batch; detail batches wait for active terrain work. This keeps the existing single worker and avoids duplicating the planet model, but a synchronous terrain build still occupies that worker.

Worker and renderer caches are each bounded to 16 MiB. Terrain-height fingerprints invalidate geometry that needs to refit; cache-owned buffers are copied before transfer. Full-tile candidate addresses remain fixed. Ground hits and every card base use the visible terrain collider. Client request IDs and worker job tokens exclude obsolete travel/world results. Terrain swaps retain ground resources, with per-resource origin offsets in WebGL. New detail reveals over 0.7 s, fades at 64–96 m and fades with 60–140 m flight clearance; the compatibility path supports the same resource lifecycle. Ground-detail tiles omit shadow casting.

Validation: motion corridors at seams/poles, stationary and moving coverage, tile overlap, bounded cache and transfer ownership, actual rendered gradual reveal/terrain-swap persistence/retirement, existing grounded-card tests, actual HORIZON-01 worker streaming and known-tile suppression, main shader compile/link, full regression suite and build. At the reported coastal location, the first 79-tile low-flight batch took about 1.2 s in the development runtime; the repeated known-tile request sent no geometry and took about 90 ms. These are development measurements, not iPhone timings. Very fast travel can still outrun the bounded buffer; trees and terrain still use their existing terrain update path.


## 0.9.7 — First alpine reference pass

The supplied alpine viewpoint (24.0248 S, 63.1641 W) exposes broad interpolated scaffold facets. Added a deterministic world-addressed incision layer at 600/180/45 m scales, smoothly enabled over 1,600–2,600 m in cold terrain, with at most 50 m of downward displacement. It is applied within the shared surface sampler so geometry, collision, environment sampling and detail grounding agree. Standing-water support, river corridors, glacier and lava regions are excluded; the global drainage model is unchanged.

Cold alpine material weights now support patchy seasonal snow using slope and world-stable deposition variation, while steep faces retain exposed rock. This is a local relief/material pass, not a reconstruction of mountain-range topology, a glacier-thickness model or a glacial erosion simulation. Further reference review is needed for sharp rock towers, larger cirques and talus geometry.

Validation: bounded seeded relief and continuity at the supplied ridge; water/ice/lava/lowland exclusions; sheltered versus steep-face snow/rock selection; full hydrology/terrain/collision and streaming regressions; production build. Native iPhone visual/performance review remains outstanding.


## 0.9.8 — Climate-led alpine variants

Added a shared alpine classification and snow-supply proxy based on elevation, annual precipitation, snow-month fraction, temperature and the glacier mask. High terrain with frozen-input proxy below 250 mm/yr is labelled Dry alpine; wetter cold terrain is Snowy alpine. Existing glacier coverage above 0.25 is labelled Glaciated terrain. This is an explicit visual heuristic, not an accumulation or snow-depth simulation. No generated temperature, precipitation, cryosphere or drainage fields are changed.

The HUD setting displays the variant alongside the existing biome. Separate Dry alpine and Snowy alpine destinations replace the generic Mountains entry when supported by the seed. Candidates exclude water, volcanoes and glaciers, then verify the final spawn against interpolated climate and fitted surface; unsupported variants are omitted. Glacier travel remains available separately. Alpine material snow coverage now scales with available moisture while preserving the glacier mask and the existing non-alpine material rules. The dry mountain at 24.0231 S, 63.1639 W remains predominantly exposed rock.

Validation: dry/wet/cold/warm/glacier classification, dry-versus-wet material coverage, normalized blends and glacier retention, existing destination and ecology checks, actual HORIZON-01 destination discovery and original-mountain readout, full regression suite and build. Native iPhone visual review remains outstanding.
