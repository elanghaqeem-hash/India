import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {supportingOriginal} from '@/lib/service-operations';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom,erpProjectUnit} from '@/lib/erp-core';
export const dynamic='force-dynamic';
type Case={id:string;project_id:string;kind:string;status:string;version:number;created_by:string;reviewer_email:string|null;evidence_document_id:string|null;opportunity_id:string};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 try{
  const id=new URL(req.url).searchParams.get('project_id');erpAssert(erpId(id),'Project ID wajib');
  const unit=await erpProjectUnit(a.identity.db,id);await erpGrant(a.identity,'cyber_ops',unit);
  const rows=await a.identity.db.prepare('SELECT id,kind,external_ref,title,severity,classification,status,version,created_by,reviewer_email,evidence_document_id,created_at,reviewed_at,closed_at FROM india_cyber_cases WHERE tenant_id=? AND project_id=? ORDER BY created_at DESC LIMIT 250').bind(TENANT,id).all();
  return erpReply({success:true,cases:rows.results,warning:'Metadata workflow only; not a SIEM/EDR/scanner'});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,7000) as Record<string,unknown>;
  if(v.action==='open'){
   erpAssert(['presales','admin'].includes(role),'Case hanya dibuat oleh operator bergrant',403);
   erpAssert(erpId(v.project_id)&&erpText(v.external_ref,3,120)&&erpText(v.title,8,240)&&['vapt_finding','soc_incident','dfir_incident'].includes(String(v.kind))&&['critical','high','medium','low','informational'].includes(String(v.severity))&&['confidential','restricted'].includes(String(v.classification)),'Metadata keamanan tidak valid');
   const unit=await erpProjectUnit(db,v.project_id as string);await erpGrant(a.identity,'cyber_ops',unit);
   const id=crypto.randomUUID();
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_cyber_cases(id,tenant_id,project_id,kind,external_ref,title,severity,classification,created_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,v.project_id as string,v.kind as string,(v.external_ref as string).trim(),(v.title as string).trim(),v.severity as string,v.classification as string,email)],'cyber',id,'CASE_OPEN',{project_id:v.project_id,kind:v.kind,severity:v.severity});return erpReply({success:true,id},201);
  }
  if(v.action==='review'||v.action==='close'){
   erpAssert(erpId(v.id)&&Number.isSafeInteger(v.version),'ID dan versi case wajib');
   const c=await db.prepare('SELECT c.*,p.opportunity_id FROM india_cyber_cases c JOIN india_delivery_projects p ON p.id=c.project_id AND p.tenant_id=c.tenant_id WHERE c.tenant_id=? AND c.id=?').bind(TENANT,v.id as string).first<Case>();
   erpAssert(c,'Case tidak ditemukan',404);await erpGrant(a.identity,'cyber_ops',await erpProjectUnit(db,c.project_id));
   erpAssert(v.version===c.version,'Versi case berubah',409);
   if(v.action==='review'){
    erpAssert(role==='approver'&&c.created_by.toLowerCase()!==email&&c.status==='open','QA harus reviewer independen',403);
    erpAssert(typeof v.approve==='boolean'&&erpText(v.notes,12,800)&&erpId(v.document_id),'QA dan dokumen bukti asli wajib');
    await supportingOriginal(db,v.document_id as string,c.opportunity_id);
    await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_cyber_cases WHERE tenant_id=? AND id=? AND version=? AND status='open' AND lower(created_by)!=?)",[TENANT,c.id,c.version,email],[db.prepare('UPDATE india_cyber_cases SET status=?,version=version+1,reviewer_email=?,review_notes=?,evidence_document_id=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(v.approve?'reviewed':'rejected',email,v.notes as string,v.document_id as string,TENANT,c.id)],'cyber',c.id,'CASE_REVIEW',{approved:v.approve,document_id:v.document_id});return erpReply({success:true});
   }
   erpAssert(['presales','admin'].includes(role)&&c.status==='reviewed'&&c.reviewer_email!==null&&c.reviewer_email.toLowerCase()!==email,'Penutupan perlu review independen',403);
   await supportingOriginal(db,c.evidence_document_id as string,c.opportunity_id);
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_cyber_cases WHERE tenant_id=? AND id=? AND version=? AND status='reviewed')",[TENANT,c.id,c.version],[db.prepare("UPDATE india_cyber_cases SET status='closed',version=version+1,closed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(TENANT,c.id)],'cyber',c.id,'CASE_CLOSE',{evidence_document_id:c.evidence_document_id});
   return erpReply({success:true});
  }
  throw new ERPError('Aksi cybersecurity operations tidak dikenal');
 }catch(e){return erpError(e);}
}
