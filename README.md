# Horizon 0.9.6 — Walk the world

[Walk the world on GitHub Pages](https://mlevy1.github.io/horizon-world/?v=0.9.6).

The main page is a first-person terrain explorer with walking, flight, adjustable speed and keyboard/touch movement,
ground collision, streamed nearby geometry and world-map travel. It uses the
same complete seeded planet: rivers, lakes, oceans, climate and volcanic terrain.
The detailed atlas and older inspection tools remain at [atlas.html](atlas.html),
also linked from the explorer's world map. The old hydrology.html link opens that
atlas. Ground materials now blend soil, sand, rock, snow, cooled lava and wet
gravel using climate, slope and water proximity. The **Textures on/off** button
compares them with the earlier flat colors. Water now reveals shallow beds,
darkens with depth and reflects more sky at grazing angles. WebGL adds animated
fine surface ripples and sun highlights; compatibility rendering uses simpler
static optics. Press **C** or **Crouch** for a low 0.45 m viewpoint and slower
movement; **Stand up** restores 1.7 m. Local water depth appears while wading.
Nearby rocks now form seeded irregular clusters, with partly buried bases,
climate-aware materials and collision around larger boulders. Their placement
persists as terrain streams. Conifers, broadleaf trees and shrubs now grow in uneven climate-dependent
patches, with branching trunks, open geometric foliage and trunk collision.
Choose **Travel to → Woodland** to inspect an inland temperate location.
The canopy pass now uses mature tree proportions, layered alpha-cutout foliage,
understory shrubs, broad canopy shade and a leaf-litter floor. These are initial
approximations; wind and detailed botanical assets remain later
work. Nearby ground now carries clustered ferns, grass, deadwood and stones. Fine botanical cutouts replace solid plant wedges; each card edge is grounded independently on the visible terrain. Desert scrub has varied heights and denser branching foliage, with patchy mineral/gravel ground and lower, spreading shrubs. Deserts receive dry scrub and gravel; volcanic and steep terrain receive rubble; snowfields expose scattered rock; banks and shores receive reeds, stones and deadwood. Detail uses stable seeded addresses, fits the visible terrain and stops at water. It is merged into one additional draw batch within 72 m of the streamed view center.

WebGL now adds alpha-tested nearby sun shadows from trees, shrubs, grass and rocks, with warm direct light and cooler sky fill. Use **Shadows on/off** to compare. The 1024² depth map updates only as nearby geometry streams, with shadows fading between 100 and 125 m. Terrain receives these shadows; terrain casting and distant mountain occlusion remain later work. Compatibility rendering retains approximate canopy shade.

The current viewer is a reviewable checkpoint. Further visual refinement and
touch-control checks are tracked in [BUILD-PLAN.md](BUILD-PLAN.md).


### Navigation and location controls (0.9.0)

- **Fly / Walk** switches movement mode. **Up / Down** appear in flight; keyboard **F** switches mode and **Q / E** descend/ascend. Forward flight follows your view direction; **Level view** restores horizontal travel. Walking retains ground and obstacle collision. Switching back to walking lands on the local terrain.
- **Speed** stays on the main screen: 0.5–12 m/s on foot and 3–1,000 m/s in flight. Shift boosts speed. Flight is limited to 6,000 m elevation and stays above loaded ground and water. Higher/faster flight streams a wider, coarser terrain footprint; detailed objects remain a low-altitude feature.
- **World map** supports pinch, wheel and +/− zoom, drag panning, **Whole world**, **Find me**, and destination lookup. A tap selects a pin; **Travel here** confirms travel. Dragging/pinching never triggers travel. Keyboard arrows pan, +/− zoom and Enter selects the map center. The map raster is four times the previous resolution in each axis.
- Page pinch/double-tap scaling is suppressed within the app, with 16 px mobile form controls to avoid focus zoom. A **Reset page zoom** control appears if the browser reports residual visual-viewport scaling. Native Safari browser settings can still override viewport restrictions.
- The HUD shows the modelled biome, annual mean surface temperature, annual precipitation, snow-cover months, coordinates and elevation; flight also shows height above the land/water surface and selected speed. These are procedural climate estimates, not live weather.
- Travel destinations now include **Lakefront**, **Mountains** (excluding volcanic terrain), and **Glacier**, alongside River bend, Coast, Volcano, Snowfield, Desert and Woodland when those features exist in the generated world. Lakefront placement searches an actual fitted lake boundary and faces the water; Glacier uses glacier-covered terrain, distinct from seasonal snow.
- Crouch, shadows and textures are grouped under **View options** to keep movement and speed controls easy to reach.

### Scenic terrain and coastal habitats (0.9.1)

Terrain now covers all six faces of the planet continuously, with adaptive detail near the viewer. Flight changes resolution rather than exposing the edge of a finite patch. Nearby collision bins remain bounded independently of the distant terrain. Clear-air haze is much lighter, especially in alpine and dry areas, and no longer changes with selected flight speed. Cold alpine ground favors exposed rock rather than desert sand when snow cover is incomplete.

A coastal buffer around the existing ocean mask guides vegetation and material transitions. Low, wet, temperate shores use marsh vegetation; drier low shores use dune scrub or coastal grassland; steep shores expose rock; maritime woodland develops farther upslope. Warm, wet, low, sheltered coast candidates can support mangrove margins with prop roots. Tropical forest, temperate rainforest and riparian woodland are also distinguished where the climate supports them. These are initial habitat rules and vegetation variants, not a tidal/salinity or species simulation. Forest beside a steep rocky coast is still allowed.

New coastal and tropical destinations appear when suitable locations are found in the generated seed. The HUD uses the same habitat rules as placement. Underlying geography and hydrology remain the same world.

### Aerial rendering and habitat stability (0.9.2)

The WebGL viewer now uses logarithmic camera depth plus altitude-aware clipping, preserving separation between shallow lake water and terrain from high flight. Near terrain detail fades into broad material color variation with distance, reducing repeating aerial texture patterns. Distant woodland receives a regional canopy-color approximation; this is a coarse representation rather than individually modelled distant trees.

The HUD, near vegetation and ground cover now share one complete land-habitat classification. Desert, grassland and coastal grassland use short shrub/grass policies rather than full woodland placement. Conifers use dedicated needle cutouts, layered branch spokes and foliage over the leader. The travel menu is explicitly labelled as the travel destination, separate from the biome currently under the camera.

## Implemented model

- Entire fictional planet: 128 km diameter, about 51,472 km² of surface.
- 1,179,650 flow cells, computed together before displaying the map.
- Longitude connections and two unique polar nodes; no outer boundary exits.
- One connected ocean, independent level pools, active spill outlets and closed sinks.
- Explicit headwaters, tributaries, confluences, waterbody links and ocean mouths.
- Seeded volcanic arcs and hotspot chains, broad cones/shields/calderas and
  cooled downhill lava deposits, applied before the water solve.
- A global annual climate model: temperature, precipitation, evaporative demand,
  moisture/aridity and desert/cold region estimates.
- Climate-dependent runoff, lake evaporation, contracting water surfaces, closed
  basins, dry/playa estimates and preserved potential spill connections.
- Annual precipitation accounted for as land evaporation, additional lake
  evaporation, snow sublimation, retained ice, seasonal snow storage change,
  sea calving and ocean runoff; area and graph connectivity remain conserved.
- Runtime checks reject unresolved inland terminals, uphill flow, cycles and
  failed water balances.

Equatorial spacing is about 262 m. Zooming displays the existing global network;
it does not generate independent local regions. Features below this grid scale,
detailed glacier motion, time-varying river seasons and groundwater are future steps.
Seasonal/ephemeral channel styles are estimates from annual water yield, rather
than daily simulated flow.
Ponds have wet area below 0.35 km²; larger inland waterbodies are lakes.
Dry/playa pools are counted separately from the visible pond inventory.

## Viewer

Switch between the world map and globe, drag to navigate, and use the zoom
buttons, mouse wheel or pinch gesture. Select a waterway to inspect its flow and
trace to the ocean; highlight its catchment or jump to a large river system.
The **Global map view** selector switches between water availability,
temperature, precipitation, moisture/aridity, snow/ice, meltwater supply and volcanic geography,
with legends and units.
Layer controls show rivers, streams, headwaters, inland water, geographic
catchments, flow direction and dormant potential spills. Closed-basin shortcuts
show examples directly. The inspector reports climate and annual lake behavior. Changing the world seed generates a new complete planet.

## Source and verification

No external JavaScript dependencies or installation are required.

```sh
npm test
npm run build
```

Serve the repository root or `dist/` over HTTP. Module workers do not run from a
`file://` page. GitHub Pages serves the repository root on `main`.

- `planet.mjs`: pure, complete planetary drainage model and validation.
- `basins.mjs`: local-depression catchments and lowest internal spill connections
  for every potential lake basin.
- `pools.mjs`: independent annual pool balances, spill exchanges and merging,
  authoritative for every basin in the displayed active network.
- `lake-routing.mjs`: connected wet footprints, exposed-margin drainage, real
  closed-pool sinks and optional dormant spill edges.
- `river-profiles.mjs`: shared water heights, bed elevations, channel dimensions
  and longitudinal edge sampling across the complete active network.
- `profile-view.mjs`: downstream inspection routes, exact station sampling and
  SVG profile/design-section diagrams from that shared data.
- `water-scaffold.mjs`: connected geometric support for fixed water planes and
  shared separating saddles between incompatible pool levels.
- `shorelines.mjs`: spherical contour rings, open channel portals and compact
  transferable shore paths for both map projections.
- `channel-constraints.mjs`: shared global junction anchors, section definitions,
  adjacent terrain-face references and links to standing-water openings.
- `constraint-view.mjs`: fitted section sample plots for that mesh input.
- `terrain-chunks.mjs`: globally addressed cube-sphere ground chunks, shared
  border samples, 2:1 detail stitching and a bounded surface-sample cache.
- `mesh-camera.mjs`: locally centered inspection camera and lighting.
- `mesh-foundation.mjs`: the prior monolithic reference builder, retained for
  regression checks; the live page no longer constructs it on startup.
- `mesh-preview.mjs` / `mesh-raster.mjs`: actual mesh rendering through WebGL 2
  or a software compatibility renderer.
- `surface-sampler.mjs`: shared spherical scaffold interpolation, standing-water
  queries and a complete 3D index of nearby channel profiles.
- `water-contact.mjs`: shore-crossing profile constraints and composed fitted
  ground/water queries, including channel overlap and standing-water protection.
- `geology.mjs`: spherical volcanic landforms, cooled lava deposits and water links.
- `climate.mjs`: global climate fields, annual runoff partition and lake balances.
- `cryosphere.mjs`: monthly snow balance, retained ice, glacier routing and meltwater.
- `planet-worker.mjs`: background generation.
- `atlas.mjs`: map/globe renderer and inspection controls.
- `index.html`, `atlas.css`: viewer interface.
- `tests/*.test.mjs`: full-planet topology, connectivity, conservation and
  determinism checks, plus flat-bottom, saddle, seam and polar basin examples.

The retired explorer remains available in Git history. This version uses the
new planet model only.

## Annual climate model

Temperature depends on latitude and elevation. Approximate prevailing winds
transport moisture around complete latitude rings, with windward rainfall and
leeward drying. Desert is a display estimate (precipitation/evaporative demand
below 0.25 in non-cold land), not a full Köppen classification.

The Turc–Pike annual partition limits land evaporation to available water and
energy. A lake's basin budget includes upstream supply, local runoff, rainfall
on its wet surface and open-water evaporation. Water-limited lakes contract
below their spill elevation and have zero active ocean outflow. Their potential
spill connections remain in the geographic graph, available for a wetter state.
The blue surface is a cell-resolved annual reservoir estimate; the original
basin footprint remains selectable, with exposed margins shown in brown.

Version 0.7.3 installs independent pool levels and spill directions in the
actual global cell graph. Lake basins can split into distinct wet surfaces.
Exposed margins become land and can carry streams down to their receiving pool.
Closed pools terminate their active paths; overflowing pools connect onward to
another pool or the ocean. Catchment area is conserved across ocean delivery
and closed-pool destinations. Annual evaporation and ocean outflow conserve the
same liquid input, including snow and glacier melt.

The potential basin inventory and original ocean-connected receiver graph are
preserved as `basins`, `basinId`, `potentialReceiver` and `potentialOutlet`.
Dormant potential spills are separate optional mesh-edge links, never active
closed-pool outflows. Ice routing retains its original descending scaffold;
liquid runoff uses the installed pool graph.

Pool wet area ramps from zero to the full cell area over one metre above its
bed. Stored volume integrates that same area-stage curve. This annual procedural
model has no transient filling time, groundwater exchange or seasonal lake-level
history. Physical river cross-sections and subcell shorelines are later tasks.

Use the **Split lake basin** shortcut, then **Inspect next pool**, to compare
pool levels and destinations. Exposed basin margins remain inspectable. The
inspector reports pool count, current water level and potential spill height.
Flow-permanence labels remain annual yield heuristics, not seasonal forecasts.
Glacier deformation and dynamic advance/retreat remain future work.

Background for annual evapotranspiration partition:
[Yang & Yang (2011)](https://doi.org/10.1029/2010WR009287).

## Snow and glacier checkpoint

A 12-month temperature-index model partitions precipitation into rain and snow,
melts seasonal snow and accounts for sublimation. Two repeated climate years
establish the starting snowpack. The following representative year's surplus
becomes glacier/firn input. All snow depths are **millimetres of water equivalent
(SWE)**, not physical snow depth.

Ice follows existing adjacent drainage links only when bed elevation descends.
Warm cells melt available ice; cold pits retain it. At each descending step,
8% of remaining ice is retained and 92% may be exported. This is an explicit
procedural storage/routing parameter, not a calibrated glacier velocity or a
physical ice-surface model. Ice reaching the sea is accounted for as calving.
Annual gains, melt, calving and sublimation have separate conserved budgets.

Connected glacier/ice regions and melt outlets are inventoried across the entire
planet. Meltwater enters the same climate-dependent liquid supply used by land
runoff and lake evaporation. The inspector reports peak snow, annual snowfall,
snowmelt, retained ice and glacier melt. Region shortcuts select melt outlets.

Snow and frozen-water shading are annual estimates. Sea and lake ice shading
indicates at least six modeled freezing months; it does not introduce a second
freshwater source. The snow/ice view also shows seasonal peak snow. The retained
ice metric is the **new water stored over the modeled year**, not an estimate of
the total historical thickness or volume of an existing real glacier.

Background:
[USACE snowpack mass accounting](https://www.hec.usace.army.mil/confluence/hmsdocs/hmstrm/snow-accumulation-and-melt/snowpack-mass-and-energy-accounting)
and [USGS glacier mass balance](https://www.usgs.gov/programs/climate-research-and-development-program/science/mass-balance-methods-measuring-glacier).

## Volcanic geography checkpoint

The original sea datum is established first. Seeded procedural volcanic arcs,
a hotspot chain and isolated centers then sculpt the broad elevation scaffold.
The modeled forms are composite cones, shields, calderas and cinder cones, with
smoothly blended outer margins. All placement and distances use the sphere,
including longitude wrapping and the polar caps. This is a procedural geography
model, not a plate-tectonic or eruption-history reconstruction.

Short downhill paths from flank vents lay down **cooled, solid lava deposits**.
Those deposits modify elevations before oceans, drainage, climate, lakes and
snow/glacier budgets are solved for the complete planet. The solver determines
whether a summit/crater contains water or remains dry. Basin IDs in the geology
inventory link directly to the same hydrology model displayed on the map.

The geology view shows base geography in gray, volcanic edifices in rust,
cooled deposits in orange, and craters in dark brown. Water remains blue.
Submarine features have muted blue-gray shading. Volcano markers and shortcuts
allow inspection of type, ground elevation, edifice radius, elevation change,
deposit thickness and associated summit/crater water.

These broad landforms belong to the authoritative elevation data. A future
terrain renderer must refine that data rather than adding these shapes again
on top of the solved rivers and lakes. The remaining terrain/water checkpoint
will establish channel cross-sections, water profiles and physical shorelines.

Background:
[USGS volcanic forms](https://pubs.usgs.gov/gip/volc/types.html) and
[NPS lava deposits and drainage](https://home.nps.gov/zion/learn/nature/volcanoes-of-zion-and-southwest-utah.htm).

## River profile checkpoint — 0.7.4

`model.riverProfiles` defines one canonical surface, bed, width and design depth
per channel vertex, plus adjacent directed edges measured in metres. Every
incoming and outgoing segment reads the same vertex values at a confluence.
Lake surfaces and sea level anchor the profiles. Receiving-bank spill crests
meet their source lake level; downstream constraints propagate upstream without
introducing uphill water or artificial epsilon gradients.

For mean annual discharge Q in m³/s, the procedural width is
`min(90, 2 + 7*sqrt(Q))` metres and design depth is
`min(5, 0.25 + 0.35*sqrt(Q))` metres. Design freeboard is
`0.2 + 0.25*depth` metres. These are explicit world-generation parameters, not
calibrated hydraulic predictions. Planned channel beds sit at least the design
depth below water. Lake/ocean contacts preserve deeper existing ground where
present, so actual water depth there can exceed the design channel depth.

A dry mapped channel retains design dimensions but has a false `wet` flag;
each edge also has its own `wetEdge` flag. An edge entering the ocean does not
become wet merely because the receiving ocean vertex is wet. Dormant potential
spills and closed-pool outflows are excluded from these active profiles.
`sampleRiverEdge` interpolates the shared endpoint data along a segment.

These profiles are derived data: they do not alter drainage, climate budgets or
the elevation scaffold. The existing atlas still uses schematic line widths.
The next checkpoint adds profile inspection, followed by the shared terrain
sampler and physical shoreline/mesh generation in separate tasks.

## River profile viewer — 0.7.5

Select a river or an active lake outlet, then choose **Inspect river profile**.
The river-system shortcuts provide easy starting points. A downstream elevation
plot follows existing profile edges to the next lake or ocean. It stops at that
contact rather than drawing a fictitious channel across an unprofiled lake.

Move **Position along river** to inspect widths, water/design elevation, mapped
center-bed elevation, actual center depth and minimum design depth. Junction
stations and final waterbody contacts read the exact shared endpoint values.
The minimum cross-section is an illustrative parabolic channel using saved
width, design depth and freeboard. It is not a sampled terrain bank/shoreline.
A deeper underlying lake/ocean bed remains visible in the longitudinal plot
and mapped-depth readouts; it does not become an artificial narrow trench in
the minimum design section. Horizontal and vertical chart scales differ.

Dry portions use dashed design levels and no filled section water. These are
annual estimates, not time-varying river stages. The viewer reads the same
complete global data used by future geometry; it does not generate local trials.
The next task is the spherical terrain-and-water sampler (3a).

## Shared spherical sampler — 0.7.6

`createSurfaceSampler(model).sample(longitude, latitude)` queries the existing
complete planet. Coordinates are degrees; elevations and channel distances are
metres. The result contains `terrainM` (the broad scaffold), the containing
triangle and projective weights, `standingWater` (pool/ocean plane and depth,
or null), and `river` (nearby profile, closest position, distance, width, center
bed, wet flag and proposed core bed, or null outside its design corridor).

The sampler uses the actual staggered triangular mesh, including longitude
wrap and unique polar nodes. Normalized chord/ray interpolation matches shared
mesh edges. Compact latitude/longitude caches avoid storing a second full
position mesh. A 3D unit-sphere bucket index includes every active profile edge,
with conservative bounds for arc curvature and channel support. It has no
special seam or polar search window. Querying never regenerates local terrain.

The atlas inspector's **Surface sample** block reports the sampled scaffold,
standing-water level and nearby channel offset. Map clicks probe the actual
clicked coordinates; shortcuts probe their selected node. Narrow-stream snapping
still selects a drainage cell, while the separately labeled surface probe
reports its own coordinates.

This checkpoint supplies shared inputs, not a finished combined terrain mesh.
The raw scaffold, fixed standing-water planes and channel designs remain
explicit separate fields. Bank shaping, river/lake shoreline intersections and
composition of those fields into physical surfaces are the next task (3b).
No detailed terrain, vegetation or 3D landscape is added here.

## Water-contact fitting — 0.7.7

Surface queries now also return `fitted`: `groundM`, nullable `waterM`,
`depthM` and `kind`. This combines the scaffold, channel designs and fixed
standing-water planes. The original input fields remain available for diagnosis.
**Surface sample** is now near the top of the inspector and reports both the
scaffold and fitted values.

Incoming channel profiles meet a lake/ocean plane at the radial scaffold's
shore crossing along the actual edge, rather than continuing a sloped water
sheet to an offshore cell center. Existing deeper underwater beds are retained
at the receiving endpoint. The original profile endpoints remain exact.

Channel cores and bank shoulders blend back to the scaffold outside their
support. Overlapping patches use distance weights instead of switching at a
nearest-edge boundary. Fixed standing-water surfaces remain flat; fitting can
lower a submerged bed but never raise a bank wall through existing water.
Dry designs do not create water, while connected lake/ocean water can occupy
a newly lowered shoreline throat.

The fit is procedural geometry, not a transient fluid solution. Canonical
river design profiles, drainage receivers and annual budgets remain unchanged;
the river design viewer continues to show those source profiles. Fitted values
are sampled separately. The next checkpoint extracts shoreline boundaries
(3b2); no shoreline mesh or 3D landscape is generated by this release.


## Physical shoreline extraction — 0.7.8

Task **3b2** extracts standing-water boundaries over every spherical face.
Enable **Physical shores** in Map layers (on by default) to see the same paths
on the world map and globe. The layer summary reports standing-water rings
(including island boundaries) and channel openings. Existing map water fills
remain a cell texture; the precise shore overlay is separate until task 4a.

`extractShorelines(model, surface)` returns shared contour vertices, segments,
closed `rings`, exposed `paths`, and separate `portals` where channel cores meet
standing water. It uses the same fixed water levels and fitted ground as the
surface inspector. Shore paths never bridge those channel openings. Longitude
is only a display coordinate: roots and connectivity use spherical directions
and shared mesh identities, including the unique poles. Even-degree contours
that touch at an exact dry saddle split into separate closed lobes.

The geometric water scaffold extends strictly below-level connected support
beyond the discrete pool mask (43 extra nodes for HORIZON-01). When adjacent
independent pools have incompatible levels, shared edge/face saddles separate
their geometric surfaces. Both queries and contours use those same saddles;
original hydrology elevations, receivers, inventories and annual water budgets
remain unchanged. This geometric footprint is not a recalculation of annual
lake storage or area.

Channel openings use a global corridor index and adaptive spherical distance
bounds, so a narrow off-centre opening is not skipped by coarse endpoint tests.
Unresolved tangencies are bounded to 2 cm of arc length; detected bank crossings
are refined to 0.1 micrometre numerically. That is a numerical tolerance, not a
claim of physical accuracy for the procedural channel widths or 262 m scaffold.
Every exposed default-planet shore vertex and segment midpoint agrees with its
water plane within 1 cm in the composed query. Compact Float64 path coordinates
are extracted in the worker and transferred once for rendering.

All **74 tests pass**, including a second full-resolution seed, touching-saddle
regression, polar/seam geometry, narrow channel openings, endpoint pairing and
all prior hydrology checks. Next: **4a, bare global land and water meshes**.


## Bare global mesh foundation — 0.7.9

Task 4a is split into two global checkpoints to keep each implementation small.
**4a1 is complete:** open **Map layers → View mesh foundation** to see the actual
indexed ground and lake/ocean buffers. The preview has longitude/latitude
controls and a lake/ocean visibility toggle. It uses no atlas texture, height
texture, vegetation, decorative noise or new hydrology solve. WebGL 2 renders
the buffers when available; the software renderer draws the same complete
triangle arrays as a compatibility fallback.

`buildMeshFoundation(model, surface)` consumes every spherical scaffold face,
including the wrapped seam and both unique poles. It keeps the original nodal
heights and the shared water-scaffold saddles between incompatible pool levels.
Ground triangles are split at fixed standing-water contours. Matching shore
vertices have bit-identical ground/water positions, and each water triangle
belongs to exactly one pool or ocean plane. Neighbouring faces share every
extra edge split, preventing T-junctions. Touching independent pools cache their
vertices separately even where their numerical levels happen to match.

HORIZON-01 contains **2,469,672 ground triangles** and **1,569,797 lake/ocean
triangles** in about **107.1 MiB** of indexed mesh data. Double-precision metre
coordinates preserve very thin shore triangles in the authoritative buffers;
GPU uploads use float positions. The worker transfers those arrays once. The
preview allocates graphics buffers when opened and releases them before a new
world is generated. Full-size arrays are retained for the next mesh checkpoint.

**4a2 remains next:** insert the shared subcell river cores, banks, confluences
and paired mouth openings into these meshes. This foundation preview therefore
shows the broad ground scaffold and fixed standing-water sheets, rather than
claiming to be the finished terrain/water mesh. The hydrology atlas and fitted
surface inspector retain the complete river network. Local 3D navigation is
still task 4b.

All **78 tests pass**. New complete-planet checks count two incident ground
triangles at every edge, verify Euler characteristic 2 and every source node,
check every standing-water boundary against its identical ground vertex, and
validate all triangle indices, orientations, finite coordinates and fixed water
levels. The compatibility renderer is checked for indexed geometry, depth,
water visibility and hemisphere changes. Existing hydrology and shoreline
checks continue to pass.


## Global channel constraints — 0.7.10

**4a2a is complete.** Open **Map layers → Inspect fitted channel**, or select a
river and choose **Inspect river profile**. The saved-section slider steps
through the actual global constraint stations, including shore contacts. Fitted
ground/water values and a nine-point section appear first; the original design
plots remain available under **Original river design profiles**. A wet outer
sample is reported as water continuing beyond the sampled section, rather than
being forced into an artificial bank.

`buildChannelConstraints(model, surface, shores)` covers all **85,338** global
profile links and **89,897** unique endpoint anchors, including **7,818** shared
junctions. Each link references its two real spherical terrain faces. Its
stations retain both endpoints, the midpoint and any intermediate fitted shore
contact, producing **261,899** sections. Incoming/outgoing endpoint stations use
the same anchor point ID; their transverse directions can differ at a junction.

The returned typed arrays are `anchors`, `points`, `edges`, `stations` and
`portals`. Centre directions, fitted heights and containing-face references are
saved once. `sampleConstraintSection(constraints, surface, station)` evaluates
nine perpendicular spherical offsets: centre, inner core, nominal width,
shoulders and outer support. All use the existing composed surface; overlaps,
fixed pool/ocean planes and dry designs are retained. These lateral constraints
are procedural definitions, not a second permanent multi-million-point cache.
The mesher will consume the same definitions. Station density is the initial
constraint set; this release does not claim it is a finished error-bounded
triangulation.

All **6,110** standing-water opening records are linked to their contributing
profile edges (**6,789** references), with the original shore-path indices
preserved. Open portals retain paired endpoints; a closed opening loop retains
a shared loop seed rather than inventing two dry bank endpoints. Original
shore polylines stay in `model.shorelines`. The mesh inputs add approximately
20 MB of transferable data without modifying drainage or annual budgets.

All **85 tests pass**. Complete-planet checks cover every profile/face reference,
station/contact, shared junction anchor, stored fitted point and nine-point
section, plus every linked opening. Existing manifold-mesh, standing-water,
hydrology, climate and geology tests still pass. The inspection view also
retains explicit dry gaps and does not cap ocean water at a nominal width.

**Next: 4a2b, channel triangulation into the global ground and water meshes.**
The bare-planet preview still shows the 4a1 foundation; the newly saved
constraints are inspectable inputs to that next mesh pass, not separate water
ribbons presented as an integrated mesh. Local navigation remains task 4b.


## Global water, on-demand terrain — 0.7.11

The active architecture now separates the complete planetary simulation from
rendering geometry. Hydrology, climate, broad elevations, lake levels and river
profiles remain global. The map/globe remains the overview. Detailed ground is
built only for the inspected neighborhood; startup no longer creates/transfers
the prior ~107 MiB whole-planet 3D mesh.

Open **Map layers → Inspect terrain chunks**. The inspector focuses the current
selection (a channel midpoint when a river is selected), or a large river when
nothing is selected. **Wider terrain**, **River banks** and **Fine section**
change the sample density and footprint around the same location. Cardinal
movement requests the next neighborhood. Oblique/top-down inspection uses the
same geometry and camera-relative lighting. The selected ground elevation is
the camera origin, so high land can be inspected without shifting offscreen.

`createTerrainChunkBuilder(surface)` serves every location on six cube-sphere
faces. A tile address is `{face, level, x, y}`; its grid resolution is an even
integer from 4 to 256. `terrainVertex` reduces integer cube directions to a
canonical key, making shared samples bit-identical across face seams, poles,
corners and dyadic detail levels. Heights come exclusively from the existing
fitted global query. Chunks do not regenerate drainage, channels or water levels.

`build(tile, {resolution, coarseEdges})` uses 2×2 triangle fans. A `coarseEdges`
entry removes unmatched odd boundary vertices when the neighboring tile is one
level coarser at the same grid resolution. The resulting edge segments match
the coarse neighbor, including corners where two sides stitch. Callers must
keep adjacent LODs balanced at 2:1. The current inspector requests a uniform
level; automatic mixed-LOD selection is a later streaming step.

`patch(lon, lat, {level, resolution, radius})` combines a connected neighborhood,
welding common vertices by canonical keys. The default view uses 13 tiles,
106,496 ground triangles and about **3.3 MiB** of geometry. Any world coordinate
uses the same builder. A persistent worker receives only the global fields
needed by the sampler, transfers each completed mesh, and keeps an LRU cache
bounded to 65,536 samples. New requests replace the previous displayed mesh;
a new world terminates that worker and clears the cached surface data.

This checkpoint is **ground geometry**. Sampled water heights are retained for
the next pass; the local inspector does not render water faces yet. Uniform
sampling approximates the fitted surface between grid points; finer views
resolve narrow channels more closely. Ground rendering uses the actual sampled
elevations without decorative noise or vertical exaggeration. Global rivers,
lakes and oceans remain visible in the atlas.

All **96 tests pass**. New checks cover every same-level cube-face neighbor,
coarse/fine edge matching, all stitched-corner combinations, a closed sphere
assembled from six coarse tiles, bounded deterministic caching, actual global
surface samples across all faces, bit-identical borders with caching disabled,
wet/dry river neighborhoods and both poles. Existing global hydrology and
shoreline checks remain in place. Camera/renderer checks cover local focus,
zoom, tilt basis and lighting on the opposite hemisphere.

**Next checkpoint: water surfaces clipped and joined within these chunks.**
Then add camera-driven chunk selection/eviction and automatic balanced LOD.
The monolithic detailed-mesh path is retired from the live viewer.


## Clipped chunk water — 0.7.12

The terrain inspector now includes a unified river/lake/ocean water mesh and a
Water surfaces toggle. Shore intersections split the ground and water at the
same vertices. Fixed standing-water levels are retained; river heads come from
the shared fitted surface. Independently built borders, including stitched 2:1
LOD borders, use the same canonical intersections. Conflicting standing-water
levels request finer sampling rather than creating a sloping bridge.

Lighting uses normals sampled from the global surface independently of chunk
resolution. This removes triangle-grid lighting artifacts; it does not finish
natural landform shaping. Continuous river courses, asymmetric banks, irregular
shores, valley/ridge structure and erosion/sediment forms still need refinement
in the shared surface before final 3D presentation. Vegetation and decorative
detail remain separate. Automatic camera streaming and balanced LOD are next.

Verification for 0.7.12: **106 tests pass**. New checks cover fixed-level
shore intersections, dry designs, downhill heads, ambiguous fixed planes,
shared shore roots, global normals across LODs, cube-face and stitched LOD
water borders, actual planetary ground/water edge topology and a real closed
lake's independent level. Build and whitespace checks pass.


## Camera-driven terrain streaming — 0.7.13

Map layers → Inspect terrain chunks now supports drag/touch movement, scroll
zoom, +/− buttons, arrow keys and zoom presets. The worker chooses finer chunks
around the view and coarser chunks farther away. The selected quadtree is balanced
at 2:1 before applying the existing shared ground/water border stitching.

Only one view request runs at a time. New input replaces the waiting request;
stale results are discarded. The last complete image remains visible while a
new view is built. This inspector updates in completed views; it is not yet a
continuous first-person renderer. Closing the inspector releases its worker and
geometry caches; changing the seed also resets them.

A 16 MiB LRU cache holds reusable chunk buffers, separate from transferred view
buffers and the existing bounded 65,536-sample cache. The displayed cache budget
covers cached chunk arrays, not total app memory. The typical initial river view
uses LOD 10–12. View meshes use 32 subdivisions per chunk; ambiguous water levels
request finer sampling only within a 300,000-input-triangle refinement budget,
and unresolved boundaries remain flagged. Neither the global hydrology nor the
shared fitted surface changes as the camera moves.

Verification: **114 tests pass**, including mixed-detail selection/coverage,
2:1 balancing across seams/corners/poles, stitched mesh topology, chunk reuse,
cache eviction, safe buffer transfer, request coalescing/reset, screen-scaled
movement and real global water geometry. Natural river/shore/valley shaping
remains the next geometry task; smoother lighting and streaming alone do not
make the final geography realistic.


## First river-shape pass — 0.7.14

River geometry now uses one deterministic course graph in the shared surface.
Degree-2 inland nodes move slightly toward the neighboring flow path, and bounded
spherical Hermite curves follow upstream/downstream tangents. Sources, junctions,
ports, polar links and water-contact neighborhoods stay pinned. The routing graph,
annual budgets and canonical downhill water/bed profiles remain authoritative.
This introduces modest curves; it is not a complete meander/erosion simulation.

The two sides now have different waterline widths, bed slopes, bank spreads and
freeboard. Bend direction drives the inside/outside distinction; modest seeded
variation is continuous along the network. It fades to the unchanged design at
junctions, headwaters and protected contacts. Width changes are bounded to ±12%
of nominal design width; asymmetry is limited to 55%. The side widths sum to the
reported fitted width. Dry designs stay dry and standing-water planes stay fixed.
Normals average the narrow bank slope over a bounded physical span determined by
channel width, identically across chunks and LODs, to reduce coarse sampling glare.

The atlas map/globe, highlighted routes, saved constraint centres/sections and
streamed ground/water now consume the same course geometry. Source mesh-face
references still describe the original routing edge; saved point-face references
use each actual curved location. Longitudinal distances remain the solved graph's
design lengths. Detailed terrain still follows the shared fitted query.

To inspect a visible bend: Map layers → Inspect terrain chunks → **Find a river
bend**. This selects an existing wet bend from the complete planet. It creates
no separate scene or regional generator. Broader valleys, independent erosion
forms, shoreline refinement, sediment surfaces and vegetation remain later work.

Verification: **120 tests pass**. Added checks cover bounded node smoothing,
pinned endpoints, tangent continuity, curved projection/signed sections,
protected chord parameters, asymmetric bank joins, deterministic shaping and
all global quarter stations. Existing anchor, downhill, portal/shore, global
water-budget, chunk/LOD and cache checks pass. Build and whitespace checks pass.


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


## First-person explorer — 0.8.0

The main page now opens a ground-level world explorer. WASD/arrow keys walk,
Shift moves faster, and dragging looks around. Touch users can hold the onscreen
movement buttons and drag elsewhere to look. Auto walk is optional; Stop walking,
Escape, losing focus and opening the map stop it. Ground-following collision
intersects the actual visible triangles and blocks steep steps. There is no
jumping, flying or swimming yet; submerged terrain can be walked underwater.

The entire original planet is still solved, including hydrology, climate and
volcanic elevation. The worker keeps that data; the client receives only nearby
meshes and a lightweight whole-world overview. Startup skips physical shoreline
extraction and saved inspection cross-sections. Those remain in **atlas.html**,
linked from the world map. The old hydrology.html URL now redirects to that atlas.

Geometry streams with movement, using the existing shared surface, water clipping
and balanced tile joins. Nearby geometry reaches tile level 12, with progressively
simpler distant tiles. Each tile uses 16 subdivisions; the default river start has
about 65,000 base triangles, versus roughly 600,000 in the previous inspector.
Chunk buffers have a 12 MiB LRU budget and surface samples a 32,768-entry limit.
A view is requested after moving 24 metres; the last complete view remains active
while its replacement loads. The current far plane is 260 metres with fog;
distant horizons and a richer landscape remain later work.

World map opens the complete seeded world and supports click/touch travel to any
coordinate. Region shortcuts include a river bend, coast, volcano, snowfield and
desert from the actual solve. Bare ground colors reflect climate, snow/ice and
cooled lava; no vegetation, decorative assets or new erosion pass were added.
WebGL2 is preferred, with a lower-resolution software compatibility path when
WebGL2 is unavailable. This is the first playable foundation, not finished art.

Validation focuses on movement around the sphere, collision against rendered
triangles, joined near/far terrain, and browser walking/look/travel checks.

Browser verification: walked over 60 m with streaming, changed view direction,
travelled to volcanic ground, opened the full-world map, and selected another
location whose submerged terrain correctly enabled underwater viewing.
Essential movement/collision/join and request-queue checks pass.

Distant forests now retain simplified crowns and trunks out to 1.8 km, including during flight. They share seeded tree positions and dimensions with nearby trees, with a gradual WebGL handoff. Distant crowns preserve projected canopy coverage as geometry is simplified, with varied tones and overlapping silhouettes. Beyond that range, regional terrain color remains the approximation.

Grassland now retains climate-colored herb cover across the scenic terrain, beyond the nearby plant radius. Dry coastal slopes retain scrub and grass instead of an artificial strip of tall woodland. Rock, wet banks, deserts, snow and underwater terrain keep their own material policies.

Ground detail streams independently as reusable tiles with motion-predicted buffering, bounded CPU/GPU caches, and a 0.7-second reveal. Existing ground tiles survive terrain updates; detail fades over 64–96 m and with high flight clearance.
