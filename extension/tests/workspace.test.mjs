import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand} from '../src/operations.mjs';
import {initialState,saveContent,compileSequence} from '../src/domain.mjs';

test('funnel converts to an independent flow draft with the same send/delay order',()=>{
  const s=initialState(),a=saveContent(s,{type:'text',name:'A',body:'A'}),b=saveContent(s,{type:'text',name:'B',body:'B'});
  const f=applyCommand(s,'SAVE_FUNNEL',{name:'Recepção',steps:[{itemId:a.id,delay:5},{itemId:b.id,delay:0}]});
  const flow=applyCommand(s,'CONVERT_FUNNEL',{id:f.id});assert.equal(flow.published,undefined);
  applyCommand(s,'PUBLISH_FLOW',{id:flow.id});
  const expected=compileSequence(s,{kind:'funnel',id:f.id}),actual=compileSequence(s,{kind:'flow',id:flow.id});
  assert.deepEqual(actual.nodes.map(n=>[n.type,n.seconds,n.item?.body]),expected.nodes.map(n=>[n.type,n.seconds,n.item?.body]));
  flow.draft.nodes[0].next=null;assert.equal(f.steps.length,2);
});
test('bulk tag move preserves other tags and optout and ignores repeated recipients',()=>{
  const s=initialState();for(const name of ['Entrada','Proposta','Cliente'])applyCommand(s,'SAVE_TAG',{id:name,name});
  applyCommand(s,'SAVE_CONTACTS',{contacts:[{phone:'5511999990001',name:'Ana',tags:['Entrada','Cliente'],optOut:true}]});
  const result=applyCommand(s,'BULK_TAG',{phones:['5511999990001','5511999990001'],from:'Entrada',to:'Proposta',mode:'move'});
  assert.equal(result.count,1);assert.deepEqual(s.contacts[0].tags,['Cliente','Proposta']);assert.equal(s.contacts[0].optOut,true);
  assert.throws(()=>applyCommand(s,'BULK_TAG',{phones:['5511999990001'],to:'missing',mode:'copy'}));
});
test('scoped cleaning rejects active work and deletes only the selected data',()=>{
  const s=initialState();s.events=[{id:'event'}];s.contacts=[{phone:'5511999990001',name:'Ana'}];
  s.jobs=[{status:'running'}];assert.throws(()=>applyCommand(s,'CLEAR_DATA',{scope:'history',confirmation:'LIMPAR'}));
  s.jobs=[];applyCommand(s,'CLEAR_DATA',{scope:'history',confirmation:'LIMPAR'});assert.equal(s.events.length,0);assert.equal(s.contacts.length,1);
  assert.throws(()=>applyCommand(s,'CLEAR_DATA',{scope:'contacts',confirmation:'yes'}));
});
