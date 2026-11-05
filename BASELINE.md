# Horizon v0.2.0 — Stable-feature recovery

This is a **feature baseline**, not yet a clean-code rewrite.

## Preserved in this version
- Deterministic, seeded, large-coordinate terrain; streaming terrain tiles and multiple LODs
- Mountain and coastal geography; oceans and shorelines
- Biome/environment changes; terrain color and texture variation
- Forests, mixed tree forms, shrubs, grasses and rocks, with streaming/instancing
- First-person flight, mobile touch controls, speed and altitude control
- World coordinates, teleport, seed regeneration, landscape map
- Existing drainage/watershed diagnostics and map navigation are retained as inspection tools
- Terrain-aware ground placement and collision support

## Deliberately excluded from defaults
- Incomplete river and pond water rendering (experimental toggle only)
- Historical visual comparison switches, root debugging and render isolation controls in the main UI
- Multiple published builds, PR previews and per-update branch workflows

## Main interface
Map, Settings, Help. Settings contains exploration, travel and seed. The
advanced/developer controls remain in source because parts of the old engine
still refer to their element IDs. They are hidden rather than deleted.
Removing them safely requires the subsequent code-extraction pass.

## Code and version control
This recovery initially copies the last known feature-rich Alpha 4.3 source
into a minimal published file set. Therefore it **does not yet solve the
monolithic implementation problem**, and the existing GitHub repo still has
its earlier commit history. To obtain a genuine one-commit project, create
a new empty repository and import this snapshot as its first commit.

Do not force-push or delete the older repository until the new one has
been tested on mobile.

## Next verification
1. Startup on Safari and controls
2. Terrain streaming during high-speed flight and across tile seams
3. Biomes/trees/ground-cover behavior and collision
4. Map coordinate select and travel
5. Settings scroll and layout on iPhone
Only after passing these should the rendering and geography code be split
into independent, tested modules.
