import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpOrigin,erpPolicy,erpPeriod} from '@/lib/erp-core';
import {runPostingBatch,requeueEvent} from '@/lib/rti/posting-worker';
import {getCloudflareContext} from '@opennextjs/cloudflare';
export const dynamic='force-dynamic';

// Operations-to-Ledger control surface: queue status, exception queue, manual run, requeue and manual event intake.
// Scheduled runs authenticate with a Cloudflare Access service token at the edge plus INDIA_JOB_TOKEN (secret binding).
const MANUAL_EVENTS=new Set(['DEPRECIATION_RUN','PREPAID_AMORTIZED','PERIOD_ACCRUAL','ECL_PROVISION','ONEROUS_PROVISION','FX_REVALUATION','INTERCOMPANY_CHARGE','WHT_CERTIFICATE_RECEIVED','SLA_CREDIT_ISSUED','PROJECT_PROGRESS_RECOGNIZED','SUBSCRIPTION_PERIOD_ELAPSED','TRAINING_BATCH_COMPLETED','PARTNER_SHARE_ACCRUED']);

async function scheduledCall(req:Request):Promise<D1DB|null>{
 const token=req.headers.get('x-india-job-token');if(!token)return null;
 let env:{INDIA_DB?:D1DB;INDIA_JOB_TOKEN?:string};
 try{env=(await getCloudflareContext({async:true})).env as typeof env;}catch{return null;}
 const expected=env.INDIA_JOB_TOKEN;if(!env.INDIA_DB||!expected||expected.length<32||token.length!==expected.length)return null;
 let diff=0;for(let i=0;i<token.length;i++)diff|=token.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0?env.INDIA_DB:null;
}

export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role}=a.identity;
 try{
  erpAssert(['finance','approver','admin'].includes(role),'Antrean posting hanya Finance/Approver/Admin',403);
  const entity=new URL(req.url).searchParams.get('legal_entity_id');
  erpAssert(!entity||erpId(entity),'Legal entity tidak valid');
  await erpPolicy(a.identity,'fin.journal.view',null,entity?{legal_entity_id:entity}:undefined);
  const f=entity?' AND legal_entity_id=?':'',args=entity?[TENANT,entity]:[TENANT];
  const [summary,exceptions,runs]=await Promise.all([
   db.prepare('SELECT status,count(*) n FROM india_accounting_events WHERE tenant_id=?'+f+' GROUP BY status').bind(...args).all(),
   db.prepare("SELECT id,event_type,legal_entity_id,period,source_type,source_id,error_code,attempts,created_at FROM india_accounting_events WHERE tenant_id=? AND status='exception'"+f+' ORDER BY created_at DESC LIMIT 100').bind(...args).all(),
   db.prepare('SELECT id,trigger,actor,started_at,finished_at,picked,posted,exceptions FROM india_posting_worker_runs WHERE tenant_id=? ORDER BY started_at DESC LIMIT 20').bind(TENANT).all()]);
  return erpReply({success:true,summary:summary.results,exceptions:exceptions.results,runs:runs.results,posting_mode:'rule_based_outbox'});
 }catch(e){return erpError(e);}
}

export async function POST(req:Request){
 const jobDb=await scheduledCall(req);
 if(jobDb){
  try{const r=await runPostingBatch(jobDb,TENANT,{trigger:'schedule',actor:'system:schedule'});return Response.json({success:true,...r},{headers:privateHeaders});}
  catch(e){return erpError(e);}
 }
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 try{
  erpOrigin(req);
  const v=await readBoundedJSON(req,16000) as Record<string,unknown>;
  if(v.action==='run'){
   erpAssert(role==='finance','Menjalankan posting hanya Finance',403);
   erpAssert(v.legal_entity_id===undefined||erpId(v.legal_entity_id),'Legal entity tidak valid');
   await erpPolicy(a.identity,'fin.journal.post',null,v.legal_entity_id?{legal_entity_id:v.legal_entity_id as string}:undefined);
   const r=await runPostingBatch(db,TENANT,{trigger:'manual',actor:email,legalEntityId:v.legal_entity_id as string|undefined,limit:Number.isSafeInteger(v.limit)?v.limit as number:undefined});
   return erpReply({success:true,...r});
  }
  if(v.action==='requeue'){
   erpAssert(role==='finance','Requeue hanya Finance',403);erpAssert(erpId(v.event_id),'Event wajib');
   await erpPolicy(a.identity,'fin.journal.post');
   erpAssert(await requeueEvent(db,TENANT,v.event_id as string),'Event bukan exception',409);
   return erpReply({success:true});
  }
  if(v.action==='enqueue'){
   erpAssert(role==='finance','Event akuntansi manual hanya Finance',403);
   const type=String(v.event_type||'');erpAssert(MANUAL_EVENTS.has(type),'Jenis event tidak diizinkan untuk input manual');
   erpAssert(erpId(v.legal_entity_id)&&erpPeriod(v.period)&&typeof v.source_id==='string'&&v.source_id.length>=3&&v.source_id.length<=120,'Entity, periode dan dokumen sumber wajib');
   const amounts=v.amounts as Record<string,unknown>,dims=(v.dimensions||{}) as Record<string,unknown>;
   erpAssert(amounts&&typeof amounts==='object'&&Object.values(amounts).every(x=>Number.isSafeInteger(x)&&(x as number)>=0)&&Object.keys(amounts).length<=12,'Nominal harus integer sen non-negatif');
   erpAssert(typeof dims==='object'&&Object.values(dims).every(x=>typeof x==='string'&&x.length<=120),'Dimensi tidak valid');
   await erpPolicy(a.identity,'fin.journal.create',null,{legal_entity_id:v.legal_entity_id as string});
   const id=crypto.randomUUID(),key='manual:'+type+':'+(v.source_id as string);
   await db.prepare('INSERT INTO india_accounting_events(tenant_id,id,event_type,legal_entity_id,period,occurred_on,currency,amounts_json,dimensions_json,source_type,source_id,idempotency_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(TENANT,id,type,v.legal_entity_id as string,v.period as string,(v.period as string)+'-01','IDR',JSON.stringify(amounts),JSON.stringify({...dims,entered_by:email}),'manual_event',v.source_id as string,key).run();
   return erpReply({success:true,id},201);
  }
  throw new ERPError('Aksi posting tidak tersedia');
 }catch(e){return erpError(e);}
}
