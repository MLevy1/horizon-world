import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const faults=[];
page.on('pageerror',e=>faults.push('PAGE '+String(e)));
page.on('console',msg=>{if(msg.type()==='error')faults.push('CONSOLE '+msg.text())});
page.on('requestfailed',req=>faults.push('REQUEST '+req.url()+' '+req.failure()?.errorText));
try {
 await page.goto('http://127.0.0.1:8123/',{waitUntil:'domcontentloaded',timeout:30000});
 const intro=page.locator('#intro'),start=page.locator('#start');
 await start.waitFor({state:'visible',timeout:30000});
 console.log('BEFORE',JSON.stringify({version:await page.locator('.brand span').textContent(),intro:await intro.getAttribute('class'),faults}));
 await page.waitForTimeout(3000);
 await start.click({timeout:30000});
 await page.waitForTimeout(3500);
 const state={intro:await intro.getAttribute('class'),faults,terrain:await page.locator('#region').textContent()};
 console.log('AFTER',JSON.stringify(state));
 assert.equal(faults.length,0,'Errors on startup: '+faults.join('\n'));
 assert.ok(state.intro.includes('hidden'),'Generate World button did not enter world');
 await page.screenshot({path:'alpha5-startup.png'});
}finally{await browser.close()}
