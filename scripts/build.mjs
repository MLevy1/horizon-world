import {release} from './release.mjs';
await release({check:true});
import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const path of ['experimental-lake-talus.mjs','release-meta.mjs','explorer-diagnostics.mjs','explorer-viewpoints.mjs','explorer-runtime.mjs','talus-surface.mjs','alpine-climate.mjs','alpine-surface.mjs','explorer-detail-stream.mjs','atlas.html','explorer.css','explorer.mjs','explorer-map.mjs','explorer-camera.mjs','explorer-visibility.mjs','explorer-ecology.mjs','explorer-navigation.mjs','explorer-info.mjs','explorer-worker.mjs','explorer-world.mjs','explorer-render.mjs','explorer-shadows.mjs','foliage-texture.mjs','explorer-plants.mjs','explorer-forest.mjs','forest-texture.mjs','explorer-ground.mjs','ground-texture.mjs','explorer-rocks.mjs','explorer-water.mjs','terrain-materials.mjs','terrain-lod.mjs','terrain-stream.mjs','river-course.mjs'])await copyFile(new URL(path,root),new URL(path,dist));
for(const path of ['index.html','hydrology.html','atlas.css','atlas.mjs','planet.mjs','basins.mjs','pools.mjs','lake-routing.mjs','river-profiles.mjs','profile-view.mjs','surface-sampler.mjs','water-contact.mjs','water-scaffold.mjs','shorelines.mjs','mesh-foundation.mjs','terrain-chunks.mjs','chunk-water.mjs','channel-constraints.mjs','constraint-view.mjs','mesh-preview.mjs','mesh-camera.mjs','mesh-raster.mjs','climate.mjs','cryosphere.mjs','geology.mjs','planet-worker.mjs'])await copyFile(new URL(path,root),new URL(path,dist));
console.log('Built the global hydrology atlas in dist/.');

await mkdir(new URL('assets/',dist),{recursive:true});await copyFile(new URL('assets/foliage-oak.png',root),new URL('assets/foliage-oak.png',dist));
