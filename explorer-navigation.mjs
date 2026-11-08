import {moveDirection,frame,dot} from './explorer-world.mjs?v=0.9.17';
export const WALK_SPEEDS=[.5,1,3,6,12],FLY_SPEEDS=[3,10,30,100,300,1000];
export function flightStep({direction,yaw,pitch,height,forward=0,right=0,vertical=0,speed=10,dt,radiusM}){
 const horizontal=forward*Math.cos(pitch),up=vertical+forward*Math.sin(pitch),length=Math.max(1,Math.hypot(horizontal,right,up)),distance=speed*Math.min(.1,Math.max(0,dt))/length,oldForward=frame(direction,yaw).forward;
 const next=horizontal||right?moveDirection(direction,yaw,horizontal,right,distance*Math.hypot(horizontal,right),radiusM+height):direction.slice(),basis=frame(next);
 return {direction:next,yaw:Math.atan2(dot(oldForward,basis.east),dot(oldForward,basis.north)),height:Math.min(6000,height+up*distance),distance:distance*Math.hypot(horizontal,right,up)};
}
/** App-owned map coordinates. Longitude wraps, latitude stops at the poles. */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>(x%1+1)%1;
export function mapGeometry(view,width,height){const w=Math.min(width,height*2)*view.zoom;return {w,h:w/2,x:width/2-view.cx*w,y:height/2-view.cy*w/2};}
export function mapPoint(view,x,y,width,height){const g=mapGeometry(view,width,height),v=(y-g.y)/g.h;if(v<0||v>1)return null;return {lon:wrap((x-g.x)/g.w)*360-180,lat:90-v*180};}
export function constrainMap(view,width,height){const g=mapGeometry(view,width,height),half=height/(2*g.h);return {...view,cx:wrap(view.cx),cy:half>=.5?.5:clamp(view.cy,half,1-half)};}
export function zoomMap(view,factor,x,y,width,height){const old=mapGeometry(view,width,height),u=(x-old.x)/old.w,v=(y-old.y)/old.h,next={...view,zoom:clamp(view.zoom*factor,1,64)},g=mapGeometry(next,width,height);next.cx=u-(x-width/2)/g.w;next.cy=v-(y-height/2)/g.h;return constrainMap(next,width,height);}
export function panMap(view,dx,dy,width,height){const g=mapGeometry(view,width,height);return constrainMap({...view,cx:view.cx-dx/g.w,cy:view.cy-dy/g.h},width,height);}
