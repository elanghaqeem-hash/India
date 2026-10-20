import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {safeID,TENANT} from '@/lib/sales-workflow';
import {canDecideBid,requirementKinds,complianceStatuses,type ProcurementBid} from '@/lib/sales-procurement';
export const dynamic='force-dynamic';
const resp=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>resp({success:false,message},status);
const sameOrigin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
const roles=['admin','sales','presales','finance','approver'];
type DealRow={id:string;created_by:string;stage:string;data_json:string};
type RequirementRow={id:string;created_by:string;kind:string;status:string;file_reference:string;source_content_hash:string};
async function deal(db:D1DB,id:string){return db.prepare('SELECT id,created_by,stage,data_json FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<DealRow>();}
const canSee=(role:string,email:string,d:DealRow)=>role!=='sales'||d.created_by.toLowerCase()===email.toLowerCase();
const trim=(v:unknown,max=300)=>typeof v==='string'?v.trim().slice(0,max):'';
const audit=(db:D1DB,id:string,action:string,actor:string,summary:string)=>db.prepare(
 'INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
 .bind(crypto.randomUUID(),TENANT,'deal',id,action,actor,summary.slice(0,300)).run();
async function parse(req:Request){
 const raw=await req.text();if(raw.length>14000)throw Error('Payload terlalu besar');
 const x=JSON.parse(raw) as Record<string,unknown>;
 if(!x||Array.isArray(x)||typeof x!=='object')throw Error('Format tidak valid');
 return x;
}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Role tidak berhak membaca procurement',403);
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!safeID(id))return fail('Opportunity ID tidak valid');
 try{
  const d=await deal(db,id);if(!d)return fail('Opportunity tidak ditemukan',404);
  if(!canSee(role,email,d))return fail('Opportunity bukan milik Sales Anda',403);
  const [bid,requirements]=await Promise.all([
   db.prepare('SELECT * FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first(),
   db.prepare('SELECT id,kind,title,file_reference,file_name,source_content_hash,requirement_summary,compliance_status,status,review_notes,created_by,reviewed_by,reviewed_at,created_at FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 100').bind(TENANT,id).all()
  ]);
  return resp({success:true,bid,requirements:requirements.results,role});
 }catch{return fail('Registry Tender/RKS belum disiapkan. Terapkan migrasi 0006.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Tidak berhak membuat transaksi procurement',403);
 if(!sameOrigin(req))return fail('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{p=await parse(req);}catch{return fail('Payload tidak valid atau terlalu besar',400);}
 if(!safeID(p.opportunity_id))return fail('Opportunity ID wajib');
 try{
  const d=await deal(db,p.opportunity_id as string);if(!d)return fail('Opportunity tidak ditemukan',404);
  if(!canSee(role,email,d))return fail('Opportunity bukan milik Sales Anda',403);
  if(['closed_won','closed_lost'].includes(d.stage))return fail('Paket procurement terkunci setelah closing',409);
  if(p.entity==='bid'){
   if(!['sales','admin'].includes(role))return fail('Permohonan Bid/No-Bid hanya Sales/Admin',403);
   const channel=trim(p.channel,16),summary=trim(p.summary,2000),number=trim(p.tender_number,150),deadline=trim(p.tender_deadline,20);
   if(!['direct','rfq','rfp','tender'].includes(channel)||summary.length<10||
     (deadline&&!/^\d{4}-\d{2}-\d{2}$/.test(deadline)))return fail('Channel, ringkasan, dan deadline harus valid');
   const existing=await db.prepare('SELECT bid_decision FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?')
    .bind(TENANT,d.id).first<{bid_decision:string}>();
   if(existing&&existing.bid_decision!=='pending')return fail('Bid sudah diputuskan; gunakan revisi resmi untuk pengajuan ulang',409);
   const changed=await db.prepare("INSERT INTO india_sales_bids(opportunity_id,tenant_id,channel,tender_number,tender_deadline,summary,proposed_by) VALUES (?,?,?,?,?,?,?) ON CONFLICT(opportunity_id) DO UPDATE SET channel=excluded.channel,tender_number=excluded.tender_number,tender_deadline=excluded.tender_deadline,summary=excluded.summary,updated_at=CURRENT_TIMESTAMP WHERE bid_decision='pending'")
    .bind(d.id,TENANT,channel,number,deadline,summary,email).run();
   if((changed as unknown as {meta?:{changes?:number}}).meta?.changes===0)return fail('Bid telah diputuskan oleh pengguna lain',409);
   await audit(db,d.id,'BID_REQUEST',email,channel+' '+number);
   return resp({success:true,decision:'pending'});
  }
  if(p.entity==='requirement'){
   if(!['admin','sales','presales'].includes(role))return fail('RKS/KAK hanya didaftarkan Sales/Presales/Admin',403);
   const kind=trim(p.kind,30),title=trim(p.title,250),file_reference=trim(p.file_reference,500),
    file_name=trim(p.file_name,180),source_content_hash=trim(p.source_content_hash,64).toLowerCase(),
    summary=trim(p.requirement_summary,2000);
   if(!requirementKinds.includes(kind as typeof requirementKinds[number])||title.length<5||summary.length<15||
    (source_content_hash&&!/^[a-f0-9]{64}$/.test(source_content_hash)))
    return fail('Jenis, judul, uraian requirement dan checksum wajib sesuai format',422);
   const id=crypto.randomUUID();
   await db.batch([
    db.prepare("INSERT INTO india_sales_requirements(id,tenant_id,opportunity_id,kind,title,file_reference,file_name,source_content_hash,requirement_summary,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
     .bind(id,TENANT,d.id,kind,title,file_reference,file_name,source_content_hash,summary,email),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
     .bind(crypto.randomUUID(),TENANT,'deal',d.id,'REQUIREMENT_CREATE',email,kind+': '+title)
   ]);
   return resp({success:true,id,status:'draft'},201);
  }
  return fail('Aksi procurement tidak terdaftar');
 }catch{return fail('Transaksi procurement gagal atau skema D1 belum tersedia',503);}
}
export async function PATCH(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!['admin','presales','finance','approver'].includes(role))return fail('Reviewer independen diperlukan',403);
 if(!sameOrigin(req))return fail('Origin tidak diizinkan',403);
 let p:Record<string,unknown>;try{p=await parse(req);}catch{return fail('Payload tidak valid');}
 if(!safeID(p.opportunity_id))return fail('Opportunity ID tidak valid');
 try{
  const d=await deal(db,p.opportunity_id as string);if(!d)return fail('Opportunity tidak ditemukan',404);
  if(p.entity==='bid_decision'){
   const bid=await db.prepare('SELECT * FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?')
    .bind(TENANT,d.id).first<ProcurementBid>();
   if(!bid)return fail('Bid request belum tersedia',404);
   const denial=canDecideBid(bid,role,email);if(denial)return fail(denial,403);
   const decision=trim(p.bid_decision,20),reason=trim(p.decision_reason,1000);
   if(!['go','conditional_go','no_go'].includes(decision)||reason.length<12)return fail('Keputusan dan alasan minimal 12 karakter wajib');
   const updated=await db.prepare("UPDATE india_sales_bids SET bid_decision=?,decision_reason=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND opportunity_id=? AND bid_decision='pending'")
    .bind(decision,reason,email,TENANT,d.id).run();
   if((updated as unknown as {meta?:{changes?:number}}).meta?.changes===0)return fail('Bid sudah diputuskan oleh reviewer lain',409);
   await audit(db,d.id,'BID_DECISION',email,decision+' '+reason);
   return resp({success:true,decision});
  }
  if(p.entity==='requirement_review'){
   if(!safeID(p.id))return fail('Requirement ID tidak valid');
   const reqrow=await db.prepare('SELECT id,kind,status,created_by,file_reference,source_content_hash FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=? AND id=?')
    .bind(TENANT,d.id,p.id as string).first<RequirementRow>();
   if(!reqrow)return fail('Requirement tidak ditemukan',404);
   if(reqrow.status!=='draft')return fail('Requirement sudah direview/superseded',409);
   if(reqrow.created_by.toLowerCase()===email.toLowerCase())return fail('Pembuat requirement tidak boleh mengesahkan sendiri',403);
   if(['rks','kak','rfp','rfq','technical'].includes(reqrow.kind)&&!['admin','presales'].includes(role))
    return fail('Pemeriksaan teknis hanya oleh Presales/Admin',403);
   if(reqrow.kind==='vendor_quote'&&!['admin','finance'].includes(role))return fail('Vendor quote harus direview Finance/Admin',403);
   if(!reqrow.file_reference||!/^[a-f0-9]{64}$/i.test(reqrow.source_content_hash))
    return fail('Reference arsip dan SHA-256 sumber harus tersedia sebelum review',409);
   const compliance=trim(p.compliance_status,30),notes=trim(p.review_notes,1000);
   if(!complianceStatuses.includes(compliance as typeof complianceStatuses[number])||notes.length<8)
    return fail('Status compliance dan catatan review minimal 8 karakter wajib');
   const result=await db.prepare("UPDATE india_sales_requirements SET status='reviewed',compliance_status=?,review_notes=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=? AND opportunity_id=? AND status='draft'")
    .bind(compliance,notes,email,reqrow.id,TENANT,d.id).run();
   if((result as unknown as {meta?:{changes?:number}}).meta?.changes===0)return fail('Requirement telah diubah reviewer lain',409);
   await audit(db,d.id,'REQUIREMENT_REVIEW',email,reqrow.kind+': '+compliance);
   return resp({success:true,status:'reviewed',compliance});
  }
  return fail('Aksi tidak dikenali');
 }catch{return fail('Review procurement gagal atau tabel D1 belum siap',503);}
}
