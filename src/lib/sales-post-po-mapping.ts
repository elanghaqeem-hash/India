import { newPostPoPacket, type PostPoPacket, type ServiceFamily, type EmployeeBand } from './post-po-documents';
import type { SalesAccount,SalesDeal } from './sales-workflow';

type VerifiedPo={
 po_number:string;po_date:string;po_amount_before_vat:number;
 quotation_amount_before_vat:number;boq_id:string;
};
const str=(x:string|undefined)=>x?.trim()||'';
const serviceFamilies:ServiceFamily[]=['VAPT','SOC/MDR','CTI','Cybersecurity Governance',
 'Incident Response/DFIR','Cybersecurity Technology','Other'];
export function mapSalesToPostPo(account:SalesAccount,deal:SalesDeal,verified:VerifiedPo|null):PostPoPacket{
 if(deal.stage!=='closed_won'||!verified)throw Error('Form resmi Post-PO hanya boleh menggunakan opportunity Won dengan verifikasi Finance.');
 const r=account.fields,d=deal.fields,packet=newPostPoPacket();
 const reg=packet.registration,project=packet.project;
 reg.customerId=account.customer_number;
 reg.customerName=account.legal_name;
 reg.businessType=str(r.business_type);
 reg.employeeBand=(['<100','100-500','>500'].includes(r.employee_band||'')?r.employee_band:'') as EmployeeBand;
 reg.hqAddress=str(r.hq_address);reg.hqProvince=str(r.hq_province);reg.hqPostalCode=str(r.hq_postal);
 reg.billingSameAsHq=r.billing_same_as_hq==='ya';
 reg.billingAddress=reg.billingSameAsHq?reg.hqAddress:str(r.billing_address);
 reg.billingProvince=reg.billingSameAsHq?reg.hqProvince:str(r.billing_province);
 reg.billingPostalCode=reg.billingSameAsHq?reg.hqPostalCode:str(r.billing_postal);
 reg.npwp=str(r.npwp);reg.companyPhone=str(r.company_phone);reg.fax=str(r.fax);
 reg.primary={name:str(r.primary_name),mobile:str(r.primary_phone),email:str(r.primary_email)};
 reg.technical={name:str(r.technical_name),mobile:str(r.technical_phone),email:str(r.technical_email)};
 reg.billing={name:str(r.billing_name),mobile:str(r.billing_phone),email:str(r.billing_email)};
 reg.tax={name:str(r.tax_name),mobile:str(r.tax_phone),email:str(r.tax_email)};
 reg.customerSignatory=str(r.customer_signatory);reg.customerSignatoryTitle=str(r.customer_signatory_title);
 reg.defenderSignatory=str(r.defender_signatory);reg.defenderSignatoryTitle=str(r.defender_signatory_title);
 reg.maker=str(r.maker);reg.reviewer=str(r.reviewer);reg.executor=str(r.executor);
 // Sensitive identity documents and attachments are NEVER assumed present from CRM.
 reg.primaryKtpNumber='';reg.npwpAttachmentConfirmed=false;reg.ktpAttachmentConfirmed=false;
 project.poNumber=verified.po_number;project.poDate=verified.po_date;
 project.quotationNumber=str(d.quotation_number);
 project.quotationAmountBeforeVat=verified.quotation_amount_before_vat;
 project.projectFeeBeforeVat=verified.po_amount_before_vat;
 project.serviceFamily=(serviceFamilies.includes(d.service_family as ServiceFamily)?d.service_family:'Other') as ServiceFamily;
 project.serviceDescription=deal.title;
 project.quantityAndUnit=str(d.scope_quantity);
 project.scope=str(d.technical_scope);
 project.technicalSpecifications=str(d.technical_specifications);
 project.projectPic={name:str(d.project_pic_name),mobile:str(d.project_pic_phone),email:str(d.project_pic_email)};
 project.deliveryAddress=str(d.project_site);project.deliveryProvince=str(d.project_province);
 project.deliveryPostalCode=str(d.project_postal);
 project.paymentVA=(['BCA','OCBC NISP'].includes(d.payment_va||'')?d.payment_va:'') as ''|'BCA'|'OCBC NISP';
 project.timeline=str(d.implementation_timeline);
 project.notes=str(d.opportunity_notes);
 // Payment milestones, signatory evidence, original PO/SOW and official attachments
 // require manual proof and must not be invented or marked verified by a data transfer.
 project.milestones=[{label:'',amount:0,trigger:''}];
 project.poVerified=false;project.quotationReconciled=false;
 return packet;
}
