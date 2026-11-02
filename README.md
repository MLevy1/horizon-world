# Horizon — Procedural Landscape Explorer

A single-page, browser-based, seeded procedural landscape explorer for GitHub Pages.

## Launch

Open `index.html` via a local web server, or deploy it to GitHub Pages. The app loads **Three.js from jsDelivr**, so an internet connection is required. No backend or database is required.

To test locally with Python:

```bash
cd horizon-world
python -m http.server 8000
```

Then visit http://localhost:8000.

## Publish using GitHub Pages

1. Create a public GitHub repository (e.g. `horizon-world`).
2. Upload `index.html` to the repository's root.
3. In repository **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
4. Visit `https://YOUR-USERNAME.github.io/horizon-world/` after deployment.

## Controls

- **WASD**: move
- **Mouse**: look around (click scene to capture mouse)
- **Space / Shift**: ascend / descend in flying mode
- **F**: switch between flying and walking
- **Control**: travel 3× faster
- **M**: regional map, click to teleport
- **G**: settings (seed, distance, geometry detail, speed, height scale, coordinates)
- **Esc**: release pointer lock
- On touch devices, drag the world to look and use the on-screen joystick and buttons.

## Current scope

Included: deterministic procedural heightfield (hills, ridges, large relief), terrain LOD using a distance-adaptive quadtree, atmospheric fog, sparse instanced forests, water plane, walking/flying, configurable terrain settings, map, teleportation.

Not included yet: saving modifications, digging, block construction, rivers, separate coherent full-biome climate regions, railways, NPCs, cave geometry, or planetary curvature. The map shows a 20×20 km test area, while terrain generation continues beyond that area.

This is an **exploration/rendering prototype**, not a full simulation. Terrain tiles may briefly update at LOD boundaries. This initial version generates geometry on the main thread and may stutter on less powerful devices, especially with high terrain detail and long view distances.

## Technical notes

No build step, frameworks, or package manager necessary. All app code is in `index.html`. The Three.js module is pinned to version `0.180.0`. The seed identifies generated terrain, but the terrain algorithm is not yet versioned. World state and construction edits do not exist in this version.
