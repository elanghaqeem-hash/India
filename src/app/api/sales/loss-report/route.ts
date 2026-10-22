import { authorizeBoQ,privateHeaders } from '@/lib/boq-auth';
import { TENANT,type SalesAccount,type SalesDeal } from '@/lib/sales-workflow';
import { canReadDeal } from '@/lib/sales-access';
import { createLossReportDocx } from '@/lib/sales-loss-report';
export const dynamic='force-dynamic';
const error=(message:string,status=400)=>Response.json({success:false,message},{status,headers:privateHeaders});
type DBDeal={id:string;company_id:string;title:string;stage:string;estimated_value_idr:number;
 data_json:string;created_at:string;created_by:string|null};
type DBAccount={id:string;legal_name:string;customer_number:string|null;data_json:string;created_at:string;created_by:string|null};
type DBStage={created_at:string};
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {role,email,db}=auth.identity;
 if(!['admin','sales','presales','approver'].includes(role))return error('Laporan Lost hanya untuk Sales/Presales/Approver/Admin',403);
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return error('ID opportunity tidak valid');
 try{
  const raw=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<DBDeal>();
  if(!raw)return error('Opportunity tidak ditemukan',404);
  if(!canReadDeal(role,email,raw.created_by))return error('Opportunity bukan milik akun Sales ini',403);
  if(raw.stage!=='closed_lost')return error('Report hanya dapat dibuat dari Closed Lost',409);
  const account=await db.prepare('SELECT * FROM india_sales_accounts WHERE tenant_id=? AND id=?')
   .bind(TENANT,raw.company_id).first<DBAccount>();
  if(!account)return error('Customer Account tidak ditemukan',404);
  const history=await db.prepare("SELECT created_at FROM india_sales_audit WHERE tenant_id=? AND entity_type='deal' AND entity_id=? AND action='STAGE' AND to_stage='closed_lost' ORDER BY created_at DESC LIMIT 1").bind(TENANT,id).first<DBStage>();
  const d:SalesDeal={id:raw.id,company_id:raw.company_id,company_name:account.legal_name,title:raw.title,
   stage:'closed_lost',estimated_value:raw.estimated_value_idr,fields:JSON.parse(raw.data_json||'{}'),
   created_at:raw.created_at,created_by:raw.created_by||undefined};
  const a:SalesAccount={id:account.id,legal_name:account.legal_name,customer_number:account.customer_number||'',
   fields:{},created_at:account.created_at};
  const bytes=await createLossReportDocx(d,a,history?.created_at||'');
  await db.prepare('INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) VALUES (?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),TENANT,'deal',id,'LOST_REPORT_EXPORT',email,'Unsigned internal evaluation').run();
  const output=new Uint8Array(bytes.length);output.set(bytes);
  return new Response(output.buffer,{headers:{...privateHeaders,
   'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'Content-Disposition':'attachment; filename="INDIA_Closed_Lost_'+id.slice(0,70)+'.docx"'}});
 }catch{return error('Dokumen Lost Report gagal dibuat. Periksa data, skema atau izin akun.',503);}
}
