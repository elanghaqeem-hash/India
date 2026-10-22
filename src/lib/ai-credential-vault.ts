import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { D1DB } from './boq-auth';
import type { AIConversationRequest, AIConversationTurn } from './ai-conversation';
import { AI_PROVIDERS, type ProviderId, type AIProviderRow, type AIProviderPublic,
  publicProvider, isProviderId } from './ai-provider-registry';

type AIEnv = { INDIA_AI_ENCRYPTION_KEY?: string };
const utf8=new TextEncoder();
const decode=new TextDecoder();

export async function encryptionKey():Promise<CryptoKey>{
 let env:AIEnv;
 try {env=(await getCloudflareContext({async:true})).env as AIEnv;}
 catch {throw new Error('Secret enkripsi Cloudflare belum tersedia.');}
 const configured=env.INDIA_AI_ENCRYPTION_KEY;
 if(!configured)throw new Error('Secret INDIA_AI_ENCRYPTION_KEY belum dikonfigurasi di Worker.');
 let bytes:Uint8Array;
 try {bytes=Uint8Array.from(atob(configured),c=>c.charCodeAt(0));}
 catch {throw new Error('Konfigurasi enkripsi tidak valid.');}
 if(bytes.byteLength!==32)throw new Error('Secret enkripsi wajib berupa 32 byte base64.');
 const material=new Uint8Array(32);
 material.set(bytes);
 return crypto.subtle.importKey('raw',material,'AES-GCM',false,['encrypt','decrypt']);
}
const base64=(bytes:Uint8Array)=>btoa(Array.from(bytes,x=>String.fromCharCode(x)).join(''));
const unbase64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

export async function encryptProviderKey(id:ProviderId,plain:string):Promise<{iv:string;ciphertext:string}> {
 const key=await encryptionKey();
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const raw=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode('INDIA-AI:'+id)},
  key,utf8.encode(plain));
 return {iv:base64(iv),ciphertext:base64(new Uint8Array(raw))};
}
export async function decryptProviderKey(row:AIProviderRow):Promise<string>{
 if(!row.key_iv||!row.key_ciphertext)throw new Error('Provider belum memiliki API key.');
 const key=await encryptionKey();
 try {
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(row.key_iv),
   additionalData:utf8.encode('INDIA-AI:'+row.provider_id)},key,unbase64(row.key_ciphertext));
  return decode.decode(bytes);
 }catch {throw new Error('Tidak dapat mendekripsi API key. Periksa secret enkripsi.');}
}
export async function getProviderRows(db:D1DB):Promise<AIProviderRow[]>{
 const r=await db.prepare('SELECT provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at FROM india_ai_providers ORDER BY priority ASC').all<AIProviderRow>();
 return r.results;
}
export async function readProvider(db:D1DB,id:ProviderId):Promise<AIProviderRow|null>{
 return db.prepare('SELECT provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at FROM india_ai_providers WHERE provider_id=?').bind(id).first<AIProviderRow>();
}
export async function listProviders(db:D1DB):Promise<AIProviderPublic[]>{
 const all=await getProviderRows(db);
 return AI_PROVIDERS.map(meta=>publicProvider(all.find(r=>r.provider_id===meta.id)||null,meta.id))
  .sort((a,b)=>a.priority-b.priority);
}
export async function auditConfig(db:D1DB,email:string,id:ProviderId,action:string):Promise<void>{
 await db.prepare('INSERT INTO india_ai_config_audit(actor_email,provider_id,action) VALUES(?,?,?)')
  .bind(email,id,action).run();
}

/** Probe one allowlisted provider. Never return upstream body, token or header values. */
export async function probeProvider(id:ProviderId,model:string,apiKey:string):Promise<{ok:boolean;message:string;latencyMs:number}>{
 const started=Date.now();
 let url:string, headers:Record<string,string>={'Content-Type':'application/json'};
 let body:unknown;
 if(id==='gemini'){
  url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  headers['x-goog-api-key']=apiKey;
  body={contents:[{parts:[{text:'Respond PONG'}]}],generationConfig:{maxOutputTokens:12}};
 }else if(id==='anthropic'){
  url='https://api.anthropic.com/v1/messages';
  headers['x-api-key']=apiKey;headers['anthropic-version']='2023-06-01';
  body={model,max_tokens:12,messages:[{role:'user',content:'Respond PONG'}]};
 }else{
  const endpoints:Record<Exclude<ProviderId,'gemini'|'anthropic'>,string>={
   openai:'https://api.openai.com/v1/chat/completions',
   groq:'https://api.groq.com/openai/v1/chat/completions',
   openrouter:'https://openrouter.ai/api/v1/chat/completions',
   deepseek:'https://api.deepseek.com/chat/completions',
  };
  url=endpoints[id];headers.Authorization='Bearer '+apiKey;
  body={model,messages:[{role:'user',content:'Respond PONG'}],max_tokens:12};
 }
 try {
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000),cache:'no-store'});
  return {ok:res.ok,message:res.ok?'Koneksi berhasil; model menerima permintaan.':
   'Provider menolak permintaan (HTTP '+res.status+'). Periksa API key, model, kuota dan billing.',latencyMs:Date.now()-started};
 }catch{
  return {ok:false,message:'Koneksi ke provider gagal atau melebihi batas waktu 15 detik.',latencyMs:Date.now()-started};
 }
}

/** Admin-only test console and future server-side routing. Never use for public unauthenticated input. */
export async function invokeAI(id:ProviderId,model:string,apiKey:string,prompt:string|AIConversationRequest):Promise<string>{
 let url:string,headers:Record<string,string>={'Content-Type':'application/json'};
 const system = typeof prompt === 'string' ? undefined : prompt.system;
 const messages:AIConversationTurn[] = typeof prompt === 'string'
  ? [{role:'user',content:prompt}]
  : prompt.messages;
 let body:unknown;
 if(id==='gemini'){
  url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
  headers['x-goog-api-key']=apiKey;
  body={contents:messages.map(message=>({role:message.role==='assistant'?'model':'user',parts:[{text:message.content}]})),
   ...(system?{systemInstruction:{parts:[{text:system}]}}:{}),generationConfig:{maxOutputTokens:750}};
 }else if(id==='anthropic'){
  url='https://api.anthropic.com/v1/messages';
  headers['x-api-key']=apiKey;headers['anthropic-version']='2023-06-01';
  body={model,max_tokens:750,...(system?{system}:{}),messages};
 }else{
  const endpoints:Record<Exclude<ProviderId,'gemini'|'anthropic'>,string>={
   openai:'https://api.openai.com/v1/chat/completions',
   groq:'https://api.groq.com/openai/v1/chat/completions',
   openrouter:'https://openrouter.ai/api/v1/chat/completions',
   deepseek:'https://api.deepseek.com/chat/completions',
  };
  url=endpoints[id];headers.Authorization='Bearer '+apiKey;
  body={model,messages:[...(system?[{role:'system',content:system}]:[]),...messages],max_tokens:750};
 }
 const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(25000),cache:'no-store'});
 if(!res.ok)throw new Error('Provider '+id+' gagal (HTTP '+res.status+').');
 const result=await res.json();
 const output=id==='gemini'?result?.candidates?.[0]?.content?.parts?.map((x:{text?:string})=>x.text||'').join(''):
   id==='anthropic'?result?.content?.map((x:{text?:string})=>x.text||'').join(''):result?.choices?.[0]?.message?.content;
 if(typeof output!=='string'||!output.trim())throw new Error('Provider '+id+' mengembalikan respons kosong.');
 return output.slice(0,16000);
}

/** Used only by authorized API route, with explicit limits on input. */
export async function runPriorityChain(db:D1DB,prompt:string|AIConversationRequest):Promise<{
 content:string;providerUsed:string;modelUsed:string;latencyMs:number;tokensEstimate:number;isFallback:boolean;
}>{
 const started=Date.now();
 const rows=(await getProviderRows(db)).filter(row=>row.enabled===1 && row.tested_ok===1 && !!row.key_ciphertext &&
  isProviderId(row.provider_id)).sort((a,b)=>a.priority-b.priority);
 if(!rows.length)throw new Error('Belum ada provider AI aktif dengan API key.');
 const attempts=[] as string[];
 for(const row of rows){
  try{
   const apiKey=await decryptProviderKey(row);
   const content=await invokeAI(row.provider_id,row.model,apiKey,prompt);
   return {content,providerUsed:AI_PROVIDERS.find(x=>x.id===row.provider_id)?.name||row.provider_id,
     modelUsed:row.model,latencyMs:Date.now()-started,tokensEstimate:Math.round(((typeof prompt==='string'?prompt.length:prompt.system.length+prompt.messages.reduce((n,m)=>n+m.content.length,0))+content.length)/4),
     isFallback:attempts.length>0};
  }catch{
   // Never log tokens, prompts or upstream response bodies.
   attempts.push(row.provider_id);
  }
 }
 throw new Error('Semua provider AI aktif gagal. Periksa koneksi, model, kuota atau penagihan.');
}
