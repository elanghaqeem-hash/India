import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { AI_PROVIDERS, isProviderId, safeModel } from '@/lib/ai-provider-registry';
import { encryptProviderKey, decryptProviderKey, readProvider, listProviders, auditConfig,
  probeProvider } from '@/lib/ai-credential-vault';

const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:privateHeaders});
function isSameOrigin(req:Request):boolean{
 const origin=req.headers.get('origin');
 return (!origin||origin===new URL(req.url).origin) && req.headers.get('x-india-ai-admin')==='1';
}
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);
 if(!auth.ok)return auth.response;
 if(auth.identity.role!=='admin')return json({success:false,message:'Hanya Admin dapat mengelola AI API Keys.'},403);
 try {return json({success:true,configs:await listProviders(auth.identity.db)});}
 catch{return json({success:false,message:'Skema AI D1 belum tersedia. Jalankan migrasi AI Connections.'},503);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);
 if(!auth.ok)return auth.response;
 if(auth.identity.role!=='admin')return json({success:false,message:'Hanya Admin dapat mengubah koneksi AI.'},403);
 if(!isSameOrigin(req))return json({success:false,message:'Origin/permintaan administrator tidak valid.'},403);
 const size=Number(req.headers.get('content-length')||0);
 if(size>12000)return json({success:false,message:'Data konfigurasi terlalu besar.'},413);
 let body:Record<string,unknown>;
 try{body=await req.json();}catch{return json({success:false,message:'Format JSON tidak valid.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({success:false,message:'Permintaan tidak valid.'},400);
 const db=auth.identity.db,email=auth.identity.email,action=body.action;
 if(action==='reorder'){
  const ids=body.orderedIds;
  if(!Array.isArray(ids)||ids.length!==AI_PROVIDERS.length||new Set(ids).size!==ids.length||
    !ids.every(isProviderId))return json({success:false,message:'Urutan provider harus lengkap dan unik.'},400);
  try{
   const query='INSERT INTO india_ai_providers(provider_id,model,priority,enabled,updated_by) '+
     'VALUES(?,?,?,?,?) ON CONFLICT(provider_id) DO UPDATE SET priority=excluded.priority,'+
     'updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP';
   const statements=ids.map((id,i)=>db.prepare(query)
     .bind(id,AI_PROVIDERS.find(x=>x.id===id)!.model,i+1,0,email));
   await db.batch(statements);
   await auditConfig(db,email,'openai','reorder_all');
   return json({success:true,configs:await listProviders(db)});
  }catch{return json({success:false,message:'Gagal menyimpan urutan provider pada D1.'},503);}
 }
 if(!isProviderId(body.id))return json({success:false,message:'Provider tidak dikenal.'},400);
 const id=body.id;
 try{
  const existing=await readProvider(db,id);
  if(action==='test'){
   if(!existing?.key_ciphertext)return json({success:false,message:'Simpan API key terlebih dahulu.'},400);
   const plain=await decryptProviderKey(existing);
   const result=await probeProvider(id,existing.model,plain);
   await db.prepare('UPDATE india_ai_providers SET tested_at=CURRENT_TIMESTAMP,tested_ok=?,updated_at=CURRENT_TIMESTAMP WHERE provider_id=?')
     .bind(result.ok?1:0,id).run();
   await auditConfig(db,email,id,'test_connection');
   return json({success:result.ok,message:result.message,latencyMs:result.latencyMs,configs:await listProviders(db)},result.ok?200:422);
  }
  if(action==='deleteKey'){
   if(!existing)return json({success:true,configs:await listProviders(db)});
   await db.prepare('UPDATE india_ai_providers SET key_iv=NULL,key_ciphertext=NULL,enabled=0,tested_at=NULL,tested_ok=NULL,updated_at=CURRENT_TIMESTAMP,updated_by=? WHERE provider_id=?').bind(email,id).run();
   await auditConfig(db,email,id,'delete_key');
   return json({success:true,configs:await listProviders(db)});
  }
  if(action!=='save')return json({success:false,message:'Aksi tidak didukung.'},400);
  const meta=AI_PROVIDERS.find(x=>x.id===id)!;
  if(body.model!==undefined&&!safeModel(body.model))return json({success:false,message:'Nama model tidak valid.'},400);
  if(body.enabled!==undefined&&typeof body.enabled!=='boolean')return json({success:false,message:'Status aktif tidak valid.'},400);
  if(body.apiKey!==undefined&&(typeof body.apiKey!=='string'||body.apiKey.length<12||body.apiKey.length>1000||
    /\s/.test(body.apiKey)))return json({success:false,message:'API key tidak valid (12-1000 karakter tanpa spasi).'},400);
  const key=body.apiKey as string|undefined;
  const encrypted=key?await encryptProviderKey(id,key):null;
  const model=typeof body.model==='string'?body.model:(existing?.model||meta.model);
  const priority=existing?.priority||(AI_PROVIDERS.findIndex(x=>x.id===id)+1);
  const enabled=body.enabled===undefined?existing?.enabled===1:body.enabled;
  if(enabled&&!encrypted&&!existing?.key_ciphertext)return json({success:false,message:'Isi API key sebelum mengaktifkan provider.'},400);
  const query='INSERT INTO india_ai_providers '+
    '(provider_id,model,priority,enabled,key_iv,key_ciphertext,tested_at,tested_ok,updated_at,updated_by) '+
    'VALUES(?,?,?,?,?,?,NULL,NULL,CURRENT_TIMESTAMP,?) '+
    'ON CONFLICT(provider_id) DO UPDATE SET '+
    'model=excluded.model,priority=excluded.priority,enabled=excluded.enabled,'+
    'key_iv=COALESCE(excluded.key_iv,india_ai_providers.key_iv),'+
    'key_ciphertext=COALESCE(excluded.key_ciphertext,india_ai_providers.key_ciphertext),'+
    'tested_at=CASE WHEN excluded.key_ciphertext IS NOT NULL OR excluded.model<>india_ai_providers.model THEN NULL ELSE india_ai_providers.tested_at END,'+
    'tested_ok=CASE WHEN excluded.key_ciphertext IS NOT NULL OR excluded.model<>india_ai_providers.model THEN NULL ELSE india_ai_providers.tested_ok END,'+
    'updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by';
  await db.prepare(query).bind(id,model,priority,enabled?1:0,encrypted?.iv||null,encrypted?.ciphertext||null,email).run();
  await auditConfig(db,email,id,key?'rotate_key':'update_settings');
  return json({success:true,message:'Pengaturan tersimpan terenkripsi dalam D1.',configs:await listProviders(db)});
 }catch{
  return json({success:false,message:'Konfigurasi gagal. Periksa tabel D1, enkripsi Worker secret, dan izin Admin.'},503);
 }
}
