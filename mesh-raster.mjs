import {meshCamera,inspectionZoom} from './mesh-camera.mjs?v=0.9.2';
/** CPU compatibility path: rasterizes the same complete indexed buffers. */
export function createSoftwareMeshPreview(canvas,mesh){
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Could not create the mesh preview.');
  function draw(lon=-35,lat=20,showWater=true,zoom=1,tilt=0){
    const rect=canvas.getBoundingClientRect(),w=Math.max(1,Math.min(640,Math.round(rect.width))),h=Math.max(1,Math.round(w*rect.height/rect.width));canvas.width=w;canvas.height=h;
    const image=ctx.createImageData(w,h),rgba=image.data,depth=new Float64Array(w*h).fill(-Infinity);
    for(let k=0;k<rgba.length;k+=4){rgba[k]=11;rgba[k+1]=23;rgba[k+2]=29;rgba[k+3]=255;}
    const camera=meshCamera(lon,lat,zoom,tilt,mesh.radiusM,mesh.focus?.groundM||0);zoom=inspectionZoom(mesh,camera,w/h,zoom);const {east,up,front,origin,light:lightDirection}=camera,scale=.45*h*zoom/(mesh.radiusM+4000),lightLength=Math.hypot(...lightDirection);
    function render(data,water){
      const source=data.positions,n=source.length/3,screen=new Float64Array(source.length);
      for(let i=0;i<n;i++){const k=i*3,x=source[k]-origin[0],y=source[k+1]-origin[1],z=source[k+2]-origin[2];screen[k]=w/2+(x*east[0]+y*east[1]+z*east[2])*scale;screen[k+1]=h/2-(x*up[0]+y*up[1]+z*up[2])*scale;screen[k+2]=x*front[0]+y*front[1]+z*front[2];}
      for(let k=0;k<data.indices.length;k+=3){
        const a=data.indices[k]*3,b=data.indices[k+1]*3,c=data.indices[k+2]*3,ax=screen[a],ay=screen[a+1],bx=screen[b],by=screen[b+1],cx=screen[c],cy=screen[c+1],area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
        if(area<=0)continue;
        const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5)),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));if(x0>x1||y0>y1)continue;
        const ux=source[b]-source[a],uy=source[b+1]-source[a+1],uz=source[b+2]-source[a+2],vx=source[c]-source[a],vy=source[c+1]-source[a+1],vz=source[c+2]-source[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
        const light=.35+.65*Math.max(0,(nx*lightDirection[0]+ny*lightDirection[1]+nz*lightDirection[2])/(Math.hypot(nx,ny,nz)*lightLength)),base=water?[41,117,145]:[125,125,110],vertexLight=data.normals?[a,b,c].map(i=>.35+.65*Math.max(0,(data.normals[i]*lightDirection[0]+data.normals[i+1]*lightDirection[1]+data.normals[i+2]*lightDirection[2])/(Math.hypot(...data.normals.subarray(i,i+3))*lightLength))):null;
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const px=x+.5,py=y+.5,wb=((px-ax)*(cy-ay)-(py-ay)*(cx-ax))/area,wc=((bx-ax)*(py-ay)-(by-ay)*(px-ax))/area,wa=1-wb-wc;
          if(wa< -1e-8||wb< -1e-8||wc< -1e-8)continue;
          const z=wa*screen[a+2]+wb*screen[b+2]+wc*screen[c+2],i=y*w+x;if(z<depth[i])continue;depth[i]=z;const intensity=vertexLight?wa*vertexLight[0]+wb*vertexLight[1]+wc*vertexLight[2]:light;rgba[i*4]=Math.round(base[0]*intensity);rgba[i*4+1]=Math.round(base[1]*intensity);rgba[i*4+2]=Math.round(base[2]*intensity);
        }
      }
    }
    render(mesh.ground,false);if(showWater)render(mesh.water||mesh.standingWater,true);ctx.putImageData(image,0,0);
  }
  return {draw,dispose(){ctx.clearRect(0,0,canvas.width,canvas.height);}};
}
