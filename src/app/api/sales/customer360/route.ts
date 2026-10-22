import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt} from '@/lib/operations';
import {check,ServiceError,accessibleDeal} from '@/lib/service-operations';
import {validISODate} from '@/lib/lead-intelligence';
export const dynamic='force-dynamic';
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const ownerClause="(?!='sales' OR lower(a.created_by)=? OR EXISTS(SELECT 1 FROM india_sales_opportunities d WHERE d.company_id=a.id AND d.tenant_id=a.tenant_id AND lower(d.created_by)=?))";
type Account={id:string;legal_name:string;customer_number:string;created_by:string;data_json:string};
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;const {db,role,email}=auth.identity;
 if(!['admin','sales','presales','finance','legal','approver'].includes(role))return fail('Customer 360 hanya role operasional',403);
 const id=new URL(req.url).searchParams.get('customer_id');
 try{
  const accounts=await db.prepare('SELECT a.id,a.legal_name,a.customer_number FROM india_sales_accounts a WHERE a.tenant_id=? AND '+ownerClause+' ORDER BY a.legal_name LIMIT 501').bind(TENANT,role,email,email).all();
  if(!id)return reply({success:true,role,identityEmail:email,accounts:accounts.results.slice(0,500),truncated:accounts.results.length>500});
  check(safeID(id),'Customer ID tidak valid');
  const account=await db.prepare('SELECT a.* FROM india_sales_accounts a WHERE a.tenant_id=? AND a.id=? AND '+ownerClause).bind(TENANT,id,role,email,email).first<Account>();check(account,'Customer tidak tersedia untuk akun ini',404);
  const visible="d.tenant_id=? AND d.company_id=? AND (?!='sales' OR lower(d.created_by)=?)";
  const [deals,records,relations,related,leads,communications,emails,contracts,billing]=await Promise.all([
   db.prepare('SELECT d.id,d.title,d.stage,d.estimated_value_idr,d.created_by FROM india_sales_opportunities d WHERE '+visible+' ORDER BY d.created_at DESC').bind(TENANT,id,role,email).all(),
   db.prepare("SELECT * FROM india_customer_records WHERE tenant_id=? AND customer_id=? AND (opportunity_id IS NULL OR opportunity_id IN (SELECT d.id FROM india_sales_opportunities d WHERE "+visible+')) ORDER BY created_at DESC LIMIT 500').bind(TENANT,id,TENANT,id,role,email).all<{data_json:string}>(),
   db.prepare('SELECT r.*,a.legal_name,a.customer_number FROM india_customer_relations r JOIN india_sales_accounts a ON a.id=CASE WHEN r.child_id=? THEN r.parent_id ELSE r.child_id END AND a.tenant_id=r.tenant_id WHERE r.tenant_id=? AND (r.child_id=? OR r.parent_id=?) AND '+ownerClause).bind(id,TENANT,id,id,role,email,email).all(),
   db.prepare('SELECT r.* FROM india_opportunity_relations r JOIN india_sales_opportunities d ON d.id=r.source_id AND d.tenant_id=r.tenant_id JOIN india_sales_opportunities t ON t.id=r.target_id AND t.tenant_id=r.tenant_id WHERE '+visible+" AND (?!='sales' OR lower(t.created_by)=?)").bind(TENANT,id,role,email,role,email).all(),
   db.prepare('SELECT l.lead_id,l.opportunity_id,m.lead_number,m.source,m.campaign,l.converted_at FROM india_sales_lead_links l JOIN india_sales_opportunities d ON d.id=l.opportunity_id AND d.tenant_id=l.tenant_id JOIN india_marketing_leads m ON m.id=l.lead_id WHERE '+visible).bind(TENANT,id,role,email).all(),
   db.prepare("SELECT x.id,x.opportunity_id,x.subject,x.detail,x.created_at,x.kind FROM india_sales_activities x JOIN india_sales_opportunities d ON d.id=x.opportunity_id AND d.tenant_id=x.tenant_id WHERE "+visible+' ORDER BY x.created_at DESC LIMIT 200').bind(TENANT,id,role,email).all(),
   db.prepare('SELECT x.id,x.opportunity_id,x.subject,x.direction,x.sent_at,x.verification FROM india_opportunity_emails x JOIN india_sales_opportunities d ON d.id=x.opportunity_id AND d.tenant_id=x.tenant_id WHERE '+visible+' ORDER BY x.sent_at DESC LIMIT 200').bind(TENANT,id,role,email).all(),
   db.prepare('SELECT c.*,p.opportunity_id,p.po_number,p.title FROM india_service_contracts c JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id JOIN india_sales_opportunities d ON d.id=p.opportunity_id AND d.tenant_id=p.tenant_id WHERE '+visible+' ORDER BY c.end_date').bind(TENANT,id,role,email).all(),
   db.prepare("SELECT i.id,i.number,i.amount_cents,i.vat_cents,i.due_date,i.status,p.opportunity_id,coalesce((SELECT sum(t.amount_cents) FROM india_billing_payments t WHERE t.invoice_id=i.id AND t.status='approved'),0) paid_cents FROM india_billing_invoices i JOIN india_delivery_projects p ON p.id=i.project_id AND p.tenant_id=i.tenant_id JOIN india_sales_opportunities d ON d.id=p.opportunity_id AND d.tenant_id=p.tenant_id WHERE "+visible+' ORDER BY i.due_date DESC LIMIT 500').bind(TENANT,id,role,email).all()
  ]);
  const f=JSON.parse(account.data_json) as Record<string,string>;
  return reply({success:true,role,identityEmail:email,accounts:accounts.results.slice(0,500),account:{id:account.id,customer_number:account.customer_number,legal_name:account.legal_name,fields:Object.fromEntries(['industry','company_phone','hq_address','primary_name','primary_phone','primary_email','technical_name','technical_email','billing_name','billing_email'].map(k=>[k,f[k]||'']))},deals:deals.results,records:records.results.map(r=>({...r,data:JSON.parse(r.data_json),data_json:undefined})),relations:relations.results,opportunity_relations:related.results,leads:leads.results,communications:communications.results,emails:emails.results,contracts:contracts.results,billing:billing.results,limits:{accounts:500,records:500,activities:200,emails:200,billing:500}});
 }catch(e){return e instanceof ServiceError?fail(e.message,e.status):fail('Customer 360 belum siap; periksa migrasi 0027',503);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;const {db,role,email}=auth.identity;
 if(!['admin','sales'].includes(role))return fail('Customer 360 hanya dapat dikelola Sales/Admin',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let v:Record<string,unknown>;try{v=await readBoundedJSON(req,10000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 try{
  check(safeID(v.customer_id),'Customer wajib');const a=await db.prepare('SELECT * FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind(TENANT,v.customer_id).first<Account>();check(a,'Customer tidak ditemukan',404);check(role==='admin'||a.created_by.toLowerCase()===email,'Hanya owner Customer dapat mengubah profil',403);
  const action=txt(v.action,30),id=crypto.randomUUID(),writes=[];
  if(action==='relation'){
   check(safeID(v.parent_id)&&['subsidiary','branch'].includes(String(v.kind)),'Parent dan jenis relasi wajib');
   const parent=await db.prepare('SELECT * FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind(TENANT,v.parent_id).first<Account>();check(parent,'Parent tidak tersedia',404);check(role==='admin'||parent.created_by.toLowerCase()===email,'Parent di luar ownership',403);
   writes.push(db.prepare('INSERT INTO india_customer_relations(id,tenant_id,child_id,parent_id,kind,created_by) VALUES(?,?,?,?,?,?)').bind(id,TENANT,a.id,parent.id,String(v.kind),email));
  }else if(action==='opportunity_relation'){
   check(safeID(v.source_id)&&safeID(v.target_id),'Dua Opportunity wajib');const source=await accessibleDeal(auth.identity,v.source_id),target=await accessibleDeal(auth.identity,v.target_id);check(source.company_id===a.id&&target.company_id===a.id,'Opportunity harus memakai Customer ID yang sama',409);
   writes.push(db.prepare("INSERT INTO india_opportunity_relations(id,tenant_id,source_id,target_id,kind,created_by) VALUES(?,?,?,?,'related',?)").bind(id,TENANT,source.id,target.id,email));
  }else if(action==='stakeholder'||action==='installed_product'){
   check(txt(v.title,240).length>=3,'Nama/judul wajib');let data:Record<string,unknown>={},opp:string|null=null;
   if(action==='stakeholder'){
    check(txt(v.role_title,150).length>=3&&['decision_maker','influencer','technical','procurement','billing','user'].includes(String(v.influence))&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt(v.email,200)),'Jabatan, pengaruh dan email valid wajib');
    data={role_title:txt(v.role_title,150),influence:v.influence,email:txt(v.email,200),phone:txt(v.phone,80)};
   }else{
    check(safeID(v.opportunity_id)&&txt(v.sku,120).length>=2&&validISODate(v.installed_date)&&v.installed_date<=new Date(Date.now()+7*3600000).toISOString().slice(0,10),'Opportunity, SKU dan tanggal pemasangan wajib');const d=await accessibleDeal(auth.identity,v.opportunity_id);check(d.company_id===a.id&&d.stage==='closed_won','Produk terpasang memerlukan Won customer yang sama',409);opp=d.id;
    check(!v.support_until||(validISODate(v.support_until)&&v.support_until>=v.installed_date),'Tanggal support tidak valid');data={sku:txt(v.sku,120),installed_date:v.installed_date,support_until:v.support_until||null,notes:txt(v.notes,1500)};
   }
   writes.push(db.prepare('INSERT INTO india_customer_records(id,tenant_id,customer_id,kind,title,data_json,opportunity_id,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,TENANT,a.id,action,txt(v.title,240),JSON.stringify(data),opp,email));
  }else return fail('Aksi tidak dikenal');
  await atomicSales(db,'EXISTS(SELECT 1 FROM india_sales_accounts WHERE tenant_id=? AND id=? AND created_by=?)',[TENANT,a.id,a.created_by],[...writes,operationEvent(db,'customer360',a.id,action.toUpperCase(),email,{...v})]);return reply({success:true,id},201);
 }catch(e){return e instanceof ServiceError?fail(e.message,e.status):fail(/constraint|DELIVERY_CONFLICT/i.test(String(e))?'Relasi duplikat/siklus atau data berubah; muat ulang':'Customer 360 tidak tersimpan',/constraint|DELIVERY_CONFLICT/i.test(String(e))?409:503);}
}
