# Horizon 0.6.0 — Global hydrology atlas

[Open the atlas on GitHub Pages](https://mlevy1.github.io/horizon-world/?v=0.6.0).

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
The **Global climate view** selector switches between water availability,
temperature, precipitation, moisture/aridity, snow/ice and meltwater supply,
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
- `climate.mjs`: global climate fields, annual runoff partition and lake balances.
- `cryosphere.mjs`: monthly snow balance, retained ice, glacier routing and meltwater.
- `planet-worker.mjs`: background generation.
- `atlas.mjs`: map/globe renderer and inspection controls.
- `index.html`, `atlas.css`: viewer interface.
- `tests/planet.test.mjs`: fifteen topology, connectivity, conservation and
  determinism tests, including the entire published default planet.

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

The model assumes a common level within each inventoried reservoir basin. It
does not yet resolve independently isolated subpools below internal saddles.
Flow-permanence labels are annual yield heuristics, not seasonal forecasts.
Volcanic geography is the next separate task. Glacier deformation and dynamic
advance/retreat remain future work.

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
