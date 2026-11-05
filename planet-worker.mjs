import {solvePlanet,transferBuffers} from './planet.mjs';
self.onmessage=({data})=>{
  try{
    const started=performance.now();
    const model=solvePlanet({seed:data.seed,progress:(stage,fraction)=>postMessage({type:'progress',stage,fraction})});
    model.stats.generationSeconds=(performance.now()-started)/1000;
    postMessage({type:'complete',model},transferBuffers(model));
  }catch(error){postMessage({type:'error',message:error.message});}
};
