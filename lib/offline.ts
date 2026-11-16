export type OfflineContext={userId:string;camps:{id:string;title:string}[]};
export type IntakeDraft={client_request_id:string;camp_id:string;display_name?:string;age_years:number;gender:'female'|'male'|'undisclosed';pregnancy_status:string;bp_systolic?:number;bp_diastolic?:number;blood_glucose_mg_dl?:number;bmi?:number;consent_recorded:boolean;is_emergency:boolean};
type Cipher={iv:string;data:string};
type Metadata={userId:string;salt:string;check:Cipher};
type StoredDraft={id:string;userId:string;createdAt:string;cipher:Cipher};
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

async function store<T>(name:'keys'|'drafts',mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest):Promise<T>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('kawt-offline-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('keys',{keyPath:'userId'});request.result.createObjectStore('drafts',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
 return new Promise<T>((resolve,reject)=>{const transaction=db.transaction(name,mode);const request=operation(transaction.objectStore(name));let result:T;request.onsuccess=()=>{result=request.result};transaction.oncomplete=()=>{db.close();resolve(result)};transaction.onerror=()=>{db.close();reject(transaction.error)};transaction.onabort=()=>{db.close();reject(transaction.error)}});
}
export async function deriveOfflineKey(passphrase:string,salt:string){
 if(passphrase.length<12)throw new Error('Use an offline passphrase with at least 12 characters');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(salt),iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptDraft(value:unknown,key:CryptoKey):Promise<Cipher>{
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(value)));
 return {iv:encode(iv),data:encode(new Uint8Array(encrypted))};
}
export async function decryptDraft<T>(cipher:Cipher,key:CryptoKey):Promise<T>{
 const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(cipher.iv)},key,decode(cipher.data));
 return JSON.parse(new TextDecoder().decode(data));
}
export async function unlockOfflineQueue(userId:string,passphrase:string):Promise<CryptoKey>{
 const existing=await store<Metadata|undefined>('keys','readonly',s=>s.get(userId));
 const salt=existing?.salt??encode(crypto.getRandomValues(new Uint8Array(16)));
 const key=await deriveOfflineKey(passphrase,salt);
 if(existing){
  try{if(await decryptDraft<string>(existing.check,key)!=='KAWT offline '+userId)throw new Error('Wrong passphrase')}
  catch{throw new Error('The offline passphrase does not unlock this account queue')}
 }else{
  const metadata:Metadata={userId,salt,check:await encryptDraft('KAWT offline '+userId,key)};
  try{await store('keys','readwrite',s=>s.add(metadata))}catch(error){if(error instanceof DOMException&&error.name==='ConstraintError')return unlockOfflineQueue(userId,passphrase);throw error}
 }
 return key;
}
export async function queueIntake(userId:string,value:IntakeDraft,key:CryptoKey){
 const draft:StoredDraft={id:value.client_request_id,userId,createdAt:new Date().toISOString(),cipher:await encryptDraft(value,key)};
 await store('drafts','readwrite',s=>s.add(draft));
}
export async function offlineDrafts(userId:string,key:CryptoKey){
 const all=await store<StoredDraft[]>('drafts','readonly',s=>s.getAll());
 return Promise.all(all.filter(d=>d.userId===userId).map(async d=>({id:d.id,createdAt:d.createdAt,value:await decryptDraft<IntakeDraft>(d.cipher,key)})));
}
export async function removeOfflineDraft(id:string,userId:string){
 const existing=await store<StoredDraft|undefined>('drafts','readonly',s=>s.get(id));
 if(existing?.userId===userId)await store('drafts','readwrite',s=>s.delete(id));
}
