import {requireVaultDocument,vaultError} from '@/lib/document-vault';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID,dateValid,requiredForStage,type SalesStage} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {boqTotals,type BoQLine} from '@/lib/boq-domain';
import {checkBoqLink} from '@/lib/sales-boq-link';
import {atomicSales,currentRelease,dealGuard,salesAudit,transactionError,type FlowDeal,type SalesRelease} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const res=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const deny=(message:string,status=400)=>res({success:false,message},status);
const allowed=['admin','sales','presales','finance','approver','legal'];
const str=(x:unknown)=>typeof x==='string'?x.trim():'';
const digest=(s:string)=>/^[a-f0-9]{64}$/i.test(s);
type Boq={id:string;opportunity_id:string;version:number;edit_seq:number;status:string;quotation_number:string;customer_name:string;project_name:string;service_type:string;payment_terms:string;line_items_json:string;vat_rate:number;created_by:string};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!allowed.includes(role))return deny('Role tidak diizinkan',403);
 const id=new URL(req.url).searchParams.get('opportunity_id');if(!safeID(id))return deny('Pilih Opportunity dari Sales Pipeline');
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return deny('Opportunity tidak ditemukan',404);
  if(!canReadDeal(role,email,d.created_by))return deny('Opportunity bukan milik Sales ini',403);
  const [releases,negotiations]=await Promise.all([
   db.prepare('SELECT * FROM india_sales_releases WHERE tenant_id=? AND opportunity_id=? ORDER BY version DESC').bind(TENANT,id).all<SalesRelease>(),
   db.prepare('SELECT * FROM india_sales_negotiations WHERE tenant_id=? AND opportunity_id=? ORDER BY rowid DESC').bind(TENANT,id).all()
  ]);
  return res({success:true,role,identityEmail:email,deal:{id:d.id,title:d.title,stage:d.stage,flow_version:d.flow_version},releases:releases.results,negotiations:negotiations.results});
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return deny(v.message,v.status);}const t=transactionError(e);return deny(t.message,t.status);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!allowed.includes(role))return deny('Role tidak diizinkan',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return deny('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>16000)return deny('Payload terlalu besar',413);p=JSON.parse(raw);if(!p||typeof p!=='object'||Array.isArray(p))return deny('JSON harus object');}catch{return deny('JSON tidak valid');}
 const id=str(p.opportunity_id),action=str(p.action),notes=str(p.notes);
 if(!safeID(id)||!Number.isInteger(p.flow_version)||notes.length<15||notes.length>3000)return deny('Opportunity, versi data dan catatan 15–3000 karakter wajib',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return deny('Opportunity tidak ditemukan',404);
  if(!canReadDeal(role,email,d.created_by))return deny('Opportunity bukan milik Sales ini',403);
  if(d.flow_version!==p.flow_version)return deny('Data berubah, muat ulang',409);
  if(['closed_won','closed_lost'].includes(d.stage))return deny('Opportunity ditutup; riwayat paket terkunci',409);
  const f=JSON.parse(d.data_json) as Record<string,string>;
  const acc=await db.prepare('SELECT id,legal_name,data_json FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind(TENANT,d.company_id).first<{id:string;legal_name:string;data_json:string}>();
  if(!acc)return deny('Customer tidak tersedia',409);
  const release=await currentRelease(db,id),guard=dealGuard(d);
  // Bind customer state too: account changes must never approve a stale proposal.
  guard.condition+=" AND EXISTS(SELECT 1 FROM india_sales_accounts WHERE id=? AND tenant_id=? AND data_json=? AND legal_name=?)";
  guard.args.push(acc.id,TENANT,acc.data_json,acc.legal_name);
  const actorIsMaker=['admin','sales'].includes(role);
  if(action==='scope'){
   if(!['presales','admin'].includes(role))return deny('Validasi scope hanya Presales/Admin',403);
   if(!['discovery','solution_design','commercial_review'].includes(d.stage)||release)return deny('Scope harus divalidasi pada Discovery/Solution Design; revisi paket aktif terlebih dahulu',409);
   const missing=requiredForStage('discovery',{id,title:d.title,company_id:d.company_id,company_name:acc.legal_name,stage:d.stage as SalesStage,estimated_value:d.estimated_value_idr,fields:f,created_at:''},{id:acc.id,legal_name:acc.legal_name,customer_number:'',fields:JSON.parse(acc.data_json),created_at:''});
   if(missing.length)return res({success:false,message:'Scoping belum lengkap',missing},409);
   const version=await db.prepare('SELECT coalesce(max(version),0)+1 AS n FROM india_sales_releases WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<{n:number}>();
   const ref=crypto.randomUUID();
   await atomicSales(db,guard.condition,guard.args,[
    db.prepare('INSERT INTO india_sales_releases(id,tenant_id,opportunity_id,version,status,scope_snapshot,account_snapshot,scope_notes,scoped_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(ref,TENANT,id,version!.n,'scoped',JSON.stringify({title:d.title,estimated_value:d.estimated_value_idr,fields:f}),JSON.stringify(acc),notes,email),
    salesAudit(db,id,'PRESALES_SCOPE_VALIDATED',email,'Paket v'+version!.n+' '+notes)
   ]);
   return res({success:true,id:ref,version:version!.n},201);
  }
  if(!release)return deny('Validasi Presales diperlukan untuk membuat paket penawaran',409);
  if(str(p.release_id)!==release.id)return deny('Versi paket berubah, muat ulang',409);
  guard.condition+=' AND EXISTS(SELECT 1 FROM india_sales_releases WHERE id=? AND status=?)';guard.args.push(release.id,release.status);
  if(action==='propose'){
   if(!['admin','sales','presales'].includes(role))return deny('Penyusunan proposal hanya Sales/Presales/Admin',403);
   if(release.status!=='scoped')return deny('Proposal hanya dari scope tervalidasi',409);
   const reference=str(p.proposal_reference),sha=str(p.proposal_sha256).toLowerCase();
   if(reference.length<8||reference.length>400||!digest(sha))return deny('Referensi arsip proposal final dan SHA-256 wajib',422);
   await requireVaultDocument(db,reference,sha,id,release.id,'proposal');
   const boq=await db.prepare('SELECT * FROM india_boq WHERE tenant_id=? AND id=?').bind(TENANT,f.boq_id||'').first<Boq>();
   if(!boq||boq.status!=='approved'||boq.quotation_number!==f.quotation_number)return deny('BoQ approved dan quotation harus cocok',409);
   const link=checkBoqLink({...boq,line_items:JSON.parse(boq.line_items_json)},d,acc,role,email);if(link)return deny(link,409);
   const required=['implementation_timeline','project_site','costing_notes','quotation_number','quotation_sent_at','quotation_valid_days','quotation_valid_until','quotation_sender_name','quotation_sender_title'];
   const missing=required.filter(k=>!f[k]);if(missing.length)return res({success:false,message:'Lengkapi Sales Form sebelum proposal',missing},409);
   if(!dateValid(f.quotation_sent_at)||!dateValid(f.quotation_valid_until)||f.quotation_valid_until<new Date().toISOString().slice(0,10)||f.quotation_sent_at>f.quotation_valid_until||!/^([1-9][0-9]{0,2})$/.test(f.quotation_valid_days)||Number(f.quotation_valid_days)>365)return deny('Tanggal dan masa berlaku quotation harus valid dan belum kedaluwarsa',422);
   guard.condition+=' AND EXISTS(SELECT 1 FROM india_boq WHERE id=? AND tenant_id=? AND edit_seq=? AND status=?)';guard.args.push(boq.id,TENANT,boq.edit_seq,'approved');
   await atomicSales(db,guard.condition,guard.args,[
    db.prepare("UPDATE india_sales_releases SET status='proposed',proposal_snapshot=?,proposal_reference=?,proposal_sha256=?,proposal_notes=?,proposed_by=?,proposed_at=CURRENT_TIMESTAMP,boq_id=?,boq_version=?,boq_edit_seq=? WHERE id=? AND status='scoped'")
    .bind(JSON.stringify({title:d.title,fields:f,boq_id:boq.id,boq_version:boq.version,boq_edit_seq:boq.edit_seq}),reference,sha,notes,email,boq.id,boq.version,boq.edit_seq,release.id),salesAudit(db,id,'PROPOSAL_SUBMITTED',email,'Paket v'+release.version+' / BoQ v'+boq.version)
   ]);
   return res({success:true,release_id:release.id,status:'proposed'});
  }
  if(action==='approve'){
   if(!['admin','approver'].includes(role))return deny('Persetujuan proposal hanya Approver/Admin',403);
   if(release.status!=='proposed')return deny('Proposal harus berstatus Proposed',409);
   await requireVaultDocument(db,release.proposal_reference!,release.proposal_sha256!,id,release.id,'proposal');
   const boq=await db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(release.boq_id!,TENANT).first<Boq>();
   if([release.proposed_by,d.created_by,boq?.created_by].some(x=>x?.trim().toLowerCase()===email.toLowerCase()))return deny('Segregation of Duties: pembuat proposal, opportunity atau BoQ tidak boleh menyetujui sendiri',403);
   if(!boq||boq.status!=='approved'||boq.edit_seq!==release.boq_edit_seq)return deny('Versi BoQ berubah; revisi proposal diperlukan',409);
   guard.condition+=" AND EXISTS(SELECT 1 FROM india_boq WHERE id=? AND edit_seq=? AND status='approved')";guard.args.push(boq.id,boq.edit_seq);
   await atomicSales(db,guard.condition,guard.args,[db.prepare("UPDATE india_sales_releases SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP,approval_notes=? WHERE id=? AND status='proposed'").bind(email,notes,release.id),salesAudit(db,id,'PROPOSAL_APPROVED',email,'Paket v'+release.version+' '+notes)]);
   return res({success:true,status:'approved'});
  }
  if(action==='revise'){
   if(!actorIsMaker&&role!=='presales')return deny('Revisi hanya Sales/Presales/Admin',403);
   await atomicSales(db,guard.condition,guard.args,[
    db.prepare("UPDATE india_sales_releases SET status='superseded' WHERE id=?").bind(release.id),
    db.prepare("UPDATE india_sales_submissions SET status='superseded' WHERE release_id=? AND status IN ('reported','verified')").bind(release.id),
    db.prepare('DELETE FROM india_sales_po_checks WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id),
    db.prepare("UPDATE india_sales_opportunities SET stage='solution_design' WHERE id=?").bind(id),salesAudit(db,id,'OFFER_REVISION_REQUIRED',email,notes,d.stage,'solution_design')
   ]);
   return res({success:true,status:'superseded',message:'Buat scope dan revisi BoQ baru, lalu ulangi approval dan submission.'});
  }
  if(action==='negotiate'){
   if(!actorIsMaker)return deny('Negosiasi hanya Sales pemilik/Admin',403);
   if(release.status!=='approved'||!['negotiation','pending_po'].includes(d.stage))return deny('Negosiasi memerlukan paket approved pada Negotiation/Pending PO',409);
   const submission=await db.prepare("SELECT id FROM india_sales_submissions WHERE tenant_id=? AND opportunity_id=? AND release_id=? AND status='verified' ORDER BY rowid DESC LIMIT 1").bind(TENANT,id,release.id).first<{id:string}>();
   if(!submission)return deny('Submission paket ini harus direview independen',409);
   const decision=str(p.decision),amount=typeof p.amount_before_vat==='number'?p.amount_before_vat:NaN,ref=str(p.evidence_reference),sha=str(p.evidence_sha256).toLowerCase();
   if(!['pending','approved','rejected','revision_required'].includes(decision)||!Number.isFinite(amount)||amount<=0||amount>=1e14||ref.length<8||ref.length>400||!digest(sha))return deny('Keputusan, nilai sebelum PPN dan bukti keputusan pelanggan wajib valid',422);
   const boq=await db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(release.boq_id!,TENANT).first<Boq>();
   const subtotal=boq?boqTotals(JSON.parse(boq.line_items_json) as BoQLine[],[],boq.vat_rate).subtotal:NaN;
   if(decision==='approved'&&(!Number.isFinite(subtotal)||Math.abs(amount-subtotal)>0.01))return deny('Harga berbeda dari BoQ. Pilih Revision Required dan lakukan persetujuan ulang.',409);
   const communication=str(p.communication_id);
   if(communication){
    if(!safeID(communication))return deny('ID email tidak valid',422);
    const linked=await db.prepare("SELECT id FROM india_opportunity_emails WHERE id=? AND tenant_id=? AND opportunity_id=? AND direction='inbound' AND (release_id IS NULL OR release_id=?)").bind(communication,TENANT,id,release.id).first();
    if(!linked)return deny('Email harus berasal dari Opportunity dan paket yang sama',409);
   }
   await requireVaultDocument(db,ref,sha,id,release.id,'negotiation');
   const event=crypto.randomUUID();
   guard.condition+=" AND EXISTS(SELECT 1 FROM india_sales_submissions WHERE id=? AND status='verified' AND release_id=?)";guard.args.push(submission.id,release.id);
   const writes=[db.prepare('INSERT INTO india_sales_negotiations(id,tenant_id,opportunity_id,release_id,submission_id,decision,amount_before_vat,notes,evidence_reference,evidence_sha256,created_by,communication_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(event,TENANT,id,release.id,submission.id,decision,amount,notes,ref,sha,email,communication||null),
    db.prepare('UPDATE india_sales_opportunities SET data_json=? WHERE id=?').bind(JSON.stringify({...f,customer_decision:decision==='approved'?'approved':decision==='rejected'?'rejected':'pending',negotiation_notes:notes}),id),
    db.prepare('DELETE FROM india_sales_po_checks WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id),salesAudit(db,id,'NEGOTIATION_'+decision.toUpperCase(),email,'Paket v'+release.version+' '+notes)];
   if(decision==='revision_required')writes.push(db.prepare("UPDATE india_sales_releases SET status='superseded' WHERE id=?").bind(release.id),db.prepare("UPDATE india_sales_submissions SET status='superseded' WHERE release_id=? AND status IN ('reported','verified')").bind(release.id),db.prepare("UPDATE india_sales_opportunities SET stage='solution_design' WHERE id=?").bind(id));
   await atomicSales(db,guard.condition,guard.args,writes);
   return res({success:true,id:event,decision},201);
  }
  return deny('Aksi lifecycle tidak dikenal');
 }catch(e){if(/VAULT_|OperationError/.test(String(e))){const v=vaultError(e);return deny(v.message,v.status);}const t=transactionError(e);return deny(t.message,t.status);}
}
