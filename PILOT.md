# Horizon 0.2.2 — River Lab pilot

A focused test around X 921 / Z 1,755. Settings → Visit river geometry pilot
enables experimental rivers and moves the camera to this location.

- Channel-near terrain vertices use ~0.4–0.6 m sampling; elsewhere, existing
  terrain tiles, forests, oceans, flight controls and maps are unchanged.
- A conforming transition grid shares vertices between refined/coarse cells.
  Exterior tile edges stay on the original regular grid.
- Terrain and water both read the same world-coordinate drainage and river-bed
  profile. Water edges in the pilot no longer snap to uncarved terrain.
- Additional channel excavation blends out near the pilot's boundary.
- No new GitHub Actions, branches or previews.

This is a controlled pilot, NOT full River Lab equivalence. Junctions,
lake mouths, cross-LOD seams and water shader parity still need visual tests.
