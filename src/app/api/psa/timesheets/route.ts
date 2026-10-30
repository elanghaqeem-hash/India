import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,jakartaDate} from '@/lib/operations';

export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const reviewers=['finance','approver'];
const roles=['admin','presales',...reviewers];
const iso=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const error=(e:unknown)=>/CONFLICT|constraint|IMMUTABLE|FOREIGN KEY/i.test(String(e))?fail('Timesheet berubah atau melebihi alokasi. Muat ulang.',409):fail('Timesheet belum tersedia; periksa migrasi 0033.',503);

type Row={id:string;tenant_id:string;project_id:string;person_id:string;allocation_id:string;work_date:string;minutes:number;billable:number;description:string;status:string;version:number;created_by:string;reviewed_by:string|null;review_notes:string|null;cost_snapshot_cents:number};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,email,role}=a.identity;if(!roles.includes(role))return fail('Akses timesheet ditolak',403);
 try{
  const u=new URL(req.url),id=u.searchParams.get('project_id');
  const privileged=reviewers.includes(role);
  const projects=await db.prepare(`SELECT p.id,p.title,p.status,p.start_date,p.end_date FROM india_delivery_projects p
   WHERE p.tenant_id=? AND (${privileged?'1=1':'EXISTS(SELECT 1 FROM india_resource_allocations x JOIN india_resource_people r ON r.id=x.person_id AND r.tenant_id=x.tenant_id WHERE x.tenant_id=p.tenant_id AND x.opportunity_id=p.opportunity_id AND x.status=\'active\' AND lower(r.email)=?)'}) ORDER BY p.created_at DESC LIMIT 100`).bind(TENANT,...(privileged?[]:[email])).all();
  if(!id)return reply({success:true,reviewer:privileged,projects:projects.results,items:[],allocations:[]});
  if(!safeID(id)||!projects.results.some(p=>p.id===id))return fail('Proyek tidak tersedia untuk akun ini',404);
  const [entries,allocations]=await Promise.all([
   db.prepare(`SELECT t.id,t.project_id,t.work_date,t.minutes,t.billable,t.description,t.status,t.version,t.created_by,t.reviewed_by,t.review_notes,${privileged?'t.cost_snapshot_cents':'0 AS cost_snapshot_cents'} FROM india_project_timesheets t WHERE t.tenant_id=? AND t.project_id=? ${privileged?'':'AND lower(t.created_by)=?'} ORDER BY t.work_date DESC,t.created_at DESC LIMIT 500`).bind(TENANT,id,...(privileged?[]:[email])).all<Row>(),
   db.prepare("SELECT x.id,x.allocation_month,x.person_days,r.display_name FROM india_resource_allocations x JOIN india_resource_people r ON r.id=x.person_id AND r.tenant_id=x.tenant_id JOIN india_delivery_projects p ON p.opportunity_id=x.opportunity_id AND p.tenant_id=x.tenant_id WHERE p.tenant_id=? AND p.id=? AND x.status='active' AND lower(r.email)=? ORDER BY x.allocation_month").bind(TENANT,id,email).all()
  ]);
  return reply({success:true,reviewer:privileged,projects:projects.results,items:entries.results,allocations:allocations.results});
 }catch(e){return error(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,email,role}=a.identity;if(!roles.includes(role))return fail('Akses timesheet ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let v:Record<string,unknown>;try{v=await readBoundedJSON(req,5000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 try{
  if(v.action==='submit'){
   if(!safeID(v.project_id)||!safeID(v.allocation_id)||!iso(v.work_date)||typeof v.minutes!=='number'||!Number.isInteger(v.minutes)||v.minutes<15||v.minutes>480||v.minutes%15||typeof v.billable!=='boolean'||typeof v.description!=='string'||v.description.trim().length<12||v.description.length>1000)return fail('Proyek, alokasi, tanggal, jam kerja dan deskripsi wajib valid');
   const projectId=v.project_id as string,allocationId=v.allocation_id as string,workDate=v.work_date as string,minutes=v.minutes as number,description=(v.description as string).trim();
   if(workDate>jakartaDate())return fail('Tanggal kerja tidak boleh di masa depan');
   const id=crypto.randomUUID();
   await atomicSales(db,`EXISTS(SELECT 1 FROM india_delivery_projects p JOIN india_resource_allocations x ON x.tenant_id=p.tenant_id AND x.opportunity_id=p.opportunity_id AND x.id=? JOIN india_resource_people r ON r.id=x.person_id AND r.tenant_id=x.tenant_id WHERE p.tenant_id=? AND p.id=? AND p.status='active' AND x.status='active' AND r.active=1 AND lower(r.email)=? AND substr(?,1,7)=x.allocation_month AND ? BETWEEN p.start_date AND p.end_date)`,[allocationId,TENANT,projectId,email,workDate,workDate],[
    db.prepare('INSERT INTO india_project_timesheets(id,tenant_id,project_id,person_id,allocation_id,work_date,minutes,billable,description,cost_snapshot_cents,created_by) SELECT ?,p.tenant_id,p.id,x.person_id,x.id,?,?,?,?,round(x.daily_cost_snapshot*100),? FROM india_delivery_projects p JOIN india_resource_allocations x ON x.tenant_id=p.tenant_id AND x.opportunity_id=p.opportunity_id WHERE p.tenant_id=? AND p.id=? AND x.id=?').bind(id,workDate,minutes,v.billable?1:0,description,email,TENANT,projectId,allocationId),
    operationEvent(db,'timesheet',id,'SUBMIT',email,{project_id:projectId,work_date:workDate,minutes})
   ]);return reply({success:true,id},201);
  }
  if(v.action==='review'){
   if(!reviewers.includes(role))return fail('Review hanya untuk Finance atau Approver',403);
   if(!safeID(v.id)||!Number.isInteger(v.version)||typeof v.approve!=='boolean'||typeof v.notes!=='string'||v.notes.trim().length<12||v.notes.length>1000)return fail('ID, versi, keputusan dan alasan review wajib valid');
   const row=await db.prepare('SELECT * FROM india_project_timesheets WHERE tenant_id=? AND id=?').bind(TENANT,v.id).first<Row>();
   if(!row)return fail('Timesheet tidak ditemukan',404);
   if(row.created_by.toLowerCase()===email)return fail('Maker tidak boleh menyetujui sendiri',403);
   if(row.status!=='submitted'||row.version!==v.version)return fail('Versi/status timesheet berubah',409);
   await atomicSales(db,"EXISTS(SELECT 1 FROM india_project_timesheets WHERE tenant_id=? AND id=? AND version=? AND status='submitted' AND lower(created_by)!=?)",[TENANT,row.id,row.version,email],[
    db.prepare('UPDATE india_project_timesheets SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes.trim(),TENANT,row.id),
    operationEvent(db,'timesheet',row.id,v.approve?'APPROVE':'REJECT',email,{version:row.version,notes:v.notes.trim()})
   ]);return reply({success:true});
  }
  return fail('Aksi tidak dikenal');
 }catch(e){return error(e);}
}
