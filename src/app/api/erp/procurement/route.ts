import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {supportingOriginal} from '@/lib/service-operations';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom,erpOpportunityUnit,erpPositiveCents,erpDate,erpPeriod} from '@/lib/erp-core';
export const dynamic='force-dynamic';
type PO={id:string;opportunity_id:string;vendor_id:string;offer_id:string;status:string;version:number;created_by:string;qty:number;unit_price_cents:number};
type AP={id:string;po_id:string;vendor_id:string;status:string;version:number;created_by:string;opportunity_id:string};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 try{
  const opportunity=new URL(req.url).searchParams.get('opportunity_id');
  erpAssert(erpId(opportunity),'Opportunity wajib');const unit=await erpOpportunityUnit(a.identity.db,opportunity);
  const cap=a.identity.role==='finance'?'finance_ap':'procurement';await erpGrant(a.identity,cap,unit);
  const {db}=a.identity;
  const [orders,receipts,invoices]=await Promise.all([
   db.prepare('SELECT * FROM india_purchase_orders WHERE tenant_id=? AND opportunity_id=? ORDER BY created_at DESC LIMIT 150').bind(TENANT,opportunity).all(),
   db.prepare('SELECT r.* FROM india_purchase_receipts r JOIN india_purchase_orders p ON p.id=r.po_id AND p.tenant_id=r.tenant_id WHERE p.tenant_id=? AND p.opportunity_id=? ORDER BY r.received_at DESC LIMIT 150').bind(TENANT,opportunity).all(),
   db.prepare('SELECT i.* FROM india_ap_supplier_invoices i JOIN india_purchase_orders p ON p.id=i.po_id AND p.tenant_id=i.tenant_id WHERE p.tenant_id=? AND p.opportunity_id=? ORDER BY i.created_at DESC LIMIT 150').bind(TENANT,opportunity).all()]);
  return erpReply({success:true,orders:orders.results,receipts:receipts.results,invoices:invoices.results,payments_enabled:false});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,9000) as Record<string,unknown>;

  if(v.action==='budget'){
   erpAssert(role==='finance'&&erpId(v.legal_entity_id)&&erpPeriod(v.period)&&erpText(v.code,3,80)&&erpPositiveCents(v.limit_cents),'Budget Finance membutuhkan legal entity, periode dan batas',403);
   await erpGrant(a.identity,'finance_ap',v.legal_entity_id as string);const id=crypto.randomUUID();
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_procurement_budgets(id,tenant_id,legal_entity_id,period,code,limit_cents,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.period as string,v.code as string,v.limit_cents as number,email)],'procurement',id,'BUDGET_CREATE',{code:v.code,limit_cents:v.limit_cents});return erpReply({success:true,id},201);
  }
  if(v.action==='approve_budget'){
   erpAssert(role==='approver'&&erpId(v.id),'Budget hanya diputuskan Approver',403);
   const budget=await db.prepare('SELECT legal_entity_id,status,created_by FROM india_procurement_budgets WHERE tenant_id=? AND id=?').bind(TENANT,v.id as string).first<{legal_entity_id:string;status:string;created_by:string}>();
   erpAssert(budget&&budget.status==='draft'&&budget.created_by.toLowerCase()!==email,'Budget self-approval ditolak',409);await erpGrant(a.identity,'finance_ap',budget.legal_entity_id);
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_procurement_budgets WHERE tenant_id=? AND id=? AND status='draft' AND lower(created_by)!=?)",[TENANT,v.id as string,email],[db.prepare("UPDATE india_procurement_budgets SET status='approved',approved_by=?,approved_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(email,TENANT,v.id as string)],'procurement',v.id as string,'BUDGET_APPROVED',{});return erpReply({success:true});
  }
  if(v.action==='requisition'){
   erpAssert(['presales','admin'].includes(role)&&erpId(v.opportunity_id)&&erpId(v.budget_id)&&erpText(v.request_number,3,100)&&erpText(v.title,8,180)&&Number.isSafeInteger(v.qty)&&Number(v.qty)>0&&erpPositiveCents(v.ceiling_cents),'Requisition harus memiliki budget dan batas biaya',403);
   const unit=await erpOpportunityUnit(db,v.opportunity_id as string);await erpGrant(a.identity,'procurement',unit);const id=crypto.randomUUID();
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_procurement_requisitions(id,tenant_id,opportunity_id,budget_id,request_number,title,qty,ceiling_cents,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,v.opportunity_id as string,v.budget_id as string,v.request_number as string,v.title as string,v.qty as number,v.ceiling_cents as number,email)],'procurement',id,'REQUISITION_CREATE',{opportunity_id:v.opportunity_id,budget_id:v.budget_id});return erpReply({success:true,id},201);
  }
  if(v.action==='approve_requisition'){
   erpAssert(role==='approver'&&erpId(v.id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Requisition butuh Approver dan alasan',403);
   const req=await db.prepare('SELECT opportunity_id,status,version,created_by FROM india_procurement_requisitions WHERE tenant_id=? AND id=?').bind(TENANT,v.id as string).first<{opportunity_id:string;status:string;version:number;created_by:string}>();
   erpAssert(req&&req.status==='draft'&&req.version===v.version&&req.created_by.toLowerCase()!==email,'Requisition berubah atau self-approval',409);
   await erpGrant(a.identity,'procurement',await erpOpportunityUnit(db,req.opportunity_id));
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_procurement_requisitions WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(created_by)!=?)",[TENANT,v.id as string,v.version as number,email],[db.prepare('UPDATE india_procurement_requisitions SET status=?,version=version+1,reviewed_by=?,review_notes=? WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,v.id as string)],'procurement',v.id as string,'REQUISITION_REVIEW',{approved:v.approve});return erpReply({success:true});
  }
  if(v.action==='create_po'){
   erpAssert(['presales','admin'].includes(role),'Purchase Order hanya untuk Procurement/Presales bergrant',403);
   erpAssert(erpId(v.offer_id)&&erpText(v.po_number,3,100)&&Number.isSafeInteger(v.qty)&&Number(v.qty)>0,'Vendor offer, PO dan kuantitas wajib');
   const offer=await db.prepare('SELECT o.id,o.vendor_id,o.opportunity_id,o.quantity,o.unit_price_idr,o.status,o.valid_until,v.status AS vendor_status,v.valid_until AS vendor_valid FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id WHERE o.tenant_id=? AND o.id=?').bind(TENANT,v.offer_id as string).first<{id:string;vendor_id:string;opportunity_id:string;quantity:number;unit_price_idr:number;status:string;valid_until:string;vendor_status:string;vendor_valid:string}>();
   erpAssert(offer&&offer.status==='validated'&&offer.vendor_status==='validated','Vendor dan offer harus tervalidasi',409);
   const unit=await erpOpportunityUnit(db,offer.opportunity_id);await erpGrant(a.identity,'procurement',unit);
   const cents=Math.round(offer.unit_price_idr*100);erpAssert(erpPositiveCents(cents)&&offer.quantity>=Number(v.qty),'Nilai atau kuantitas offer tidak valid');
   const id=crypto.randomUUID();
   const writes=[db.prepare('INSERT INTO india_purchase_orders(id,tenant_id,vendor_id,offer_id,opportunity_id,po_number,qty,unit_price_cents,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,offer.vendor_id,offer.id,offer.opportunity_id,(v.po_number as string).trim(),v.qty as number,cents,email)];
   if(v.requisition_id!==undefined){erpAssert(erpId(v.requisition_id),'Requisition wajib valid');writes.push(db.prepare('INSERT INTO india_procurement_commitments(tenant_id,requisition_id,po_id,created_by) VALUES(?,?,?,?)').bind(TENANT,v.requisition_id as string,id,email));}
   await erpAtom(a.identity,'1=1',[],writes,'procurement',id,'CREATE_PO',{offer_id:offer.id,qty:v.qty,requisition_id:v.requisition_id||null});return erpReply({success:true,id},201);
  }
  if(v.action==='review_po'||v.action==='receipt'||v.action==='supplier_invoice'){
   erpAssert(erpId(v.po_id),'Purchase Order wajib');
   const po=await db.prepare('SELECT * FROM india_purchase_orders WHERE tenant_id=? AND id=?').bind(TENANT,v.po_id as string).first<PO>();
   erpAssert(po,'PO tidak ditemukan',404);const unit=await erpOpportunityUnit(db,po.opportunity_id);
   if(v.action==='review_po'){
    erpAssert(role==='approver','Review PO hanya Approver independen',403);
    await erpGrant(a.identity,'procurement',unit);
    erpAssert(po.status==='draft'&&po.version===v.version&&po.created_by.toLowerCase()!==email&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Review PO tidak valid atau self-approval',403);
    await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_purchase_orders WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(created_by)!=?)",[TENANT,po.id,po.version,email],[db.prepare('UPDATE india_purchase_orders SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,po.id)],'procurement',po.id,'REVIEW_PO',{approved:v.approve});return erpReply({success:true});
   }
   if(v.action==='receipt'){
    erpAssert(['presales','admin'].includes(role),'Penerimaan harus Procurement yang bergrant',403);await erpGrant(a.identity,'procurement',unit);
    erpAssert(po.status==='approved'&&po.created_by.toLowerCase()!==email&&Number.isSafeInteger(v.qty)&&Number(v.qty)>0&&erpId(v.document_id),'Penerimaan berbeda pembuat PO dan membutuhkan bukti asli',403);
    await supportingOriginal(db,v.document_id as string,po.opportunity_id);
    const id=crypto.randomUUID();
    await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_purchase_receipts(id,tenant_id,po_id,qty,evidence_document_id,received_by) VALUES(?,?,?,?,?,?)').bind(id,TENANT,po.id,v.qty as number,v.document_id as string,email)],'procurement',id,'RECEIPT',{po_id:po.id,qty:v.qty,document_id:v.document_id});return erpReply({success:true,id},201);
   }
   erpAssert(role==='finance','Supplier Invoice hanya Finance',403);await erpGrant(a.identity,'finance_ap',unit);
   erpAssert(po.status==='approved'&&erpText(v.supplier_invoice_number,3,100)&&Number.isSafeInteger(v.qty)&&Number(v.qty)>0&&erpId(v.document_id)&&erpDate(v.due_date),'Dokumen, jumlah dan jatuh tempo supplier invoice wajib');
   await supportingOriginal(db,v.document_id as string,po.opportunity_id);
   const amt=(v.qty as number)*po.unit_price_cents;erpAssert(erpPositiveCents(amt),'Jumlah invoice melampaui presisi');
   const id=crypto.randomUUID();
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_ap_supplier_invoices(id,tenant_id,po_id,vendor_id,supplier_invoice_number,qty,amount_cents,evidence_document_id,due_date,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,po.id,po.vendor_id,(v.supplier_invoice_number as string).trim(),v.qty as number,amt,v.document_id as string,v.due_date as string,email)],'ap',id,'INVOICE_DRAFT',{po_id:po.id,document_id:v.document_id});return erpReply({success:true,id},201);
  }
  if(v.action==='review_invoice'){
   erpAssert(role==='approver','AP approval hanya Approver independen',403);
   erpAssert(erpId(v.id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Keputusan AP tidak valid');
   const invoice=await db.prepare('SELECT i.*,p.opportunity_id FROM india_ap_supplier_invoices i JOIN india_purchase_orders p ON p.id=i.po_id AND p.tenant_id=i.tenant_id WHERE i.tenant_id=? AND i.id=?').bind(TENANT,v.id as string).first<AP>();
   erpAssert(invoice&&invoice.status==='draft'&&invoice.version===v.version&&invoice.created_by.toLowerCase()!==email,'Invoice berubah atau self-approval',409);
   await erpGrant(a.identity,'finance_ap',await erpOpportunityUnit(db,invoice.opportunity_id));
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_ap_supplier_invoices WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(created_by)!=?)",[TENANT,v.id as string,v.version as number,email],[db.prepare('UPDATE india_ap_supplier_invoices SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,v.id as string)],'ap',v.id as string,'REVIEW_SUPPLIER_INVOICE',{approved:v.approve});
   return erpReply({success:true});
  }
  throw new ERPError('Aksi procurement/AP tidak dikenali');
 }catch(e){return erpError(e);}
}
