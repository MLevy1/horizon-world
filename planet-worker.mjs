import {createSurfaceSampler} from './surface-sampler.mjs?v=0.7.8';
import {extractShorelines,packShorelines} from './shorelines.mjs?v=0.7.8';
import {solvePlanet,transferBuffers} from './planet.mjs?v=0.7.8';
self.onmessage=({data})=>{
  try{
    const started=performance.now();
    const model=solvePlanet({seed:data.seed,progress:(stage,fraction)=>postMessage({type:'progress',stage,fraction})});
    postMessage({type:'progress',stage:'Extracting global shorelines and channel openings',fraction:.98});
    model.shorelines=packShorelines(extractShorelines(model,createSurfaceSampler(model)));
    model.stats.generationSeconds=(performance.now()-started)/1000;
    postMessage({type:'complete',model},transferBuffers(model));
  }catch(error){postMessage({type:'error',message:error.message});}
};
