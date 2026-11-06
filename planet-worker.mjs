import {buildMeshFoundation} from './mesh-foundation.mjs?v=0.7.9';
import {createSurfaceSampler} from './surface-sampler.mjs?v=0.7.9';
import {extractShorelines,packShorelines} from './shorelines.mjs?v=0.7.9';
import {solvePlanet,transferBuffers} from './planet.mjs?v=0.7.9';
self.onmessage=({data})=>{
  try{
    const started=performance.now();
    const model=solvePlanet({seed:data.seed,progress:(stage,fraction)=>postMessage({type:'progress',stage,fraction})});
    postMessage({type:'progress',stage:'Extracting global shorelines and channel openings',fraction:.98});
    const surface=createSurfaceSampler(model);
    model.shorelines=packShorelines(extractShorelines(model,surface));
    model.meshFoundation=buildMeshFoundation(model,surface,{progress:f=>postMessage({type:'progress',stage:'Building the global mesh foundation · '+Math.round(f*100)+'%',fraction:.98+.019*f})});
    model.stats.generationSeconds=(performance.now()-started)/1000;
    postMessage({type:'complete',model},transferBuffers(model));
  }catch(error){postMessage({type:'error',message:error.message});}
};
