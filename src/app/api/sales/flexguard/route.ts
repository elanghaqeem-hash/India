import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {supportingOriginal} from '@/lib/service-operations';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {walletTotals,canPostFlex,type FlexEventKind,type FlexEvent} from '@/lib/flexguard-ledger';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const activeRoles=['admin','finance','approver','sales','presales'];
const bound=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=1&&Number(n)<=100000;
const txt=(v:unknown,max=1000)=>typeof v==='string'?v.trim().slice(0,max):'';
function permitted(role:string,email:string,w:{owner_email:string;pm_email:string|null}){
 return !['sales','presales'].includes(role)||(role==='sales'?w.owner_email?.toLowerCase()===email:w.pm_email?.toLowerCase()===email);
}
const walletSQL="SELECT w.*,a.legal_name,c.status contract_status,c.model,c.end_date,p.opportunity_id,p.pm_email,o.created_by owner_email FROM india_flexguard_wallets w JOIN india_sales_accounts a ON a.id=w.customer_id AND a.tenant_id=w.tenant_id JOIN india_service_contracts c ON c.id=w.contract_id AND c.tenant_id=w.tenant_id JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id JOIN india_sales_opportunities o ON o.id=p.opportunity_id AND o.tenant_id=p.tenant_id";
type Wallet={id:string;customer_id:string;contract_id:string;legal_name:string;status:string;entitlement_units:number;created_by:string;approved_by:string|null;end_date:string;opportunity_id:string;pm_email:string|null;owner_email:string};
type LedgerRow={id:string;wallet_id:string;kind:FlexEventKind;units:number;invoice_id:string|null;opportunity_id:string|null;source_event_id:string|null;document_id:string|null;created_at:string;actor_email:string;explanation:string};
async function events(db:D1DB,id:string){
 const rows=await db.prepare('SELECT id,wallet_id,kind,units,invoice_id,opportunity_id,source_event_id,document_id,created_at,actor_email,explanation FROM india_flexguard_events WHERE tenant_id=? AND wallet_id=? ORDER BY created_at,id LIMIT 5001').bind(TENANT,id).all<LedgerRow>();
 if(!rows.success||rows.results.length>5000)throw Error('Riwayat token melebihi batas laporan; hubungi Finance.');
 return rows.results;
}
async function wallet(db:D1DB,id:string){return db.prepare(walletSQL+' WHERE w.tenant_id=? AND w.id=?').bind(TENANT,id).first<Wallet>();}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!activeRoles.includes(role))return fail('Hak akses FlexGuard ditolak',403);
 try{
  const id=new URL(req.url).searchParams.get('wallet_id');
  if(id&&!safeID(id))return fail('Wallet ID tidak valid',422);
  const rows=id?{success:true,results:[await wallet(db,id)].filter(Boolean) as Wallet[]}:
    await db.prepare(walletSQL+' WHERE w.tenant_id=? AND (? NOT IN (\'sales\',\'presales\') OR (?=\'sales\' AND lower(o.created_by)=?) OR (?=\'presales\' AND lower(p.pm_email)=?)) ORDER BY w.created_at DESC LIMIT 51')
      .bind(TENANT,role,role,email,role,email).all<Wallet>();
  if(!rows.success)throw Error('D1 tidak tersedia');
  const visible=rows.results.filter(w=>permitted(role,email,w)).slice(0,50);
  const result=await Promise.all(visible.map(async w=>{
   const history=await events(db,w.id);
   const balance=walletTotals(history as FlexEvent[]);
   return {id:w.id,customer_id:w.customer_id,customer_name:w.legal_name,contract_id:w.contract_id,opportunity_id:w.opportunity_id,
    status:w.status,expires_at:w.end_date,entitlement_units:w.entitlement_units,approved:w.approved_by!==null,
    balance,events:id?history.slice(-100).reverse():undefined,history_truncated:id&&history.length>100};
  }));
  return reply({success:true,role,wallets:result,truncated:!id&&rows.results.length>50,
   source:'immutable-d1-ledger',status:'database_verified_at_request'});
 }catch{return fail('FlexGuard ledger belum tersedia atau tidak konsisten (migrasi 0030 wajib).',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 if(!activeRoles.includes(role))return fail('Hak akses ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin tidak cocok',403);
 let p:Record<string,unknown>;
 try{p=await readBoundedJSON(req,8000);}catch(e){return fail(e instanceof Error?e.message:'Payload gagal',e instanceof RequestBodyError?e.status:400);}
 const action=txt(p.action,30);
 try{
  if(action==='create_wallet'){
   if(!['admin','finance'].includes(role)||!safeID(p.contract_id)||!bound(p.entitlement_units))return fail('Kontrak, kuota dan role Finance wajib',403);
   const c=await db.prepare("SELECT c.id,c.customer_id,c.status,c.model,c.end_date FROM india_service_contracts c WHERE c.tenant_id=? AND c.id=? AND c.status='active' AND c.model='FlexGuard' AND c.end_date>=date('now')")
    .bind(TENANT,p.contract_id as string).first<{id:string;customer_id:string}>();
   if(!c)return fail('Kontrak FlexGuard yang disetujui dan aktif wajib',409);
   const id=crypto.randomUUID();
   await db.batch([db.prepare('INSERT INTO india_flexguard_wallets(id,tenant_id,customer_id,contract_id,entitlement_units,created_by) VALUES(?,?,?,?,?,?)').bind(id,TENANT,c.customer_id,c.id,Number(p.entitlement_units),email)]);
   return reply({success:true,id,status:'draft',message:'Menunggu approval independen entitlement token.'},201);
  }
  if(action==='approve_wallet'){
   if(!['admin','approver'].includes(role)||!safeID(p.wallet_id)||txt(p.notes).length<12)return fail('Approval independen dan alasan minimal 12 karakter wajib',403);
   const w=await wallet(db,p.wallet_id as string);
   if(!w||w.status!=='draft'||w.created_by.toLowerCase()===email)return fail('Wallet tidak tersedia atau maker tidak boleh menyetujui sendiri',409);
   await db.batch([db.prepare("UPDATE india_flexguard_wallets SET status='active',approved_by=?,approved_at=CURRENT_TIMESTAMP,approved_notes=? WHERE id=? AND tenant_id=? AND status='draft' AND lower(created_by)!=?").bind(email,txt(p.notes),w.id,TENANT,email)]);
   return reply({success:true,id:w.id,status:'active'});
  }
  const kind=action as FlexEventKind;
  if(!canPostFlex(role,kind)||!safeID(p.wallet_id)||!bound(p.units)||!safeID(p.request_key)||txt(p.request_key).length<16||txt(p.explanation).length<12)
   return fail('Role, wallet, token integer positif, request key dan alasan wajib',422);
  const w=await wallet(db,p.wallet_id as string);
  if(!w||!permitted(role,email,w))return fail('Wallet di luar kewenangan pengguna',403);
  if(w.status!=='active')return fail('Entitlement wallet belum disetujui',409);
  const invoice=txt(p.invoice_id,128)||null,opp=txt(p.opportunity_id,128)||null,
   source=txt(p.source_event_id,128)||null,doc=txt(p.document_id,128)||null;
  if(['RESERVE','RELEASE','DEBIT'].includes(kind)&&(!safeID(opp)||w.customer_id!==(await db.prepare('SELECT company_id FROM india_sales_opportunities WHERE tenant_id=? AND id=? AND stage=\'closed_won\'').bind(TENANT,opp).first<{company_id:string}>())?.company_id))
   return fail('Opportunity harus Won dan milik customer wallet',409);
  if(role==='sales'&&opp){
   const owned=await db.prepare('SELECT id FROM india_sales_opportunities WHERE tenant_id=? AND id=? AND lower(created_by)=?').bind(TENANT,opp,email).first();
   if(!owned)return fail('Sales tidak berhak reservasi untuk opportunity lain',403);
  }
  if(kind==='DEBIT'){
   if(!safeID(doc)||!opp)return fail('Bukti asli delivery diperlukan sebelum konsumsi',409);
   await supportingOriginal(db,doc,opp);
  }
  if(['ISSUE','TOPUP'].includes(kind)&&!safeID(invoice))return fail('Invoice yang sudah dibayar penuh wajib',409);
  const id=crypto.randomUUID();
  await db.batch([db.prepare('INSERT INTO india_flexguard_events(id,tenant_id,wallet_id,kind,units,invoice_id,opportunity_id,source_event_id,document_id,request_key,actor_email,explanation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(id,TENANT,w.id,kind,Number(p.units),invoice,opp,source,doc,txt(p.request_key,128),email,txt(p.explanation))]);
  return reply({success:true,id,kind,status:'posted',message:'Transaksi tersimpan ke immutable D1 ledger.'},201);
 }catch(e){
  const conflict=/FLEXGUARD_|constraint|UNIQUE/i.test(String(e));
  return fail(conflict?'Transaksi ditolak oleh batas kuota, saldo, referensi asli, atau idempotency D1.':'Transaksi FlexGuard gagal: verifikasi skema 0030 dan bukti Vault.',conflict?409:503);
 }
}
