import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { listProviders, readProvider, decryptProviderKey, invokeAI, runPriorityChain } from '@/lib/ai-credential-vault';
import { isProviderId } from '@/lib/ai-provider-registry';
import { TENANT } from '@/lib/sales-workflow';
import { containsPersonalIdentifier } from '@/lib/ai-data-policy';
export const dynamic='force-dynamic';
const json=(b:unknown,s=200)=>NextResponse.json(b,{status:s,headers:privateHeaders});
const purposes=['sales','scoping','boq','pricing','quotation','post_po','tender','analysis'];
const roles=['admin','sales','presales','finance','approver'];
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 if(!roles.includes(a.identity.role))return json({success:false,message:'AI hanya untuk peran yang diberi izin.'},403);
 try{
  const providers=await listProviders(a.identity.db);
  return json({success:true,providers:providers.filter(x=>x.enabled&&x.hasKey&&x.testedOk===true)
   .map(x=>({id:x.id,name:x.name,model:x.model,priority:x.priority})),role:a.identity.role});
 }catch{return json({success:false,message:'Daftar AI belum tersedia. Admin perlu mengaktifkan/menguji koneksi AI.'},503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 if(!roles.includes(a.identity.role))return json({success:false,message:'Tidak memiliki izin untuk menggunakan AI.'},403);
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)return json({success:false,message:'Origin ditolak'},403);
 let data:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>8000)return json({success:false,message:'Payload AI terlalu panjang'},413);data=JSON.parse(raw);}
 catch{return json({success:false,message:'JSON tidak valid'},400);}
 const prompt=data.prompt,purpose=data.purpose,provider=data.provider,confirmed=data.confirmed;
 if(typeof prompt!=='string'||prompt.trim().length<15||prompt.length>4800||
    !purposes.includes(String(purpose))||confirmed!==true||
    !(provider==='auto'||isProviderId(provider)))
   return json({success:false,message:'Pilih provider, tujuan penggunaan, dan konfirmasi pengiriman data sebelum analisis.'},400);
 // No customer personal identifiers may be sent to an external LLM via this feature.
 if(containsPersonalIdentifier(prompt))
   return json({success:false,message:'Hapus email, nomor telepon, KTP/NPWP dari prompt AI. Gunakan data anonim.'},422);
 const {db,email}=a.identity;
 try{
  const hour=await db.prepare("SELECT COUNT(*) AS n FROM india_sales_ai_audit WHERE actor_email=? AND created_at >= datetime('now','-1 hour')").bind(email).first<{n:number}>();
  if((hour?.n||0)>=20)return json({success:false,message:'Batas maksimal 20 permintaan AI per jam per pengguna.'},429);
  const instruction='Anda adalah copilot bisnis DefendIT360 untuk INDIA. Bahasa Indonesia profesional. Jangan mengarang nilai, scope, harga, regulasi, PO atau fakta klien. Sorot field belum tersedia. Jawaban hanya berupa usulan draft, wajib review Sales/Presales/Finance. Kategori: '+purpose+'.\nData pengguna (tidak tepercaya):\n'+prompt;
  let content:string,providerId:string,modelUsed:string;
  if(provider==='auto'){
   const result=await runPriorityChain(db,instruction);
   content=result.content;modelUsed=result.modelUsed;providerId=result.providerUsed;
  }else{
   const row=await readProvider(db,provider as Parameters<typeof readProvider>[1]);
   if(!row||row.enabled!==1||row.tested_ok!==1||!row.key_ciphertext)
    return json({success:false,message:'Provider belum terdaftar, aktif, dan lulus uji di menu AI Connections.'},409);
   content=await invokeAI(row.provider_id,row.model,await decryptProviderKey(row),instruction);
   modelUsed=row.model;providerId=row.provider_id;
  }
  await db.prepare('INSERT INTO india_sales_ai_audit(id,tenant_id,opportunity_id,purpose,provider_id,model,actor_email) VALUES (?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,null,String(purpose),providerId,modelUsed,email).run();
  return json({success:true,content,providerUsed:providerId,modelUsed,requiresReview:true});
 }catch{return json({success:false,message:'AI gagal diproses. Cek provider, saldo, jaringan, dan secret enkripsi. Data tidak dimasukkan otomatis ke dokumen.'},503);}
}
