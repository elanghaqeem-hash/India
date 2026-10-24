#!/usr/bin/env node
/**
 * Fail-closed, READ-ONLY control-plane preflight for a dedicated INDIA release UAT Worker.
 * No write endpoints, no secret values or email addresses in stdout.
 * This only certifies cloud configuration and SQL schema; no signed human UAT.
 */
const ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
const CLONE='5b9b58de-be29-48bb-9023-018c7f15f68b';
const PRODUCTION='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const LEGACY_UAT='eaed652e-7322-4950-a304-dd50baa5de02';
const MANDATORY_ROLES={admin:1,sales:2,presales:1,finance:1,approver:1,legal:1};
const env=process.env;
function check(value,message){if(!value)throw Error(message);}
function validate(){
 check(process.argv[2]==='--preflight','Only read-only --preflight is supported');
 check(env.INDIA_GATE_WORKER_NAME && /^uat-india-[a-z0-9-]{3,50}$/.test(env.INDIA_GATE_WORKER_NAME),
   'A dedicated uat-india-* Worker is required, not shared uat-india');
 check(env.INDIA_GATE_D1_ID===CLONE&&env.INDIA_GATE_D1_ID!==PRODUCTION&&env.INDIA_GATE_D1_ID!==LEGACY_UAT,
   'D1 must be the isolated restored candidate, never production/shared UAT');
 check(/^[0-9a-f]{40}$/.test(env.INDIA_GATE_SHA||''),'Pinned candidate commit SHA required');
 check(/^[0-9a-f-]{36}$/.test(env.INDIA_GATE_ACCESS_APP_ID||''),'Dedicated Access app ID required');
 check(env.INDIA_GATE_TOKEN,'Cloudflare READ ONLY token required');
}
async function api(path,method='GET',body){
 const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path;
 const res=await fetch(url,{method,headers:{'Authorization':'Bearer '+env.INDIA_GATE_TOKEN,
  'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,
  redirect:'error',signal:AbortSignal.timeout(18000)});
 const out=await res.json();
 check(res.ok&&out.success===true,'Cloudflare read-only API failed (HTTP '+res.status+')');
 return out.result;
}
async function query(sql,params=[]){
 check(/^\s*(?:SELECT|PRAGMA quick_check|PRAGMA foreign_key_check)\b/i.test(sql)&&
  !/;\s*\S/.test(sql),'Only one read-only SQL statement is permitted');
 const result=await api('/d1/database/'+CLONE+'/query','POST',{sql,params});
 check(result.length===1&&result[0].success,'Isolated D1 read-only query failed');
 return result[0].results||[];
}
function binding(list,name){
 const matches=list.filter(x=>x.name===name);
 check(matches.length===1,'Worker binding '+name+' missing/duplicated');
 return matches[0];
}
async function run(){
 validate();
 const worker=await api('/workers/scripts/'+env.INDIA_GATE_WORKER_NAME+'/settings');
 const db=binding(worker.bindings||[],'INDIA_DB');
 check((db.id||db.database_id)===CLONE,'Worker is not bound to isolated D1 clone');
 const access=await api('/access/apps/'+env.INDIA_GATE_ACCESS_APP_ID);
 check(access.name&&String(access.domain||'').startsWith(env.INDIA_GATE_WORKER_NAME+'.'),
  'Dedicated Access app hostname mismatch');
 check(binding(worker.bindings,'INDIA_ACCESS_AUD').text===access.aud,'JWT audience mismatch');
 check(binding(worker.bindings,'INDIA_ACCESS_TEAM_DOMAIN').text?.endsWith('.cloudflareaccess.com'),
  'Access issuer is missing or invalid');
 check(binding(worker.bindings,'INDIA_RELEASE_SHA').text===env.INDIA_GATE_SHA,
  'Deployed release SHA does not match candidate');
 check(binding(worker.bindings,'INDIA_AI_ENCRYPTION_KEY').type==='secret_text',
  'AI AES-256 encryption key binding missing');
 check(binding(worker.bindings,'INDIA_DOCUMENT_ENCRYPTION_KEY').type==='secret_text',
  'Document Vault encryption key binding missing');
 const ledger=await query('SELECT version FROM india_schema_migrations ORDER BY version');
 const applied=new Set(ledger.map(x=>Number(x.version)));
 for(let v=13;v<=28;v++)check(applied.has(v),'Canonical D1 migration '+v+' absent');
 const manifests=await query("SELECT path FROM india_schema_file_manifest WHERE path LIKE 'migrations/002%'");
 const canon=['0021_tender_bid_readiness','0022_document_vault_governance',
  '0023_tender_vault_integrity','0024_executive_sales_targets',
  '0025_vendor_resource_feasibility','0026_partner_reporting_administration',
  '0027_customer_delivery_cash_renewal','0028_ai_mistral_provider'];
 const expected=new Set(canon.map(x=>'migrations/'+x+'.sql'));
 for(const p of expected)check(manifests.some(x=>x.path===p),'Canonical SQL manifest missing');
 for(const row of manifests){const n=/^migrations\/(002[1-8])_/.exec(row.path);
  if(n)check(expected.has(row.path),'Noncanonical SQL path collision');}
 const quick=await query('PRAGMA quick_check');
 check(quick[0]?.quick_check==='ok','SQLite integrity check failed');
 check((await query('PRAGMA foreign_key_check')).length===0,'Foreign key violations found');
 const policies=await api('/access/apps/'+env.INDIA_GATE_ACCESS_APP_ID+'/policies');
 const emails=[...new Set((policies||[]).filter(p=>p.decision==='allow')
  .flatMap(p=>(p.include||[]).map(z=>z.email?.email?.toLowerCase()).filter(Boolean)))];
 check(emails.length>=7,'At least 7 distinct Access humans incl Legal required');
 const roles={};
 for(const email of emails){
  const rows=await query('SELECT role,active FROM india_members WHERE lower(email)=?',[email]);
  const active=rows.find(x=>x.active===1);
  if(active)roles[active.role]=(roles[active.role]||0)+1;
 }
 for(const [role,n] of Object.entries(MANDATORY_ROLES))
  check((roles[role]||0)>=n,'Active signed-Access roster missing role '+role);
 console.log(JSON.stringify({scope:'READ_ONLY_CLOUDFLARE_CONFIG_PREFLIGHT',result:'PASS',
  worker:env.INDIA_GATE_WORKER_NAME,isolated_clone:true,
  schema_version:28,quick_check:'ok',signed_access_roster_count:emails.length,
  note:'NO human JWT sessions or transaction UAT performed. Production release still HOLD.'}));
}
run().catch(error=>{console.error(JSON.stringify({scope:'READ_ONLY_CLOUDFLARE_CONFIG_PREFLIGHT',
 result:'BLOCKED_OR_FAIL',reason:String(error.message||error).slice(0,190),production_mutated:false}));
 process.exitCode=2;});
