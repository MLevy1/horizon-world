import test from 'node:test';
import assert from 'node:assert/strict';
import {createExplorerMap} from '../explorer-map.mjs';
test('map taps select a pin; drags and multi-finger gestures never trigger selection or travel',()=>{
 const handlers={},selections=[],draws=[],ctx=new Proxy({drawImage:(...a)=>draws.push(a)},{get:(t,k)=>k in t?t[k]:()=>{}});globalThis.devicePixelRatio=1;globalThis.ResizeObserver=class{observe(){}};globalThis.document={createElement:()=>({getContext:()=>ctx})};
 const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:400,height:250}),addEventListener:(type,fn)=>handlers[type]=fn,focus(){},setPointerCapture(){}};
 const map=createExplorerMap({canvas,getPosition:()=>({lon:0,lat:0}),onSelect:p=>selections.push(p)});map.setWorld({width:800,height:400},[]);selections.length=0;
 const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 handlers.pointerdown(event(1,150,100));handlers.pointermove(event(1,200,100));handlers.pointerup(event(1,200,100));assert.equal(selections.length,0);
 handlers.pointerdown(event(1,200,100));handlers.pointerup(event(1,200,100));assert.equal(selections.length,1);assert.ok(Number.isFinite(selections[0].lon));
 selections.length=0;handlers.pointerdown(event(1,100,100));handlers.pointerdown(event(2,200,100));handlers.pointermove(event(2,300,100));handlers.pointerup(event(2,300,100));handlers.pointerup(event(1,100,100));assert.equal(selections.length,0);assert.ok(draws.some(a=>a[3]>400));
 let prevented=false;handlers.wheel({clientX:200,clientY:125,deltaY:-100,preventDefault(){prevented=true;}});assert.equal(prevented,true);handlers.keydown({key:'Enter',preventDefault(){}});assert.equal(selections.length,1);map.reset();assert.equal(draws.at(-1)[3],400);
});
