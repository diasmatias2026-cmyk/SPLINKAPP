import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pageAction,dataURL} from '../src/transport.mjs';
let sent=[];
function mock(){sent=[];globalThis.window={WPP:{webpack:{isReady:true},version:'fixture',conn:{getMyUserId:()=>({_serialized:'5511999990000@c.us'})},contact:{queryExists:async()=>({wid:{_serialized:'5511999990001@c.us'}})},chat:{sendTextMessage:async(...args)=>{sent.push(args);return{id:{_serialized:'message-id'}};},sendFileMessage:async(...args)=>{sent.push(args);return{id:'file-id'};},sendVCardContactMessage:async(...args)=>{sent.push(args);return{id:'contact-id'};},list:async()=>[{id:{_serialized:'5511999990001@c.us'},name:'Ana'},{id:'5511999990002@c.us',name:'Bia'},{id:'1234@g.us',name:'Grupo'}],getActiveChat:()=>({id:{_serialized:'5511999990001@c.us'},name:'Ana'})},on:()=>{}}};}
test('MAIN status and extraction handle object and string chat ids',async()=>{mock();assert.equal((await pageAction('status')).profile,'5511999990000');assert.equal((await pageAction('extract')).length,2);assert.equal((await pageAction('active')).phone,'5511999990001');});
test('MAIN rejects account change before sending',async()=>{mock();const r=await pageAction('send',{profile:'another',to:'5511999990001',item:{type:'text',body:'Oi'}});assert.equal(r.beforeSend,true);assert.equal(sent.length,0);});
test('MAIN sends text and returns its exact transport identifier',async()=>{mock();const r=await pageAction('send',{profile:'5511999990000',to:'5511999990001',item:{type:'text',body:'Oi'}});assert.equal(r.id,'message-id');assert.equal(sent[0][1],'Oi');});
test('image media is never PTT and uses the actual isViewOnce option',async()=>{mock();await pageAction('send',{profile:'5511999990000',to:'5511999990001',item:{type:'media',mime:'image/png',fileName:'x.png',isPtt:true,asViewOnce:true},data:'data:image/png;base64,eA=='});assert.equal(sent[0][2].isPtt,false);assert.equal(sent[0][2].isViewOnce,true);assert.equal(sent[0][2].type,'image');});
test('lookup failures are distinguished from an error after send begins',async()=>{mock();window.WPP.contact.queryExists=async()=>null;const a=await pageAction('send',{profile:'5511999990000',to:'5511999990001',item:{type:'text',body:'Oi'}});assert.equal(a.beforeSend,true);mock();window.WPP.chat.sendTextMessage=async()=>{throw new Error('ambiguous')};const b=await pageAction('send',{profile:'5511999990000',to:'5511999990001',item:{type:'text',body:'Oi'}});assert.equal(b.beforeSend,false);});
test('Blob conversion preserves exact bytes',async()=>{const url=await dataURL(new Blob([new Uint8Array([0,127,255])],{type:'application/octet-stream'}));assert.equal(url,'data:application/octet-stream;base64,AH//');});
test('LID identifiers are resolved to phone numbers, never exported as telephone digits',async()=>{
  mock();window.WPP.chat.list=async()=>[{id:'123456789012345@lid',name:'Ana'},{id:'999999999999999@lid',name:'Unresolved'}];
  window.WPP.contact.getPnLidEntry=async id=>id.startsWith('123')?{phoneNumber:{_serialized:'5511999990001@c.us'}}:{};
  window.WPP.chat.getActiveChat=()=>({id:'123456789012345@lid',name:'Ana'});
  assert.deepEqual((await pageAction('extract')).map(c=>c.phone),['5511999990001']);
  assert.equal((await pageAction('active')).phone,'5511999990001');
});
