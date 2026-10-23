const {createRequire}=require('node:module');
const requireBundle=createRequire(process.env.SPLINK_PLAYWRIGHT_PATH||__filename);
const {chromium}=requireBundle('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
  const extension=path.resolve('dist');fs.mkdirSync('artifacts',{recursive:true});
  const profile=path.resolve('artifacts','test-profile-'+Date.now());
  const context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.SPLINK_BROWSER||'C:/Users/Marco/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:20000});
    const id=new URL(worker.url()).host;
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`chrome-extension://${id}/dashboard.html`);await page.getByRole('heading',{name:'Seu atendimento, em ordem.'}).waitFor();
    const result=await page.evaluate(async()=>{
      const status=await chrome.runtime.sendMessage({type:'STATUS'}),state=await chrome.runtime.sendMessage({type:'STATE'});
      const saved=await chrome.runtime.sendMessage({type:'SAVE_CONTENT',payload:{type:'text',name:'Teste de integração',body:'Mensagem de teste, sem envio.'}});
      const backup=await chrome.runtime.sendMessage({type:'EXPORT'});
      return{status,state,saved,backup};
    });
    assert.equal(result.status.data.ready,false);assert.equal(result.state.ok,true);assert.equal(result.saved.ok,true);assert.equal(result.backup.data.state.contents.length,1);
    assert.deepEqual(errors,[]);await page.screenshot({path:'artifacts/extension-loaded.png',fullPage:true});
    // The entire WhatsApp document is intercepted: this is a synthetic fixture,
    // in a fresh browser profile. No WhatsApp network or real account is used.
    await context.route('https://web.whatsapp.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>WhatsApp fixture — no network</title><h1>Isolated transport fixture</h1>'}));
    const wa=await context.newPage();await wa.goto('https://web.whatsapp.com/');
    await page.evaluate(async()=>{
      const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
      await chrome.scripting.executeScript({target:{tabId:tabs[0].id},world:'MAIN',func:()=>{
        window.__testSends=[];
        window.WPP={webpack:{isReady:true},version:'test-fixture',conn:{getMyUserId:()=>({_serialized:'5511999990000@c.us'})},on:()=>{},contact:{queryExists:async()=>({wid:{_serialized:'5511999990001@c.us'}})},chat:{sendTextMessage:async(to,body)=>{window.__testSends.push({to,body});return{id:{_serialized:'fixture-accepted-1'}};}}};
      }});
      const contents=(await chrome.runtime.sendMessage({type:'STATE'})).data.contents;
      const result=await chrome.runtime.sendMessage({type:'CREATE_CAMPAIGN',payload:{name:'Integration fixture',profile:'5511999990000',source:{kind:'item',id:contents[0].id},recipients:[{phone:'5511999990001',name:'Fixture'}],delayMin:1,delayMax:1,paused:false}});
      if(!result.ok)throw new Error(result.error);
      await chrome.runtime.sendMessage({type:'PULSE'});
    });
    const executed=await page.evaluate(async()=>(await chrome.runtime.sendMessage({type:'STATE'})).data);
    assert.equal(executed.jobs[0].status,'completed');assert.equal(executed.events[0].messageId,'fixture-accepted-1');
    const calls=await wa.evaluate(()=>window.__testSends);assert.equal(calls.length,1);
    await page.evaluate(()=>chrome.runtime.sendMessage({type:'PULSE'}));assert.equal((await wa.evaluate(()=>window.__testSends)).length,1);
    const untrusted=await wa.evaluate(()=>chrome.runtime.sendMessage?.({type:'STATE'}).catch(()=>null)).catch(()=>null);assert.ok(!untrusted?.ok);
    fs.writeFileSync('artifacts/extension-results.json',JSON.stringify({passed:true,id,checks:['Manifest V3 load','module service worker starts','CSP dashboard modules load','sender authorization','IndexedDB content saved via service worker','full backup through runtime messaging','synthetic MAIN-world transport','account check and queue execute once','transport identifier persisted','no WhatsApp network or real messages'],errors},null,2));
    console.log('Unpacked extension + synthetic MAIN transport integration passed; no real messages.');
  } finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
