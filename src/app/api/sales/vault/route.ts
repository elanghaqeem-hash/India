import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
import {VAULT_MAX_BYTES,VAULT_KINDS,documentHash,sealDocument,openDocument,inspectDocument,vaultReference,vaultError,type VaultDoc,type VaultKind} from '@/lib/document-vault';
export const dynamic='force-dynamic';
const res=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const deny=(message:string,status=400)=>res({success:false,message},status);
const readers=['admin','sales','presales','finance','approver','legal'];
async function boundedBody(req:Request){
 if(Number(req.headers.get('content-length'))>VAULT_MAX_BYTES)throw Error('TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>VAULT_MAX_BYTES){await reader.cancel();throw Error('TOO_LARGE');}chunks.push(r.value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return data;
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!['admin','sales','presales'].includes(role))return deny('Upload hanya Sales, Presales atau Admin',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return deny('Origin ditolak',403);
 const p=new URL(req.url).searchParams,id=p.get('opportunity_id')||'',release=p.get('release_id')||'',kind=p.get('kind')||'',name=p.get('filename')||'';
 if(!safeID(id)||!safeID(release)||!VAULT_KINDS.includes(kind as VaultKind)||!name||name.length>180||/[\x00-\x1f\x7f/\\]/.test(name))return deny('Opportunity, paket, jenis dan nama file harus valid',422);
 if(role==='presales'&&kind!=='proposal')return deny('Presales hanya mengunggah proposal',403);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return deny('Opportunity tidak tersedia',404);
  if(!canReadDeal(role,email,d.created_by))return deny('Opportunity bukan milik Sales ini',403);
  if(['closed_won','closed_lost'].includes(d.stage))return deny('Dokumen transaksi yang sudah ditutup terkunci',409);
  const r=await db.prepare('SELECT status FROM india_sales_releases WHERE id=? AND tenant_id=? AND opportunity_id=?').bind(release,TENANT,id).first<{status:string}>();
  if(!r||r.status==='superseded'||(kind==='proposal'?r.status!=='scoped':r.status!=='approved'))return deny('Upload harus sesuai paket aktif dan tahapan persetujuannya',409);
  const bytes=await boundedBody(req);if(!bytes.length)return deny('File kosong',422);
  const media=await inspectDocument(name,bytes);if(!media)return deny('Gunakan PDF, DOCX, PNG, JPEG atau email EML dengan isi file yang sesuai',415);
  const doc:VaultDoc={id:crypto.randomUUID(),tenant_id:TENANT,opportunity_id:id,release_id:release,kind:kind as VaultKind,file_name:name,media_type:media,byte_length:bytes.length,sha256:await documentHash(bytes),iv:'',chunk_count:0,created_by:email};
  const sealed=await sealDocument(doc,bytes),guard=dealGuard(d);
  guard.condition+=' AND EXISTS(SELECT 1 FROM india_sales_releases WHERE id=? AND tenant_id=? AND opportunity_id=? AND status=?)';guard.args.push(release,TENANT,id,r.status);
  await atomicSales(db,guard.condition,guard.args,[
   db.prepare('INSERT INTO india_document_vault(id,tenant_id,opportunity_id,release_id,kind,file_name,media_type,byte_length,sha256,iv,chunk_count,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(doc.id,TENANT,id,release,kind,name,media,bytes.length,doc.sha256,sealed.iv,sealed.chunks.length,email),
   ...sealed.chunks.map((c,i)=>db.prepare('INSERT INTO india_document_chunks(document_id,part,ciphertext) VALUES(?,?,?)').bind(doc.id,i,c)),
   salesAudit(db,id,'DOCUMENT_UPLOADED',email,kind+' / '+doc.id)
  ]);
  return res({success:true,id:doc.id,reference:vaultReference(doc.id),sha256:doc.sha256,file_name:name,byte_length:bytes.length},201);
 }catch(e){if(String(e).includes('TOO_LARGE'))return deny('File maksimum 8 MB',413);if(/CHECK constraint|FLOW_CONFLICT/.test(String(e)))return deny('Paket berubah. Muat ulang sebelum upload.',409);const v=vaultError(e);return deny(v.message,v.status);}
}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!readers.includes(role))return deny('Hak akses dokumen tidak tersedia',403);
 const p=new URL(req.url).searchParams,id=p.get('id'),opp=p.get('opportunity_id');
 if(!safeID(id||opp))return deny('ID dokumen atau Opportunity harus valid');
 try{
  const doc=id?await db.prepare('SELECT * FROM india_document_vault WHERE id=? AND tenant_id=?').bind(id,TENANT).first<VaultDoc>():null;
  if(id&&!doc)return deny('Dokumen tidak ditemukan',404);
  const opportunity=doc?.opportunity_id||opp!;
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,opportunity).first<FlowDeal>();
  if(!d)return deny('Opportunity tidak ditemukan',404);
  if(!canReadDeal(role,email,d.created_by))return deny('Opportunity bukan milik Sales ini',403);
  if(!doc){const rows=await db.prepare('SELECT id,release_id,kind,file_name,media_type,byte_length,sha256,created_by,created_at FROM india_document_vault WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(TENANT,opportunity).all();return res({success:true,documents:rows.results});}
  const bytes=await openDocument(db,doc);
  // Audit must commit before plaintext leaves the authenticated endpoint.
  await salesAudit(db,opportunity,'DOCUMENT_DOWNLOADED',email,doc.kind+' / '+doc.id).run();
  return new Response(new Uint8Array(bytes),{headers:{...privateHeaders,'Content-Type':doc.media_type,'Content-Length':String(bytes.length),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(doc.file_name),'Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
 }catch(e){const v=vaultError(e);return deny(v.message,v.status);}
}
