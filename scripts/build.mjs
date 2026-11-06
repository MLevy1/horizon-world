import {mkdir,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const path of ['index.html','hydrology.html','atlas.css','atlas.mjs','planet.mjs','basins.mjs','pools.mjs','lake-routing.mjs','river-profiles.mjs','climate.mjs','cryosphere.mjs','geology.mjs','planet-worker.mjs'])await copyFile(new URL(path,root),new URL(path,dist));
console.log('Built the global hydrology atlas in dist/.');
