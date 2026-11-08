export const forestKind=kind=>kind==='conifer'?1:kind==='tropical'?2:kind==='mangrove'?3:0;
/** Normalized crown lobes: x/z and radii use tree width; y/ry use height.
 * The canopy geometry and distant cutout use these same footprints. */
export function crownLobes(kind){
 if(kind==='conifer')return Array.from({length:6},(_,i)=>({x:0,z:0,y:.25+i*.13,rx:.92-i*.145,rz:.92-i*.145,ry:.15-i*.014}));
 if(kind==='tropical')return [{x:0,z:0,y:.9,rx:.64,rz:.64,ry:.10},...Array.from({length:6},(_,i)=>({x:Math.cos(i*Math.PI/3)*.48,z:Math.sin(i*Math.PI/3)*.48,y:.79+(i%2)*.04,rx:.58,rz:.58,ry:.14}))];
 const base=kind==='mangrove'?.6:.70;
 return [{x:0,z:0,y:base+.10,rx:.64,rz:.64,ry:.19},...Array.from({length:5},(_,i)=>({x:Math.cos(i*6.283/5)*.43,z:Math.sin(i*6.283/5)*.43,y:base+(i%2)*.07,rx:.56,rz:.56,ry:.22}))];
}
export const forestUV=(kind,row=0)=>{const x=forestKind(kind)/4,y=row/3;return [[x,y+1/3],[x+.25,y+1/3],[x+.25,y],[x,y]];};
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function forestBlend(distance,seed=0){return smooth(150+seed*60,380+seed*60,distance);}
export function branchVisibility(distance,seed=0){return 1-smooth(70+seed*35,220+seed*35,distance);}
/** Typed chunks keep large streamed forests from building duplicate JS-number
 * arrays. Finishing releases each source chunk as its packed output is created. */
export function packedBuffer(Type=Float32Array){let chunks=[],length=0;const size=16384;return {get length(){return length;},push(...values){for(const value of values){const at=length%size;if(at===0)chunks.push(new Type(size));chunks[chunks.length-1][at]=value;length++;}},finish(){const out=new Type(length);for(let i=0;i<chunks.length;i++)out.set(chunks[i].subarray(0,Math.min(size,length-i*size)),i*size);chunks=[];return out;}};}
