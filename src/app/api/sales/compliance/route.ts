import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {validISODate} from '@/lib/lead-intelligence';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const text=(x:unknown,max=2000)=>typeof x==='string'&&x.trim().length<=max?x.trim():'';
const num=(x:unknown,max=1e9)=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<max;
const today=()=>new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const evidence=(p:Record<string,unknown>)=>text(p.evidence_reference,400).length>=8&&/^[a-f0-9]{64}$/.test(text(p.evidence_sha256,64));
const roles=['admin','sales','presales','finance','approver'];
type Row={id:string;status:string;version:number;created_by:string;category?:string;vendor_id?:string;valid_until?:string;capacity_units?:number;capacity_unit?:string;quantity?:number;capacity_confirmed?:number;unit?:string;requirement_id?:string;vendor_offer_id?:string};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Akses compliance tidak tersedia',403);
 const id=new URL(req.url).searchParams.get('opportunity_id');if(!safeID(id))return fail('Pilih Opportunity',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  const [vendors,offers,items,requirements]=await Promise.all([
   db.prepare('SELECT * FROM india_vendors WHERE tenant_id=? ORDER BY legal_name').bind(TENANT).all(),
   db.prepare('SELECT o.*,v.legal_name FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id WHERE o.tenant_id=? AND o.opportunity_id=? ORDER BY o.created_at DESC').bind(TENANT,id).all(),
   db.prepare('SELECT * FROM india_tender_compliance_gaps WHERE tenant_id=? AND opportunity_id=? ORDER BY requirement_id,clause_reference').bind(TENANT,id).all(),
   db.prepare("SELECT id,title,status,compliance_status FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=? AND kind IN ('rks','kak','rfp','rfq')").bind(TENANT,id).all()
  ]);
  return reply({success:true,role,identityEmail:email,deal:{id,title:d.title,stage:d.stage,flow_version:d.flow_version},vendors:vendors.results,offers:offers.results,items:items.results,requirements:requirements.results});
 }catch{return fail('Compliance belum siap. Periksa migrasi 0016.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Akses ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,18000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(p.opportunity_id)||!Number.isSafeInteger(p.flow_version))return fail('Opportunity dan versi wajib',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  if(d.flow_version!==p.flow_version)return fail('Data berubah; muat ulang',409);
  if(!['prospecting','qualified','discovery','solution_design'].includes(d.stage))return fail('Revisi paket ke Solution Design sebelum perubahan procurement',409);
  const action=text(p.action,40),id=crypto.randomUUID(),g=dealGuard(d);
  const writes=[];
  if(action==='vendor'||action==='revise_vendor'){
   if(!['admin','finance','presales'].includes(role))return fail('Registrasi vendor hanya Finance/Presales/Admin',403);
   if(text(p.legal_name,240).length<3||text(p.registration_number,100).length<3||!/^\S+@\S+\.\S+$/.test(text(p.contact_email,200))||text(p.capabilities).length<10||!num(p.capacity_units)||!text(p.capacity_unit,60)||!evidence(p)||!validISODate(p.valid_until)||p.valid_until<today())return fail('Identitas, kemampuan, kapasitas, masa berlaku dan bukti vendor wajib valid',422);
   if(action==='revise_vendor'){
    if(!safeID(p.id)||!Number.isSafeInteger(p.version))return fail('ID dan versi vendor wajib',422);
    const old=await db.prepare('SELECT * FROM india_vendors WHERE tenant_id=? AND id=?').bind(TENANT,p.id as string).first<Row>();
    if(!old||old.version!==p.version)return fail('Versi vendor berubah',409);
    g.condition+=' AND EXISTS(SELECT 1 FROM india_vendors WHERE id=? AND version=?)';g.args.push(old.id,old.version);
    writes.push(db.prepare("UPDATE india_vendors SET legal_name=?,registration_number=?,contact_email=?,capabilities=?,capacity_units=?,capacity_unit=?,evidence_reference=?,evidence_sha256=?,valid_until=?,created_by=?,status='draft',version=version+1,reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL WHERE id=?").bind(text(p.legal_name,240),text(p.registration_number,100),text(p.contact_email,200).toLowerCase(),text(p.capabilities),p.capacity_units as number,text(p.capacity_unit,60),text(p.evidence_reference,400),text(p.evidence_sha256,64),p.valid_until,email,old.id));
   }else{
   writes.push(db.prepare('INSERT INTO india_vendors(id,tenant_id,legal_name,registration_number,contact_email,capabilities,capacity_units,capacity_unit,evidence_reference,evidence_sha256,valid_until,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,text(p.legal_name,240),text(p.registration_number,100),text(p.contact_email,200).toLowerCase(),text(p.capabilities),p.capacity_units as number,text(p.capacity_unit,60),text(p.evidence_reference,400),text(p.evidence_sha256,64),p.valid_until,email));
   }
  }else if(action==='offer'){
   if(!['admin','finance','presales','sales'].includes(role))return fail('Akses ditolak',403);
   if(!safeID(p.vendor_id)||text(p.scope).length<10||!num(p.quantity)||!num(p.unit_price_idr,1e14)||!num(p.capacity_confirmed)||Number(p.capacity_confirmed)<Number(p.quantity)||!text(p.unit,60)||!evidence(p)||!validISODate(p.valid_until)||p.valid_until<today()||Number(p.quantity)*Number(p.unit_price_idr)>=1e14)return fail('Scope, kuantitas, harga IDR, kapasitas dan bukti penawaran wajib valid',422);
   const v=await db.prepare('SELECT * FROM india_vendors WHERE id=? AND tenant_id=?').bind(p.vendor_id as string,TENANT).first<Row>();
   if(!v||v.status!=='validated'||v.valid_until!<p.valid_until||v.valid_until!<today()||v.capacity_unit!==p.unit||v.capacity_units!<Number(p.capacity_confirmed))return fail('Vendor harus tervalidasi, sesuai unit/kapasitas dan berlaku sepanjang penawaran',409);
   g.condition+=" AND EXISTS(SELECT 1 FROM india_vendors WHERE id=? AND version=? AND status='validated')";g.args.push(v.id,v.version);
   writes.push(db.prepare('INSERT INTO india_vendor_offers(id,tenant_id,opportunity_id,vendor_id,scope,quantity,unit,unit_price_idr,capacity_confirmed,valid_until,evidence_reference,evidence_sha256,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,d.id,v.id,text(p.scope),p.quantity as number,text(p.unit,60),p.unit_price_idr as number,p.capacity_confirmed as number,p.valid_until,text(p.evidence_reference,400),text(p.evidence_sha256,64),email));
  }else if(action==='reopen_requirement'){
   if(!['admin','sales','presales'].includes(role)||!safeID(p.id)||text(p.review_notes).length<12)return fail('Reviewer dan alasan revisi wajib',422);
   const parent=await db.prepare("SELECT id FROM india_sales_requirements WHERE tenant_id=? AND opportunity_id=? AND id=? AND status='reviewed'").bind(TENANT,d.id,p.id as string).first();
   if(!parent)return fail('Requirement reviewed tidak ditemukan',409);
   g.condition+=" AND EXISTS(SELECT 1 FROM india_sales_requirements WHERE id=? AND status='reviewed')";g.args.push(p.id as string);
   writes.push(db.prepare("UPDATE india_sales_requirements SET status='draft',compliance_status='pending',reviewed_by=NULL,review_notes='',reviewed_at=NULL WHERE id=?").bind(p.id as string));
  }else if(action==='clause'||action==='revise_clause'){
   if(!['admin','sales','presales'].includes(role))return fail('Clause hanya Sales/Presales/Admin',403);
   if(!safeID(p.requirement_id)||!text(p.clause_reference,100)||!['administrative','technical','commercial','security','vendor'].includes(text(p.category,30))||text(p.requirement_text).length<10||text(p.response_text).length<10||typeof p.mandatory!=='boolean'||!evidence(p)||(p.category==='vendor'&&!safeID(p.vendor_offer_id)))return fail('Clause, persyaratan, jawaban dan bukti wajib valid',422);
   const parent=await db.prepare("SELECT id FROM india_sales_requirements WHERE id=? AND tenant_id=? AND opportunity_id=? AND status='draft' AND kind IN ('rks','kak','rfp','rfq')").bind(p.requirement_id as string,TENANT,d.id).first();
   if(!parent)return fail('Register RKS/KAK draft diperlukan',409);
   if(p.category==='vendor'){
    const o=await db.prepare('SELECT id FROM india_vendor_offers WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.vendor_offer_id as string).first();if(!o)return fail('Penawaran vendor dari Opportunity yang sama wajib',409);
   }
   if(action==='revise_clause'){
    if(!safeID(p.id)||!Number.isSafeInteger(p.version))return fail('ID dan versi klausul wajib',422);
    const old=await db.prepare('SELECT * FROM india_tender_compliance_items WHERE tenant_id=? AND opportunity_id=? AND requirement_id=? AND id=?').bind(TENANT,d.id,p.requirement_id as string,p.id as string).first<Row>();
    if(!old||old.version!==p.version)return fail('Versi klausul berubah',409);
    g.condition+=" AND EXISTS(SELECT 1 FROM india_tender_compliance_items WHERE id=? AND version=?) AND EXISTS(SELECT 1 FROM india_sales_requirements WHERE id=? AND status='draft')";g.args.push(old.id,old.version,p.requirement_id as string);
    writes.push(db.prepare("UPDATE india_tender_compliance_items SET clause_reference=?,category=?,requirement_text=?,mandatory=?,response_text=?,evidence_reference=?,evidence_sha256=?,vendor_offer_id=?,created_by=?,status='draft',compliance_status='pending',version=version+1,reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL WHERE id=?").bind(text(p.clause_reference,100),text(p.category,30),text(p.requirement_text),p.mandatory?1:0,text(p.response_text),text(p.evidence_reference,400),text(p.evidence_sha256,64),p.category==='vendor'?p.vendor_offer_id as string:null,email,old.id));
   }else{
   writes.push(db.prepare('INSERT INTO india_tender_compliance_items(id,tenant_id,opportunity_id,requirement_id,clause_reference,category,requirement_text,mandatory,response_text,evidence_reference,evidence_sha256,vendor_offer_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,d.id,p.requirement_id as string,text(p.clause_reference,100),text(p.category,30),text(p.requirement_text),p.mandatory?1:0,text(p.response_text),text(p.evidence_reference,400),text(p.evidence_sha256,64),p.category==='vendor'?p.vendor_offer_id as string:null,email));
   }
  }else if(['review_vendor','suspend_vendor','review_offer','review_clause'].includes(action)){
   const table=action.includes('vendor')?'india_vendors':action==='review_offer'?'india_vendor_offers':'india_tender_compliance_items';
   const required=table==='india_vendors'||table==='india_vendor_offers'?['admin','finance']:['admin','presales','finance','approver'];
   if(!required.includes(role))return fail('Reviewer sesuai kewenangan diperlukan',403);
   if(!safeID(p.id)||!Number.isSafeInteger(p.version)||text(p.review_notes).length<12)return fail('ID, versi dan catatan reviewer wajib',422);
   const row=await db.prepare('SELECT * FROM '+table+' WHERE tenant_id=? AND id=?'+(table!=='india_vendors'?' AND opportunity_id=?':'')).bind(TENANT,p.id as string,...(table!=='india_vendors'?[d.id]:[])).first<Row>();
   if(!row)return fail('Data tidak ditemukan',404);if(row.created_by.toLowerCase()===email)return fail('Maker tidak boleh mereview sendiri',403);
   if(row.version!==p.version||(action==='suspend_vendor'?row.status!=='validated':row.status!=='draft'))return fail('Status atau versi berubah',409);
   const status=action==='suspend_vendor'?'suspended':action==='review_clause'?'reviewed':p.approve===true?'validated':p.approve===false?'rejected':'';
   if(!status)return fail('Keputusan review wajib',422);
   if(status==='validated'&&row.valid_until!<today())return fail('Bukti vendor/penawaran kedaluwarsa',409);
   if(action==='review_offer'&&status==='validated'){
    const v=await db.prepare('SELECT * FROM india_vendors WHERE tenant_id=? AND id=?').bind(TENANT,row.vendor_id!).first<Row>();
    if(!v||v.status!=='validated'||v.valid_until!<row.valid_until!||v.capacity_unit!==row.unit||v.capacity_units!<row.capacity_confirmed!)return fail('Validasi kapasitas/masa berlaku vendor gagal',409);
    g.condition+=" AND EXISTS(SELECT 1 FROM india_vendors WHERE id=? AND version=? AND status='validated')";g.args.push(v.id,v.version);
   }
   if(action==='review_clause'){
    if(row.category==='commercial'&&!['admin','finance'].includes(role))return fail('Clause komersial memerlukan Finance/Admin',403);
    if(row.category!=='commercial'&&!['admin','presales'].includes(role))return fail('Clause teknis/administratif memerlukan Presales/Admin',403);
    const comp=text(p.compliance_status,30);if(!['compliant','partial','non_compliant','not_applicable'].includes(comp))return fail('Status compliance wajib',422);
    if(comp==='compliant'&&row.category==='vendor'){
     const v=await db.prepare("SELECT o.id,o.version,v.version AS vendor_version,v.id AS vendor_id FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id WHERE o.id=? AND o.tenant_id=? AND o.opportunity_id=? AND o.status='validated' AND v.status='validated' AND o.valid_until>=? AND v.valid_until>=? AND o.unit=v.capacity_unit AND v.capacity_units>=o.capacity_confirmed").bind(row.vendor_offer_id!,TENANT,d.id,today(),today()).first<{id:string;version:number;vendor_version:number;vendor_id:string}>();
     if(!v)return fail('Kapasitas, harga dan bukti vendor belum tervalidasi',409);
     g.condition+=" AND EXISTS(SELECT 1 FROM india_vendor_offers WHERE id=? AND version=? AND status='validated') AND EXISTS(SELECT 1 FROM india_vendors WHERE id=? AND version=? AND status='validated')";g.args.push(v.id,v.version,v.vendor_id,v.vendor_version);
    }
    writes.push(db.prepare('UPDATE india_tender_compliance_items SET compliance_status=? WHERE id=?').bind(comp,row.id));
   }
   g.condition+=' AND EXISTS(SELECT 1 FROM '+table+' WHERE id=? AND version=? AND status=?)';g.args.push(row.id,row.version,row.status);
   writes.push(db.prepare('UPDATE '+table+' SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,email,text(p.review_notes),row.id));
  }else return fail('Aksi tidak dikenal',422);
  writes.push(salesAudit(db,d.id,'COMPLIANCE_'+action.toUpperCase(),email,text(p.review_notes)||text(p.clause_reference,100)||text(p.legal_name,240)||id));
  await atomicSales(db,g.condition,g.args,writes);return reply({success:true,id},201);
 }catch(e){return fail(/constraint|COMPLIANCE_CONFLICT/i.test(String(e))?'Benturan versi atau aturan compliance. Periksa mandatory clause, vendor dan muat ulang.':'Transaksi compliance tidak tersimpan. Periksa migrasi 0016.',/constraint|COMPLIANCE_CONFLICT/i.test(String(e))?409:503);}
}
