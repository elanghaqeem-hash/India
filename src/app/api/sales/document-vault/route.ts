import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
import {VAULT_MAX_BYTES,documentHash,sealDocument,openDocument,inspectDocument,vaultError,type VaultDoc} from '@/lib/document-vault';
export const dynamic='force-dynamic';
const kinds=['nda','rks','kak','quotation','supporting'] as const;
const readers=['admin','sales','presales','finance','approver','legal'];
const res=(data:unknown,status=200)=>Response.json(data,{status,headers:privateHeaders});
const deny=(message:string,status=400)=>res({success:false,message},status);
const goodDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
type ExtraDoc=VaultDoc&{version:number;retention_until:string|null;legal_hold:number;hold_reason:string|null};
async function identityDeal(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return {error:a.response};
 const {db,role,email}=a.identity;
 if(!readers.includes(role))return {error:deny('Role tidak diizinkan',403)};
 const q=new URL(req.url).searchParams;
 const id=q.get('opportunity_id')||'';
 if(!safeID(id))return {error:deny('Opportunity tidak valid',422)};
 const deal=await db.prepare('SELECT * FROM india_sales_opportunities WHERE id=? AND tenant_id=?').bind(id,TENANT).first<FlowDeal>();
 if(!deal)return {error:deny('Opportunity tidak ditemukan',404)};
 if(!canReadDeal(role,email,deal.created_by))return {error:deny('Opportunity bukan milik Sales ini',403)};
 return {db,role,email,deal,id};
}
async function boundedBody(req:Request){
 if(Number(req.headers.get('content-length'))>VAULT_MAX_BYTES)throw Error('TOO_LARGE');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();
 let n=0;const parts:Uint8Array[]=[];
 try{while(true){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>VAULT_MAX_BYTES){await reader.cancel();throw Error('TOO_LARGE');}parts.push(x.value);}}finally{reader.releaseLock();}
 const out=new Uint8Array(n);let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;
}
const event=(db:D1DB,opp:string,source:'release'|'library',id:string,action:string,email:string,role:string,description:string)=>
 db.prepare('INSERT INTO india_document_access_events(id,tenant_id,opportunity_id,source,document_id,action,actor_email,actor_role,description) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,opp,source,id,action,email,role,description);
async function findDoc(db:D1DB,opp:string,id:string,source:string){
 if(source==='library')return db.prepare("SELECT *, '' AS release_id FROM india_document_library WHERE tenant_id=? AND opportunity_id=? AND id=?").bind(TENANT,opp,id).first<ExtraDoc>();
 if(source==='release')return db.prepare('SELECT v.*,g.version,g.retention_until,g.legal_hold,g.hold_reason FROM india_document_vault v JOIN india_document_governance g ON g.document_id=v.id WHERE v.tenant_id=? AND v.opportunity_id=? AND v.id=?').bind(TENANT,opp,id).first<ExtraDoc>();
 return null;
}
export async function GET(req:Request){
 const a=await identityDeal(req);if(a.error)return a.error;
 const {db,role,email,id:opp}=a;if(!db||!role||!email||!opp)return deny('Auth invalid',403);
 const q=new URL(req.url).searchParams,docId=q.get('id'),source=q.get('source')||'library';
 try{
  if(q.get('audit')==='1'){
   if(!['admin','legal'].includes(role))return deny('Audit log hanya Legal/Admin',403);
   const rows=await db.prepare('SELECT document_id,source,action,actor_email,actor_role,description,event_at FROM india_document_access_events WHERE tenant_id=? AND opportunity_id=? ORDER BY event_at DESC,id DESC LIMIT 150').bind(TENANT,opp).all();
   return res({success:true,events:rows.results});
  }
  if(docId){
   if(!safeID(docId)||!['library','release'].includes(source))return deny('Dokumen tidak valid',422);
   const doc=await findDoc(db,opp,docId,source);if(!doc)return deny('Dokumen tidak ditemukan',404);
   if(doc.retention_until&&doc.retention_until<new Date().toISOString().slice(0,10)&&!doc.legal_hold&&!['admin','legal'].includes(role))
    return deny('Masa retensi terlampaui. Minta tinjauan Admin/Legal.',403);
   const data=await openDocument(db,doc,source as 'release'|'library');
   await db.batch([salesAudit(db,opp,'DOCUMENT_DOWNLOADED',email,doc.kind+' / '+doc.id),
     event(db,opp,source as 'release'|'library',doc.id,'DOWNLOAD',email,role,doc.file_name)]);
   return new Response(new Uint8Array(data),{headers:{...privateHeaders,'Content-Type':doc.media_type,'Content-Length':String(data.length),'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(doc.file_name),'Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}});
  }
  const [a1,a2]=await Promise.all([
   db.prepare('SELECT v.id,v.release_id,v.kind,v.file_name,v.media_type,v.byte_length,v.sha256,v.created_by,v.created_at,g.version,g.retention_until,g.legal_hold FROM india_document_vault v JOIN india_document_governance g ON g.document_id=v.id WHERE v.tenant_id=? AND v.opportunity_id=? ORDER BY v.created_at DESC,v.id DESC LIMIT 150').bind(TENANT,opp).all(),
   db.prepare('SELECT id,kind,file_name,media_type,byte_length,sha256,created_by,created_at,version,retention_until,legal_hold FROM india_document_library WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC,id DESC LIMIT 150').bind(TENANT,opp).all()
  ]);
  return res({success:true,documents:[...a1.results.map(d=>({...d,source:'release'})),...a2.results.map(d=>({...d,source:'library'}))]});
 }catch(e){const x=vaultError(e);return deny(x.message,x.status);}
}
export async function POST(req:Request){
 const a=await identityDeal(req);if(a.error)return a.error;
 const {db,role,email,id:opp,deal}=a;if(!db||!role||!email||!opp||!deal)return deny('Auth invalid',403);
 if(!['admin','sales','presales'].includes(role))return deny('Hanya Sales/Presales/Admin dapat mengunggah',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return deny('Origin ditolak',403);
 const q=new URL(req.url).searchParams,kind=q.get('kind')||'',name=q.get('filename')||'';
 if(!kinds.includes(kind as typeof kinds[number])||!name||name.length>180||/[\x00-\x1f\x7f/\\]/.test(name))return deny('Jenis atau nama dokumen tidak valid',422);
 if(role==='presales'&&!['rks','kak','supporting'].includes(kind))return deny('Presales hanya mengunggah dokumen scoping/tender pendukung',403);
 if(['closed_won','closed_lost'].includes(deal.stage))return deny('Opportunity yang ditutup tidak menerima file baru',409);
 try{
  const bytes=await boundedBody(req);if(!bytes.length)return deny('File kosong',422);
  const media=await inspectDocument(name,bytes);if(!media)return deny('Hanya file PDF, DOCX, PNG, JPEG atau EML yang valid',415);
  const prev=await db.prepare('SELECT coalesce(max(version),0) AS n FROM india_document_library WHERE tenant_id=? AND opportunity_id=? AND kind=?').bind(TENANT,opp,kind).first<{n:number}>();
  const version=(prev?.n||0)+1;
  const doc:VaultDoc={id:crypto.randomUUID(),tenant_id:TENANT,opportunity_id:opp,release_id:'',kind,file_name:name,media_type:media,byte_length:bytes.length,sha256:await documentHash(bytes),iv:'',chunk_count:0,created_by:email};
  const sealed=await sealDocument(doc,bytes),guard=dealGuard(deal);
  guard.condition+=' AND (SELECT coalesce(max(version),0) FROM india_document_library WHERE tenant_id=? AND opportunity_id=? AND kind=?)=?';
  guard.args.push(TENANT,opp,kind,version-1);
  await atomicSales(db,guard.condition,guard.args,[
   db.prepare('INSERT INTO india_document_library(id,tenant_id,opportunity_id,kind,version,file_name,media_type,byte_length,sha256,iv,chunk_count,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(doc.id,TENANT,opp,kind,version,name,media,bytes.length,doc.sha256,sealed.iv,sealed.chunks.length,email),
   ...sealed.chunks.map((chunk,i)=>db.prepare('INSERT INTO india_document_library_chunks(document_id,part,ciphertext) VALUES(?,?,?)').bind(doc.id,i,chunk)),
   salesAudit(db,opp,'DOCUMENT_UPLOADED',email,kind+' / v'+version+' / '+doc.id),
   event(db,opp,'library',doc.id,'UPLOAD',email,role,name)
  ]);
  return res({success:true,id:doc.id,version,reference:'library:'+doc.id,sha256:doc.sha256,file_name:name,byte_length:bytes.length},201);
 }catch(e){if(String(e).includes('TOO_LARGE'))return deny('File maksimum 8 MB',413);if(/FLOW_CONFLICT|UNIQUE constraint/.test(String(e)))return deny('Versi dokumen berubah; muat ulang.',409);const x=vaultError(e);return deny(x.message,x.status);}
}
export async function PATCH(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['admin','legal'].includes(role))return deny('Hanya Admin/Legal dapat mengelola retensi',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return deny('Origin ditolak',403);
 let p:{opportunity_id?:string;id?:string;source?:string;action?:string;until?:string;hold?:boolean;reason?:string};
 try{const raw=await req.text();if(raw.length>2500)return deny('Payload terlalu besar',413);p=JSON.parse(raw);}catch{return deny('JSON tidak valid',400);}
 const opp=p?.opportunity_id||'',docId=p?.id||'',source=p?.source||'',reason=(p?.reason||'').trim();
 if(!safeID(opp)||!safeID(docId)||!['release','library'].includes(source)||reason.length<15||reason.length>500)return deny('Dokumen dan alasan audit minimal 15 karakter wajib',422);
 const deal=await db.prepare('SELECT * FROM india_sales_opportunities WHERE id=? AND tenant_id=?').bind(opp,TENANT).first<FlowDeal>();
 if(!deal)return deny('Opportunity tidak ditemukan',404);
 if(!canReadDeal(role,email,deal.created_by))return deny('Tidak berwenang',403);
 const doc=await findDoc(db,opp,docId,source);if(!doc)return deny('Dokumen tidak ditemukan',404);
 if(doc.created_by.toLowerCase()===email.toLowerCase())return deny('Maker tidak dapat menyetujui perubahan retensi dokumennya sendiri',403);
 const table=source==='release'?'india_document_governance':'india_document_library',key=source==='release'?'document_id':'id';
 let field='',value:string|number|null=null,action='';
 if(p.action==='retention'){
  if(role!=='admin')return deny('Penetapan retensi hanya Admin',403);
  const until=p.until||'';
  if(!goodDate(until)||until<new Date().toISOString().slice(0,10))return deny('Tanggal retensi harus valid dan tidak di masa lampau',422);
  if(doc.retention_until&&until<doc.retention_until)return deny('Tidak boleh memperpendek retensi dokumen',409);
  field='retention_until';value=until;action='RETENTION_SET';
 }else if(p.action==='hold'){
  if(typeof p.hold!=='boolean')return deny('Parameter legal hold wajib benar/salah',422);
  field='legal_hold';value=p.hold?1:0;action=p.hold?'LEGAL_HOLD_SET':'LEGAL_HOLD_RELEASE';
  if(!p.hold&&role!=='legal')return deny('Pelepasan legal hold harus dilakukan Legal',403);
 }else return deny('Aksi tidak tersedia',422);
 try{
  const g=dealGuard(deal);
  g.condition+=' AND EXISTS (SELECT 1 FROM '+table+' WHERE '+key+'=? AND tenant_id=? AND opportunity_id=?'+')';
  g.args.push(docId,TENANT,opp);
  await atomicSales(db,g.condition,g.args,[
   db.prepare('UPDATE '+table+' SET '+field+'=?,hold_reason=CASE WHEN ?=\'legal_hold\' THEN ? ELSE hold_reason END,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE '+key+'=?').bind(value,field,reason,email,docId),
   salesAudit(db,opp,action,email,source+' / '+docId+' / '+reason),
   event(db,opp,source as 'release'|'library',docId,action,email,role,reason)
  ]);
  return res({success:true,id:docId,action,retention_until:field==='retention_until'?value:doc.retention_until,legal_hold:field==='legal_hold'?value:doc.legal_hold});
 }catch(e){const x=vaultError(e);return deny(x.message,x.status);}
}
