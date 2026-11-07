/** Shared, seamless material images generated once per viewer. No additional
 * terrain vertices or external texture downloads. Scales are metres per tile. */
export const MATERIALS=[{name:'Soil',scale:2,relief:.008},{name:'Sand',scale:2,relief:.004},{name:'Rock',scale:4,relief:.025},{name:'Snow',scale:2,relief:.006},{name:'Cooled lava',scale:4,relief:.035},{name:'Wet gravel',scale:2,relief:.008}];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const hash=(x,y,s=0)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
const wrap=(v,p)=>(v%p+p)%p;
function noise(x,y,p,seed){const i=Math.floor(x),j=Math.floor(y),u=smooth(0,1,x-i),v=smooth(0,1,y-j),a=hash(wrap(i,p),wrap(j,p),seed),b=hash(wrap(i+1,p),wrap(j,p),seed),c=hash(wrap(i,p),wrap(j+1,p),seed),d=hash(wrap(i+1,p),wrap(j+1,p),seed);return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;}
function fbm(u,v,s){return .55*noise(u*4,v*4,4,s)+.28*noise(u*12,v*12,12,s+17)+.17*noise(u*36,v*36,36,s+53);}
function pebble(u,v,s){const n=24,x=u*n,y=v*n,i=Math.floor(x),j=Math.floor(y);let best=100,tone=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const h=hash(wrap(i+a,n),wrap(j+b,n),s),px=i+a+.1+.8*h,py=j+b+.1+.8*hash(wrap(i+a,n),wrap(j+b,n),s+1),d=Math.hypot(x-px,y-py);if(d<best){best=d;tone=h;}}return {height:1-smooth(.12,.60,best),tone};}
let shared;
export function makeTerrainTextures(size=256){
  if(size<16||(size&(size-1)))throw Error('Material size must be a power of two');if(shared?.size===size)return shared;
  const levels=[],base=new Uint8Array(size*size*4*MATERIALS.length);
  for(let material=0;material<MATERIALS.length;material++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,s=101+material*97,n=fbm(u,v,s),warp=noise(u*4,v*4,4,s+4),grain=hash(x,y,s+9)-.5;let rgb,h;
    if(material===0){const stone=pebble(u,v,s),fleck=stone.tone>.85?stone.height:0;h=clamp(n*.65+grain*.2+fleck*.25);rgb=[.31,.245,.17].map((c,k)=>c*(.75+n*.5)+grain*.05+fleck*(.14-k*.02));}
    else if(material===1){const ripple=.5+.5*Math.sin((v*7+warp*.65+noise(u*8,v*8,8,s+2)*.3)*Math.PI*2);h=clamp(n*.3+ripple*.35+grain*.3);rgb=[.66,.55,.37].map(c=>c*(.88+n*.15+ripple*.07)+grain*.045);}
    else if(material===2){const vein=1-smooth(.015,.07,Math.abs(noise((u+(warp-.5)*.15)*9,(v+(n-.5)*.15)*9,9,s+2)-.5)),facet=Math.abs(n-.46);h=clamp(n*.75+facet*.7-vein*.2+grain*.08);rgb=[.43,.425,.39].map((c,k)=>c*(.63+n*.7)-vein*.075+grain*.045+(k===0?.02*n:0));}
    else if(material===3){const drift=.5+.5*Math.sin((v*5+warp*.7)*Math.PI*2);h=clamp(.4+n*.28+drift*.16+grain*.18);rgb=[.84,.875,.88].map(c=>c*(.89+n*.15+drift*.04)+grain*.016);}
    else if(material===4){const crack=1-smooth(.014,.055,Math.abs(noise((u+(warp-.5)*.2)*11,(v+(n-.5)*.2)*11,11,s+7)-.5)),crust=Math.abs(n-.5)*2;h=clamp(.35+n*.45+crust*.25-crack*.3+grain*.1);rgb=[.23,.225,.215].map(c=>c*(.62+n*.85)-crack*.09+grain*.04);}
    else{const stone=pebble(u,v,s);h=clamp(stone.height*.65+n*.25+grain*.1);rgb=[.26,.255,.22].map(c=>c*(.55+stone.height*.5+stone.tone*.3)+grain*.03);}
    const i=((material*size+y)*size+x)*4;for(let k=0;k<3;k++)base[i+k]=Math.round(clamp(rgb[k])*255);base[i+3]=Math.round(h*255);
  }
  levels.push({size,data:base});for(let n=size;n>1;n>>=1){const next=n>>1,prev=levels.at(-1).data,data=new Uint8Array(next*next*4*MATERIALS.length);for(let m=0;m<MATERIALS.length;m++)for(let y=0;y<next;y++)for(let x=0;x<next;x++)for(let k=0;k<4;k++){let sum=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)sum+=prev[((m*n+y*2+b)*n+x*2+a)*4+k];data[((m*next+y)*next+x)*4+k]=sum/4;}levels.push({size:next,data});}
  shared={size,levels};return shared;
}
/** Compatibility sampling uses a distance-selected mip, without per-pixel
 * allocations or procedural noise evaluation. */
export function sampleTerrainTextureLevel(textures,id,u,v,lod,out){const scale=MATERIALS[id].scale,level=textures.levels[clamp(lod,0,textures.levels.length-1)],n=level.size,x=Math.floor(wrap(u/scale,1)*n),y=Math.floor(wrap(v/scale,1)*n),i=((id*n+y)*n+x)*4;for(let k=0;k<3;k++)out[k]=level.data[i+k]/255;return out;}
export function sampleTerrainTexture(textures,id,u,v,footprint,out){const lod=Math.floor(Math.log2(Math.max(1,footprint*textures.size/MATERIALS[id].scale)));return sampleTerrainTextureLevel(textures,id,u,v,lod,out);}
/** Continuous climate/slope/water masks; caller supplies interpolated fields. */
export function terrainMaterialWeights({aridity,snow,glacier,lava,slope,shore,coast,elevationM=0,temperature=15,snowDeposit=1}){
  const w=new Float32Array(6);const volcanic=clamp(lava),frozen=clamp(Math.max(glacier,Math.max(smooth(6,10,snow),smooth(1700,3000,elevationM)*(1-smooth(-2,3,temperature))*smooth(3,8,snow)*snowDeposit)))*(1-.65*smooth(.65,.95,slope))*(1-clamp(shore)*.85),rock=Math.max(smooth(.12,.6,slope),.7*smooth(1200,2200,elevationM)*(1-smooth(2,10,temperature))),dry=1-smooth(.2,.55,aridity),wet=clamp(shore)*(1-rock*.7);
  w[3]=frozen;let remain=1-frozen;w[4]=remain*volcanic;remain*=1-volcanic;w[2]=remain*rock;remain*=1-rock;w[5]=remain*wet;remain*=1-wet;const sand=Math.max(dry,clamp(coast)*.8);w[1]=remain*sand;w[0]=remain*(1-sand);return w;
}
