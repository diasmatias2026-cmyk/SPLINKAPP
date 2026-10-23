export const uid = () => crypto.randomUUID();
const copy = value => structuredClone(value);
export const terminal = status => ['completed','accepted','failed','cancelled','unknown'].includes(status);
export function initialState() {
  return {version:1,revision:0,contents:[],funnels:[],flows:[],triggers:[],tags:[],contacts:[],campaigns:[],jobs:[],events:[],seen:[],cooldowns:{},nextAllowed:{},acks:{},settings:{minDelay:6,maxDelay:16,theme:'light'}};
}
export function text(value, label='Campo', max=1000) {
  if(typeof value!=='string'||!value.trim()||value.length>max) throw new Error(`${label}: preencha entre 1 e ${max} caracteres.`);
  return value.trim();
}
export function normalizePhone(value) {
  let number=String(value??'').replace(/\D/g,'');
  if(number.length===10||number.length===11) number='55'+number;
  if(!/^[1-9]\d{7,14}$/.test(number)) throw new Error('Telefone inválido; use DDI, DDD e número.');
  return number;
}
export function parseContacts(input) {
  if(typeof input!=='string'||input.length>2_000_000) throw new Error('Lista muito grande. Limite: 2 MB.');
  const raw=input.replace(/^\uFEFF/,'');
  const first=raw.split(/\r?\n/)[0]??'';
  let inside=false,commas=0,semicolons=0;
  for(let i=0;i<first.length;i++){if(first[i]==='"'){if(inside&&first[i+1]==='"')i++;else inside=!inside;}else if(!inside){if(first[i]===',')commas++;if(first[i]===';')semicolons++;}}
  const separator=semicolons>commas?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<=raw.length;i++) {
    const c=raw[i];
    if(c==='"') {if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===separator||c==='\n'||c===undefined)) {
      row.push(cell.trim());cell='';
      if(c!==separator){if(row.some(Boolean))rows.push(row);row=[];}
    } else if(c!=='\r') cell+=c??'';
  }
  if(quoted)throw new Error('CSV com aspas não fechadas.');
  const header=rows[0]?.some(c=>/^(telefone|numero|número|phone|whatsapp)$/i.test(c))?rows.shift().map(c=>c.toLowerCase()):null;
  const phoneIndex=header?header.findIndex(c=>/^(telefone|numero|número|phone|whatsapp)$/.test(c)):0;
  const nameIndex=header?header.findIndex(c=>/^(nome|name)$/.test(c)):1;
  const contacts=[],errors=[],seen=new Set();let duplicates=0;
  for(const [index,columns] of rows.entries()) {
    try {
      const phone=normalizePhone(columns[phoneIndex]);
      if(seen.has(phone)){duplicates++;continue;}seen.add(phone);
      const fields=Object.fromEntries(columns.flatMap((v,i)=>[[`campo${i}`,v],...(header?.[i]?[[header[i],v]]:[])]));
      fields.cidade??=columns[2]??'';
      contacts.push({phone,original:columns[phoneIndex],name:columns[nameIndex]||'Contato',fields});
    } catch(e){errors.push({line:index+(header?2:1),reason:e.message});}
  }
  if(contacts.length>10000)throw new Error('Divida a campanha em listas de até 10.000 contatos.');
  return {contacts,errors,duplicates};
}
export function renderVariables(template,contact,hour=new Date().getHours()) {
  return String(template??'').replace(/\{([\wÀ-ÿ]+)\}/g,(_,key)=>{
    const values={...contact.fields,nome:contact.name,telefone:contact.phone,saudacao:hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite'};
    if(!Object.hasOwn(values,key))throw new Error(`Variável sem valor: {${key}}.`);
    return values[key]??'';
  });
}
export function saveContent(s,input) {
  if(!['text','audio','media','document','contact'].includes(input.type))throw new Error('Tipo de conteúdo inválido.');
  const previous=s.contents.find(x=>x.id===input.id);
  const item={id:previous?.id??uid(),name:text(input.name,'Nome',120),type:input.type,favorite:!!input.favorite,updatedAt:Date.now()};
  if(input.type==='text')item.body=text(input.body,'Mensagem',20000);
  else if(input.type==='contact'){item.phone=normalizePhone(input.phone);item.contactName=text(input.contactName,'Nome do contato',120);}
  else {
    item.assetId=text(input.assetId,'Arquivo',100);item.fileName=text(input.fileName,'Nome do arquivo',255);
    item.mime=text(input.mime,'Tipo de arquivo',100);item.caption=String(input.caption??'').slice(0,10000);
    item.isPtt=input.type==='audio'&&!!input.isPtt;item.asViewOnce=input.type!=='document'&&!!input.asViewOnce;
    if(input.type==='audio'&&!item.mime.startsWith('audio/'))throw new Error('Selecione um arquivo de áudio.');
    if(input.type==='media'&&!/^(image|video)\//.test(item.mime))throw new Error('Selecione uma imagem ou vídeo.');
  }
  if(previous)Object.assign(previous,item);else s.contents.push(item);
  return previous??item;
}
function hydrateNodes(s,nodes) {
  return nodes.map(node=>{
    const n=copy(node);
    if(n.type==='item'){const item=s.contents.find(x=>x.id===n.itemId);if(!item)throw new Error(`Conteúdo não encontrado no nó ${n.id}.`);n.item=copy(item);}
    if(!['item','delay','response','random'].includes(n.type))throw new Error('Tipo de nó inválido.');
    if(n.type==='delay'&&(!Number.isFinite(n.seconds)||n.seconds<1||n.seconds>31536000))throw new Error('Espera deve ter entre 1 segundo e 365 dias.');
    if(n.type==='response'&&(!Number.isFinite(n.timeout)||n.timeout<1))throw new Error('Resposta precisa de prazo em segundos.');
    if(n.type==='random'&&(!n.branches?.length||n.branches.some(b=>!Number.isFinite(b.weight)||b.weight<=0)))throw new Error('Ramificações precisam de pesos positivos.');
    return n;
  });
}
export function validateSequence(sequence) {
  if(!sequence||!Array.isArray(sequence.nodes)||!sequence.nodes.length||sequence.nodes.length>200)throw new Error('Sequência precisa de 1 a 200 nós.');
  const ids=new Set(sequence.nodes.map(n=>n.id));
  if(ids.size!==sequence.nodes.length||!ids.has(sequence.start))throw new Error('IDs duplicados ou início inválido.');
  const reached=new Set();
  function visit(id,ancestors=new Set()) {
    if(!id)return;if(!ids.has(id))throw new Error(`Ligação para nó inexistente: ${id}`);
    if(ancestors.has(id))throw new Error('Ciclo detectado. Remova a ligação de retorno.');
    if(reached.has(id))return;reached.add(id);
    const n=sequence.nodes.find(x=>x.id===id),next=new Set(ancestors);next.add(id);
    for(const target of [n.next,n.onDifferent,n.onTimeout,...(n.branches??[]).map(b=>b.next)])visit(target,next);
  }
  visit(sequence.start);
  if(reached.size!==ids.size)throw new Error('Há nós sem ligação com o início.');
  return sequence;
}
export function compileSequence(s,source) {
  if(source.kind==='flow') {
    const f=s.flows.find(x=>x.id===source.id);if(!f?.published)throw new Error('Publique o fluxo antes de enviar.');
    return copy(f.published);
  }
  const steps=source.kind==='funnel'?s.funnels.find(x=>x.id===source.id)?.steps:source.kind==='item'?[{itemId:source.id,delay:0}]:null;
  if(!steps?.length)throw new Error('Selecione conteúdo ou funil válido.');
  const nodes=[];
  for(const [i,step] of steps.entries()) {
    if(step.delay>0)nodes.push({id:`delay-${i}`,type:'delay',seconds:Number(step.delay)});
    nodes.push({id:`item-${i}`,type:'item',itemId:step.itemId});
  }
  nodes.forEach((n,i)=>n.next=nodes[i+1]?.id??null);
  return validateSequence({start:nodes[0].id,nodes:hydrateNodes(s,nodes)});
}
export function publishFlow(s,id) {
  const f=s.flows.find(x=>x.id===id);if(!f)throw new Error('Fluxo não encontrado.');
  f.published=validateSequence({...copy(f.draft),nodes:hydrateNodes(s,f.draft.nodes),versionId:uid(),publishedAt:Date.now()});
  return f;
}
export function createCampaign(s,input,now=Date.now()) {
  if(input.requestId!==undefined){
    if(typeof input.requestId!=='string'||!input.requestId.trim()||input.requestId.length>100)throw new Error('Identificador da solicitação inválido.');
    const existing=s.campaigns.find(c=>c.requestId===input.requestId);
    if(existing)return existing;
  }
  const min=Number(input.delayMin),max=Number(input.delayMax);
  if(!Number.isFinite(min)||!Number.isFinite(max)||min<1||max<min||max>3600)throw new Error('Intervalo inválido; use mínimo de 1s e máximo de 3600s.');
  if(!input.recipients?.length||input.recipients.length>10000)throw new Error('Selecione entre 1 e 10.000 destinatários.');
  const sequence=compileSequence(s,input.source);
  const c={id:uid(),name:text(input.name,'Campanha',120),profile:text(input.profile,'Conta',80),createdAt:now,scheduledAt:input.scheduledAt||now,delayMin:min,delayMax:max,source:copy(input.source)};
  if(!Number.isFinite(c.scheduledAt)||c.scheduledAt<0)throw new Error('Data inválida.');
  const unique=new Map(input.recipients.map(r=>{const phone=normalizePhone(r.phone);return[phone,{phone,name:text(r.name||'Contato','Nome do contato',120),fields:r.fields&&typeof r.fields==='object'?Object.fromEntries(Object.entries(r.fields).slice(0,100).map(([k,v])=>[k,String(v).slice(0,20000)])):{}}];}));
  for(const recipient of unique.values()) {
    if(s.contacts.some(x=>x.phone===recipient.phone&&x.optOut))continue;
    for(const n of sequence.nodes)if(n.type==='item'){renderVariables(n.item.body??n.item.caption??'',recipient);}
    s.jobs.push({id:uid(),campaignId:c.id,profile:c.profile,recipient,sequence:copy(sequence),nodeId:sequence.start,status:'queued',desired:input.paused?'paused':'active',wakeAt:c.scheduledAt,createdAt:now,updatedAt:now,steps:0});
  }
  if(!s.jobs.some(j=>j.campaignId===c.id))throw new Error('Todos os destinatários estão na lista de não enviar.');
  if(input.requestId)c.requestId=input.requestId;
  s.campaigns.push(c);return c;
}
export function matchRules(message,rules,caseSensitive=false) {
  if(!Array.isArray(rules)||!rules.length)return false;
  const normalize=x=>caseSensitive?String(x):String(x).toLocaleLowerCase('pt-BR');
  const value=normalize(message);
  return rules.every(r=>{
    if(!Array.isArray(r.words)||!r.words.length)return false;
    const words=r.words.map(normalize).filter(Boolean);if(!words.length)return false;
    if(r.operator==='notContains')return words.every(w=>!value.includes(w));
    return words.some(w=>r.operator==='equals'?value===w:r.operator==='startsWith'?value.startsWith(w):r.operator==='contains'?value.includes(w):false);
  });
}
export function validateBackup(input) {
  if(input?.format!=='splink'||input.version!==1||input.state?.version!==1)throw new Error('Formato ou versão de backup não suportado.');
  const raw=input.state,s=initialState();
  for(const key of ['contents','funnels','flows','triggers','tags','contacts','campaigns','jobs','events','seen'])if(!Array.isArray(raw[key])||raw[key].length>50000)throw new Error(`Coleção inválida ou muito grande: ${key}.`);
  if(raw.contents.length>10000||!Array.isArray(input.assets)||input.assets.length>10000)throw new Error('Backup excede os limites.');
  const finite=(v,label,min=0,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} inválido no backup.`);return v;};
  const optional=(v,max=1000)=>typeof v==='string'?v.slice(0,max):'';
  let total=0;
  const assets=input.assets.map(a=>{
    if(typeof a.data!=='string'||!/^data:[^,]{1,200};base64,[A-Za-z0-9+/]*={0,2}$/.test(a.data)||a.data.length>28_000_000)throw new Error('Arquivo inválido no backup.');
    total+=a.data.length;if(total>90_000_000)throw new Error('Divida o backup: arquivos acima de 90 MB codificados.');
    return{id:text(a.id,'ID do arquivo',100),name:text(a.name||'arquivo','Nome do arquivo',255),data:a.data};
  });
  const assetIds=new Set(assets.map(a=>a.id));if(assetIds.size!==assets.length)throw new Error('Arquivos duplicados no backup.');
  function cleanContent(c){const value=saveContent(initialState(),c);value.id=text(c.id,'ID do conteúdo',100);if(value.assetId&&!assetIds.has(value.assetId))throw new Error(`Arquivo ausente: ${value.name}`);return value;}
  function cleanGraph(graph,embedded=false){
    if(!graph||!Array.isArray(graph.nodes)||graph.nodes.length>200)throw new Error('Grafo inválido.');
    const result={start:embedded?text(graph.start,'Início',100):optional(graph.start,100),nodes:graph.nodes.map(n=>{
      if(!['item','delay','response','random'].includes(n.type))throw new Error('Tipo de nó inválido.');
      const node={id:text(n.id,'ID do nó',100),type:n.type,next:n.next?text(n.next,'Próximo nó',100):null,x:finite(n.x??220,'Posição',0,100000),y:finite(n.y??40,'Posição',0,100000)};
      if(n.type==='item'){node.itemId=optional(n.itemId,100);if(embedded)node.item=cleanContent(n.item);}
      if(n.type==='delay')node.seconds=finite(n.seconds,'Espera',1,31536000);
      if(n.type==='response'){
        node.timeout=finite(n.timeout,'Prazo',1,31536000);node.expected=optional(n.expected,1000);node.operator=['equals','startsWith','contains'].includes(n.operator)?n.operator:'contains';
        node.onDifferent=n.onDifferent?text(n.onDifferent,'Ramo',100):null;node.onTimeout=n.onTimeout?text(n.onTimeout,'Ramo',100):null;
      }
      if(n.type==='random'){if(!Array.isArray(n.branches)||!n.branches.length||n.branches.length>20)throw new Error('Ramificações inválidas.');node.branches=n.branches.map(b=>({weight:finite(b.weight,'Peso',0.001,100000),next:b.next?text(b.next,'Ramo',100):null}));}
      return node;
    })};
    if(embedded){validateSequence(result);result.versionId=optional(graph.versionId,100);result.publishedAt=finite(graph.publishedAt??0,'Publicação');}
    return result;
  }
  s.contents=raw.contents.map(cleanContent);
  s.funnels=raw.funnels.map(f=>{
    if(!Array.isArray(f.steps)||!f.steps.length||f.steps.length>100)throw new Error('Etapas inválidas.');
    return{id:text(f.id,'ID',100),name:text(f.name,'Funil',120),steps:f.steps.map(x=>({itemId:text(x.itemId,'Conteúdo',100),delay:finite(x.delay,'Atraso',0,31536000)}))};
  });
  for(const f of s.funnels)compileSequence(s,{kind:'funnel',id:f.id});
  s.flows=raw.flows.map(f=>({id:text(f.id,'ID',100),name:text(f.name,'Fluxo',120),draft:cleanGraph(f.draft),...(f.published?{published:cleanGraph(f.published,true)}:{})}));
  s.tags=raw.tags.map(t=>({id:text(t.id,'ID',100),name:text(t.name,'Etiqueta',80),description:optional(t.description,500),color:/^#[0-9a-f]{6}$/i.test(t.color)?t.color:'#5d6871'}));
  s.contacts=raw.contacts.map(c=>({phone:normalizePhone(c.phone),name:text(c.name||'Contato','Contato',120),fields:Object.fromEntries(Object.entries(c.fields??{}).slice(0,100).map(([k,v])=>[k,optional(String(v),20000)])),tags:(Array.isArray(c.tags)?c.tags:[]).filter(id=>s.tags.some(t=>t.id===id)),optOut:!!c.optOut}));
  function cleanSource(source){if(!source||!['item','funnel','flow'].includes(source.kind))throw new Error('Fonte inválida.');return{kind:source.kind,id:text(source.id,'Fonte',100)};}
  s.triggers=raw.triggers.map(t=>{
    const source=cleanSource(t.source);compileSequence(s,source);
    if(!Array.isArray(t.rules)||!t.rules.length||t.rules.length>20)throw new Error('Regras inválidas.');
    const rules=t.rules.map(r=>{if(!['equals','contains','startsWith','notContains'].includes(r.operator)||!Array.isArray(r.words)||!r.words.length||r.words.length>30)throw new Error('Condição inválida.');return{operator:r.operator,words:r.words.map(w=>text(w,'Palavra',200))};});
    return{id:text(t.id,'ID',100),name:text(t.name,'Gatilho',120),profile:normalizePhone(t.profile),source,rules,enabled:false,caseSensitive:!!t.caseSensitive,cooldown:finite(t.cooldown,'Cooldown',60,31536000),delay:finite(t.delay,'Atraso',0,86400)};
  });
  s.campaigns=raw.campaigns.map(c=>({id:text(c.id,'ID',100),name:text(c.name,'Campanha',120),profile:normalizePhone(c.profile),createdAt:finite(c.createdAt,'Data'),scheduledAt:finite(c.scheduledAt,'Agenda'),delayMin:finite(c.delayMin,'Intervalo',1,3600),delayMax:finite(c.delayMax,'Intervalo',c.delayMin,3600),source:cleanSource(c.source)}));
  s.jobs=raw.jobs.map(j=>{
    if(!['queued','running','waiting','waiting-response','paused','accepted','completed','failed','cancelled','unknown'].includes(j.status)||!s.campaigns.some(c=>c.id===j.campaignId))throw new Error('Execução inválida no backup.');
    const sequence=cleanGraph(j.sequence,true);if(j.nodeId&&!sequence.nodes.some(n=>n.id===j.nodeId))throw new Error('Nó atual não encontrado.');
    const status=j.status==='running'?'unknown':terminal(j.status)?j.status:'paused';
    return{id:text(j.id,'ID',100),campaignId:j.campaignId,profile:normalizePhone(j.profile),recipient:{phone:normalizePhone(j.recipient?.phone),name:text(j.recipient?.name||'Contato','Contato',120),fields:Object.fromEntries(Object.entries(j.recipient?.fields??{}).slice(0,100).map(([k,v])=>[k,String(v).slice(0,20000)]))},sequence,nodeId:j.nodeId??null,status,desired:'paused',resumeStatus:['queued','waiting','waiting-response'].includes(j.resumeStatus??j.status)?(j.resumeStatus??j.status):'queued',wakeAt:finite(j.wakeAt,'Prazo'),createdAt:finite(j.createdAt,'Data'),updatedAt:finite(j.updatedAt,'Data'),waitStartedAt:finite(j.waitStartedAt??0,'Data'),steps:finite(j.steps,'Etapas',0,500),error:optional(j.error,2000)||null};
  });
  s.events=raw.events.slice(0,20000).map(e=>({id:text(e.id,'ID',100),jobId:optional(e.jobId,100),campaignId:optional(e.campaignId,100),profile:optional(e.profile,80),phone:optional(e.phone,80),nodeId:optional(e.nodeId,100),attemptId:optional(e.attemptId,100),at:finite(e.at,'Data'),outcome:['accepted','failed','unknown'].includes(e.outcome)?e.outcome:'unknown',messageId:optional(e.messageId,300)||null,error:optional(e.error,2000)||null,...(Number.isInteger(e.ack)&&e.ack>=0&&e.ack<=4?{ack:e.ack,ackAt:finite(e.ackAt??e.at,'Data ACK'),delivery:e.ack>=4?'played':e.ack>=3?'read':e.ack>=2?'delivered':null}:{})}));
  for(const key of ['contents','funnels','flows','triggers','tags','campaigns','jobs']){const ids=s[key].map(x=>x.id);if(new Set(ids).size!==ids.length)throw new Error(`IDs duplicados: ${key}.`);}
  s.seen=raw.seen.filter(v=>typeof v==='string'&&v.length<=300).slice(-5000);
  for(const key of ['cooldowns','nextAllowed'])s[key]=Object.fromEntries(Object.entries(raw[key]??{}).filter(([k,v])=>k.length<=200&&Number.isFinite(v)&&v>=0).slice(-10000));
  s.settings.theme=['light','dark','system'].includes(raw.settings?.theme)?raw.settings.theme:'light';
  return{format:'splink',version:1,state:s,assets};
}
