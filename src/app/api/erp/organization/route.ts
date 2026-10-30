import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpAtom} from '@/lib/erp-core';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;
 try{
  if(!['admin','approver'].includes(role))throw new ERPError('Akses pengelolaan organisasi ditolak',403);
  const units=await db.prepare('SELECT id,code,label,kind,parent_id,active FROM india_erp_org_units WHERE tenant_id=? ORDER BY kind,code LIMIT 500').bind(TENANT).all();
  const grants=await db.prepare("SELECT id,email,capability,unit_id,status,version,requested_by,reviewed_by FROM india_erp_capability_grants WHERE tenant_id=? ORDER BY created_at DESC LIMIT 500").bind(TENANT).all();
  const opportunities=await db.prepare("SELECT opportunity_id,legal_entity_id,status,version,requested_by,reviewed_by FROM india_erp_opportunity_scopes WHERE tenant_id=? ORDER BY opportunity_id LIMIT 500").bind(TENANT).all();
  const projects=await db.prepare("SELECT project_id,legal_entity_id,status,version,requested_by,reviewed_by FROM india_erp_project_scopes WHERE tenant_id=? ORDER BY project_id LIMIT 500").bind(TENANT).all();
  return erpReply({success:true,role,email,units:units.results,grants:grants.results,projects:projects.results,opportunities:opportunities.results});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,8000) as Record<string,unknown>;
  if(v.action==='create_unit'){
   erpAssert(role==='admin','Hanya Admin dapat menambah unit organisasi',403);
   erpAssert(erpId(v.id)&&erpText(v.code,2,48)&&erpText(v.label,3,160)&&['legal_entity','division','department','team','cost_center'].includes(String(v.kind))&&(v.parent_id===null||erpId(v.parent_id)),'Unit, kode, tipe dan parent wajib valid');
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_erp_org_units(id,tenant_id,code,label,kind,parent_id,created_by) VALUES(?,?,?,?,?,?,?)').bind(v.id as string,TENANT,v.code as string,v.label as string,v.kind as string,v.parent_id as string|null,email)],'org',v.id as string,'CREATE_UNIT',{kind:v.kind,code:v.code});return erpReply({success:true,id:v.id},201);
  }
  if(v.action==='request_grant'){
   erpAssert(role==='admin','Permohonan hak ERP hanya oleh Admin',403);
   erpAssert(erpId(v.id)&&erpText(v.email,6,254)&&String(v.email).includes('@')&&erpId(v.unit_id)&&['finance_gl','finance_ap','procurement','cyber_ops','resource','hr','audit'].includes(String(v.capability)),'Identitas, unit dan capability tidak valid');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_members m JOIN india_erp_org_units u ON u.tenant_id=? AND u.id=? AND u.active=1 WHERE lower(m.email)=lower(?) AND m.active=1)",[TENANT,v.unit_id as string,v.email as string],[db.prepare('INSERT INTO india_erp_capability_grants(id,tenant_id,email,capability,unit_id,requested_by) VALUES(?,?,?,?,?,?)').bind(v.id as string,TENANT,String(v.email).toLowerCase(),v.capability as string,v.unit_id as string,email)],'access',v.id as string,'REQUEST_GRANT',{capability:v.capability,unit_id:v.unit_id});return erpReply({success:true,id:v.id},201);
  }
  if(v.action==='review_grant'){
   erpAssert(role==='approver','Hanya Approver independen dapat memutuskan grant',403);
   erpAssert(erpId(v.id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Review grant tidak valid');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_capability_grants WHERE tenant_id=? AND id=? AND version=? AND status='pending' AND lower(requested_by)!=? AND lower(email)!=?)",[TENANT,v.id as string,v.version as number,email,email],[db.prepare("UPDATE india_erp_capability_grants SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(v.approve?'approved':'rejected',email,(v.notes as string).trim(),TENANT,v.id as string)],'access',v.id as string,'REVIEW_GRANT',{approve:v.approve});return erpReply({success:true});
  }
  if(v.action==='request_project_scope'){
   erpAssert(role==='admin','Pemetaan legal entity oleh Admin',403);
   erpAssert(erpId(v.project_id)&&erpId(v.legal_entity_id),'Proyek dan legal entity wajib');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_org_units WHERE tenant_id=? AND id=? AND kind='legal_entity' AND active=1)",[TENANT,v.legal_entity_id as string],[db.prepare('INSERT INTO india_erp_project_scopes(tenant_id,project_id,legal_entity_id,requested_by) VALUES(?,?,?,?)').bind(TENANT,v.project_id as string,v.legal_entity_id as string,email)],'org',v.project_id as string,'REQUEST_PROJECT_SCOPE',{legal_entity_id:v.legal_entity_id});return erpReply({success:true});
  }
  if(v.action==='review_project_scope'){
   erpAssert(role==='approver','Review pemetaan proyek harus independen',403);
   erpAssert(erpId(v.project_id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean','Review scope tidak valid');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_project_scopes WHERE tenant_id=? AND project_id=? AND status='pending' AND version=? AND lower(requested_by)!=?)",[TENANT,v.project_id as string,v.version as number,email],[db.prepare("UPDATE india_erp_project_scopes SET status=?,version=version+1,reviewed_by=? WHERE tenant_id=? AND project_id=?").bind(v.approve?'approved':'rejected',email,TENANT,v.project_id as string)],'org',v.project_id as string,'REVIEW_PROJECT_SCOPE',{approve:v.approve});return erpReply({success:true});
  }

  if(v.action==='request_opportunity_scope'){
   erpAssert(role==='admin','Pemetaan legal entity oleh Admin',403);
   erpAssert(erpId(v.opportunity_id)&&erpId(v.legal_entity_id),'Opportunity dan legal entity wajib');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_org_units WHERE tenant_id=? AND id=? AND kind='legal_entity' AND active=1)",[TENANT,v.legal_entity_id as string],[db.prepare('INSERT INTO india_erp_opportunity_scopes(tenant_id,opportunity_id,legal_entity_id,requested_by) VALUES(?,?,?,?)').bind(TENANT,v.opportunity_id as string,v.legal_entity_id as string,email)],'org',v.opportunity_id as string,'REQUEST_OPPORTUNITY_SCOPE',{legal_entity_id:v.legal_entity_id});return erpReply({success:true});
  }
  if(v.action==='review_opportunity_scope'){
   erpAssert(role==='approver','Review pemetaan Opportunity harus independen',403);
   erpAssert(erpId(v.opportunity_id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean','Review scope tidak valid');
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_opportunity_scopes WHERE tenant_id=? AND opportunity_id=? AND status='pending' AND version=? AND lower(requested_by)!=?)",[TENANT,v.opportunity_id as string,v.version as number,email],[db.prepare("UPDATE india_erp_opportunity_scopes SET status=?,version=version+1,reviewed_by=? WHERE tenant_id=? AND opportunity_id=?").bind(v.approve?'approved':'rejected',email,TENANT,v.opportunity_id as string)],'org',v.opportunity_id as string,'REVIEW_OPPORTUNITY_SCOPE',{approve:v.approve});return erpReply({success:true});
  }
  throw new ERPError('Aksi organisasi tidak dikenal');
 }catch(e){return erpError(e);}
}
