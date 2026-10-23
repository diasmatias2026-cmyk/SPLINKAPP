export function h(tag,attrs={},...children){
  const element=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(value===undefined||value===null||value===false)continue;
    if(key.startsWith('on'))element.addEventListener(key.slice(2).toLowerCase(),value);
    else if(key==='class')element.className=value;
    else if(key==='checked')element.checked=value;
    else if(key==='value')element.value=value;
    else if(key==='style'&&typeof value==='object')Object.assign(element.style,value);
    else element.setAttribute(key,value===true?'':String(value));
  }
  for(const child of children.flat(Infinity))if(child!==null&&child!==undefined&&child!==false)element.append(child instanceof Node?child:document.createTextNode(String(child)));
  if(attrs.value!==undefined)element.value=attrs.value;
  return element;
}
export const button=(label,fn,kind='')=>h('button',{type:'button',class:kind,onClick:fn},label);
export const field=(label,input,help)=>{input.setAttribute('aria-label',label);return h('label',{},label,input,help?h('span',{class:'help'},help):null);};
export const check=(label,checked=false)=>h('label',{class:'check'},h('input',{type:'checkbox',checked}),label);
export function select(options,value){return h('select',{value},options.map(o=>h('option',{value:o.value},o.label)));}
export function notify(message){const node=h('div',{class:'toast'},message);document.getElementById('notices').append(node);setTimeout(()=>node.remove(),6000);}
export async function act(task){try{return await task();}catch(e){notify(e.message);return null;}}
export function dialog(title,body,onSave,{wide=false,label='Salvar'}={}){
  const modal=h('dialog',{class:`dialog ${wide?'wide':''}`}),error=h('span',{class:'error',role:'alert'});
  const save=h('button',{type:'submit',class:'primary'},label),close=()=>modal.close();
  const form=h('form',{},h('div',{class:'dialog-body'},body),h('footer',{},error,button('Cancelar',close),save));
  form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;error.textContent='';try{await onSave();modal.close();}catch(e){error.textContent=e.message;}finally{save.disabled=false;}});
  modal.append(h('header',{},h('h2',{},title),button('Fechar',close)),form);modal.addEventListener('close',()=>modal.remove());document.body.append(modal);modal.showModal();return modal;
}
export const empty=(title,description,label,action)=>h('div',{class:'empty'},h('strong',{},title),h('span',{},description),label? h('div',{},button(label,action)):null);
export const stamp=value=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export const labels={text:'Texto',audio:'Áudio',media:'Imagem ou vídeo',document:'Documento',contact:'Contato',queued:'Na fila',running:'Processando',waiting:'Aguardando',paused:'Pausado',completed:'Execução concluída',accepted:'Aceito pelo transporte',failed:'Falhou antes de enviar',unknown:'Resultado desconhecido',cancelled:'Cancelado','waiting-response':'Aguardando resposta'};
export const badge=status=>h('span',{class:`pill ${status}`},labels[status]??status);
export function download(name,data,type='application/json'){
  const blob=data instanceof Blob?data:new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type});const url=URL.createObjectURL(blob);const link=h('a',{href:url,download:name});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(rows){return'\uFEFF'+rows.map(row=>row.map(value=>{let t=String(value??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return'"'+t.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function icon(name){
  const paths={home:'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',library:'M4 3h5v18H4z M11 3h4v18h-4z M17 3l4 1v17l-4-1z',campaigns:'M3 11l18-8-7 18-3-7-8-3z M11 14l10-11',automation:'M12 3v5 M5 13V8h14v5 M2 13h6v7H2z M16 13h6v7h-6z',contacts:'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M17 4a4 4 0 010 7 M22 21v-2a4 4 0 00-3-4',reports:'M4 21V3h16v18z M8 16h8 M8 12h8 M8 8h4',settings:'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M12 8a4 4 0 100 8 4 4 0 000-8',mark:'M10 5H7a6 6 0 000 12h3 M14 5h3a6 6 0 010 12h-3 M7 11h10'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]??paths.home);svg.append(path);return svg;
}
