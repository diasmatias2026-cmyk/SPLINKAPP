import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContacts, renderVariables, initialState, saveContent, compileSequence, publishFlow, createCampaign, matchRules, validateBackup, normalizePhone } from '../src/domain.mjs';

test('CSV handles BOM, header, semicolons, escaped quotes and duplicate numbers', () => {
  const result = parseContacts('\uFEFFtelefone;nome;cidade\r\n+55 (55) 99999-0000;"Maria; Silva";"Belo ""Horizonte"""\r\n5555999990000;Repetido;BH');
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].phone, '5555999990000');
  assert.equal(result.contacts[0].name, 'Maria; Silva');
  assert.equal(result.contacts[0].fields.cidade, 'Belo "Horizonte"');
  assert.equal(result.duplicates, 1);
});
test('phone normalization preserves ninth digit and DDD55', () => {
  assert.equal(normalizePhone('(55) 99999-0000'), '5555999990000');
  assert.equal(normalizePhone('5534999990000'), '5534999990000');
  assert.throws(() => normalizePhone('123'));
});
test('variables use column fields, name and greeting without interpreting HTML', () => {
  assert.equal(renderVariables('Oi {nome}, {cidade} {campo0}', {name:'<Ana>',phone:'5511999990000',fields:{cidade:'SP',campo0:'5511999990000'}}, 9), 'Oi <Ana>, SP 5511999990000');
  assert.throws(() => renderVariables('{ausente}', {name:'Ana',fields:{}},9));
});
test('content and published flow are immutable snapshots; broken references block publishing', () => {
  const s=initialState(); const item=saveContent(s,{name:'Olá',type:'text',body:'Oi {nome}'});
  s.flows.push({id:'f',name:'Recepção',draft:{start:'a',nodes:[{id:'a',type:'item',itemId:item.id,next:null}]}});
  publishFlow(s,'f'); item.body='Outro texto';
  assert.equal(s.flows[0].published.nodes[0].item.body,'Oi {nome}');
  assert.throws(()=>compileSequence(s,{kind:'item',id:'missing'}));
});
test('campaign deduplicates and stores content snapshot, account and full timestamps', () => {
  const s=initialState();const item=saveContent(s,{name:'Oi',type:'text',body:'Olá'});
  const c=createCampaign(s,{name:'Teste',profile:'5511999990000',recipients:parseContacts('5511999990001,Ana\n5511999990001,Ana').contacts,source:{kind:'item',id:item.id},delayMin:6,delayMax:8},100);
  assert.equal(s.jobs.length,1);assert.equal(s.jobs[0].campaignId,c.id);item.body='Alterado';
  assert.equal(s.jobs[0].sequence.nodes[0].item.body,'Olá');
  assert.throws(()=>createCampaign(s,{...c,recipients:[],delayMin:-1,delayMax:0}));
});
test('keyword matching combines AND conditions, OR words and case behavior', () => {
  assert.equal(matchRules('Olá PREÇO', [{operator:'contains',words:['preço','valor']},{operator:'startsWith',words:['olá']}],false),true);
  assert.equal(matchRules('Olá PREÇO', [{operator:'equals',words:['preço']}],false),false);
  assert.equal(matchRules('Olá PREÇO', [{operator:'contains',words:['preço']}],true),false);
});
test('backup validation rejects unsupported versions and missing asset references', () => {
  assert.throws(()=>validateBackup({version:99}));
  const s=initialState();assert.equal(validateBackup({format:'splink',version:1,state:s,assets:[]}).state.version,1);
  s.contents.push({id:'a',name:'Doc',type:'document',assetId:'missing'});
  assert.throws(()=>validateBackup({format:'splink',version:1,state:s,assets:[]}));
});
