import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT} from '@/lib/sales-workflow';

export const dynamic='force-dynamic';
type ReviewRow={id:string;kind:string;opportunity_id:string|null;title:string;created_by:string;created_at:string};
type QueueItem={id:string;kind:string;opportunity_id:string|null;title:string;created_at:string;href:string};
type QuerySpec={kind:string;sql:string;extraEmail?:boolean};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{...privateHeaders,'Vary':'Cookie'}});
const MAX_ROWS=100;
const DETAIL_PATH:Record<string,string>={
 boq:'/boq',tender_deadline:'/sales/bid-readiness',tender_checklist:'/sales/bid-readiness',
 award_finance:'/sales/award',award_legal:'/sales/award',feasibility:'/sales/feasibility',
 invoice:'/sales/billing',payment:'/sales/billing',contract:'/sales/renewals',
 flexguard_wallet:'/flexguard'
};
/** These queries reflect the actual reviewer roles in each existing transactional handler.
 * Never introduce a second approval ledger or infer authority from a client-selected role.
 * The destination handler re-checks the state, maker/checker, version and document evidence.
 */
function queries(role:string):QuerySpec[]{
 const items:QuerySpec[]=[];
 if(['admin','approver'].includes(role))items.push({kind:'boq',sql:
  "SELECT 'boq' AS kind,b.id,b.opportunity_id,('BoQ · '||b.quotation_number) AS title,b.created_by,b.updated_at AS created_at FROM india_boq b WHERE b.tenant_id=? AND b.status='submitted' AND lower(b.created_by)!=? ORDER BY b.updated_at DESC LIMIT 101"});
 if(['admin','approver'].includes(role))items.push({kind:'tender_deadline',sql:
  "SELECT 'tender_deadline' AS kind,t.id,t.opportunity_id,('Deadline · '||t.milestone||' · '||o.title) AS title,t.created_by,t.created_at FROM india_tender_deadlines t JOIN india_sales_opportunities o ON o.tenant_id=t.tenant_id AND o.id=t.opportunity_id WHERE t.tenant_id=? AND t.status='draft' AND lower(t.created_by)!=? AND o.stage NOT IN ('closed_won','closed_lost') ORDER BY t.created_at DESC LIMIT 101"});
 if(['admin','presales','finance','approver'].includes(role)){
  const category=role==='presales'?" AND t.category='technical'":role==='finance'||role==='approver'?" AND t.category!='technical'":'';
  items.push({kind:'tender_checklist',sql:
   "SELECT 'tender_checklist' AS kind,t.id,t.opportunity_id,('Checklist · '||t.item_code||' · '||o.title) AS title,t.created_by,t.created_at FROM india_tender_checklist t JOIN india_sales_opportunities o ON o.tenant_id=t.tenant_id AND o.id=t.opportunity_id WHERE t.tenant_id=? AND t.status='draft' AND lower(t.created_by)!=? AND o.stage NOT IN ('closed_won','closed_lost')"+category+" ORDER BY t.created_at DESC LIMIT 101"});
 }
 if(['finance','approver'].includes(role))items.push({kind:'award_finance',extraEmail:true,sql:
  "SELECT 'award_finance' AS kind,a.id,a.opportunity_id,('Finance PO/SPK · '||a.document_number) AS title,a.created_by,a.created_at FROM india_sales_award_documents a JOIN india_sales_opportunities o ON o.tenant_id=a.tenant_id AND o.id=a.opportunity_id WHERE a.tenant_id=? AND a.finance_reviewed_by IS NULL AND lower(a.created_by)!=? AND (a.legal_reviewed_by IS NULL OR lower(a.legal_reviewed_by)!=?) AND o.stage NOT IN ('closed_won','closed_lost') ORDER BY a.created_at DESC LIMIT 101"});
 if(role==='legal')items.push({kind:'award_legal',extraEmail:true,sql:
  "SELECT 'award_legal' AS kind,a.id,a.opportunity_id,('Legal PO/SPK · '||a.document_number) AS title,a.created_by,a.created_at FROM india_sales_award_documents a JOIN india_sales_opportunities o ON o.tenant_id=a.tenant_id AND o.id=a.opportunity_id WHERE a.tenant_id=? AND a.legal_reviewed_by IS NULL AND lower(a.created_by)!=? AND (a.finance_reviewed_by IS NULL OR lower(a.finance_reviewed_by)!=?) AND o.stage NOT IN ('closed_won','closed_lost') ORDER BY a.created_at DESC LIMIT 101"});
 if(['admin','finance','approver'].includes(role)){
  items.push({kind:'feasibility',sql:
   "SELECT 'feasibility' AS kind,f.id,f.opportunity_id,('Resource feasibility · '||o.title) AS title,f.created_by,f.created_at FROM india_feasibility_plans f JOIN india_sales_opportunities o ON o.tenant_id=f.tenant_id AND o.id=f.opportunity_id WHERE f.tenant_id=? AND f.status='draft' AND lower(f.created_by)!=? AND o.stage NOT IN ('closed_won','closed_lost') ORDER BY f.created_at DESC LIMIT 101"});
  items.push({kind:'invoice',sql:
   "SELECT 'invoice' AS kind,i.id,p.opportunity_id,('Invoice · '||i.number) AS title,i.created_by,i.created_at FROM india_billing_invoices i JOIN india_delivery_projects p ON p.tenant_id=i.tenant_id AND p.id=i.project_id WHERE i.tenant_id=? AND i.status='draft' AND lower(i.created_by)!=? ORDER BY i.created_at DESC LIMIT 101"});
  items.push({kind:'payment',sql:
   "SELECT 'payment' AS kind,t.id,p.opportunity_id,('Collection · '||t.reference) AS title,t.created_by,t.created_at FROM india_billing_payments t JOIN india_billing_invoices i ON i.tenant_id=t.tenant_id AND i.id=t.invoice_id JOIN india_delivery_projects p ON p.tenant_id=i.tenant_id AND p.id=i.project_id WHERE t.tenant_id=? AND t.status='draft' AND lower(t.created_by)!=? ORDER BY t.created_at DESC LIMIT 101"});
  items.push({kind:'contract',sql:
   "SELECT 'contract' AS kind,c.id,p.opportunity_id,('Contract · '||p.po_number) AS title,c.configured_by AS created_by,p.created_at FROM india_service_contracts c JOIN india_delivery_projects p ON p.tenant_id=c.tenant_id AND p.id=c.project_id WHERE c.tenant_id=? AND c.status='draft' AND c.configured_by IS NOT NULL AND c.end_date IS NOT NULL AND c.renewal_cents IS NOT NULL AND lower(c.configured_by)!=? ORDER BY p.created_at DESC LIMIT 101"});
 }
 if(['admin','approver'].includes(role))items.push({kind:'flexguard_wallet',sql:
  "SELECT 'flexguard_wallet' AS kind,w.id,p.opportunity_id,('FlexGuard entitlement · '||a.legal_name) AS title,w.created_by,w.created_at FROM india_flexguard_wallets w JOIN india_service_contracts c ON c.id=w.contract_id AND c.tenant_id=w.tenant_id JOIN india_sales_accounts a ON a.id=w.customer_id AND a.tenant_id=w.tenant_id JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id WHERE w.tenant_id=? AND w.status='draft' AND c.status='active' AND c.model='FlexGuard' AND lower(w.created_by)!=? ORDER BY w.created_at DESC LIMIT 101"});
 return items;
}
async function fetchQueue(db:D1DB,role:string,email:string){
 const groups=queries(role);
 const results=await Promise.all(groups.map(async ({sql,extraEmail})=>{
  const response=await db.prepare(sql).bind(TENANT,email,...(extraEmail?[email]:[])).all<ReviewRow>();
  if(!response.success)throw Error('Query D1 gagal');
  return response.results;
 }));
 const all:QueueItem[]=results.flatMap(rows=>rows.slice(0,MAX_ROWS).map(row=>{
  const url=DETAIL_PATH[row.kind];
  const id=typeof row.opportunity_id==='string'&&row.opportunity_id.length>0?row.opportunity_id:null;
  if(!url)throw Error('Jenis approval tidak diizinkan');
  return {id:row.id,kind:row.kind,title:row.title,opportunity_id:id,created_at:row.created_at,
   href:url+(row.kind==='flexguard_wallet'?'?wallet_id='+encodeURIComponent(row.id):(id?'?opportunity_id='+encodeURIComponent(id):''))};
 }));
 all.sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const truncated=results.some(rows=>rows.length>MAX_ROWS)||all.length>250;
 return {items:all.slice(0,250),truncated,included_kinds:groups.map(x=>x.kind)};
}
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);
 if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!['admin','sales','presales','finance','approver','legal'].includes(role))return reply({success:false,message:'Tidak berwenang membaca antrean approval.'},403);
 try{
  const data=await fetchQueue(db,role,email);
  return reply({success:true,role,generated_at:new Date().toISOString(),
   ...data,read_only:true,
   scope:'Pending records eligible for role-based review; final approvals remain in their canonical transaction modules.'});
 }catch{
  // A partial / outdated D1 schema is NOT a valid zero-pending answer.
  return reply({success:false,message:'Antrian tidak tersedia: migrasi D1 atau pemeriksaan sumber belum lengkap. Tidak ada angka pending yang diasumsikan.'},503);
 }
}
