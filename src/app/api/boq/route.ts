import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { validateBoQ, boqTotals, can } from '@/lib/boq-domain';
import { checkBoqLink } from '@/lib/sales-boq-link';
import {atomicSales} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';
type Row={id:string;tenant_id:string;customer_name:string;project_name:string;quotation_number:string;service_type:string;opportunity_id:string|null;version:number;status:string;vat_rate:number;payment_terms:string;line_items_json:string;cost_items_json:string;notes:string|null;created_by:string;updated_by:string;approved_by:string|null;created_at:string;updated_at:string};
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const problem=(message:string,status=400)=>respond({success:false,message},status);
function visible(row:Row,role:string){
 const lines=JSON.parse(row.line_items_json),costs=JSON.parse(row.cost_items_json),totals=boqTotals(lines,costs,row.vat_rate);
 const {line_items_json,cost_items_json,...base}=row;
 return {...base,line_items:lines,subtotal:totals.subtotal,vat_amount:totals.vat_amount,grand_total:totals.grand_total,
  ...(role==='admin'||role==='finance'?{cost_items:costs,hpp:totals.hpp,gross_profit:totals.gp,gross_margin_pct:totals.margin,cost_complete:totals.complete}:{})};
}
const sameOrigin=(req:Request)=>!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 try{
  const {db,role}=a.identity;
  const result=role==='sales'
   ?await db.prepare("SELECT b.* FROM india_boq b LEFT JOIN india_sales_opportunities d ON b.opportunity_id=d.id AND b.tenant_id=d.tenant_id WHERE b.tenant_id=? AND (b.created_by=? OR d.created_by=?) ORDER BY b.updated_at DESC LIMIT 100").bind('defendit360',a.identity.email,a.identity.email).all<Row>()
   :await db.prepare('SELECT * FROM india_boq WHERE tenant_id=? ORDER BY updated_at DESC LIMIT 100').bind('defendit360').all<Row>();
  return respond({success:true,role,boqs:result.results.map(row=>visible(row,role))});
 }catch{return problem('Database BoQ tidak dapat dibaca',500);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,email,role}=a.identity;
 if(!can(role,'create'))return problem('Peran tidak diizinkan membuat BoQ',403);
 if(!sameOrigin(req))return problem('Origin tidak diperbolehkan',403);
 try{
  const text=await req.text();if(text.length>140000)return problem('Dokumen terlalu besar',413);
  const value=validateBoQ(JSON.parse(text));
  if(value.cost_items?.length&&!can(role,'edit_cost'))return problem('HPP hanya untuk Finance',403);
   if(!value.opportunity_id)return problem('Opportunity ID wajib untuk semua BoQ komersial INDIA',422);
   const deal=await db.prepare('SELECT id,company_id,title,stage,created_by,data_json FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind('defendit360',value.opportunity_id).first<{id:string;company_id:string;title:string;stage:string;created_by:string;data_json:string}>();
   const account=deal?await db.prepare('SELECT id,legal_name FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind('defendit360',deal.company_id).first<{id:string;legal_name:string}>():null;
   const linkError=checkBoqLink(value,deal,account,role,email);
   if(linkError)return problem(linkError,409);
  const id=crypto.randomUUID();
  await atomicSales(db,"EXISTS(SELECT 1 FROM india_sales_opportunities WHERE id=? AND tenant_id=? AND stage=? AND data_json=?)",[deal!.id,'defendit360',deal!.stage,deal!.data_json],[db.prepare('INSERT INTO india_boq (id,tenant_id,project_name,customer_name,quotation_number,service_type,opportunity_id,vat_rate,payment_terms,line_items_json,cost_items_json,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,'defendit360',value.project_name,value.customer_name,value.quotation_number,value.service_type,
   value.opportunity_id||null,value.vat_rate,value.payment_terms,JSON.stringify(value.line_items),JSON.stringify(value.cost_items||[]),value.notes||null,email,email),
  db.prepare('INSERT INTO india_audit_log(id,tenant_id,boq_id,action,actor_email) VALUES (?,?,?,?,?)')
  .bind(crypto.randomUUID(),'defendit360',id,'CREATE',email)]);
  const row=await db.prepare('SELECT * FROM india_boq WHERE id=?').bind(id).first<Row>();
  return respond({success:true,boq:visible(row!,role)},201);
 }catch(e){const m=e instanceof Error?e.message:'Gagal menyimpan BoQ';return problem(m,m.includes('UNIQUE constraint')?409:400);}
}
