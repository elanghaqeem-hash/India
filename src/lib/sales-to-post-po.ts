import {newPostPoPacket,type PostPoPacket,type Pic,type PaymentMilestone,type ServiceFamily} from './post-po-documents';
import type {SalesAccount,SalesDeal} from './sales-workflow';
const pic=(f:Record<string,string>,prefix:string):Pic=>({
 name:f[prefix+'_name']||'',mobile:f[prefix+'_phone']||'',email:f[prefix+'_email']||''
});
export function parseMilestones(raw:string):PaymentMilestone[]{
 try{
  const v=JSON.parse(raw);
  if(!Array.isArray(v)||v.length>20)return [];
  return v.map(x=>({label:String(x.label||''),amount:Number(x.amount||0),trigger:String(x.trigger||'')}));
 }catch{return [];}
}
/** Only source-grounded fields are populated. Never fabricate IDs, identity numbers or signoffs. */
export function prefillFromSales(a:SalesAccount,d:SalesDeal,poVerified:boolean,quotationAmount=0):PostPoPacket{
 const r=a.fields,p=d.fields;
 const data=newPostPoPacket();
 data.registration={
  ...data.registration,customerId:a.customer_number,customerName:a.legal_name,
  businessType:r.business_type||'',employeeBand:(r.employee_band||'') as PostPoPacket['registration']['employeeBand'],
  hqAddress:r.hq_address||'',hqProvince:r.hq_province||'',hqPostalCode:r.hq_postal||'',
  billingSameAsHq:r.billing_same_as_hq!=='tidak',billingAddress:r.billing_address||'',
  billingProvince:r.billing_province||'',billingPostalCode:r.billing_postal||'',
  npwp:r.npwp||'',companyPhone:r.company_phone||'',fax:r.fax||'',
  primary:pic(r,'primary'),technical:pic(r,'technical'),billing:pic(r,'billing'),tax:pic(r,'tax'),
  customerSignatory:r.customer_signatory||'',customerSignatoryTitle:r.customer_signatory_title||'',
  defenderSignatory:r.defender_signatory||'',defenderSignatoryTitle:r.defender_signatory_title||'',
  maker:r.maker||'',reviewer:r.reviewer||'',executor:r.executor||'',
  // KTP data and documentary evidence must be supplied explicitly in protected Post-PO form.
  primaryKtpNumber:'',npwpAttachmentConfirmed:false,ktpAttachmentConfirmed:false,
 };
 const family=['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other']
 .includes(p.service_family)?p.service_family as ServiceFamily:'Other';
 data.project={
  ...data.project,poNumber:p.po_number||'',poDate:p.po_date||'',poVerified,
  quotationNumber:p.quotation_number||'',quotationAmountBeforeVat:quotationAmount,
  serviceFamily:family,serviceDescription:d.title,quantityAndUnit:p.scope_quantity||'',
  scope:p.technical_scope||'',technicalSpecifications:p.technical_specifications||'',
  projectPic:pic(p,'project_pic'),deliveryAddress:p.project_site||'',deliveryProvince:p.project_province||'',
  deliveryPostalCode:p.project_postal||'',
  paymentVA:(p.payment_va==='BCA'||p.payment_va==='OCBC NISP'?p.payment_va:''),
  projectFeeBeforeVat:Number(p.po_amount_before_vat||0),
  milestones:parseMilestones(p.payment_milestones||''),
  durationValue:(p.contract_duration||'').match(/^\d+/)?.[0]||'',
  durationUnit:/bulan/i.test(p.contract_duration||'')?'bulan':/tahun/i.test(p.contract_duration||'')?'tahun':'hari',
  timeline:p.implementation_timeline||'',notes:p.scope_reconciliation||'',
  quotationReconciled:poVerified
 };
 return data;
}
