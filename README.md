# Horizon 0.7.2 — Global hydrology atlas

[Open the atlas on GitHub Pages](https://mlevy1.github.io/horizon-world/?v=0.7.2).

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
- One connected ocean, retained flat ponds/lakes, one spill outlet per waterbody.
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
Ponds have mapped area below 0.35 km²; larger inland waterbodies are lakes.

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
  computed for every basin separately from the displayed active network.
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

The displayed water model still assumes a common level within each inventoried
reservoir basin. The separate 0.7.2 `poolBalances` solver now resolves independent
pools below connecting ridges across the complete planet. Supply enters its
actual local depression. A pool evaporates, spills across a real connecting
mesh edge or merges with its neighbor when both can sustain a joined surface.
Each potential basin and the complete outer-spill graph conserve liquid runoff.

Pool wet area ramps from zero to the full cell area over one metre above its
bed; this fixed subcell approximation is unchanged by merging. Stored volume
is the integral of that area-stage curve. The annual equilibrium model has no
transient filling time, groundwater exchange or seasonal lake-level history.

The new results do not yet replace the atlas water surfaces, active receiver
links or channel paths. That integration is the next separate task (1c) in
[BUILD-PLAN.md](BUILD-PLAN.md). Flow-permanence labels remain annual yield
heuristics, not seasonal forecasts.
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
