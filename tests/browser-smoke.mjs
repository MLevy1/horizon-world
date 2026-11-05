import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const faults=[];
page.on('pageerror',e=>faults.push(String(e)));
page.on('console',msg=>{if(msg.type()==='error')faults.push(msg.text())});
const begin=Date.now();
try{
 await page.goto('http://127.0.0.1:8123/',{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#loading').waitFor({state:'visible',timeout:30000});
 const version=await page.locator('.brand span').textContent();
 assert.ok(version.includes('4.3.0'),version);
 // Rendering is expected to be heavier than before; fail fast on JS exceptions.
 await page.waitForTimeout(6000);
 assert.deepEqual(faults,[],'Uncaught errors while generating world');
 // Settings remains reachable and scrollable at iPhone viewport.
 await page.locator('#settingsBtn').click();
 assert.equal(await page.locator('#panel').evaluate(e=>e.classList.contains('open')),true);
 await page.locator('#closeSettings').click();
 // Exercise the same hydrology path that is used by world-space terrain queries.
 await page.locator('#mapBtn').click();
 await page.locator('#mapWatershed').click({timeout:100000});
 await page.locator('#mapTitle').waitFor({state:'visible'});
 await page.locator('#mapCanvas').click({position:{x:140,y:140},timeout:100000});
 const stats=await page.locator('#drainageStats').textContent();
 assert.ok(stats.includes('3D rendered reaches:'),stats);
 await page.screenshot({path:'alpha4-mobile-smoke.png',fullPage:false});
 assert.deepEqual(faults,[],'Browser runtime errors');
 console.log(JSON.stringify({elapsedSeconds:(Date.now()-begin)/1000,version,stats:stats.slice(0,180)}));
}finally{await browser.close()}
