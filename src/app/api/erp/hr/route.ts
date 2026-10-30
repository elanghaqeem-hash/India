import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom,erpDate} from '@/lib/erp-core';
export const dynamic='force-dynamic';
type Emp={email:string;status:string;version:number;created_by:string};
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 try{
  const a=auth.identity,legal=new URL(req.url).searchParams.get('legal_entity_id');
  erpAssert(erpId(legal),'Legal entity wajib');
  await erpGrant(a,'hr',legal);
  const [people,policies,leave,skills,assets]=await Promise.all([
   a.db.prepare("SELECT e.email,e.employment_type,e.start_date,e.end_date,e.status,e.version,s.position_title,s.unit_id FROM india_hr_employees e JOIN india_erp_staff_org s ON s.tenant_id=e.tenant_id AND s.email=e.email AND s.status='approved' WHERE e.tenant_id=? ORDER BY e.email LIMIT 200").bind(TENANT).all(),
   a.db.prepare("SELECT id,leave_type,calendar_year,days_entitlement,status FROM india_hr_leave_policies WHERE tenant_id=? AND legal_entity_id=?").bind(TENANT,legal).all(),
   a.db.prepare("SELECT l.id,l.email,l.policy_id,l.from_date,l.to_date,l.business_days,l.status,l.version FROM india_hr_leave_requests l JOIN india_hr_leave_policies p ON p.id=l.policy_id AND p.tenant_id=l.tenant_id WHERE l.tenant_id=? AND p.legal_entity_id=? ORDER BY l.from_date DESC LIMIT 200").bind(TENANT,legal).all(),
   a.db.prepare('SELECT id,email,skill,level,expires_at FROM india_hr_skills WHERE tenant_id=? LIMIT 250').bind(TENANT).all(),
   a.db.prepare('SELECT id,tag,category,model,status,assigned_to FROM india_hr_assets WHERE tenant_id=? AND legal_entity_id=? LIMIT 250').bind(TENANT,legal).all()
  ]);
  return erpReply({success:true,people:people.results,policies:policies.results,leave:leave.results,skills:skills.results,assets:assets.results,sensitive_payroll_enabled:false});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const a=auth.identity,{db,email,role}=a;
 try{
  erpOrigin(req);const v=await readBoundedJSON(req,9500) as Record<string,unknown>;
  if(v.action==='onboard'){
   erpAssert(role==='admin'&&erpText(v.email,6,254)&&String(v.email).includes('@')&&erpDate(v.start_date)&&['permanent','contract','intern','external'].includes(String(v.employment_type)),'Employee harus member aktif, tipe dan tanggal valid',403);
   const staff=await db.prepare("SELECT s.unit_id FROM india_erp_staff_org s WHERE s.tenant_id=? AND lower(s.email)=lower(?) AND s.status='approved'").bind(TENANT,v.email as string).first<{unit_id:string}>();
   erpAssert(staff,'Penempatan organisasi staff harus disetujui',409);await erpGrant(a,'hr',staff.unit_id);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_members WHERE lower(email)=lower(?) AND active=1)",[v.email as string],[db.prepare('INSERT INTO india_hr_employees(tenant_id,email,employment_type,start_date,created_by) VALUES(?,?,?,?,?)').bind(TENANT,String(v.email).toLowerCase(),v.employment_type as string,v.start_date as string,email)],'hr',v.email as string,'ONBOARD_REQUEST',{employment_type:v.employment_type});return erpReply({success:true},201);
  }
  if(v.action==='activate'||v.action==='offboard'){
   erpAssert(role==='approver'&&erpText(v.email,6,254)&&Number.isSafeInteger(v.version)&&erpText(v.reason,12,800),'Employee lifecycle membutuhkan approver dan alasan',403);
   const emp=await db.prepare('SELECT email,status,version,created_by FROM india_hr_employees WHERE tenant_id=? AND lower(email)=lower(?)').bind(TENANT,v.email as string).first<Emp>();
   erpAssert(emp&&emp.version===v.version&&emp.status===(v.action==='activate'?'onboarding':'active')&&emp.created_by.toLowerCase()!==email&&emp.email.toLowerCase()!==email,'Review lifecycle ditolak',409);
   const staff=await db.prepare("SELECT unit_id FROM india_erp_staff_org WHERE tenant_id=? AND lower(email)=lower(?) AND status='approved'").bind(TENANT,emp.email).first<{unit_id:string}>();
   erpAssert(staff,'Staff scope belum disahkan',409);await erpGrant(a,'hr',staff.unit_id);
   if(v.action==='offboard'){
    erpAssert(erpDate(v.end_date),'Tanggal offboard tidak valid');
    const open=await db.prepare("SELECT count(*) n FROM india_hr_assets WHERE tenant_id=? AND lower(assigned_to)=lower(?) AND status='assigned'").bind(TENANT,emp.email).first<{n:number}>();
    erpAssert(open?.n===0,'Aset harus dikembalikan sebelum offboarding',409);
   }
   const status=v.action==='activate'?'active':'offboarded';
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_hr_employees WHERE tenant_id=? AND lower(email)=lower(?) AND status=? AND version=?)",[TENANT,emp.email,emp.status,emp.version],[db.prepare('UPDATE india_hr_employees SET status=?,version=version+1,approved_by=?,reason=?,end_date=? WHERE tenant_id=? AND lower(email)=lower(?)').bind(status,email,v.reason as string,v.action==='offboard'?v.end_date as string:null,TENANT,emp.email)],'hr',emp.email,'EMPLOYEE_'+status.toUpperCase(),{});return erpReply({success:true});
  }
  if(v.action==='leave_policy'){
   erpAssert(role==='admin'&&erpId(v.legal_entity_id)&&['annual','sick','unpaid','special'].includes(String(v.leave_type))&&Number.isSafeInteger(v.calendar_year)&&Number(v.calendar_year)>=2020&&Number(v.calendar_year)<=2150&&Number.isSafeInteger(v.days_entitlement)&&Number(v.days_entitlement)>=0,'Kebijakan leave tidak valid',403);
   await erpGrant(a,'hr',v.legal_entity_id as string);const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_hr_leave_policies(id,tenant_id,legal_entity_id,leave_type,calendar_year,days_entitlement,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.leave_type as string,v.calendar_year as number,v.days_entitlement as number,email)],'hr',id,'LEAVE_POLICY_DRAFT',{leave_type:v.leave_type});return erpReply({success:true,id},201);
  }
  if(v.action==='approve_policy'){
   erpAssert(role==='approver'&&erpId(v.id),'Review leave policy perlu approver',403);
   const p=await db.prepare("SELECT legal_entity_id,status,created_by FROM india_hr_leave_policies WHERE tenant_id=? AND id=?").bind(TENANT,v.id as string).first<{legal_entity_id:string;status:string;created_by:string}>();
   erpAssert(p&&p.status==='draft'&&p.created_by.toLowerCase()!==email,'Self approval policy ditolak',409);
   await erpGrant(a,'hr',p.legal_entity_id);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_hr_leave_policies WHERE tenant_id=? AND id=? AND status='draft' AND lower(created_by)!=?)",[TENANT,v.id as string,email],[db.prepare("UPDATE india_hr_leave_policies SET status='approved',approved_by=? WHERE tenant_id=? AND id=?").bind(email,TENANT,v.id as string)],'hr',v.id as string,'LEAVE_POLICY_APPROVE',{});return erpReply({success:true});
  }
  if(v.action==='leave_request'){
   erpAssert(erpId(v.policy_id)&&erpDate(v.from_date)&&erpDate(v.to_date)&&String(v.from_date)<=String(v.to_date),'Leave dates atau policy tidak valid');
   const days=Math.round((Date.parse(v.to_date as string)-Date.parse(v.from_date as string))/86400000)+1;
   erpAssert(days>0&&days<=365,'Rentang cuti maksimal 365 hari');
   const emp=await db.prepare("SELECT status FROM india_hr_employees WHERE tenant_id=? AND email=?").bind(TENANT,email).first<{status:string}>();
   erpAssert(emp?.status==='active','Pemohon belum aktif',403);
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_hr_leave_requests(id,tenant_id,email,policy_id,from_date,to_date,business_days,created_by,notes) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,email,v.policy_id as string,v.from_date as string,v.to_date as string,days,email,String(v.notes||'').slice(0,800))],'hr',id,'LEAVE_REQUEST',{policy_id:v.policy_id,days});return erpReply({success:true,id},201);
  }
  if(v.action==='review_leave'){
   erpAssert(role==='approver'&&erpId(v.id)&&Number.isSafeInteger(v.version)&&typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Review leave wajib terpisah',403);
   const leave=await db.prepare("SELECT l.email,l.status,l.version,p.legal_entity_id FROM india_hr_leave_requests l JOIN india_hr_leave_policies p ON p.id=l.policy_id AND p.tenant_id=l.tenant_id WHERE l.id=? AND l.tenant_id=?").bind(v.id as string,TENANT).first<{email:string;status:string;version:number;legal_entity_id:string}>();
   erpAssert(leave&&leave.status==='draft'&&leave.version===v.version&&leave.email.toLowerCase()!==email,'Review cuti tidak valid',409);
   await erpGrant(a,'hr',leave.legal_entity_id);
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_hr_leave_requests WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(email)!=?)",[TENANT,v.id as string,v.version as number,email],[db.prepare('UPDATE india_hr_leave_requests SET status=?,version=version+1,reviewed_by=?,review_notes=? WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,v.id as string)],'hr',v.id as string,'LEAVE_REVIEW',{approved:v.approve});return erpReply({success:true});
  }

  if(v.action==='skill'){
   erpAssert(role==='admin'&&erpText(v.email,6,254)&&erpText(v.skill,3,120)&&['foundation','intermediate','advanced','expert'].includes(String(v.level)),'Data kompetensi atau sertifikasi tidak valid',403);
   const unit=await db.prepare("SELECT unit_id FROM india_erp_staff_org WHERE tenant_id=? AND lower(email)=lower(?) AND status='approved'").bind(TENANT,v.email as string).first<{unit_id:string}>();
   erpAssert(unit,'Staff belum memiliki unit',409);await erpGrant(a,'hr',unit.unit_id);
   erpAssert(v.expires_at===undefined||erpDate(v.expires_at),'Tanggal kedaluwarsa tidak valid');
   const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_hr_skills(id,tenant_id,email,skill,level,evidence_document_id,expires_at,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,TENANT,String(v.email).toLowerCase(),(v.skill as string).trim(),v.level as string,erpId(v.document_id)?v.document_id:null,v.expires_at as string||null,email)],'hr',id,'SKILL_RECORD',{employee:v.email,skill:v.skill,level:v.level});return erpReply({success:true,id},201);
  }
  if(v.action==='asset_register'){
   erpAssert(role==='admin'&&erpId(v.legal_entity_id)&&erpText(v.tag,3,80)&&erpText(v.model,3,120)&&['laptop','mobile','security_token','equipment','license'].includes(String(v.category)),'Inventaris aset harus memiliki tag dan kategori valid',403);
   await erpGrant(a,'hr',v.legal_entity_id as string);const id=crypto.randomUUID();
   await erpAtom(a,'1=1',[],[db.prepare('INSERT INTO india_hr_assets(id,tenant_id,legal_entity_id,tag,category,model,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.tag as string,v.category as string,v.model as string,email)],'hr',id,'ASSET_REGISTER',{tag:v.tag,category:v.category});return erpReply({success:true,id},201);
  }
  if(v.action==='asset_assign'||v.action==='asset_return'||v.action==='asset_retire'){
   erpAssert(role==='admin'&&erpId(v.id),'Aset harus valid',403);
   const asset=await db.prepare('SELECT id,status,assigned_to,legal_entity_id FROM india_hr_assets WHERE tenant_id=? AND id=?').bind(TENANT,v.id as string).first<{id:string;status:string;assigned_to:string|null;legal_entity_id:string}>();
   erpAssert(asset,'Aset tidak ditemukan',404);await erpGrant(a,'hr',asset.legal_entity_id);
   const assign=v.action==='asset_assign',retire=v.action==='asset_retire';
   erpAssert(assign?asset.status==='available':asset.status===(retire?'available':'assigned'),'Status aset tidak sesuai',409);
   if(assign){
    erpAssert(erpText(v.email,6,254),'Email penerima wajib');
    const target=await db.prepare("SELECT e.email FROM india_hr_employees e JOIN india_erp_staff_org s ON s.email=e.email AND s.tenant_id=e.tenant_id AND s.status='approved' WHERE e.tenant_id=? AND lower(e.email)=lower(?) AND e.status='active' AND EXISTS(WITH RECURSIVE nodes(id,parent_id) AS (SELECT id,parent_id FROM india_erp_org_units WHERE tenant_id=? AND id=s.unit_id UNION ALL SELECT p.id,p.parent_id FROM india_erp_org_units p JOIN nodes n ON n.parent_id=p.id WHERE p.tenant_id=?) SELECT 1 FROM nodes WHERE id=?)").bind(TENANT,v.email as string,TENANT,TENANT,asset.legal_entity_id).first();
    erpAssert(target,'Penerima belum aktif atau di legal entity lain',409);
   }
   const newStatus=assign?'assigned':retire?'retired':'available',assigned=assign?String(v.email).toLowerCase():null;
   const id=crypto.randomUUID();
   await erpAtom(a,"EXISTS(SELECT 1 FROM india_hr_assets WHERE tenant_id=? AND id=? AND status=? AND assigned_to IS ?)",[TENANT,asset.id,asset.status,asset.assigned_to],[db.prepare('INSERT INTO india_hr_asset_events(id,tenant_id,asset_id,action,employee_email,created_by) VALUES(?,?,?,?,?,?)').bind(id,TENANT,asset.id,assign?'assign':retire?'retire':'return',assign?assigned:asset.assigned_to,email),
    db.prepare('UPDATE india_hr_assets SET status=?,assigned_to=? WHERE tenant_id=? AND id=?').bind(newStatus,assigned,TENANT,asset.id)],'hr',asset.id,'ASSET_'+newStatus.toUpperCase(),{event_id:id});return erpReply({success:true});
  }
  throw new ERPError('Aksi HR belum tersedia');
 }catch(e){return erpError(e);}
}
