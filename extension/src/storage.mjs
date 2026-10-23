import { initialState } from './domain.mjs';
let connection;
export function database() {
  if(!connection)connection=new Promise((resolve,reject)=>{
    const request=indexedDB.open('splink-v2',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('state');request.result.createObjectStore('assets',{keyPath:'id'});};
    request.onerror=()=>{connection=null;reject(request.error);};
    request.onblocked=()=>{connection=null;reject(new Error('Feche outras abas Splink para atualizar o banco.'));};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=null;};resolve(request.result);};
  });return connection;
}
export const store={
  async read(){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('main');r.onsuccess=()=>resolve(r.result??initialState());r.onerror=()=>reject(r.error);});},
  async mutate(fn){const db=await database();return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),table=tx.objectStore('state');let result,error;
    const r=table.get('main');r.onsuccess=()=>{try{const s=r.result??initialState();result=fn(s);if(result?.then)throw new Error('Mutação deve ser síncrona.');s.revision++;table.put(s,'main');}catch(e){error=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(error??tx.error);tx.onabort=()=>reject(error??tx.error);
  });}
};
export async function asset(id) {const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('assets').objectStore('assets').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function putAsset(value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
export async function allAssets(){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('assets').objectStore('assets').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function replaceDatabase(state,assets){
  const db=await database();return new Promise((resolve,reject)=>{
    const tx=db.transaction(['state','assets'],'readwrite'),table=tx.objectStore('state');let error;
    // Check and replace in one transaction: a scheduler claim cannot slip between them.
    const read=table.get('main');read.onsuccess=()=>{
      if(read.result?.jobs.some(j=>j.status==='running')){error=new Error('Aguarde o envio em andamento antes de restaurar.');tx.abort();return;}
      table.put(state,'main');const a=tx.objectStore('assets');a.clear();for(const value of assets)a.put(value);
    };
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(error??tx.error);tx.onabort=()=>reject(error??tx.error);
  });
}
