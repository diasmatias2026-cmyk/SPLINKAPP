import { store, allAssets, replaceDatabase } from './storage.mjs';
import { applyCommand } from './operations.mjs';
import { validateBackup,terminal } from './domain.mjs';
import { dataURL } from './transport.mjs';
export const preview=!globalThis.chrome?.runtime?.id;
export async function api(type,payload={}){
  if(!preview){const response=await chrome.runtime.sendMessage({type,payload});if(!response?.ok)throw new Error(response?.error||'Recarregue a extensão e tente novamente.');return response.data;}
  if(type==='STATE')return store.read();
  if(type==='STATUS')return{ready:false,profile:null,error:'Prévia local · envios desativados'};
  if(type==='PULSE')return;
  if(type==='EXPORT'){const state=await store.read(),assets=[];for(const a of await allAssets())assets.push({id:a.id,name:a.name,data:await dataURL(a.blob)});return{format:'splink',version:1,state,assets};}
  if(type==='IMPORT'){const b=validateBackup(payload),assets=[];for(const a of b.assets){if(!a.data?.startsWith('data:'))throw new Error('Arquivo inválido.');assets.push({id:a.id,name:a.name,blob:await(await fetch(a.data)).blob()});}for(const j of b.state.jobs)if(!terminal(j.status)){j.desired='paused';j.status='paused';}b.state.triggers.forEach(t=>t.enabled=false);return replaceDatabase(b.state,assets);}
  if(['EXTRACT','ACTIVE','VALIDATE','OPEN_WA'].includes(type))throw new Error('Instale a extensão no Edge/Chrome para conectar ao WhatsApp.');
  return store.mutate(s=>applyCommand(s,type,payload));
}
