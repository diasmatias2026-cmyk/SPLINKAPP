import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState,validateBackup,saveContent,createCampaign,parseContacts } from '../src/domain.mjs';
import { applyCommand } from '../src/operations.mjs';
const backup=s=>({format:'splink',version:1,state:s,assets:[]});
test('campaign request retries return the same campaign without creating more jobs',()=>{
  const s=initialState(),item=saveContent(s,{name:'Texto',type:'text',body:'Olá'});
  const input={requestId:'request-123',name:'Teste',profile:'5511999990000',source:{kind:'item',id:item.id},recipients:[{phone:'5511999990001',name:'Ana'}],delayMin:1,delayMax:2};
  const first=applyCommand(s,'CREATE_CAMPAIGN',input),second=applyCommand(s,'CREATE_CAMPAIGN',input);
  assert.equal(first.id,second.id);assert.equal(s.jobs.length,1);assert.equal(s.campaigns.length,1);
  assert.throws(()=>applyCommand(s,'CREATE_CAMPAIGN',{...input,requestId:123}),/solicitação/i);
});
test('unfinished flow drafts survive backup without becoming executable',()=>{
  const s=initialState();applyCommand(s,'SAVE_FLOW',{name:'Em edição',draft:{start:'',nodes:[]}});
  const result=validateBackup(backup(s));assert.equal(result.state.flows[0].draft.start,'');
  assert.throws(()=>applyCommand(result.state,'PUBLISH_FLOW',{id:s.flows[0].id}));
});
test('restoration rejects forged jobs and dangling graph nodes',()=>{
  const s=initialState();s.jobs.push({id:'forged',status:'queued',recipient:{phone:'bad'},sequence:{start:'missing',nodes:[]}});
  assert.throws(()=>validateBackup(backup(s)));
});
test('backup excludes unexpected state fields and restores active work paused',()=>{
  const s=initialState();const c=saveContent(s,{name:'Olá',type:'text',body:'Olá'});
  createCampaign(s,{name:'Campanha',profile:'5511999990000',source:{kind:'item',id:c.id},recipients:[{phone:'5511999990001',name:'Ana'}],delayMin:6,delayMax:16});s.token='must-not-restore';
  const result=validateBackup(backup(s));assert.equal(result.state.token,undefined);assert.equal(result.state.jobs[0].desired,'paused');
});
test('import validates MIME data containers and embedded snapshot assets',()=>{
  const s=initialState();s.contents.push({id:'a',name:'Documento',type:'document',assetId:'asset1',fileName:'x.pdf',mime:'application/pdf'});
  assert.throws(()=>validateBackup({...backup(s),assets:[{id:'asset1',name:'x.pdf',data:'https://malicious.example/asset'}]}));
});
test('deleting referenced content is rejected and saved funnels validate delays',()=>{
  const s=initialState(),c=saveContent(s,{name:'Texto',type:'text',body:'Oi'});
  applyCommand(s,'SAVE_FUNNEL',{name:'Recepção',steps:[{itemId:c.id,delay:0}]});
  assert.throws(()=>applyCommand(s,'DELETE_CONTENT',{id:c.id}));
  assert.throws(()=>applyCommand(s,'SAVE_FUNNEL',{name:'Inválido',steps:[{itemId:c.id,delay:-1}]}));
});
test('operations reject unknown commands, invalid rules, invalid themes and quota-bypassing controls',()=>{
  const s=initialState(),c=saveContent(s,{name:'Texto',type:'text',body:'Oi'});
  assert.throws(()=>applyCommand(s,'EVAL',{code:'x'}));assert.throws(()=>applyCommand(s,'CONTROL',{desired:'sent'}));
  assert.throws(()=>applyCommand(s,'SETTINGS',{theme:'fake'}));
  assert.throws(()=>applyCommand(s,'SAVE_TRIGGER',{name:'T',profile:'5511999990000',source:{kind:'item',id:c.id},rules:[{operator:'anything',words:['a']}],cooldown:0,delay:0}));
});
test('semicolon CSV detection ignores commas inside quoted fields without headers',()=>{
  const p=parseContacts('5511999990001;"Ana, Bia, Carla";SP');assert.equal(p.contacts.length,1);assert.equal(p.contacts[0].name,'Ana, Bia, Carla');
});
test('reimporting contacts never removes an optout or their existing tags',()=>{
  const s=initialState();s.tags.push({id:'t',name:'Cliente'});s.contacts.push({phone:'5511999990001',name:'Ana',tags:['t'],optOut:true});
  applyCommand(s,'SAVE_CONTACTS',{contacts:[{phone:'5511999990001',name:'Ana nova'}]});assert.equal(s.contacts[0].optOut,true);assert.deepEqual(s.contacts[0].tags,['t']);
});
