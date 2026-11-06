import {createTerrainChunkBuilder} from './terrain-chunks.mjs?v=0.7.11';
import {buildChannelConstraints} from './channel-constraints.mjs?v=0.7.11';
import {createSurfaceSampler} from './surface-sampler.mjs?v=0.7.11';
import {extractShorelines,packShorelines} from './shorelines.mjs?v=0.7.11';
import {solvePlanet,transferBuffers} from './planet.mjs?v=0.7.11';
let terrainBuilder=null;
self.onmessage=({data})=>{
  try{
    if(data.type==='terrain-patch'){
      if(!terrainBuilder){if(!data.model)throw Error('Terrain worker needs global surface data');terrainBuilder=createTerrainChunkBuilder(createSurfaceSampler(data.model));}
      const patch=terrainBuilder.patch(data.lon,data.lat,{level:data.level,resolution:64});
      postMessage({type:'terrain-patch',requestId:data.requestId,patch},transferBuffers(patch));return;
    }
    const started=performance.now();
    const model=solvePlanet({seed:data.seed,progress:(stage,fraction)=>postMessage({type:'progress',stage,fraction})});
    postMessage({type:'progress',stage:'Extracting global shorelines and channel openings',fraction:.98});
    const surface=createSurfaceSampler(model);
    const shores=extractShorelines(model,surface);
    model.shorelines=packShorelines(shores);
    model.channelConstraints=buildChannelConstraints(model,surface,shores,{progress:f=>postMessage({type:'progress',stage:'Linking global channel constraints · '+Math.round(f*100)+'%',fraction:.98+.005*f})});
    model.stats.generationSeconds=(performance.now()-started)/1000;
    postMessage({type:'complete',model},transferBuffers(model));
  }catch(error){postMessage({type:'error',message:error.message});}
};
