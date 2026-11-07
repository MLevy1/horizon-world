/** Schedule before running user code: an exception cannot terminate the frame chain. */
export function startFrameLoop(step,onError,{request=callback=>requestAnimationFrame(callback)}={}){
 let active=true;function frame(now){if(!active)return;request(frame);try{step(now);}catch(error){onError(error);}}request(frame);return ()=>{active=false;};
}
