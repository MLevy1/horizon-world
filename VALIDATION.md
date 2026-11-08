# Horizon validation workflow

## Each release

1. Record the baseline commit and run `npm test` and `npm run check:release`.
2. Use `npm run release -- --version X.Y.Z`; run tests, release check and build before publishing.
3. Open Diagnostics & viewpoints, copy the baseline view/report and capture screenshots after terrain and detail requests settle. Repeat using the same pose, viewport, shadows and texture settings. Animated water and screen-door transitions can differ between frames; image differences need interpretation.
4. Inspect geometry only, then the normal scene. Check ground contact, water alignment and nearby objects separately.
5. Walk and fly the same short route, turn around and return. Include stopping, low/high flight, speed changes, map open/close, background/resume and Recover view. Save endpoints and record the route's speed, duration and input sequence alongside reports; route playback is not yet automated.
6. Recheck alpine lake, broken mountain corridor, coastal forest, grassland and tropical hillside references. These are chosen starting viewpoints, not scientific/environmental ground truth or exact original photo orientations. River bend, desert, woodland and glacier references are also included from the verified HORIZON-01 destinations.
7. Verify the deployed version and repeat on the actual iPhone. Desktop/headless checks do not establish iPhone stability or performance.

## Interpreting freezes

The panel refreshes on a separate timer. Compare input timestamp, frame age, render age, context, recovering flag, terrain request age and collider presence. Opening the panel intentionally pauses navigation/rendering, so account for its `paused` flag. Copy a report immediately after a failure; the event ring retains only the latest 30 entries. A blocked main thread can also block the panel timer, so absence of updates is evidence rather than a diagnosis.

## Performance measurements

Keep baseline device, viewport and settings fixed. Compare frame cadence, render heartbeat, terrain/material/object stage times, request round-trip age and tracked cache bytes. Stage times measure worker CPU elapsed time; request elapsed time also includes queue/message/main-thread delay. Neither metric measures GPU execution. Main-thread install/upload timings measure CPU elapsed time and upload submission; resource triangle counts are submitted geometry, not the number of visible triangles after GPU clipping. Cache estimates are not total browser or GPU residency. Do not enable automatic quality changes until these measurements establish useful budgets.

## Before re-enabling a landform experiment

- Define a reproducible scene and one visible success criterion.
- Check surface continuity across spatial buckets, mask boundaries, water support edges, glacier/lava cutoffs and cube/LOD seams.
- Check gradients and normals as well as bounded heights.
- Protect or explicitly re-solve basin sills, outlet paths and water levels when geometry changes can affect drainage.
- Sample geometry before meshing; derive material/object policy from the same landform mask.
- Validate terrain collision and cached object re-grounding through multiple LOD updates and return travel.
- Compare both controlled fixtures and several actual world sites in a browser before publishing.

Talus and alpine displacement remain disabled. This document does not certify their prior tests as sufficient.
