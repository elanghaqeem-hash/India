import {feasibilityReady} from '@/lib/solution-feasibility-gate';
import {tenderReady,guardTender} from '@/lib/tender-readiness';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { boqTotals, type BoQLine, type CostLine } from '@/lib/boq-domain';
import { createQuotationDocx, type QuotationDetails } from '@/lib/quotation-docx';
import { TENANT } from '@/lib/sales-workflow';
import { canReadDeal } from '@/lib/sales-access';
import type { Proposal, ProposalLineItem } from '@/lib/types';
import {atomicSales,currentRelease,dealGuard,salesAudit,type FlowDeal} from '@/lib/sales-transactions';
export const dynamic='force-dynamic';

const deny=(message:string,status=400)=>Response.json({success:false,message},{status,headers:privateHeaders});
type DealRow=FlowDeal & {id:string;company_id:string;title:string;stage:string;data_json:string;created_by:string|null};
type AccountRow={id:string;legal_name:string;data_json:string};
type BoQRow={id:string;opportunity_id:string|null;customer_name:string;project_name:string;quotation_number:string;version:number;edit_seq:number;status:string;line_items_json:string;cost_items_json:string;vat_rate:number;payment_terms:string;approved_by:string|null;created_by:string;created_at:string;};
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const clean=(v:string)=>v.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,60);
/** Download approved D1 quotation using INDIA's already implemented 3-format DOCX generator. */
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);
 if(!auth.ok)return auth.response;
 if(!['admin','sales','presales','finance','approver'].includes(auth.identity.role))
  return deny('Tidak berhak mengunduh quotation.',403);
 const params=new URL(req.url).searchParams;
 const id=params.get('opportunity_id')||'';
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return deny('Opportunity ID tidak valid');
 const db=auth.identity.db;
 try{
  const row=await db.prepare('SELECT * FROM india_sales_opportunities WHERE id=? AND tenant_id=?').bind(id,TENANT).first<DealRow>();
  if(!row)return deny('Opportunity tidak ditemukan',404);
  if(!canReadDeal(auth.identity.role,auth.identity.email,row.created_by))return deny('Opportunity tidak tersedia untuk Sales ini',403);
  const acct=await db.prepare('SELECT * FROM india_sales_accounts WHERE id=? AND tenant_id=?').bind(row.company_id,TENANT).first<AccountRow>();
  if(!acct)return deny('Customer Account tidak ditemukan',404);
  const fields=JSON.parse(row.data_json||'{}') as Record<string,string>;
  const boqId=fields.boq_id||'';
  const boq=await db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=? AND opportunity_id=?').bind(boqId,TENANT,id).first<BoQRow>();
  if(!boq||boq.status!=='approved')return deny('Quotation hanya dapat diekspor dari BoQ approved yang terkait opportunity.',409);
  if(boq.customer_name.trim().toLowerCase()!==acct.legal_name.trim().toLowerCase()||
   boq.project_name.trim().toLowerCase()!==row.title.trim().toLowerCase()||
   (fields.quotation_number&&fields.quotation_number!==boq.quotation_number))
   return deny('Nama proyek, pelanggan atau nomor quotation belum sesuai dengan BoQ approved.',409);
  const release=await currentRelease(db,id);
  if(!release||release.status!=='approved'||release.boq_id!==boq.id||release.boq_version!==boq.version)return deny('Proposal versi aktif harus approved sebelum ekspor quotation',409);
  if(!await tenderReady(db,id))return deny('Bid GO, mandatory clause dan validasi vendor harus lengkap sebelum ekspor quotation',409);
  if(!await feasibilityReady(db,id))return deny('Resource capacity dan solusi supplier belum lulus feasibility review',409);
  const days=Number(fields.quotation_valid_days),until=fields.quotation_valid_until||'';
  if(!Number.isInteger(days)||days<=0||days>365||!/\d{4}-\d{2}-\d{2}/.test(until))
   return deny('Lengkapi masa berlaku dan tanggal akhir quotation di Sales Form sebelum ekspor.',409);
  const items=JSON.parse(boq.line_items_json) as BoQLine[], costs=JSON.parse(boq.cost_items_json) as CostLine[];
  const totals=boqTotals(items,costs,boq.vat_rate);
  if(!items.length||totals.subtotal<=0)return deny('BoQ line item tidak lengkap',409);
  const lines:ProposalLineItem[]=items.map((x,i)=>({
   line_number:i+1, service_type:x.service_type as ProposalLineItem['service_type'],
   description:x.description,quantity:x.quantity,unit:x.unit,unit_price:x.unit_price,line_total:x.quantity*x.unit_price,
  }));
  const proposal:Proposal={
   id:boq.id,opportunity_id:id,opportunity_name:row.title,company_id:acct.id,
   company_name:acct.legal_name,quotation_number:boq.quotation_number,version:boq.version,
   status:'approved',subtotal:totals.subtotal,vat_amount:totals.vat_amount,grand_total:totals.grand_total,
   discount_pct:0,payment_terms:boq.payment_terms as Proposal['payment_terms'],
   valid_days:days,valid_until:until,client_tier:'C',selected_price_range:'standard',line_items:lines,
   created_by:boq.created_by,approved_by:boq.approved_by||undefined,created_at:boq.created_at,
  };
  // Client tier and price range are structurally required by legacy Proposal but not printed by generator.
  const detail:QuotationDetails={
   endUser:str(fields.end_user)||acct.legal_name,scope:str(fields.technical_scope),
   recipientName:str(fields.quotation_to_pic),
   signatoryName:str(fields.quotation_sender_name),
   signatoryTitle:str(fields.quotation_sender_title),
   quotationDate:str(fields.quotation_sent_at),
   assets:str(fields.asset_profile)||str(fields.scope_quantity),
   methodology:str(fields.methodology),serviceLevels:str(fields.service_level),
   technicalPlatform:str(fields.license_or_sku),team:str(fields.team_composition)||str(fields.resourcing_model),
   deliverables:str(fields.deliverables),terms:str(fields.quotation_terms),
   paymentNotes:str(fields.quotation_payment_notes),exclusions:str(fields.exclusions),
   rules:str(fields.methodology),logSources:str(fields.asset_profile),
  };
  if(params.get('output')==='preview')return Response.json({success:true,proposal,details:detail,release_id:release.id},{headers:privateHeaders});
  const bytes=createQuotationDocx(proposal,'auto',detail);
  const guard=dealGuard(row);
  guard.condition+=" AND EXISTS(SELECT 1 FROM india_sales_releases WHERE id=? AND status='approved') AND EXISTS(SELECT 1 FROM india_boq WHERE id=? AND edit_seq=? AND status='approved')";guard.args.push(release.id,boq.id,boq.edit_seq);
  await atomicSales(db,guard.condition,guard.args,[salesAudit(db,id,'QUOTATION_EXPORT',auth.identity.email,'DOCX '+boq.quotation_number+' v'+boq.version+' / paket v'+release.version)]);
  const output=new Uint8Array(bytes.length);output.set(bytes);
  return new Response(output.buffer,{status:200,headers:{...privateHeaders,
   'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
   'Content-Disposition':'attachment; filename="INDIA_Technotama_Quotation_'+clean(boq.quotation_number)+'.docx"'}});
 }catch{return deny('Gagal membuat DOCX dari data Sales/BoQ. Periksa skema dan field quotation.',503);}
}
