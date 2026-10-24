import {requireVaultDocument,authenticateWonOriginals,vaultError} from '@/lib/document-vault';
import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders, type D1DB } from '@/lib/boq-auth';
import { boqTotals, type BoQLine } from '@/lib/boq-domain';
import { canReadDeal,canReadAccount,canEditAccount,canEditDeal,canChangeStage } from '@/lib/sales-access';
import { salesJourney } from '@/lib/sales-journey';
import {needsTenderGate,procurementGate,type ProcurementBid,type RequirementEvidence} from '@/lib/sales-procurement';
import {submissionMatches,type Submission} from '@/lib/sales-submission';
import {validAwardForWon,type AwardDoc} from '@/lib/sales-award';
import { ACCOUNT_KEYS, DEAL_KEYS, TENANT, SALES_STAGES, stageTransition, requiredForStage, dateValid, cleanFields, safeID, documentChecklist,
 type SalesDeal, type SalesAccount, type SalesStage } from '@/lib/sales-workflow';
import {atomicSales,currentRelease,dealGuard,salesAudit,transactionError,poSnapshot,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const answer=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>answer({success:false,message},status);
const allowed=(role:string,roles:string[])=>roles.includes(role);
const ownOrigin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
type AcctRow={id:string;legal_name:string;customer_number:string|null;data_json:string;created_at:string;created_by:string|null};
type DealRow=FlowDeal & {id:string;company_id:string;title:string;stage:string;estimated_value_idr:number;data_json:string;created_at:string;created_by:string|null};
type BoQRow={id:string;opportunity_id:string|null;status:string;quotation_number:string;version:number;customer_name:string;project_name:string;line_items_json:string;vat_rate:number};
type PoRow={opportunity_id:string;boq_id:string;po_number:string;po_date:string;po_reference:string;po_amount_before_vat:number;quotation_amount_before_vat:number;verified_by:string;verified_at:string;release_id:string|null};
const account=(r:AcctRow):SalesAccount=>({id:r.id,legal_name:r.legal_name,customer_number:r.customer_number||'',fields:JSON.parse(r.data_json||'{}'),created_at:r.created_at,created_by:r.created_by||undefined});
const deal=(r:DealRow,a:SalesAccount):SalesDeal=>({id:r.id,company_id:r.company_id,company_name:a.legal_name,title:r.title,stage:r.stage as SalesStage,estimated_value:r.estimated_value_idr,flow_version:r.flow_version,fields:JSON.parse(r.data_json||'{}'),created_at:r.created_at,created_by:r.created_by||undefined});
async function getAccount(db:D1DB,id:string):Promise<AcctRow|null>{
 return db.prepare('SELECT * FROM india_sales_accounts WHERE id=? AND tenant_id=?').bind(id,TENANT).first<AcctRow>();
}
async function getDeal(db:D1DB,id:string):Promise<DealRow|null>{
 return db.prepare('SELECT * FROM india_sales_opportunities WHERE id=? AND tenant_id=?').bind(id,TENANT).first<DealRow>();
}
const servicePerms=['admin','sales','presales','finance','approver','legal'];
const salesPerms=['admin','sales'];
async function requireBoq(db:D1DB,d:SalesDeal,a:SalesAccount):Promise<{boq:BoQRow;subtotal:number;problem?:string}|{problem:string}>{
 const boqId=d.fields.boq_id;
 if(!safeID(boqId))return {problem:'Pilih BoQ tersimpan dan approved yang terhubung ke Opportunity ID ini.'};
 const boq=await db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(boqId,TENANT).first<BoQRow>();
 if(!boq||boq.opportunity_id!==d.id)return {problem:'BoQ harus berasal dari opportunity yang sama.'};
 if(boq.status!=='approved')return {problem:'BoQ harus berstatus approved oleh approver yang berwenang.'};
 if(boq.customer_name.trim().toLowerCase()!==a.legal_name.trim().toLowerCase())return {problem:'Nama klien pada BoQ tidak sama dengan Customer Account.'};
 if(boq.project_name.trim().toLowerCase()!==d.title.trim().toLowerCase())return {problem:'Nama proyek pada BoQ tidak sama dengan opportunity.'};
 const lines=JSON.parse(boq.line_items_json) as BoQLine[];
 const totals=boqTotals(lines,[],boq.vat_rate);
 if(d.fields.quotation_number&&d.fields.quotation_number!==boq.quotation_number)return {problem:'Nomor quotation tidak cocok dengan BoQ approved.'};
 return {boq,subtotal:totals.subtotal};
}
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const db=auth.identity.db,u=new URL(req.url),entity=u.searchParams.get('entity')||'deals';
 if(!allowed(auth.identity.role,servicePerms))return fail('Hak akses data Sales tidak tersedia untuk role ini',403);
 try{
  if(entity==='accounts'){
   const rows=await db.prepare('SELECT * FROM india_sales_accounts WHERE tenant_id=? ORDER BY created_at DESC LIMIT 250').bind(TENANT).all<AcctRow>();
   return answer({success:true,accounts:rows.results.filter(x=>canReadAccount(auth.identity.role,auth.identity.email,x.created_by)).map(account),role:auth.identity.role});
  }
  if(entity==='deals'){
   const rows=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? ORDER BY created_at DESC LIMIT 250').bind(TENANT).all<DealRow>();
   const companies=await db.prepare('SELECT * FROM india_sales_accounts WHERE tenant_id=?').bind(TENANT).all<AcctRow>();
   const refs=new Map(companies.results.map(r=>[r.id,account(r)]));
   return answer({success:true,deals:rows.results.filter(x=>refs.has(x.company_id)&&canReadDeal(auth.identity.role,auth.identity.email,x.created_by)).map(x=>deal(x,refs.get(x.company_id)!)),role:auth.identity.role});
  }
  const id=u.searchParams.get('id');
  if(!safeID(id))return fail('ID opportunity tidak valid');
  const raw=await getDeal(db,id as string),acct=raw?await getAccount(db,raw.company_id):null;
  if(!raw||!acct)return fail('Opportunity tidak ditemukan',404);
  if(!canReadDeal(auth.identity.role,auth.identity.email,raw.created_by))return fail('Tidak memiliki akses ke opportunity ini',403);
  const d=deal(raw,account(acct));
  if(entity==='details'){
   const [boqs,po,history,activities,originLead,documents,submissions,awardDocs]=await Promise.all([
    db.prepare('SELECT id,quotation_number,status,project_name,version FROM india_boq WHERE tenant_id=? AND opportunity_id=? ORDER BY updated_at DESC LIMIT 30').bind(TENANT,id).all(),
    db.prepare('SELECT * FROM india_sales_po_checks WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<PoRow>(),
    db.prepare('SELECT action,from_stage,to_stage,actor_email,summary,created_at FROM india_sales_audit WHERE tenant_id=? AND entity_id=? ORDER BY created_at DESC LIMIT 50').bind(TENANT,id).all(),
    db.prepare('SELECT kind,subject,detail,next_action_at,created_by,created_at FROM india_sales_activities WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 70').bind(TENANT,id).all(),
    db.prepare('SELECT l.lead_id,m.lead_number,m.source,m.campaign FROM india_sales_lead_links l JOIN india_marketing_leads m ON m.id=l.lead_id WHERE l.tenant_id=? AND l.opportunity_id=?').bind(TENANT,id).first<{lead_id:string;lead_number:string;source:string;campaign:string}>(),
    db.prepare('SELECT kind,status,reference FROM india_sales_documents WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 80').bind(TENANT,id).all<{kind:string;status:string;reference:string}>(),
    db.prepare("SELECT id,opportunity_id,boq_id,boq_version,quotation_number,recipient_email,channel,status,created_by,verified_by,evidence_reference,evidence_sha256 FROM india_sales_submissions WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 50").bind(TENANT,id).all<Submission>(),
    db.prepare('SELECT id,opportunity_id,document_kind,document_number,archive_reference,original_sha256,created_by,finance_reviewed_by,legal_reviewed_by FROM india_sales_award_documents WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).all<AwardDoc>()
   ]);
   const chosen=boqs.results.find((x:{id?:string})=>x.id===d.fields.boq_id) as {id:string;opportunity_id?:string;version:number;quotation_number:string;status:string}|undefined;
   const confirmedSubmission=chosen?submissions.results.find(x=>submissionMatches(x,{
    id:chosen.id,opportunity_id:d.id,status:chosen.status,quotation_number:chosen.quotation_number,version:chosen.version
   },d.id)):undefined;
   const existingBid=await db.prepare('SELECT * FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<ProcurementBid>();
   const tenderProcess=existingBid?.channel&&existingBid.channel!=='direct'?existingBid.channel:(d.fields.procurement_process||'');
   const tenderRequired=needsTenderGate(tenderProcess)||existingBid?.bid_decision==='no_go';
   let procurementGaps:string[]=existingBid?.bid_decision==='no_go'?['Bid/No-Bid NO-GO: quotation tidak boleh diterbitkan']: [];
   if(needsTenderGate(tenderProcess)){
    const requirements=await db.prepare('SELECT kind,status,compliance_status,reviewed_by,file_reference,source_content_hash FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).all<RequirementEvidence>();
    procurementGaps.push(...procurementGate(tenderProcess,existingBid,requirements.results));
   }
   const release=await currentRelease(db,d.id);
   const latestNegotiation=release?await db.prepare('SELECT decision FROM india_sales_negotiations WHERE release_id=? ORDER BY rowid DESC LIMIT 1').bind(release.id).first<{decision:string}>():null;
   const currentAwards=release?await db.prepare('SELECT * FROM india_sales_award_documents WHERE tenant_id=? AND opportunity_id=? AND release_id=?').bind(TENANT,d.id,release.id).all<AwardDoc & {po_data_json:string}>():{results:[]};
   const dualReviewedAward=currentAwards.results.some(x=>validAwardForWon(x,d.fields.po_number||'')&&x.po_data_json===poSnapshot(d.fields));
   const journey=salesJourney(account(acct),d,{
    lead_number:originLead?.lead_number||null,boq_status:chosen?.status||null,boq_linked:!!chosen,
    quotation_record:release?.status==='approved',release_status:release?.status||null,negotiation_decision:latestNegotiation?.decision||null,
    // A document reference/attestation is NOT equivalent to proof of submission or original PO.
    submission_proof:!!confirmedSubmission&&release?.status==='approved',po_check:!!po&&!!release&&po.release_id===release.id,po_original:dualReviewedAward,legal_approved:dualReviewedAward,procurement_gaps:procurementGaps,procurement_required:tenderRequired
   });
   return answer({success:true,deal:d,account:account(acct),boqs:boqs.results,poCheck:po,history:history.results,activities:activities.results,documents:documents.results,submissions:submissions.results,awardDocuments:awardDocs.results,journey,
    checklist:documentChecklist(d,account(acct)),originLead,role:auth.identity.role,identityEmail:auth.identity.email});
  }
  return fail('Jenis data tidak dikenal');
 }catch{return fail('Database Sales belum siap, periksa migrasi 0003 dan login.',503);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 if(!ownOrigin(req))return fail('Origin tidak diizinkan',403);
 if(!allowed(role,servicePerms))return fail('Role tidak memiliki izin membuat transaksi Sales',403);
 let p:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>60000)return fail('Payload terlalu besar',413);
 p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))return fail('Payload harus object');}
 catch{return fail('JSON tidak valid');}
 const kind=p.entity;
 try{
  if(kind==='account'){
   if(!allowed(role,salesPerms))return fail('Hanya Sales/Admin boleh registrasi pelanggan',403);
   const legal_name=String(p.legal_name||'').trim().replace(/\s+/g,' ');
   if(legal_name.length<3||legal_name.length>240)return fail('Nama legal pelanggan wajib (3-240 karakter)');
   const fields=cleanFields(p.fields||{},ACCOUNT_KEYS);
   const id=crypto.randomUUID(),customer_number='IND-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'-'+id.slice(0,8).toUpperCase();
   await db.batch([db.prepare('INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) VALUES (?,?,?,?,?,?)')
    .bind(id,TENANT,legal_name,customer_number,JSON.stringify(fields),email),db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,'account',id,'CREATE',email)]);
   return answer({success:true,id,customer_number,missing:[]},201);
  }
  if(kind==='deal'){
   if(!allowed(role,salesPerms))return fail('Hanya Sales/Admin boleh mendaftarkan opportunity',403);
   const company_id=p.company_id,title=String(p.title||'').trim(),amount=Number(p.estimated_value);
   if(!safeID(company_id)||!title||title.length>240||!Number.isFinite(amount)||amount<=0||amount>1e14)return fail('Pelanggan, nama proyek dan nilai peluang wajib valid');
   const ownerAccount=await getAccount(db,company_id as string);
   if(!ownerAccount)return fail('Customer account tidak ditemukan',404);
   if(!canReadAccount(role,email,ownerAccount.created_by))return fail('Tidak memiliki akses ke Customer Account ini',403);
   const fields=cleanFields(p.fields||{},DEAL_KEYS);
   const id=crypto.randomUUID();
   await db.batch([db.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,TENANT,company_id as string,title,'prospecting',amount,JSON.stringify(fields),email),salesAudit(db,id,'CREATE',email,'',null,'prospecting')]);
   return answer({success:true,id},201);
  }
  if(kind==='activity'){
   if(!safeID(p.opportunity_id)||!['call','email','meeting','follow_up','tender','note'].includes(String(p.kind)))return fail('Opportunity / jenis aktivitas tidak valid');
   const activityDeal=await getDeal(db,p.opportunity_id as string);
   if(!activityDeal)return fail('Opportunity tidak ditemukan',404);
   if(!canReadDeal(role,email,activityDeal.created_by))return fail('Tidak memiliki akses ke opportunity ini',403);
   const subject=String(p.subject||'').trim(),detail=String(p.detail||'').trim(),date=String(p.next_action_at||'');
   if(!subject||subject.length>200||detail.length>2000||date.length>30)return fail('Aktivitas tidak valid');
   const id=crypto.randomUUID();
   const guard=dealGuard(activityDeal);
   await atomicSales(db,guard.condition,guard.args,[db.prepare('INSERT INTO india_sales_activities(id,tenant_id,opportunity_id,kind,subject,detail,next_action_at,created_by) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,p.opportunity_id as string,String(p.kind),subject,detail,date||null,email),salesAudit(db,String(p.opportunity_id),'ACTIVITY',email)]);
   return answer({success:true,id},201);
  }
  if(kind==='verify_po'){
   if(!allowed(role,['admin','finance','approver']))return fail('Verifikasi PO hanya untuk Finance/Approver/Admin',403);
   if(!safeID(p.id))return fail('Opportunity tidak valid');
   const raw=await getDeal(db,p.id as string),acct=raw?await getAccount(db,raw.company_id):null;
   if(!raw||!acct)return fail('Opportunity tidak ditemukan',404);
   if(raw.created_by?.trim().toLowerCase()===email.trim().toLowerCase())return fail('Segregation of Duties: pembuat opportunity tidak boleh melakukan verifikasi PO, termasuk Admin.',403);
   const d=deal(raw,account(acct));
   if(p.flow_version!==undefined&&p.flow_version!==raw.flow_version)return fail('Data berubah pada sesi lain, muat ulang',409);
   if(d.stage!=='pending_po')return fail('PO dapat diverifikasi hanya pada Pending PO',409);
   if(p.confirmed_documents!==true)return fail('Finance/Approver wajib menyatakan telah memeriksa dokumen PO asli, ruang lingkup, nominal dan quotation.',422);
   const check=await requireBoq(db,d,account(acct));
   if('problem' in check)return fail(String(check.problem),409);
   const release=await currentRelease(db,d.id);
   if(!release||release.status!=='approved'||release.boq_id!==check.boq.id)return fail('Proposal approved versi aktif wajib sebelum verifikasi PO',409);
   const awards=await db.prepare('SELECT * FROM india_sales_award_documents WHERE tenant_id=? AND opportunity_id=? AND release_id=?').bind(TENANT,d.id,release.id).all<AwardDoc & {po_data_json:string}>();
   const award=awards.results.find(x=>validAwardForWon(x,d.fields.po_number||'')&&x.po_data_json===poSnapshot(d.fields));
   if(!award)return fail('PO asli dengan data yang sama harus direview Finance dan Legal secara independen',409);
   await requireVaultDocument(db,award.archive_reference,award.original_sha256,d.id,release.id,award.document_kind);
   const number=d.fields.po_number||'',date=d.fields.po_date||'',reference=d.fields.po_reference||'',n=Number(d.fields.po_amount_before_vat);
   if(!number||!dateValid(date)||!reference||reference.length<8||!Number.isFinite(n)||n<=0)
     return fail('Nomor, tanggal, referensi bukti PO dan nilai PO harus lengkap',409);
   if(Math.abs(n-check.subtotal)>0.01)return fail('Nilai PO berbeda dari BoQ approved. Lakukan revisi dan approval terlebih dahulu.',409);
   if(!d.fields.scope_reconciliation||d.fields.scope_reconciliation.length<15)return fail('Catatan konfirmasi scope dan termin minimal 15 karakter.',409);
   const guard=dealGuard(raw);
   await atomicSales(db,guard.condition,guard.args,[db.prepare('INSERT INTO india_sales_po_checks(opportunity_id,tenant_id,boq_id,po_number,po_date,po_reference,po_amount_before_vat,quotation_amount_before_vat,verified_by,release_id,award_id) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(opportunity_id) DO UPDATE SET boq_id=excluded.boq_id,po_number=excluded.po_number,po_date=excluded.po_date,po_reference=excluded.po_reference,po_amount_before_vat=excluded.po_amount_before_vat,quotation_amount_before_vat=excluded.quotation_amount_before_vat,verified_by=excluded.verified_by,release_id=excluded.release_id,award_id=excluded.award_id,verified_at=CURRENT_TIMESTAMP')
    .bind(d.id,TENANT,check.boq.id,number,date,reference,n,check.subtotal,email,release.id,award.id),
    salesAudit(db,d.id,'VERIFY_PO',email,'Paket v'+release.version+' / award '+award.id)
   ]);
   return answer({success:true,verified_by:email});
  }
  if(kind==='document'){
   const id=p.opportunity_id;
   if(!safeID(id))return fail('Opportunity tidak valid');
   const raw=await getDeal(db,id as string),acct=raw?await getAccount(db,raw.company_id):null;
   if(!raw||!acct)return fail('Opportunity tidak ditemukan',404);
   if(!canReadDeal(role,email,raw.created_by))return fail('Tidak memiliki akses ke opportunity ini',403);
   const d=deal(raw,account(acct)),checklist=documentChecklist(d,account(acct));
   const doc=String(p.document_kind||''),ref=String(p.reference||'').trim();
   if(!['boq','quotation','customer_registration','project_form','sales_handover','loss_analysis'].includes(doc)||!ref||ref.length>200)return fail('Jenis / referensi dokumen tidak valid');
   const missing=doc==='customer_registration'?checklist.registration:doc==='project_form'?checklist.project:[];
   // Metadata and a completed checklist do not establish that an original file exists or is signed.
   const status='draft';
   const guard=dealGuard(raw);
   await atomicSales(db,guard.condition,guard.args,[db.prepare('INSERT INTO india_sales_documents(id,tenant_id,opportunity_id,kind,status,reference,checklist_json,created_by) VALUES (?,?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),TENANT,id as string,doc,status,ref,JSON.stringify(missing),email),salesAudit(db,id as string,'DOCUMENT_'+doc.toUpperCase(),email,'Status '+status)]);
   return answer({success:true,status,missing});
  }
  return fail('Aksi tidak dikenali');
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return fail(v.message,v.status);}const t=transactionError(e);return fail(t.message,t.status);}
}
export async function PATCH(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,email,role}=auth.identity;
 if(!ownOrigin(req))return fail('Origin ditolak',403);
 if(!allowed(role,servicePerms))return fail('Role tidak berhak mengubah Sales',403);
 let p:Record<string,unknown>;
 try{const s=await req.text();if(s.length>60000)return fail('Payload terlalu besar',413);p=JSON.parse(s);}
 catch{return fail('JSON tidak valid');}
 if(!safeID(p.id))return fail('ID tidak valid');
 try{
  if(p.entity==='account'){
   if(!allowed(role,salesPerms))return fail('Perubahan pelanggan hanya Sales/Admin',403);
   const row=await getAccount(db,p.id as string);
   if(!row)return fail('Pelanggan tidak ditemukan',404);
   if(!canEditAccount(role,email,row.created_by))return fail('Hanya pembuat Customer Account atau Admin yang dapat memperbarui master data',403);
   const name=p.legal_name===undefined?row.legal_name:String(p.legal_name).trim().replace(/\s+/g,' ');
   if(name.length<3||name.length>240)return fail('Nama legal tidak valid');
   const fields={...JSON.parse(row.data_json),...cleanFields(p.fields||{},ACCOUNT_KEYS)};
   await atomicSales(db,'EXISTS(SELECT 1 FROM india_sales_accounts WHERE id=? AND tenant_id=? AND data_json=? AND legal_name=?)',[row.id,TENANT,row.data_json,row.legal_name],[
    db.prepare('UPDATE india_sales_accounts SET legal_name=?,data_json=? WHERE id=? AND tenant_id=?').bind(name,JSON.stringify(fields),row.id,TENANT),
    db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,'account',row.id,'UPDATE',email,'Perubahan Customer diperiksa ulang pada paket penawaran aktif')
   ]);
   return answer({success:true,missing:[]});
  }
  if(p.entity==='deal'||p.entity==='transition'){
   if(!allowed(role,['admin','sales','presales','finance','approver']))return fail('Role tidak diizinkan',403);
   const row=await getDeal(db,p.id as string),a=row?await getAccount(db,row.company_id):null;
   if(!row||!a)return fail('Opportunity / pelanggan tidak ditemukan',404);
   if(!canReadDeal(role,email,row.created_by))return fail('Opportunity bukan milik akun Sales ini',403);
   const d=deal(row,account(a));
   if(p.flow_version!==undefined&&p.flow_version!==row.flow_version)return fail('Data berubah pada sesi lain, muat ulang',409);
   if(p.entity==='deal'){
    if(d.stage==='closed_won'||d.stage==='closed_lost')return fail('Opportunity sudah ditutup, gunakan prosedur reopen atau koreksi',409);
    const allowedFields=cleanFields(p.fields||{},DEAL_KEYS);
    if(!canEditDeal(role,email,row.created_by,allowedFields,p.title!==undefined||p.estimated_value!==undefined))return fail('Sales hanya boleh mengubah opportunity sendiri; Presales hanya boleh mengubah parameter teknis',403);
    const title=p.title===undefined?d.title:String(p.title).trim();
    const amount=p.estimated_value===undefined?d.estimated_value:Number(p.estimated_value);
    if(!title||title.length>240||!Number.isFinite(amount)||amount<=0||amount>1e14)return fail('Judul dan nilai tidak valid');
    const fields={...d.fields,...allowedFields};
    const guard=dealGuard(row);
    await atomicSales(db,guard.condition,guard.args,[
     db.prepare('UPDATE india_sales_opportunities SET title=?,estimated_value_idr=?,data_json=? WHERE id=? AND tenant_id=?').bind(title,amount,JSON.stringify(fields),d.id,TENANT),
     salesAudit(db,d.id,'UPDATE',email,'Perubahan material membatalkan paket dan persetujuan terkait')
    ]);
    return answer({success:true});
   }
   if(!canChangeStage(role,email,row.created_by))return fail('Hanya Sales pemilik deal atau Admin boleh mengubah stage',403);
   const stage=String(p.stage) as SalesStage;
   if(!SALES_STAGES.some(x=>x[0]===stage))return fail('Stage tidak terdaftar');
   const transition=stageTransition(d.stage,stage);
   if(transition)return fail(transition,409);
   if(stage===d.stage)return answer({success:true,stage});
   const missing=requiredForStage(stage,d,account(a));
   if(stage==='closed_lost'){
    if(!d.fields.lost_reason||!d.fields.lost_notes)missing.push('lost_reason / lost_notes');
   }
   if(missing.length)return answer({success:false,message:'Field wajib belum lengkap',missing},409);
   const enteringOffer=['quotation_sent','negotiation','pending_po','closed_won'].includes(stage);
   if(enteringOffer){
    const check=await requireBoq(db,d,account(a));
    if('problem' in check)return fail(String(check.problem),409);
    const bid=await db.prepare('SELECT * FROM india_sales_bids WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<ProcurementBid>();
    if(bid?.bid_decision==='no_go')return fail('Bid/No-Bid NO-GO: deal tidak boleh dilanjutkan ke quotation',409);
    const tenderProcess=bid?.channel&&bid.channel!=='direct'?bid.channel:(d.fields.procurement_process||'');
    if(needsTenderGate(tenderProcess)){
     const reqs=await db.prepare('SELECT kind,status,compliance_status,reviewed_by,file_reference,source_content_hash FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).all<RequirementEvidence>();
     const tenderGaps=procurementGate(tenderProcess,bid,reqs.results);
     if(tenderGaps.length)return answer({success:false,message:'Bid/No-Bid dan persyaratan RKS/KAK harus lolos sebelum quotation',missing:tenderGaps},409);
    }
   }
   if(['negotiation','pending_po','closed_won'].includes(stage)){
    const finalBoq=await db.prepare('SELECT id,opportunity_id,version,quotation_number,status FROM india_boq WHERE id=? AND tenant_id=?')
     .bind(d.fields.boq_id||'',TENANT).first<{id:string;opportunity_id:string|null;version:number;quotation_number:string;status:string}>();
    const proofs=await db.prepare('SELECT id,opportunity_id,boq_id,boq_version,quotation_number,recipient_email,channel,status,created_by,verified_by,evidence_reference,evidence_sha256 FROM india_sales_submissions WHERE tenant_id=? AND opportunity_id=? AND status=?')
     .bind(TENANT,d.id,'verified').all<Submission>();
    if(!finalBoq||!proofs.results.some(x=>submissionMatches(x,finalBoq,d.id)))
     return fail('Quotation yang disetujui harus memiliki bukti submission yang direview independen sebelum Negotiation, PO, atau Won.',409);
   }
   if(stage==='closed_won'){
    const awardDocs=await db.prepare('SELECT id,opportunity_id,document_kind,document_number,archive_reference,original_sha256,created_by,finance_reviewed_by,legal_reviewed_by FROM india_sales_award_documents WHERE tenant_id=? AND opportunity_id=?')
     .bind(TENANT,d.id).all<AwardDoc>();
    if(!awardDocs.results.some(x=>validAwardForWon(x,d.fields.po_number||'')))
     return fail('Closed Won ditolak: bukti PO/SPK asli harus memiliki checksum, referensi arsip, dan review Finance serta Legal yang terpisah.',409);
   }
   if(stage==='closed_won'){
    const po=await db.prepare('SELECT * FROM india_sales_po_checks WHERE opportunity_id=? AND tenant_id=?').bind(d.id,TENANT).first<PoRow>();
    if(!po||po.boq_id!==d.fields.boq_id||po.po_number!==d.fields.po_number||
       po.po_date!==d.fields.po_date||po.po_reference!==d.fields.po_reference||
       Math.abs(po.po_amount_before_vat-Number(d.fields.po_amount_before_vat))>0.01)
      return fail('Verifikasi PO oleh Finance/Approver harus selesai dengan bukti yang sama.',409);
   }
   if(stage==='closed_won')await authenticateWonOriginals(db,d.id);
   const guard=dealGuard(row);
   await atomicSales(db,guard.condition,guard.args,[
    db.prepare('UPDATE india_sales_opportunities SET stage=? WHERE id=? AND tenant_id=?').bind(stage,d.id,TENANT),
    salesAudit(db,d.id,'STAGE',email,'',d.stage,stage)
   ]);
   return answer({success:true,stage});
  }
  return fail('Jenis perubahan tidak dikenali');
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return fail(v.message,v.status);}const t=transactionError(e);return fail(t.message,t.status);}
}
