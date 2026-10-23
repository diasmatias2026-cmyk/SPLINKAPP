import { uid,validateSequence } from './domain.mjs';
import { h,button,field,select,dialog,notify,act } from './ui.mjs';
export function flowEditor({flow,state,save,publish}){
  let id=flow?.id,selected;
  const draft=structuredClone(flow?.draft??{start:'start',nodes:[{id:'start',type:'delay',seconds:1,next:null,x:220,y:40}]}),name=h('input',{required:true,value:flow?.name??'',placeholder:'Ex.: Qualificação de orçamento'}),canvas=h('div',{class:'flow-canvas'}),world=h('div',{class:'flow-world'}),inspector=h('div',{class:'flow-inspector fields'});
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');world.append(svg);canvas.append(world);
  draft.nodes.forEach((n,i)=>{n.x??=220;n.y??=40+i*110;});selected=draft.start;
  const nodeName=n=>n.type==='item'?(state.contents.find(c=>c.id===n.itemId)?.name??'Selecionar conteúdo'):n.type==='delay'?`Esperar ${n.seconds}s`:n.type==='response'?'Aguardar resposta':'Distribuir caminhos';
  function links(){svg.replaceChildren();for(const n of draft.nodes){const targets=[n.next,n.onDifferent,n.onTimeout,...(n.branches??[]).map(b=>b.next)].filter(Boolean);for(const target of targets){const to=draft.nodes.find(t=>t.id===target);if(!to)continue;const path=document.createElementNS(svg.namespaceURI,'path');const x=n.x+105,y=n.y+62,tx=to.x+105,ty=to.y;path.setAttribute('d',`M${x} ${y} C${x} ${y+36},${tx} ${ty-36},${tx} ${ty}`);path.setAttribute('stroke','#95a79e');path.setAttribute('stroke-width','1.5');path.setAttribute('fill','none');svg.append(path);}}}
  function draw(){
    world.querySelectorAll('button').forEach(n=>n.remove());world.style.minHeight=`${Math.max(850,...draft.nodes.map(n=>n.y+140))}px`;world.style.minWidth=`${Math.max(680,...draft.nodes.map(n=>n.x+250))}px`;
    for(const n of draft.nodes){
      const node=button([h('strong',{},nodeName(n)),h('small',{},`${n.id===draft.start?'Início · ':''}${n.type} · ${n.id}`)],()=>{selected=n.id;draw();inspect();},`flow-node ${selected===n.id?'selected':''}`);node.style.left=n.x+'px';node.style.top=n.y+'px';node.setAttribute('aria-label',`Editar nó ${n.id}: ${nodeName(n)}`);
      node.addEventListener('pointerdown',event=>{if(event.button!==0)return;const x=event.clientX,y=event.clientY,sx=n.x,sy=n.y;let moved=false;node.setPointerCapture(event.pointerId);
        const move=e=>{if(Math.abs(e.clientX-x)+Math.abs(e.clientY-y)>4)moved=true;n.x=Math.max(10,sx+e.clientX-x);n.y=Math.max(10,sy+e.clientY-y);node.style.left=n.x+'px';node.style.top=n.y+'px';links();};
        const stop=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',stop);if(moved)links();};node.addEventListener('pointermove',move);node.addEventListener('pointerup',stop,{once:true});
      });world.append(node);
    }links();
  }
  function targetField(label,value,fn){const input=select([{value:'',label:'Encerrar'},...draft.nodes.filter(n=>n.id!==selected).map(n=>({value:n.id,label:`${n.id} · ${nodeName(n)}`}))],value??'');input.addEventListener('change',()=>{fn(input.value||null);links();});return field(label,input);}
  function inspect(){
    const n=draft.nodes.find(n=>n.id===selected);if(!n){inspector.replaceChildren(h('p',{},'Selecione um nó.'));return;}
    const controls=[h('h3',{},`Nó ${n.id}`),h('p',{class:'help'},'Arraste no quadro ou use as ligações abaixo. O rascunho só executa depois de publicado.')];
    if(n.type==='item'){const item=select([{value:'',label:'Selecione um conteúdo'},...state.contents.map(c=>({value:c.id,label:c.name}))],n.itemId??'');item.addEventListener('change',()=>{n.itemId=item.value;draw();});controls.push(field('Conteúdo',item));}
    if(n.type==='delay'){const seconds=h('input',{type:'number',min:1,value:n.seconds});seconds.addEventListener('input',()=>{n.seconds=Number(seconds.value);draw();});controls.push(field('Tempo de espera (s)',seconds));}
    if(n.type==='response'){
      const expected=h('input',{value:n.expected??'',placeholder:'Vazio: qualquer resposta'}),timeout=h('input',{type:'number',min:1,value:n.timeout??3600}),operator=select([{value:'contains',label:'Contém'},{value:'equals',label:'Igual a'},{value:'startsWith',label:'Começa com'}],n.operator??'contains');
      expected.addEventListener('input',()=>n.expected=expected.value);timeout.addEventListener('input',()=>n.timeout=Number(timeout.value));operator.addEventListener('change',()=>n.operator=operator.value);
      controls.push(field('Resposta esperada',expected),field('Comparar como',operator),field('Prazo para responder (s)',timeout),targetField('Resposta diferente',n.onDifferent,value=>n.onDifferent=value),targetField('Sem resposta / expirou',n.onTimeout,value=>n.onTimeout=value));
    }
    if(n.type==='random'){
      for(const [index,b] of (n.branches??[]).entries()){
        const weight=h('input',{type:'number',min:1,value:b.weight});weight.addEventListener('input',()=>b.weight=Number(weight.value));controls.push(field(`Peso do caminho ${index+1}`,weight),targetField(`Destino ${index+1}`,b.next,value=>b.next=value),button(`Remover caminho ${index+1}`,()=>{n.branches.splice(index,1);inspect();links();}));
      }
      controls.push(button('Adicionar caminho',()=>{n.branches??=[];n.branches.push({weight:1,next:null});inspect();}));
    } else controls.push(targetField(n.type==='response'?'Resposta corresponde':'Próximo nó',n.next,value=>n.next=value));
    controls.push(button('Definir como início',()=>{draft.start=n.id;draw();}),button('Excluir nó',()=>{if(draft.nodes.length===1){notify('Mantenha pelo menos um nó.');return;}draft.nodes=draft.nodes.filter(x=>x.id!==n.id);for(const item of draft.nodes){for(const key of ['next','onDifferent','onTimeout'])if(item[key]===n.id)item[key]=null;for(const branch of item.branches??[])if(branch.next===n.id)branch.next=null;}if(draft.start===n.id)draft.start=draft.nodes[0].id;selected=draft.start;draw();inspect();},'danger'));
    inspector.replaceChildren(...controls);
  }
  function add(type){const last=draft.nodes.find(n=>n.id===selected)??draft.nodes.at(-1),n={id:uid().slice(0,8),type,next:null,x:last.x,y:last.y+110};if(type==='item')n.itemId=state.contents[0]?.id??'';if(type==='delay')n.seconds=5;if(type==='response'){n.timeout=3600;n.expected='';}if(type==='random')n.branches=[{weight:1,next:null},{weight:1,next:null}];if(last&&!last.next&&last.type!=='random')last.next=n.id;draft.nodes.push(n);selected=n.id;draw();inspect();}
  async function persist(){const saved=await save({id,name:name.value,draft});id=saved.id;return id;}
  const tools=h('div',{class:'toolbar'},button('+ Conteúdo',()=>add('item')),button('+ Espera',()=>add('delay')),button('+ Resposta',()=>add('response')),button('+ Randomizador',()=>add('random')),button('Validar',()=>act(async()=>{validateSequence(draft);for(const n of draft.nodes)if(n.type==='item'&&!state.contents.some(c=>c.id===n.itemId))throw new Error(`Escolha o conteúdo do nó ${n.id}.`);notify('Ligações válidas. A publicação também verifica os parâmetros.');})),button('Publicar versão',()=>act(async()=>{await persist();await publish(id);}),'primary'));
  draw();inspect();dialog(flow?'Editar fluxo':'Novo fluxo',h('div',{class:'fields'},field('Nome do fluxo',name),tools,h('div',{class:'flow-layout'},canvas,inspector)),persist,{wide:true,label:'Salvar rascunho'});
}
