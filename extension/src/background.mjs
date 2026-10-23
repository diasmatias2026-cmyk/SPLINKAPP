import { store, allAssets, replaceDatabase } from './storage.mjs';
import { Engine } from './engine.mjs';
import { WhatsAppTransport, dataURL } from './transport.mjs';
import { applyCommand } from './operations.mjs';
import { validateBackup, terminal } from './domain.mjs';
const transport=new WhatsAppTransport();
const engine=new Engine(store,transport);
const dashboard=chrome.runtime.getURL('dashboard.html');
const isDashboard=sender=>sender.id===chrome.runtime.id&&[dashboard,chrome.runtime.getURL('popup.html')].some(url=>sender.url?.split('#')[0]===url);
async function openDashboard(){const tabs=await chrome.tabs.query({url:dashboard});if(tabs[0])await chrome.tabs.update(tabs[0].id,{active:true});else await chrome.tabs.create({url:dashboard});}
async function pulse(){try{const messages=await transport.call('events');if(Array.isArray(messages))for(const m of messages){if(m.kind==='ack')await engine.ack(m);else await engine.incoming(m);}await engine.tick();}catch{/* Offline remains queued; never mark it sent. */}}
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('splink-scheduler',{periodInMinutes:0.5}));
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('splink-scheduler',{periodInMinutes:0.5}));
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='splink-scheduler')void pulse();});
chrome.action.onClicked.addListener(()=>void openDashboard());
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||!message||typeof message.type!=='string')return false;
  if(!isDashboard(sender)){
    if(sender.tab?.url?.startsWith('https://web.whatsapp.com/')&&message.type==='PULSE'){pulse().then(()=>respond({ok:true}),()=>respond({ok:false}));return true;}
    if(sender.tab?.url?.startsWith('https://web.whatsapp.com/')&&message.type==='OPEN'){openDashboard().then(()=>respond({ok:true}));return true;}
    respond({ok:false,error:'Origem não autorizada.'});return false;
  }
  (async()=>{
    const {type,payload={}}=message;
    if(type==='STATE')return store.read();
    if(type==='STATUS')return transport.status();
    if(type==='PULSE'){await pulse();return null;}
    if(type==='OPEN_WA')return chrome.tabs.create({url:'https://web.whatsapp.com/'});
    if(type==='EXTRACT')return transport.call('extract',payload);
    if(type==='VALIDATE')return transport.call('validate',payload);
    if(type==='ACTIVE')return transport.call('active');
    if(type==='EXPORT'){
      const state=await store.read();state.triggers.forEach(t=>t.enabled=false);
      for(const j of state.jobs)if(!terminal(j.status)){j.resumeStatus=j.resumeStatus??j.status;j.desired='paused';j.status=j.status==='running'?'unknown':'paused';}
      const files=await allAssets();const assets=[];for(const f of files)assets.push({id:f.id,name:f.name,data:await dataURL(f.blob)});
      return{format:'splink',version:1,createdAt:new Date().toISOString(),state,assets};
    }
    if(type==='IMPORT'){
      const current=await store.read();if(current.jobs.some(j=>j.status==='running'))throw new Error('Aguarde o envio em andamento antes de restaurar.');
      const backup=validateBackup(payload);const files=[];
      for(const a of backup.assets){if(typeof a.data!=='string'||!a.data.startsWith('data:')||a.data.length>28_000_000)throw new Error('Arquivo inválido no backup.');const r=await fetch(a.data);files.push({id:a.id,name:a.name,blob:await r.blob()});}
      for(const j of backup.state.jobs){if(!terminal(j.status)){j.desired='paused';j.status=j.status==='running'?'unknown':'paused';}}
      backup.state.triggers.forEach(t=>t.enabled=false);
      await replaceDatabase(backup.state,files);return null;
    }
    const result=await store.mutate(s=>applyCommand(s,type,payload));
    return result;
  })().then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.message||'Não foi possível concluir.'}));return true;
});
