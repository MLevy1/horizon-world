/** Keep close detail on foot and usable depth precision from high flight. */
export function cameraClip({flying=false,clearance=0}={}){return {near:flying?Math.max(.08,Math.min(50,clearance*.025)):.08,far:160000};}
export function depthResolution(distance,near,far,bits=24){return distance*distance*(far-near)/(far*near*(2**bits-1));}

export function logDepthResolution(distance,far=160000,bits=24){return (distance+1)*Math.log(far+1)/(2**bits-1);}
