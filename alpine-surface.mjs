const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function noise(p,seed){const cell=p.map(Math.floor),f=p.map((v,k)=>smooth(0,1,v-cell[k])),hash=(x,y,z)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};let n=0;for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++)n+=hash(cell[0]+x,cell[1]+y,cell[2]+z)*(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);return n;}
export function createAlpineRelief(seed){let salt=2166136261;for(const c of String(seed))salt=Math.imul(salt^c.charCodeAt(0),16777619);return ({direction,radiusM,elevationM,temperature,glacier=0,lava=0,protectedWater=false})=>{
 if(protectedWater||glacier>.05||lava>.1)return 0;
 const mask=smooth(1600,2600,elevationM)*(1-smooth(2,10,temperature));if(!mask)return 0;
 const p=direction.map(v=>v*radiusM),ridge=scale=>1-2*Math.abs(noise(p.map(v=>v/scale),salt)-.5);
 // Nested, world-addressed incisions break broad scaffold facets without adding water.
 return -mask*(34*ridge(600)**3+13*ridge(180)**4+3*ridge(45)**3);
};}
