const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** A visual accumulation proxy from annual climate, not a snow-depth simulation. */
export function alpineClimate({elevationM=0,temperature=15,precipitation=1000,snowMonths=0,glacier=0,lava=0}){
 if(lava>.3)return null;
 if(glacier>.25)return {variant:'Glaciated terrain',snowSupply:1};
 if(elevationM<=1600)return null;
 const frozenInput=Math.max(0,precipitation)*Math.max(0,Math.min(1,snowMonths/12))*(1-smooth(-2,4,temperature)),snowSupply=.08+.92*smooth(60,600,frozenInput);
 return {variant:frozenInput>=250?'Snowy alpine':'Dry alpine',snowSupply};
}
