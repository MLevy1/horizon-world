import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const path of ['atlas.html','explorer.css','explorer.mjs','explorer-worker.mjs','explorer-world.mjs','explorer-render.mjs','terrain-materials.mjs','terrain-lod.mjs','terrain-stream.mjs','river-course.mjs'])await copyFile(new URL(path,root),new URL(path,dist));
for(const path of ['index.html','hydrology.html','atlas.css','atlas.mjs','planet.mjs','basins.mjs','pools.mjs','lake-routing.mjs','river-profiles.mjs','profile-view.mjs','surface-sampler.mjs','water-contact.mjs','water-scaffold.mjs','shorelines.mjs','mesh-foundation.mjs','terrain-chunks.mjs','chunk-water.mjs','channel-constraints.mjs','constraint-view.mjs','mesh-preview.mjs','mesh-camera.mjs','mesh-raster.mjs','climate.mjs','cryosphere.mjs','geology.mjs','planet-worker.mjs'])await copyFile(new URL(path,root),new URL(path,dist));
console.log('Built the global hydrology atlas in dist/.');
