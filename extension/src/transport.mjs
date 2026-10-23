import { asset } from './storage.mjs';
// Serialized into MAIN by chrome.scripting. No extension secrets or imports here.
export async function pageAction(action,payload={}) {
  const w=window.WPP;
  const idOf=id=>typeof id==='string'?id:id?._serialized??(id?.user?`${id.user}@${id.server||'c.us'}`:'');
  const profile=()=>idOf(w?.conn?.getMyUserId?.()).split('@')[0];
  const ready=!!(w?.webpack?.isReady&&profile());
  const phoneOf=async value=>{
    let id=idOf(value);
    if(id.endsWith('@lid')){try{id=idOf((await w.contact.getPnLidEntry(id)).phoneNumber);}catch{return null;}}
    return /^[1-9]\d{7,14}@c\.us$/.test(id)?id.split('@')[0]:null;
  };
  if(action==='status')return{ready,profile:ready?profile():null,version:w?.version??null};
  if(!ready)return{error:'WhatsApp não está pronto.',beforeSend:true};
  if(action==='events'){
    if(!window.__splinkEvents){
      const queue=[];window.__splinkEvents={queue};
      w.on('chat.new_message',async message=>{
        const chat=idOf(message.chatId??message.from??message.id?.remote);
        if(chat.endsWith('@g.us')||message.fromMe||message.id?.fromMe)return;
        if(message.type&&message.type!=='chat')return;
        const account=profile(),at=Date.now(),phone=await phoneOf(chat);
        if(!phone||profile()!==account)return;
        queue.push({id:idOf(message.id)||message.id?.id,phone,profile:account,body:typeof message.body==='string'?message.body.slice(0,20000):'',name:message.sender?.pushname??'',fromMe:false,isGroup:false,at});
        if(queue.length>100)queue.shift();
      });
      w.on('chat.msg_ack_change',event=>{
        queue.push({kind:'ack',profile:profile(),ids:(event.ids??[]).map(idOf).filter(Boolean).slice(0,100),ack:event.ack,at:Date.now()});
        if(queue.length>100)queue.shift();
      });
    }
    return window.__splinkEvents.queue.splice(0,100);
  }
  if(action==='extract'){
    if(payload.group){
      const chat=w.chat.getActiveChat(),id=idOf(chat?.id);
      if(!id.endsWith('@g.us'))return{error:'Abra um grupo para extrair participantes.',beforeSend:true};
      const result=[];
      for(const p of await w.group.getParticipants(id)){const phone=await phoneOf(p.id);if(phone)result.push({phone,name:p.contact?.name||p.contact?.pushname||'Contato',fields:{}});}
      return result;
    }
    const result=[];
    for(const c of await w.chat.list()){const phone=await phoneOf(c.id);if(phone)result.push({phone,name:c.name||c.formattedTitle||c.contact?.name||'Contato',fields:{}});}
    return result;
  }
  if(action==='active'){
    const c=w.chat.getActiveChat(),id=idOf(c?.id);
    const phone=await phoneOf(id);
    if(!phone)return{error:'Abra uma conversa individual com número resolvido.',beforeSend:true};
    return{phone,name:c.name||c.formattedTitle||'Contato',profile:profile(),fields:{}};
  }
  if(action==='validate'){
    if(!/^\d{8,15}$/.test(payload.phone))return{error:'Telefone inválido.',beforeSend:true};
    const result=await w.contact.queryExists(payload.phone+'@c.us');return{exists:!!result?.wid,jid:idOf(result?.wid)};
  }
  if(action==='send'){
    if(profile()!==payload.profile)return{error:'Conta conectada diferente da campanha.',beforeSend:true};
    if(!/^\d{8,15}$/.test(payload.to))return{error:'Destinatário inválido.',beforeSend:true};
    let target;
    try{const resolution=await w.contact.queryExists(payload.to+'@c.us');if(!resolution?.wid)return{error:'Número não encontrado no WhatsApp.',beforeSend:true};target=idOf(resolution.wid);}
    catch(e){return{error:`Falha na consulta: ${e.message}`,beforeSend:true};}
    // Recheck account immediately before the irreversible operation.
    if(profile()!==payload.profile)return{error:'Conta alterada durante a consulta.',beforeSend:true};
    try {
      const item=payload.item;let result;
      if(item.type==='text')result=await w.chat.sendTextMessage(target,item.body,{createChat:true});
      else if(item.type==='contact')result=await w.chat.sendVCardContactMessage(target,{id:item.phone+'@c.us',name:item.contactName});
      else result=await w.chat.sendFileMessage(target,payload.data,{createChat:true,type:item.type==='audio'?'audio':item.type==='document'?'document':item.mime.startsWith('video/')?'video':'image',filename:item.fileName,caption:item.caption||'',isPtt:item.type==='audio'&&item.isPtt,isViewOnce:!!item.asViewOnce});
      return{id:idOf(result?.id)||(result?.id??null)};
    } catch(e){return{error:e.message,beforeSend:false};}
  }
  return{error:'Ação indisponível.',beforeSend:true};
}
export async function dataURL(blob) {
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
  for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return `data:${blob.type||'application/octet-stream'};base64,${btoa(binary)}`;
}
export class WhatsAppTransport {
  async tab(){const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});const tab=tabs.find(t=>t.active)??tabs[0];if(!tab)throw new Error('Abra o WhatsApp Web para conectar.');return tab;}
  async call(action,payload={}){
    const tab=await this.tab();let timer;
    try{
      const result=await Promise.race([chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:pageAction,args:[action,payload]}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Tempo limite do WhatsApp. Confira a conversa antes de reenviar.')),20000);})]);
      const value=result[0]?.result;if(value?.error){const e=new Error(value.error);e.beforeSend=value.beforeSend;throw e;}return value;
    } finally{clearTimeout(timer);}
  }
  async status(){try{return await this.call('status');}catch(e){return{ready:false,profile:null,error:e.message};}}
  async send(payload){
    let data;
    if(payload.item.assetId){const file=await asset(payload.item.assetId);if(!file){const e=new Error('Arquivo não encontrado na biblioteca.');e.beforeSend=true;throw e;}data=await dataURL(file.blob);}
    return this.call('send',{...payload,data});
  }
}
