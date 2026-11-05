# Horizon 0.4.0 — Global hydrology atlas

[Open the atlas on GitHub Pages](https://mlevy1.github.io/horizon-world/?v=0.4.0).

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
- Contributing area and steady rainfall runoff conserved to the ocean.
- Runtime checks reject unresolved inland terminals, uphill flow, cycles and
  failed water balances.

Equatorial spacing is about 262 m. Zooming displays the existing global network;
it does not generate independent local regions. Features below this grid scale,
seasonal drying, evaporation and groundwater are outside this steady-flow model.
Ponds have mapped area below 0.35 km²; larger inland waterbodies are lakes.

## Viewer

Switch between the world map and globe, drag to navigate, and use the zoom
buttons, mouse wheel or pinch gesture. Select a waterway to inspect its flow and
trace to the ocean; highlight its catchment or jump to a large river system.
Layer controls show rivers, streams, headwaters, inland water, catchments and
flow direction. Changing the world seed generates a new complete planet.

## Source and verification

No external JavaScript dependencies or installation are required.

```sh
npm test
npm run build
```

Serve the repository root or `dist/` over HTTP. Module workers do not run from a
`file://` page. GitHub Pages serves the repository root on `main`.

- `planet.mjs`: pure, complete planetary drainage model and validation.
- `planet-worker.mjs`: background generation.
- `atlas.mjs`: map/globe renderer and inspection controls.
- `index.html`, `atlas.css`: viewer interface.
- `tests/planet.test.mjs`: eight topology, connectivity, conservation and
  determinism tests, including the entire published default planet.

The retired explorer remains available in Git history. This version uses the
new planet model only.
