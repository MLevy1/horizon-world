# Horizon 0.1 — New foundation

A clean restart of the Horizon landscape project, not a refactor of earlier versions.

## Run

Open `index.html` on GitHub Pages. For local work, serve this directory over HTTP (for example `python3 -m http.server 8000`) and open `http://localhost:8000`.

The page imports a pinned Three.js module from jsDelivr. The simulation itself is dependency-free JavaScript.

## Current features

A finite 8 × 8 km test region; deterministic elevation, coastal slope, mountains, soil/forest color and instanced trees; priority-flood drainage calculated **before** final valley terrain; ocean at sea level 0; a drainage map; tap-to-travel; flying controls on mobile and desktop.

**Important:** the blue lines on the map show computed potential drainage; **rivers are intentionally not drawn in 3D** in v0.1. The clean restart avoids re-introducing the old ribbon/shoreline defects.

## File map

- `world.mjs` — pure world-generation and hydrology, no graphics
- `app.js` — Three.js viewer and mobile controls
- `index.html` — minimal UI
- `tests.mjs` — deterministic simulation invariants, run with `node --test tests.mjs`
- `LESSONS.md` — condensed audit of the old repository

## Commit workflow

One active `main`, one deployed URL, one meaningful commit per accepted update. No automated deployment retries, preview copies or permanent pilot settings. Before visual changes, validate in a local browser and keep screenshots of the same test coordinates.