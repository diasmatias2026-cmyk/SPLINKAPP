const { createRequire }=require('node:module');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const resolve=createRequire(process.env.SPLINK_PLAYWRIGHT_PATH||__filename);
const { chromium }=resolve('playwright');
(async()=>{
  fs.mkdirSync('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.SPLINK_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  try {
    await page.goto('http://127.0.0.1:4178');
    await page.getByRole('heading',{name:'Seu atendimento, em ordem.'}).waitFor();
    await page.screenshot({path:'artifacts/home-empty.png',fullPage:true});
    await page.getByRole('button',{name:'Biblioteca',exact:true}).click();
    await page.getByRole('button',{name:'Adicionar conteúdo',exact:true}).first().click();
    let modal=page.getByRole('dialog');
    await modal.getByLabel('Nome',{exact:true}).fill('Resposta de orçamento');
    await modal.getByLabel('Mensagem',{exact:false}).fill('Olá {nome}, recebemos seu pedido. <img src=x onerror="window.injetado=1">');
    await modal.getByRole('button',{name:'Salvar',exact:true}).click();
    await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Favoritar',exact:true}).click();
    await page.getByRole('button',{name:'Ver',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Concluir'}).click();
    assert.equal(await page.evaluate(()=>window.injetado),undefined);
    await page.reload();await page.getByText('Resposta de orçamento',{exact:true}).waitFor();
    await page.screenshot({path:'artifacts/library.png',fullPage:true});
    await page.getByRole('button',{name:'Automações',exact:true}).click();
    await page.getByRole('button',{name:'Novo funil',exact:true}).click();
    modal=page.getByRole('dialog');await modal.getByLabel('Nome',{exact:true}).fill('Recepção');
    await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Converter em fluxo',exact:true}).click();
    modal=page.getByRole('dialog');await modal.getByLabel('Nome do fluxo').fill('Funil convertido');
    await modal.getByRole('button',{name:'Salvar rascunho'}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Fluxos visuais',exact:true}).click();await page.getByRole('button',{name:'Novo fluxo',exact:true}).click();
    modal=page.getByRole('dialog');await modal.getByLabel('Nome do fluxo').fill('Atendimento inicial');
    await modal.getByRole('button',{name:'+ Conteúdo',exact:true}).click();
    await page.screenshot({path:'artifacts/flow-editor.png',fullPage:true});
    await modal.getByRole('button',{name:'Salvar rascunho'}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Publicar',exact:true}).last().click();
    await page.getByRole('button',{name:'Contatos e CRM',exact:true}).click();
    await page.getByRole('button',{name:'Nova etiqueta',exact:true}).click();modal=page.getByRole('dialog');await modal.getByLabel('Nome',{exact:true}).fill('Orçamentos');await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Importar contatos',exact:true}).click();modal=page.getByRole('dialog');await modal.getByLabel('Ou cole uma lista').fill('telefone,nome,cidade\n5511999990001,Ana,São Paulo\n5511999990001,Ana,São Paulo');await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Gerenciar',exact:true}).click();modal=page.getByRole('dialog');await modal.getByLabel('Orçamentos',{exact:true}).check();await modal.getByRole('button',{name:'Salvar',exact:true}).click();await modal.waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Campanhas',exact:true}).click();await page.getByRole('button',{name:'Nova campanha',exact:true}).click();modal=page.getByRole('dialog');
    await modal.getByLabel('Nome da campanha').fill('Piloto pausado');await modal.getByLabel('Conteúdo ou automação').selectOption({label:'Texto · Resposta de orçamento'});await modal.getByLabel('Conta do WhatsApp').fill('5511999990000');await modal.getByLabel('Destinatários',{exact:false}).fill('telefone,nome,cidade\n5511999990001,Ana,São Paulo');
    await modal.getByRole('button',{name:'Salvar campanha'}).click();await modal.waitFor({state:'hidden'});
    const snapshot=await page.evaluate(async()=>{const {api}=await import('/src/client.mjs');return api('STATE');});
    assert.equal(snapshot.contents.length,1);assert.equal(snapshot.funnels.length,1);assert.equal(snapshot.flows.length,2);assert.ok(snapshot.flows.some(f=>f.published));assert.equal(snapshot.contacts.length,1);assert.equal(snapshot.jobs.length,1);assert.equal(snapshot.jobs[0].desired,'paused');
    // Restore a real Blob, published snapshot and paused job through IndexedDB.
    await page.evaluate(async()=>{
      const {api}=await import('/src/client.mjs'),{putAsset}=await import('/src/storage.mjs');
      await putAsset({id:'binary-fixture',name:'sample.pdf',blob:new Blob([new Uint8Array([0,255,1,128])],{type:'application/pdf'})});
      await api('SAVE_CONTENT',{name:'Arquivo de teste',type:'document',assetId:'binary-fixture',fileName:'sample.pdf',mime:'application/pdf'});
    });
    // Actual IndexedDB transactions serialize independent concurrent updates.
    const increments=await page.evaluate(async()=>{const {store}=await import('/src/storage.mjs');await Promise.all(Array.from({length:10},()=>store.mutate(s=>s.settings.testCounter=(s.settings.testCounter??0)+1)));return(await store.read()).settings.testCounter;});assert.equal(increments,10);
    await page.screenshot({path:'artifacts/campaigns.png',fullPage:true});
    await page.getByRole('button',{name:'Configurações',exact:true}).click();
    const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Gerar backup completo'}).click();const file=await downloadEvent;const backup=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(backup.state.contents.length,2);
    const restored=await page.evaluate(async backup=>{
      const {api}=await import('/src/client.mjs'),{asset,store}=await import('/src/storage.mjs');
      await store.mutate(s=>s.contents=[]);await api('IMPORT',backup);
      const state=await api('STATE'),file=await asset('binary-fixture');
      const before=JSON.stringify(state);let rejected=false;
      try{await api('IMPORT',{...backup,assets:[{...backup.assets[0],data:'https://invalid.example/file'}]});}catch{rejected=true;}
      const unchanged=JSON.stringify(await api('STATE'))===before;
      await store.mutate(s=>s.jobs[0].status='running');let busyRejected=false;
      try{await api('IMPORT',backup);}catch{busyRejected=true;}
      const busyState=await api('STATE');await store.mutate(s=>s.jobs[0].status='paused');
      return{state,bytes:Array.from(new Uint8Array(await file.blob.arrayBuffer())),rejected,unchanged,busyRejected,busyPreserved:busyState.jobs[0].status==='running'};
    },backup);
    assert.equal(restored.state.contents.length,2);assert.ok(restored.state.flows.some(f=>f.published));assert.equal(restored.state.jobs[0].desired,'paused');assert.deepEqual(restored.bytes,[0,255,1,128]);assert.ok(restored.rejected&&restored.unchanged);
    assert.ok(restored.busyRejected&&restored.busyPreserved);
    await page.reload();await page.getByRole('heading',{name:'Configurações',exact:true}).waitFor();
    await page.getByLabel('Tema',{exact:true}).selectOption('dark');await page.waitForFunction(()=>document.body.dataset.theme==='dark');
    await page.screenshot({path:'artifacts/settings-dark.png',fullPage:true});
    await page.getByLabel('Tema',{exact:true}).selectOption('light');
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Sua operação',exact:true}).click();await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Mobile page overflow');
    assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/browser-results.json',JSON.stringify({passed:true,checks:['library CRUD and safe text','favorites','persistence after reload','funnel creation','flow draft and publish','tags and contact dedup','paused campaign snapshot','concurrent IDB transactions','backup download','theme','390px no overflow'],errors},null,2));
    console.log('Browser journeys passed (preview, real IndexedDB; no WhatsApp messages).');
  } catch(error){await page.screenshot({path:'artifacts/browser-failure.png',fullPage:true});console.error('Page at failure:',await page.locator('body').innerText());console.error('Page errors:',errors);throw error;} finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
