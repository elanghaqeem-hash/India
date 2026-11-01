import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {supportingOriginal} from '@/lib/service-operations';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom,erpPositiveCents} from '@/lib/erp-core';
export const dynamic='force-dynamic';
type Payment={id:string;legal_entity_id:string;amount_cents:number;status:string;version:number;created_by:string;reviewed_by:string|null;recorded_by:string|null;opportunity_id:string;};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 try{
  const legal=new URL(req.url).searchParams.get('legal_entity_id');erpAssert(erpId(legal),'Legal Entity wajib');
  await erpGrant(a.identity,'finance_ap',legal);
  const [accounts,payments]=await Promise.all([
   a.identity.db.prepare('SELECT id,bank_name,masked_number,currency,gl_account_id,active FROM india_treasury_accounts WHERE tenant_id=? AND legal_entity_id=?').bind(TENANT,legal).all(),
   a.identity.db.prepare('SELECT id,ap_invoice_id,bank_account_id,amount_cents,status,version,created_by,reviewed_by,recorded_by,bank_reference FROM india_treasury_payments WHERE tenant_id=? AND legal_entity_id=? ORDER BY created_at DESC LIMIT 200').bind(TENANT,legal).all()
  ]);return erpReply({success:true,accounts:accounts.results,payments:payments.results,notice:'No bank transfer is executed; settlement requires independent reconciliation to original bank evidence.'});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const a=auth.identity,{db,email,role}=a;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,10000) as Record<string,unknown>;
  if(v.action==='register_bank'){
   erpAssert(role==='finance'&&erpId(v.legal_entity_id)&&erpId(v.gl_account_id)&&erpText(v.bank_name,3,120)&&erpText(v.masked_number,4,32)&&/^\*{2,}\d{2,6}$/.test(String(v.masked_number)),'Finance harus menggunakan rekening bank tersamar',403);
   await erpGrant(a,'finance_ap',v.legal_entity_id as string);
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_treasury_accounts(id,tenant_id,legal_entity_id,bank_name,masked_number,gl_account_id,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.bank_name as string,v.masked_number as string,v.gl_account_id as string,email)],'treasury',id,'BANK_REGISTER',{bank_name:v.bank_name});return erpReply({success:true,id},201);
  }
  if(v.action==='request_payment'){
   erpAssert(role==='finance'&&erpId(v.invoice_id)&&erpId(v.bank_account_id)&&erpPositiveCents(v.amount_cents),'Invoice, rekening dan nominal wajib',403);
   const invoice=await db.prepare('SELECT i.id,i.amount_cents,p.opportunity_id,s.legal_entity_id FROM india_ap_supplier_invoices i JOIN india_purchase_orders p ON p.id=i.po_id AND p.tenant_id=i.tenant_id JOIN india_erp_opportunity_scopes s ON s.tenant_id=p.tenant_id AND s.opportunity_id=p.opportunity_id AND s.status=\'approved\' WHERE i.id=? AND i.tenant_id=? AND i.status=\'approved\'').bind(v.invoice_id as string,TENANT).first<{id:string;amount_cents:number;legal_entity_id:string}>();
   erpAssert(invoice,'AP belum approved atau belum dipetakan',409);await erpGrant(a,'finance_ap',invoice.legal_entity_id);
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_treasury_payments(id,tenant_id,legal_entity_id,ap_invoice_id,bank_account_id,amount_cents,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,invoice.legal_entity_id,invoice.id,v.bank_account_id as string,v.amount_cents as number,email)],'treasury',id,'PAYMENT_REQUEST',{invoice_id:invoice.id,amount_cents:v.amount_cents});return erpReply({success:true,id},201);
  }
  erpAssert(erpId(v.id)&&Number.isSafeInteger(v.version),'Payment ID dan versi wajib');
  const payment=await db.prepare('SELECT t.*,p.opportunity_id FROM india_treasury_payments t JOIN india_ap_supplier_invoices i ON i.id=t.ap_invoice_id AND i.tenant_id=t.tenant_id JOIN india_purchase_orders p ON p.id=i.po_id AND p.tenant_id=i.tenant_id WHERE t.tenant_id=? AND t.id=?').bind(TENANT,v.id as string).first<Payment>();
  erpAssert(payment&&payment.version===v.version,'Payment berubah atau tidak ada',409);await erpGrant(a,'finance_ap',payment.legal_entity_id);
  if(v.action==='approve_payment'){
   erpAssert(role==='approver'&&payment.status==='draft'&&payment.created_by.toLowerCase()!==email&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Treasury maker tidak boleh approve sendiri',403);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_treasury_payments WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(created_by)!=?)",[TENANT,payment.id,payment.version,email],[db.prepare('UPDATE india_treasury_payments SET status=?,version=version+1,reviewed_by=?,review_notes=? WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,payment.id)],'treasury',payment.id,'PAYMENT_APPROVAL',{approved:v.approve});return erpReply({success:true});
  }
  if(v.action==='record_bank_evidence'){
   erpAssert(role==='admin'&&payment.status==='approved'&&payment.created_by.toLowerCase()!==email&&payment.reviewed_by?.toLowerCase()!==email&&erpText(v.bank_reference,5,120)&&erpId(v.document_id),'Rekonsiliasi wajib staf berbeda dan referensi bukti asli',403);
   await supportingOriginal(db,v.document_id as string,payment.opportunity_id);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_treasury_payments WHERE tenant_id=? AND id=? AND status='approved' AND version=?)",[TENANT,payment.id,payment.version],[db.prepare("UPDATE india_treasury_payments SET status='recorded',version=version+1,recorded_by=?,bank_reference=?,bank_evidence_document_id=? WHERE tenant_id=? AND id=?").bind(email,v.bank_reference as string,v.document_id as string,TENANT,payment.id)],'treasury',payment.id,'BANK_EVIDENCE_RECORDED',{reference:v.bank_reference});return erpReply({success:true});
  }
  if(v.action==='confirm_settlement'){
   erpAssert(role==='approver'&&payment.status==='recorded'&&payment.recorded_by?.toLowerCase()!==email,'Konfirmasi bank oleh reviewer independen',403);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_treasury_payments WHERE tenant_id=? AND id=? AND status='recorded' AND version=?)",[TENANT,payment.id,payment.version],[db.prepare("UPDATE india_treasury_payments SET status='settled',version=version+1,settled_by=?,settled_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(email,TENANT,payment.id)],'treasury',payment.id,'BANK_SETTLED',{reference:'verified_original_evidence'});return erpReply({success:true});
  }
  throw new ERPError('Aksi Treasury tidak tersedia');
 }catch(e){return erpError(e);}
}
