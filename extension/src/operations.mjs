import { uid, text, saveContent, createCampaign, compileSequence, publishFlow, validateSequence, terminal, normalizePhone } from './domain.mjs';
export function applyCommand(s,type,p={}) {
  if(type==='CONVERT_FUNNEL'){
    const funnel=s.funnels.find(f=>f.id===p.id);if(!funnel)throw new Error('Funil não encontrado.');
    const sequence=compileSequence(s,{kind:'funnel',id:funnel.id});
    const nodes=sequence.nodes.map((n,index)=>{const node={...n,x:220,y:40+index*110};if(node.item){node.itemId=node.item.id;delete node.item;}return node;});
    return applyCommand(s,'SAVE_FLOW',{name:`${funnel.name.slice(0,100)} · fluxo`,draft:{start:sequence.start,nodes}});
  }
  if(type==='BULK_TAG'){
    if(!Array.isArray(p.phones)||!p.phones.length||p.phones.length>10000||!['copy','move','remove'].includes(p.mode))throw new Error('Movimentação inválida.');
    if(!s.tags.some(t=>t.id===p.to)||(p.mode==='move'&&(!s.tags.some(t=>t.id===p.from)||p.from===p.to)))throw new Error('Selecione etiquetas válidas e diferentes.');
    const phones=new Set(p.phones.map(normalizePhone));let count=0;
    for(const c of s.contacts){if(!phones.has(c.phone))continue;if(p.mode==='move'&&!c.tags?.includes(p.from))continue;
      c.tags=(c.tags??[]).filter(id=>p.mode==='move'?id!==p.from:p.mode==='remove'?id!==p.to:true);
      if(p.mode!=='remove'&&!c.tags.includes(p.to))c.tags.push(p.to);count++;
    }return{count};
  }
  if(type==='CLEAR_DATA'){
    if(p.confirmation!=='LIMPAR'||!['history','completed','contacts'].includes(p.scope))throw new Error('Confirme a limpeza digitando LIMPAR.');
    if(s.jobs.some(j=>!terminal(j.status)))throw new Error('Conclua ou cancele as execuções pendentes antes de limpar dados.');
    if(p.scope==='history'){s.events=[];s.acks={};}
    if(p.scope==='contacts')s.contacts=[];
    if(p.scope==='completed'){s.jobs=[];s.campaigns=[];s.events=[];s.acks={};}
    return;
  }
  if(type==='SAVE_CONTENT')return saveContent(s,p);
  if(type==='DELETE_CONTENT'){
    if(s.funnels.some(f=>f.steps.some(step=>step.itemId===p.id))||s.flows.some(f=>f.draft.nodes.some(n=>n.itemId===p.id)))throw new Error('Este conteúdo é usado em funil/fluxo. Remova a referência primeiro.');
    s.contents=s.contents.filter(c=>c.id!==p.id);return;
  }
  if(type==='FAVORITE'){const c=s.contents.find(c=>c.id===p.id);if(!c)throw new Error('Conteúdo não encontrado.');c.favorite=!c.favorite;return;}
  if(type==='SAVE_FUNNEL'){
    if(!Array.isArray(p.steps)||!p.steps.length||p.steps.length>100)throw new Error('Adicione entre 1 e 100 etapas.');
    const item={id:p.id||uid(),name:text(p.name,'Nome',120),steps:p.steps.map(x=>({itemId:text(x.itemId,'Conteúdo',100),delay:Number(x.delay)}))};
    if(item.steps.some(x=>!Number.isFinite(x.delay)||x.delay<0||x.delay>31536000))throw new Error('Atraso inválido.');
    const previous=s.funnels.findIndex(x=>x.id===item.id),draft=structuredClone(s);
    if(previous<0)draft.funnels.push(item);else draft.funnels[previous]=item;
    compileSequence(draft,{kind:'funnel',id:item.id});s.funnels=draft.funnels;return item;
  }
  if(type==='SAVE_FLOW'){
    const flow={id:p.id||uid(),name:text(p.name,'Nome',120),draft:structuredClone(p.draft),updatedAt:Date.now()};
    if(!flow.draft||!Array.isArray(flow.draft.nodes)||flow.draft.nodes.length>200)throw new Error('Rascunho inválido. Limite de 200 nós.');
    const existing=s.flows.find(f=>f.id===flow.id);
    if(existing)Object.assign(existing,flow);else s.flows.push(flow);return existing??flow;
  }
  if(type==='PUBLISH_FLOW')return publishFlow(s,p.id);
  if(type==='SAVE_TRIGGER'){
    compileSequence(s,p.source);
    if(!Array.isArray(p.rules)||!p.rules.length||p.rules.length>20||p.rules.some(r=>!['contains','equals','startsWith','notContains'].includes(r.operator)||!r.words?.length||r.words.length>30||r.words.some(w=>typeof w!=='string'||!w.trim()||w.length>200)))throw new Error('Condições de gatilho inválidas.');
    if(!Number.isFinite(p.cooldown)||p.cooldown<60||!Number.isFinite(p.delay)||p.delay<0||p.delay>86400)throw new Error('Cooldown mínimo de 60s; atraso entre 0 e 86400s.');
    const trigger={id:p.id||uid(),name:text(p.name,'Nome',120),profile:text(p.profile,'Conta',80),source:structuredClone(p.source),rules:structuredClone(p.rules),caseSensitive:!!p.caseSensitive,enabled:!!p.enabled,cooldown:p.cooldown,delay:p.delay};
    const old=s.triggers.find(t=>t.id===trigger.id);if(old)Object.assign(old,trigger);else s.triggers.push(trigger);return trigger;
  }
  if(type==='TOGGLE_TRIGGER'){const t=s.triggers.find(t=>t.id===p.id);if(!t)throw new Error('Gatilho ausente.');t.enabled=!t.enabled;return;}
  if(type==='DELETE'){
    if(!['triggers','funnels','flows','tags'].includes(p.collection))throw new Error('Coleção inválida.');
    if(['funnels','flows'].includes(p.collection)&&s.triggers.some(t=>t.source.id===p.id))throw new Error('Remova primeiro o gatilho que usa este recurso.');
    s[p.collection]=s[p.collection].filter(x=>x.id!==p.id);return;
  }
  if(type==='CREATE_CAMPAIGN')return createCampaign(s,p);
  if(type==='CONTROL'){
    if(!['active','paused','cancelled'].includes(p.desired))throw new Error('Controle inválido.');
    for(const j of s.jobs.filter(j=>j.campaignId===p.id&&!terminal(j.status)))j.desired=p.desired;return;
  }
  if(type==='RETRY_FAILED'){
    const job=s.jobs.find(j=>j.id===p.id);if(!job||job.status!=='failed')throw new Error('Somente falhas anteriores ao envio podem ser retomadas.');
    job.status='queued';job.desired='active';job.error=null;job.wakeAt=Date.now();return;
  }
  if(type==='SAVE_TAG'){
    const tag={id:p.id||uid(),name:text(p.name,'Etiqueta',80),color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#5d6871',description:String(p.description??'').slice(0,500)};
    if(s.tags.some(t=>t.id!==tag.id&&t.name.toLowerCase()===tag.name.toLowerCase()))throw new Error('Já existe uma etiqueta com este nome.');
    const previous=s.tags.find(t=>t.id===tag.id);if(previous)Object.assign(previous,tag);else s.tags.push(tag);return tag;
  }
  if(type==='SAVE_CONTACTS'){
    if(!Array.isArray(p.contacts)||p.contacts.length>10000)throw new Error('Lista inválida.');
    for(const r of p.contacts){const phone=normalizePhone(r.phone),existing=s.contacts.find(x=>x.phone===phone);const contact={phone,name:text(r.name||'Contato','Nome',120),fields:r.fields??existing?.fields??{},tags:(r.tags??existing?.tags??[]).filter(id=>s.tags.some(t=>t.id===id)),optOut:r.optOut===undefined?!!existing?.optOut:!!r.optOut};if(existing)Object.assign(existing,contact);else s.contacts.push(contact);}return;
  }
  if(type==='CONTACT_TAG'){
    const c=s.contacts.find(c=>c.phone===p.phone);if(!c)throw new Error('Contato não encontrado.');
    if(p.optOut!==undefined)c.optOut=!!p.optOut;
    if(p.tagId){if(!s.tags.some(t=>t.id===p.tagId))throw new Error('Etiqueta ausente.');c.tags??=[];if(c.tags.includes(p.tagId))c.tags=c.tags.filter(id=>id!==p.tagId);else c.tags.push(p.tagId);}return;
  }
  if(type==='SETTINGS'){
    if(!['light','dark','system'].includes(p.theme))throw new Error('Tema inválido.');s.settings.theme=p.theme;return;
  }
  throw new Error('Comando não reconhecido.');
}
