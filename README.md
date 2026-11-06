# Horizon 0.7.4 — Global hydrology atlas

[Open the atlas on GitHub Pages](https://mlevy1.github.io/horizon-world/?v=0.7.4).

A fresh hydrology-only foundation: one complete, closed, seeded planet. The main
page displays the actual solved headwaters, streams, rivers, ponds, lakes and
connected ocean. No detailed terrain meshes or vegetation are generated.
The old `hydrology.html` link redirects to the same main page.

The current viewer is a reviewable checkpoint. Further visual refinement and
touch-control checks are tracked in [BUILD-PLAN.md](BUILD-PLAN.md).

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
