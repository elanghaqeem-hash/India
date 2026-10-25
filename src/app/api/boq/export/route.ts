import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { can,boqTotals, type CostLine, type BoQLine } from '@/lib/boq-domain';
import { createProposalBoQ, type BoQExportFormat } from '@/lib/boq-xlsx';
import type { Proposal, PricingSession } from '@/lib/types';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const formats=['standard','onsite','customer'];
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 const url=new URL(req.url),id=url.searchParams.get('id')||'',format=url.searchParams.get('format')||'';
 if(!formats.includes(format)||!id)return Response.json({success:false,message:'Parameter ekspor tidak valid'},{status:400,headers:privateHeaders});
 if(format!=='customer'&&!can(role,'read_cost'))return Response.json({success:false,message:'BoQ internal khusus Finance/Admin'},{status:403,headers:privateHeaders});
 try{
  const row=await db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(id,'defendit360').first<any>();
  if(!row)return Response.json({success:false,message:'BoQ tidak ditemukan'},{status:404,headers:privateHeaders});
  const lines:BoQLine[]=JSON.parse(row.line_items_json),costs:CostLine[]=JSON.parse(row.cost_items_json);
  const totals=boqTotals(lines,costs,row.vat_rate);
  const items=lines.map((x,i)=>({
    line_number:i+1,service_type:x.service_type as Proposal['line_items'][number]['service_type'],
    description:x.description,quantity:x.quantity,unit:x.unit,unit_price:x.unit_price,line_total:x.quantity*x.unit_price
  }));
  const opportunityId=row.opportunity_id||('boq-'+id);
  const proposal={id,opportunity_id:opportunityId,opportunity_name:row.project_name,company_id:row.tenant_id,
    company_name:row.customer_name,quotation_number:row.quotation_number,version:row.version,
    status:row.status,subtotal:totals.subtotal,vat_amount:totals.vat_amount,grand_total:totals.grand_total,
    discount_pct:0,payment_terms:row.payment_terms,valid_days:14,valid_until:'',client_tier:'A',
    selected_price_range:'standard',line_items:items,created_by:row.created_by,created_at:row.created_at} as Proposal;
  const lookup=(code:string)=>costs.find(x=>x.code===code)?.amount;
  const pricing=costs.length?({id:'d1-'+id,opportunity_id:opportunityId,boq:{
    component_a_total:lookup('A'),component_b_total:lookup('B'),component_c_total:lookup('C'),
    component_d_total:lookup('D'),component_e_total:lookup('E'),
    total_internal_cost:totals.hpp??0}} as unknown as PricingSession):undefined;
  const bytes=createProposalBoQ(proposal,format as BoQExportFormat,format==='customer'?undefined:pricing);
  await db.prepare('INSERT INTO india_audit_log(id,tenant_id,boq_id,action,actor_email,summary) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),'defendit360',id,'EXPORT',email,format).run();
  const safeName=row.quotation_number.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,50);
  return new Response(Buffer.from(bytes),{status:200,headers:{...privateHeaders,
    'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition':'attachment; filename="Technotama_BoQ_'+format+'_'+safeName+'.xlsx"'}});
 }catch{return Response.json({success:false,message:'Ekspor XLSX gagal'},{status:500,headers:privateHeaders});}
}
