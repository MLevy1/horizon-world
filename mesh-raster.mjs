/** CPU compatibility path: rasterizes the same complete indexed buffers. */
export function createSoftwareMeshPreview(canvas,mesh){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Could not create the mesh preview.');
  function draw(lon=-35,lat=20,showWater=true){
    const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.min(640,Math.round(rect.width))),h=Math.max(1,Math.round(w*rect.height/rect.width));canvas.width=w;canvas.height=h;
    const image=ctx.createImageData(w,h),rgba=image.data,depth=new Float64Array(w*h).fill(-Infinity);
    for(let k=0;k<rgba.length;k+=4){rgba[k]=11;rgba[k+1]=23;rgba[k+2]=29;rgba[k+3]=255;}
    const l=lon*Math.PI/180,p=lat*Math.PI/180,east=[-Math.sin(l),0,Math.cos(l)],up=[-Math.sin(p)*Math.cos(l),Math.cos(p),-Math.sin(p)*Math.sin(l)],front=[Math.cos(p)*Math.cos(l),Math.sin(p),Math.cos(p)*Math.sin(l)],scale=.45*h/(mesh.radiusM+4000);
    function render(data,water){
      const source=data.positions,n=source.length/3,screen=new Float64Array(source.length);
      for(let i=0;i<n;i++){const k=i*3,x=source[k],y=source[k+1],z=source[k+2];screen[k]=w/2+(x*east[0]+y*east[1]+z*east[2])*scale;screen[k+1]=h/2-(x*up[0]+y*up[1]+z*up[2])*scale;screen[k+2]=x*front[0]+y*front[1]+z*front[2];}
      for(let k=0;k<data.indices.length;k+=3){
        const a=data.indices[k]*3,b=data.indices[k+1]*3,c=data.indices[k+2]*3,ax=screen[a],ay=screen[a+1],bx=screen[b],by=screen[b+1],cx=screen[c],cy=screen[c+1],area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        if(area<=0)continue;
        const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));if(x0>x1||y0>y1)continue;
        const ux=source[b]-source[a],uy=source[b+1]-source[a+1],uz=source[b+2]-source[a+2],vx=source[c]-source[a],vy=source[c+1]-source[a+1],vz=source[c+2]-source[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        const light=.35+.65*Math.max(0,(nx*.5+ny*.8+nz*.7)/(Math.hypot(nx,ny,nz)*Math.sqrt(1.38))),color=(water?[41,117,145]:[125,125,110]).map(v=>Math.round(v*light));
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const px=x+.5,py=y+.5,wb=((px-ax)*(cy-ay)-(py-ay)*(cx-ax))/area,wc=((bx-ax)*(py-ay)-(by-ay)*(px-ax))/area,wa=1-wb-wc;
          if(wa< -1e-8||wb< -1e-8||wc< -1e-8)continue;
          const z=wa*screen[a+2]+wb*screen[b+2]+wc*screen[c+2],i=y*w+x;if(z<depth[i])continue;depth[i]=z;rgba[i*4]=color[0];rgba[i*4+1]=color[1];rgba[i*4+2]=color[2];
        }
      }
    }
    render(mesh.ground,false);if(showWater)render(mesh.standingWater,true);ctx.putImageData(image,0,0);
  }
  return {draw,dispose(){ctx.clearRect(0,0,canvas.width,canvas.height);}};
}
