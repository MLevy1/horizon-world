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

## Landform changes

- Define a reproducible scene and one visible success criterion.
- Check surface continuity across spatial buckets, mask boundaries, water support edges, glacier/lava cutoffs and cube/LOD seams.
- Check gradients and normals as well as bounded heights.
- Protect or explicitly re-solve basin sills, outlet paths and water levels when geometry changes can affect drainage.
- Sample geometry before meshing; derive material/object policy from the same landform mask.
- Validate terrain collision and cached object re-grounding through multiple LOD updates and return travel.
- Compare both controlled fixtures and several actual world sites in a browser before publishing.

The earlier general talus uplift and alpine incision remain disabled. Regular-world lake-foot grading uses a separate continuous profile with zero displacement at the mapped shoreline. No user-managed experimental mode is required.

## 0.9.14 local validation

Fixed-camera compatibility-render comparisons use HORIZON-01, 171.2338° E / 39.0583° S, height 2838 m, yaw 0, pitch -0.1. They show the changed lower slope; these renders do not establish WebGL/iPhone appearance or performance. A 625-point region probe changed 121 ground samples (−58.67 to +31.92 m), preserved all sampled water-plane elevations and shoreline wet/dry classifications, and left sampled wet river cores unchanged. The largest adjacent 0.000001° longitude step was 0.00324 m. A grounded-card probe checked 2,016 roots against the adjusted rendered mesh. These are targeted checks, not exhaustive planetary guarantees.

## 0.9.15 rendering validation

An offscreen Mesa/llvmpipe graphics context compiled and rendered the explorer vertex/fragment shader logic, adapted from GLSL ES 300 to desktop GLSL 330. Before/after images use the same 0.9.14 mesh and camera at the alpine lake reference (390 × 700). The baseline reproduces the smooth material appearance; the updated shader distinguishes the lower gravel field from exposed rock. This bypasses browser integration, browser texture upload and iPhone GPU behaviour, so it does not certify those paths or mobile frame time. The compatibility regression fixture also checks that gravel differs at 200–1000 m and that snow conceals it. One additional low-frequency noise evaluation is used per textured terrain fragment; nearby grain retains its existing distance fade.

## 0.9.16 sediment and surface integration

A default HORIZON-01 formative pass moved material in 200,262 global cells; its final grain inventory differs from its initial weathered inventory by 2.72 × 10⁻⁹ relative volume. The eight-pass stage took 0.59–0.80 seconds in local runs and retains 23,593,000 bytes. These are local observations, not mobile budgets. Global hydrology validation now also checks the sediment volume error.

Comparing 2,601 points around 171.2338° E / 39.0583° S with the preceding geographic generator found 2,598 ground changes above 0.1 m and 36 wet/dry boundary changes. Sampled ground differences ranged from −82.62 to +46.14 m. The largest adjacent 0.000001° longitude step was 0.00149 m. The resulting full planet passes water-budget, routing and fitted-shoreline checks; basin and outlet locations are allowed to change.

Offscreen Mesa/llvmpipe rendering of the actual shader logic and generated meshes at the saved lake camera shows a continuous mineral field with substantially more clasts. Desktop shader compilation is adapted from ES 300 to GLSL 330; browser integration and iPhone frame rates are not established by this check. A local sequential view-generation comparison observed 4.03 seconds / 89 rocks for 0.9.15 and 3.38 seconds / 1,759 rocks / 47,960 rock triangles after collider reuse. This is one scenario, not a general performance claim. Collision tests also exclude clasts below the displayed water surface.

The volume model uses equivalent solid-layer thicknesses and a bounded formative episode. It does not resolve individual particle transport histories, porosity, hydraulic sediment transport or coupled glacial erosion.

## 0.9.17 canopy transition checks

The fixed flat-forest fixture checks shared identities and physical crown widths across streamed views, coverage under the camera in both flight/detail states, separate tropical/conifer/broadleaf/mangrove templates, bounded geometry, and continuous, staggered blend curves. An offscreen Mesa context compiled and rendered the actual shader logic (ES 300 adapted to desktop GLSL 330) at eight camera poses, including adjacent 1 m movements and a 100 m approach to a tropical forest edge. This checks geometry, shader linkage, cutouts and live-camera transitions, not browser integration or iPhone frame rates.

The clustered canopy uses 150–380 m transitions with up to 60 m of per-tree staggering, with additional generation overlap. Roots beyond the clustered geometry's loaded radius retain a proxy-only fallback rather than fading into missing geometry. Wood detail fades across 70–220 m, staggered by up to 35 m. Proxy cutouts and clustered crowns share a normalized lobe template and physical footprint.

A local cold woodland view contained about 9,475 trees and took 3.10 seconds to construct; moving 0.018 degrees longitude (approximately 16 m on this 64 km-radius planet) produced a subsequent view that took 1.95 seconds and required 195 new stand samples, versus 60,232 for the initial view. The tropical lake view contained about 19,247 trees and took 2.74 seconds. These are individual worker observations, not general performance guarantees.

The final canopy writer uses typed chunks instead of building duplicate large JavaScript number arrays. A chunk-boundary test checks retained vertices/indices. Worker observations after packing were approximately 2.86 s for the cold woodland view and 2.05 s for its nearby revisit; the 0.9.16 comparison was approximately 2.60 s and 1.76 s. The extra geometry has a measurable generation cost. GPU fill cost and iPhone performance require direct device checks; these timings do not establish frame rate.

Woody geometry is retained according to actual three-dimensional root distance, including camera height, rather than removed at the former flight-speed/120 m altitude switch. Very distant wood is omitted only beyond the shader's fully faded band; canopy remains present.
