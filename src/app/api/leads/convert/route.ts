import {NextResponse} from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {canEditLead,validateQualification} from '@/lib/lead-workflow';
import {validateAccount,type SalesAccount} from '@/lib/sales-workflow';

export const dynamic='force-dynamic';
const TENANT='defendit360';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanText=(v:unknown,max=180)=>typeof v==='string'?v.trim().slice(0,max):'';
type Lead={
 id:string;tenant_id:string;company_name:string;contact_name:string;contact_email:string;contact_phone:string;
 service_interest:string;lead_source:string;campaign_code:string;qualification_notes:string;budget_status:string;
 decision_authority:string;requirement_summary:string;target_date:string;owner_email:string;status:string;version:number;
 converted_account_id:string|null;converted_opportunity_id:string|null;
};
type Change={success?:boolean;meta?:{changes?:number}};

/** Atomic D1 conversion: UPDATE qualified lead with CAS -> INSERT account -> INSERT opportunity -> audit.
 * D1 batch is transactional: a failed statement rolls back all earlier writes.
 * The guarded INSERT SELECT prevents orphan records if the optimistic version has already changed.
 */
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const {db,role,email}=auth.identity;
 if(!['sales','admin'].includes(role))return json({success:false,message:'Hanya Sales/Admin dapat melakukan konversi'},403);
 if(req.headers.get('origin')!==new URL(req.url).origin||
    req.headers.get('x-india-lead-action')!=='convert')
   return json({success:false,message:'Origin atau konfirmasi tindakan tidak valid'},403);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>18000)return json({success:false,message:'Payload terlalu besar'},413);
  body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')throw Error('Invalid');}
 catch{return json({success:false,message:'Permintaan konversi tidak valid'},400);}
 const leadId=cleanText(body.lead_id,60),expectedVersion=body.version;
 if(!uuid.test(leadId)||!Number.isSafeInteger(expectedVersion)||Number(expectedVersion)<1)
   return json({success:false,message:'ID lead atau versi tidak valid'},400);
 const lead=await db.prepare('SELECT * FROM india_marketing_leads WHERE tenant_id=? AND id=?').bind(TENANT,leadId).first<Lead>();
 if(!lead)return json({success:false,message:'Lead tidak ditemukan'},404);
 if(!canEditLead(role,email,lead.owner_email))
   return json({success:false,message:'Sales tidak boleh mengonversi lead milik Sales lain'},403);
 if(lead.status==='converted')
   return json({success:false,message:'Lead sudah dikonversi',already_converted:true,
    account_id:lead.converted_account_id,opportunity_id:lead.converted_opportunity_id},409);
 if(lead.status!=='qualified'||lead.version!==expectedVersion)
   return json({success:false,message:'Lead belum qualified atau versi sudah berubah'},409);
 const incomplete=validateQualification(lead as unknown as Record<string,unknown>);
 if(incomplete.length)return json({success:false,message:'Kualifikasi belum lengkap',missing:incomplete},422);
 const customer=body.customer;
 if(!customer||typeof customer!=='object'||Array.isArray(customer))
   return json({success:false,message:'Profil customer wajib diisi'},422);
 const profile=customer as Record<string,unknown>;
 const allowed=['client_tier','industry','business_type','employee_band','company_phone','fax','hq_address',
  'hq_province','hq_postal','billing_same_as_hq','billing_address','billing_province','billing_postal',
  'technical_name','technical_phone','technical_email','billing_name','billing_phone','billing_email',
  'tax_name','tax_phone','tax_email','customer_signatory','customer_signatory_title',
  'defender_signatory','defender_signatory_title','maker','reviewer','executor'];
 const fields:Record<string,string>={};
 for(const key of allowed)if(profile[key]!==undefined){
  if(typeof profile[key]!=='string'||(profile[key] as string).length>3500)
   return json({success:false,message:'Profil customer tidak valid: '+key},422);
  fields[key]=(profile[key] as string).trim();
 }
 fields.primary_name=lead.contact_name;
 fields.primary_email=lead.contact_email;
 fields.primary_phone=lead.contact_phone||cleanText(profile.primary_phone,40);
 const accountId=crypto.randomUUID(),opportunityId=crypto.randomUUID();
 const customerNumber='IND-'+accountId.slice(0,8).toUpperCase();
 const account:SalesAccount={id:accountId,legal_name:lead.company_name,
  customer_number:customerNumber,fields,created_at:new Date().toISOString(),created_by:lead.owner_email};
 const customerMissing=validateAccount(account);
 if(customerMissing.length)return json({success:false,message:'Customer Account belum lengkap',missing:customerMissing},422);
 const title=cleanText(body.project_title,180),rawValue=body.estimated_value;
 if(title.length<4||typeof rawValue!=='number'||!Number.isSafeInteger(rawValue)||rawValue<=0||rawValue>1e13)
   return json({success:false,message:'Nama proyek atau estimasi nilai tidak valid'},422);
 const existing=await db.prepare(
  'SELECT id FROM india_sales_accounts WHERE tenant_id=? AND lower(trim(legal_name))=lower(trim(?)) LIMIT 1'
 ).bind(TENANT,lead.company_name).first<{id:string}>();
 if(existing)return json({success:false,message:'Pelanggan sudah terdaftar. Gunakan Customer Account yang ada untuk opportunity baru.',existing_account_id:existing.id},409);
 const dealFields={
  lead_source:lead.lead_source,sales_owner:lead.owner_email,expected_closing_date:lead.target_date,
  service_family:lead.service_interest,contract_model:cleanText(body.contract_model,60)||'One-Time',
  client_need:lead.requirement_summary,budget_status:lead.budget_status,
  decision_maker:lead.decision_authority,procurement_process:cleanText(body.procurement_process,180),
  discovery_notes:lead.qualification_notes,source_lead_id:lead.id,source_campaign_code:lead.campaign_code
 };
 const eventId=crypto.randomUUID(),auditId=crypto.randomUUID();
 try{
  const statements=[
   db.prepare("UPDATE india_marketing_leads SET status='converted',converted_account_id=?,converted_opportunity_id=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=? AND status='qualified' AND version=? AND owner_email=?")
     .bind(accountId,opportunityId,TENANT,leadId,lead.version,lead.owner_email),
   db.prepare("INSERT INTO india_sales_accounts(id,tenant_id,legal_name,customer_number,data_json,created_by) SELECT ?,tenant_id,company_name,?,?,owner_email FROM india_marketing_leads WHERE tenant_id=? AND id=? AND status='converted' AND version=? AND converted_account_id=? AND converted_opportunity_id=?")
     .bind(accountId,customerNumber,JSON.stringify(fields),TENANT,leadId,lead.version+1,accountId,opportunityId),
   db.prepare("INSERT INTO india_sales_opportunities(id,tenant_id,company_id,title,stage,estimated_value_idr,data_json,created_by) SELECT ?,tenant_id,? ,?,'prospecting',?,?,owner_email FROM india_marketing_leads WHERE tenant_id=? AND id=? AND status='converted' AND version=? AND converted_account_id=? AND converted_opportunity_id=?")
     .bind(opportunityId,accountId,title,rawValue,JSON.stringify(dealFields),TENANT,leadId,lead.version+1,accountId,opportunityId),
   db.prepare("INSERT INTO india_marketing_lead_events(id,tenant_id,lead_id,action,actor_email,from_status,to_status,detail) SELECT ?,tenant_id,id,'CONVERT',?,'qualified','converted',? FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=? AND converted_account_id=? AND converted_opportunity_id=?")
     .bind(eventId,email,'Account '+accountId+' / Opportunity '+opportunityId,TENANT,leadId,lead.version+1,accountId,opportunityId),
   db.prepare("INSERT INTO india_sales_audit(id,tenant_id,entity_type,entity_id,action,actor_email,summary) SELECT ?,tenant_id,'deal',?,'LEAD_CONVERSION',?,? FROM india_marketing_leads WHERE tenant_id=? AND id=? AND version=? AND converted_opportunity_id=?")
     .bind(auditId,opportunityId,email,'Lead '+leadId+' -> Customer '+accountId,TENANT,leadId,lead.version+1,opportunityId),
  ];
  const results=await db.batch(statements) as Change[];
  if(results.length!==5||results.some(x=>x.success===false)||results.some(x=>x.meta?.changes!==1))
   return json({success:false,message:'Konversi tidak diterapkan atau data telah berubah. Periksa ulang lead.'},409);
  return json({success:true,lead_id:leadId,account_id:accountId,opportunity_id:opportunityId,
   customer_number:customerNumber,owner_email:lead.owner_email,stage:'prospecting'},201);
 }catch(e){
  const conflict=/UNIQUE|FOREIGN KEY|constraint/i.test(String(e));
  return json({success:false,message:conflict?'Konflik data: konversi dibatalkan seluruhnya. Muat ulang data.':'Konversi gagal dan dibatalkan, periksa migrasi 0003/0004/0005.'},conflict?409:503);
 }
}
