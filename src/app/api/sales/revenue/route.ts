import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {validISODate} from '@/lib/lead-intelligence';
import {atomicSales,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const str=(x:unknown,max=400)=>typeof x==='string'&&x.trim().length<=max?x.trim():'';
type Revenue={id:string;release_id:string;status:string;created_by:string;amount_before_vat:number;reversal_of:string|null};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','sales','finance','approver'].includes(role))return fail('Akses revenue ditolak',403);
 const id=new URL(req.url).searchParams.get('opportunity_id');if(!safeID(id))return fail('Pilih Opportunity',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(!canReadDeal(role,email,d.created_by))return fail('Akses Opportunity ditolak',403);
  const entries=await db.prepare('SELECT * FROM india_sales_revenue WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC,rowid DESC').bind(TENANT,id).all();
  return reply({success:true,role,identityEmail:email,deal:{id,title:d.title,stage:d.stage,flow_version:d.flow_version},entries:entries.results});
 }catch{return fail('Revenue belum siap. Periksa migrasi 0019.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!['admin','finance','approver'].includes(role))return fail('Pencatatan/review revenue hanya Finance/Approver/Admin',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,10000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(p.opportunity_id)||!Number.isSafeInteger(p.flow_version))return fail('Opportunity dan versi wajib',422);
 try{
  const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,p.opportunity_id as string).first<FlowDeal>();
  if(!d)return fail('Opportunity tidak ditemukan',404);if(d.flow_version!==p.flow_version||d.stage!=='closed_won')return fail('Revenue memerlukan Closed Won dan versi terbaru',409);
  const po=await db.prepare('SELECT release_id,po_date FROM india_sales_po_checks WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{release_id:string;po_date:string}>();
  if(!po?.release_id)return fail('PO tervalidasi dengan paket aktif wajib tersedia',409);
  const id=crypto.randomUUID(),g=dealGuard(d),writes=[];
  if(p.action==='record'||p.action==='reverse'){
   if(!['admin','finance'].includes(role))return fail('Maker revenue hanya Finance/Admin',403);
   if(!validISODate(p.recognition_date)||p.recognition_date>new Date(Date.now()+7*3600000).toISOString().slice(0,10)||p.recognition_date<po.po_date||str(p.ledger_reference).length<5||str(p.invoice_reference).length<5||str(p.acceptance_reference).length<5||!/^[a-f0-9]{64}$/.test(str(p.evidence_sha256,64))||str(p.notes,2000).length<12)return fail('Tanggal pengakuan, referensi GL/invoice/BAST, checksum dan catatan wajib valid',422);
   let amount=p.amount_before_vat,reversal:null|string=null;
   if(p.action==='reverse'){
    if(!safeID(p.reversal_of))return fail('Pilih transaksi sumber',422);
    const source=await db.prepare("SELECT * FROM india_sales_revenue WHERE tenant_id=? AND opportunity_id=? AND id=? AND status='approved' AND reversal_of IS NULL").bind(TENANT,d.id,p.reversal_of as string).first<Revenue>();
    if(!source||source.release_id!==po.release_id)return fail('Sumber reversal tidak valid',409);amount=-source.amount_before_vat;reversal=source.id;
   }
   if(typeof amount!=='number'||!Number.isFinite(amount)||Math.abs(amount)>=1e14||amount===0||(p.action==='record'&&amount<0)||Math.abs(amount*100-Math.round(amount*100))>0.01)return fail('Nilai revenue harus valid dengan maksimum 2 desimal',422);
   writes.push(db.prepare('INSERT INTO india_sales_revenue(id,tenant_id,opportunity_id,release_id,recognition_date,amount_before_vat,ledger_reference,invoice_reference,acceptance_reference,evidence_sha256,notes,reversal_of,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,d.id,po.release_id,p.recognition_date,amount,str(p.ledger_reference),str(p.invoice_reference),str(p.acceptance_reference),str(p.evidence_sha256,64),str(p.notes,2000),reversal,email));
  }else if(p.action==='review'){
   if(!['admin','finance','approver'].includes(role)||!safeID(p.id)||typeof p.approve!=='boolean'||str(p.review_notes,2000).length<12)return fail('ID, keputusan dan catatan reviewer wajib',422);
   const entry=await db.prepare('SELECT * FROM india_sales_revenue WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.id as string).first<Revenue>();
   if(!entry||entry.status!=='draft')return fail('Transaksi tidak tersedia atau sudah diputuskan',409);if(entry.created_by.toLowerCase()===email)return fail('Maker tidak boleh mereview sendiri',403);
   g.condition+=" AND EXISTS(SELECT 1 FROM india_sales_revenue WHERE id=? AND status='draft')";g.args.push(entry.id);
   writes.push(db.prepare('UPDATE india_sales_revenue SET status=?,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?').bind(p.approve?'approved':'rejected',email,str(p.review_notes,2000),entry.id));
  }else return fail('Aksi tidak dikenal',422);
  writes.push(salesAudit(db,d.id,'REVENUE_'+String(p.action).toUpperCase(),email,str(p.ledger_reference)||str(p.review_notes,2000)));
  await atomicSales(db,g.condition,g.args,writes);return reply({success:true,id},201);
 }catch(e){return fail(/constraint|REVENUE_CONFLICT/i.test(String(e))?'Revenue melanggar batas PO, reversal atau versi transaksi.':'Revenue tidak tersimpan. Periksa migrasi 0019.',/constraint|REVENUE_CONFLICT/i.test(String(e))?409:503);}
}
