import {getCloudflareContext} from '@opennextjs/cloudflare';
import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom} from '@/lib/erp-core';
export const dynamic='force-dynamic';
type Connector={id:string;kind:'siem'|'edr';endpoint:string;status:string;version:number;legal_entity_id:string;created_by:string};
type Delivery={id:string;case_id:string;connector_id:string;status:string;attempts:number;last_attempt_at:string|null;legal_entity_id:string;kind:'siem'|'edr';endpoint:string;project_id:string;external_ref:string;severity:string;case_kind:string;case_status:string;evidence_document_id:string};
function safeDestination(raw:string,allowed:string){
 let u:URL;try{u=new URL(raw);}catch{throw new ERPError('Invalid connector URL');}
 const hosts=allowed.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 erpAssert(u.protocol==='https:'&&!u.username&&!u.password&&u.port===''&&!u.hash&&hosts.includes(u.hostname.toLowerCase()),'Endpoint harus hostname HTTPS dalam egress allowlist',403);
 return u.toString();
}
async function outbound(kind:'siem'|'edr',endpoint:string){
 const env=(await getCloudflareContext({async:true})).env as Record<string,unknown>;
 const allowed=String(env.INDIA_SECURITY_ALLOWED_HOSTS||'');
 const url=safeDestination(endpoint,allowed);
 const token=env[kind==='siem'?'INDIA_SIEM_OUTBOUND_TOKEN':'INDIA_EDR_OUTBOUND_TOKEN'];
 erpAssert(typeof token==='string'&&token.length>=24,'Security outbound secret belum disediakan',503);
 return {url,token};
}
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 try{
  const a=auth.identity,legal=new URL(req.url).searchParams.get('legal_entity_id');
  erpAssert(erpId(legal),'Legal entity wajib');await erpGrant(a,'cyber_ops',legal);
  const [connectors,dispatches]=await Promise.all([
   a.db.prepare('SELECT id,name,kind,status,version,created_by,reviewed_by FROM india_security_connectors WHERE tenant_id=? AND legal_entity_id=? LIMIT 100').bind(TENANT,legal).all(),
   a.db.prepare('SELECT d.id,d.case_id,d.connector_id,d.status,d.attempts,d.last_http_code,d.last_attempt_at FROM india_security_dispatches d JOIN india_security_connectors c ON c.id=d.connector_id AND c.tenant_id=d.tenant_id WHERE d.tenant_id=? AND c.legal_entity_id=? ORDER BY d.created_at DESC LIMIT 150').bind(TENANT,legal).all()
  ]);
  return erpReply({success:true,connectors:connectors.results,dispatches:dispatches.results,live_connection_verified:false});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const a=auth.identity,{db,email,role}=a;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,7000) as Record<string,unknown>;
  if(v.action==='register'){
   erpAssert(role==='admin'&&erpId(v.legal_entity_id)&&erpText(v.name,3,120)&&['siem','edr'].includes(String(v.kind))&&erpText(v.endpoint,12,500),'Konfigurasi connector tidak valid',403);
   await erpGrant(a,'cyber_ops',v.legal_entity_id as string);
   const {url}=await outbound(v.kind as 'siem'|'edr',v.endpoint as string);
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_security_connectors(id,tenant_id,legal_entity_id,name,kind,endpoint,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.name as string,v.kind as string,url,email)],'cyber',id,'CONNECTOR_REGISTER',{kind:v.kind});return erpReply({success:true,id},201);
  }
  if(v.action==='enable'){
   erpAssert(role==='approver'&&erpId(v.id)&&Number.isSafeInteger(v.version)&&erpText(v.notes,12,800),'Aktivasi konektor memerlukan Approver',403);
   const connector=await db.prepare('SELECT * FROM india_security_connectors WHERE tenant_id=? AND id=?').bind(TENANT,v.id as string).first<Connector>();
   erpAssert(connector&&connector.status==='disabled'&&connector.version===v.version&&connector.created_by.toLowerCase()!==email,'Connector sudah berubah atau self approval',409);
   await erpGrant(a,'cyber_ops',connector.legal_entity_id);await outbound(connector.kind,connector.endpoint);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_security_connectors WHERE tenant_id=? AND id=? AND status='disabled' AND version=? AND lower(created_by)!=?)",[TENANT,connector.id,connector.version,email],[db.prepare("UPDATE india_security_connectors SET status='enabled',version=version+1,reviewed_by=?,review_notes=? WHERE tenant_id=? AND id=?").bind(email,v.notes as string,TENANT,connector.id)],'cyber',connector.id,'CONNECTOR_ENABLE',{});return erpReply({success:true});
  }
  if(v.action==='queue'){
   erpAssert(['admin','presales'].includes(role)&&erpId(v.connector_id)&&erpId(v.case_id),'Case dan connector harus valid',403);
   const connector=await db.prepare('SELECT * FROM india_security_connectors WHERE tenant_id=? AND id=? AND status=\'enabled\'').bind(TENANT,v.connector_id as string).first<Connector>();
   erpAssert(connector,'Connector belum disetujui',409);await erpGrant(a,'cyber_ops',connector.legal_entity_id);
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_security_dispatches(id,tenant_id,connector_id,case_id,requested_by) VALUES(?,?,?,?,?)').bind(id,TENANT,connector.id,v.case_id as string,email)],'cyber',id,'DISPATCH_QUEUE',{connector_id:connector.id,case_id:v.case_id});return erpReply({success:true,id},201);
  }
  if(v.action==='send'){
   erpAssert(['admin','presales'].includes(role)&&erpId(v.id),'Dispatch hanya operator terotorisasi',403);
   const d=await db.prepare("SELECT d.*,k.kind,k.endpoint,k.legal_entity_id,c.project_id,c.kind AS case_kind,c.external_ref,c.severity,c.status AS case_status,c.evidence_document_id FROM india_security_dispatches d JOIN india_security_connectors k ON k.id=d.connector_id AND k.tenant_id=d.tenant_id JOIN india_cyber_cases c ON c.id=d.case_id AND c.tenant_id=d.tenant_id WHERE d.tenant_id=? AND d.id=? AND k.status='enabled'").bind(TENANT,v.id as string).first<Delivery>();
   erpAssert(d&&['pending','retryable','sending'].includes(d.status)&&d.attempts<5,'Dispatch tidak tersedia atau batas retry tercapai',409);
   await erpGrant(a,'cyber_ops',d.legal_entity_id);
   const {url,token}=await outbound(d.kind,d.endpoint);
   // Claim before egress. Failed or concurrent claims are denied by an atomic CAS guard.
   const claim="EXISTS(SELECT 1 FROM india_security_dispatches WHERE tenant_id=? AND id=? AND attempts=? AND (status IN ('pending','retryable') OR (status='sending' AND last_attempt_at<=datetime('now','-15 minutes'))))";
   await erpAtom(a,claim,[TENANT,d.id,d.attempts],[db.prepare("UPDATE india_security_dispatches SET status='sending',attempts=attempts+1,last_attempt_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(TENANT,d.id)],'cyber',d.id,'DISPATCH_CLAIM',{attempt:d.attempts+1});
   const payload={schema:'india.cyber.case.v1',case_id:d.case_id,project_id:d.project_id,case_type:d.case_kind,external_ref:d.external_ref,severity:d.severity,status:d.case_status,evidence_document_id:d.evidence_document_id};
   let code=0;
   try{
    const resp=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','Idempotency-Key':d.id},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(10000)});
    code=resp.status;
   }catch{code=0;}
   const status=code>=200&&code<300?'delivered':(d.attempts+1>=5?'rejected':'retryable');
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_security_dispatches WHERE tenant_id=? AND id=? AND status='sending' AND attempts=?)",[TENANT,d.id,d.attempts+1],[db.prepare("UPDATE india_security_dispatches SET status=?,last_http_code=?,delivered_at=CASE WHEN ?='delivered' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE tenant_id=? AND id=?").bind(status,code||null,status,TENANT,d.id)],'cyber',d.id,'DISPATCH_RESULT',{status,http_code:code});
   return erpReply({success:true,status,http_code:code,verified_delivery:status==='delivered'});
  }
  throw new ERPError('Aksi SIEM/EDR tidak tersedia');
 }catch(e){return erpError(e);}
}
