#!/usr/bin/env node
/**
 * Fail-closed production deployment compatibility gate.
 * Source HEAD packages ALL INDIA modules; an AI-only code change cannot
 * magically limit a full OpenNext Worker deployment to one endpoint.
 * Never modifies D1, accesses secret values, logs customer records or
 * authorizes production based on simulated CI.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { verifyReleaseEvidence } from './india-release-evidence.mjs';
const env=process.env;
const ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
const DB='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const AUD='0411bb42ccf17d67c3e8b81d8e8c6d6124dbfec5025cab563e6a8aea68e70398';
const TEAM='green-heart-e2b0.cloudflareaccess.com';
const WORKER='india';
const assert=(pass,why)=>{if(!pass)throw Error(why)};
const api=async(path,opts={})=>{
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  method:opts.method||'GET',headers:{
   Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,
   ...(opts.body?{'Content-Type':'application/json'}:{})
  },body:opts.body?JSON.stringify(opts.body):undefined,
  redirect:'error',signal:AbortSignal.timeout(20000)
 });
 const body=await response.json().catch(()=>({}));
 assert(response.ok&&body.success===true,'CLOUDFLARE_READ_FAIL_'+response.status);
 return body.result;
};
const binding=(list,name)=>{
 const found=list.filter(x=>x.name===name);
 assert(found.length===1,'MISSING_OR_DUPLICATE_BINDING_'+name);
 return found[0];
};
const query=async(sql)=>{
 const arr=await api('/d1/database/'+DB+'/query',{method:'POST',body:{sql}});
 assert(Array.isArray(arr)&&arr.length===1&&arr[0].success,'D1_READ_ONLY_QUERY_FAILED');
 return arr[0].results||[];
};
async function main(){
 assert(process.argv[2]==='before'||process.argv[2]==='after','INVALID_PHASE');
 const phase=process.argv[2];
 assert(env.CLOUDFLARE_API_TOKEN,'CLOUDFLARE_API_TOKEN_MISSING');
 assert(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||''),'RELEASE_SHA_MISSING');
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 assert(config.name===WORKER && config.d1_databases?.length===1 &&
  config.d1_databases[0].database_id===DB,'DEPLOY_TARGET_MISMATCH');
 const [settings,deployments]=await Promise.all([
  api('/workers/scripts/'+WORKER+'/settings'),
  api('/workers/scripts/'+WORKER+'/deployments')
 ]);
 const bindings=settings.bindings||[];
 assert((binding(bindings,'INDIA_DB').id||binding(bindings,'INDIA_DB').database_id)===DB,'PRODUCTION_D1_MISMATCH');
 assert(binding(bindings,'INDIA_ACCESS_AUD').text===AUD,'PRODUCTION_ACCESS_AUD_MISMATCH');
 assert(binding(bindings,'INDIA_ACCESS_TEAM_DOMAIN').text===TEAM,'PRODUCTION_ACCESS_ISSUER_MISMATCH');
 assert(binding(bindings,'INDIA_AI_ENCRYPTION_KEY').type==='secret_text','AI_KEY_BINDING_MISSING');
 // Require the Vault encryption binding before deploying the FULL current application.
 assert(binding(bindings,'INDIA_DOCUMENT_ENCRYPTION_KEY').type==='secret_text','VAULT_KEY_BINDING_MISSING');
 const latest=deployments.deployments?.[0]?.versions?.find(x=>x.percentage===100)?.version_id;
 assert(/^[a-f0-9-]{36}$/.test(latest||''),'ROLLBACK_WORKER_VERSION_MISSING');
 const [ledger,manifest]=await Promise.all([
  query('SELECT version FROM india_schema_migrations ORDER BY version'),
  query("SELECT path FROM india_schema_file_manifest WHERE path LIKE 'migrations/00%' ORDER BY path")
 ]);
 const applied=new Set(ledger.map(x=>Number(x.version)));
 const expected=Array.from({length:31},(_,i)=>i+1);
 const missing=expected.filter(v=>!applied.has(v));
 assert(!missing.length,'SCHEMA_INCOMPATIBLE_MISSING_MIGRATIONS_'+missing.join('_'));
 for(const v of ['0027_customer_delivery_cash_renewal','0028_ai_mistral_provider',
  '0029_indonesia_postal_reference','0030_flexguard_immutable_ledger','0031_admin_option_registry']){
  assert(manifest.some(x=>x.path==='migrations/'+v+'.sql'),'MISSING_CANONICAL_MANIFEST_'+v);
 }
 // A bookmark is not an independent original backup. Evidence must be a real verified
 // 64-hex checksum supplied from a restricted, independent backup rehearsal.
 assert(/^[a-f0-9]{64}$/.test(env.INDIA_PROD_VERIFIED_BACKUP_SHA256||''),
  'INDEPENDENT_D1_BACKUP_RESTORE_EVIDENCE_MISSING');
 assert(env.INDIA_PROD_SIGNED_ACCESS_UAT==='PASS','SIGNED_ACCESS_UAT_NOT_VERIFIED');
 assert(env.INDIA_PROD_FINANCE_SECURITY_SIGNOFF==='PASS','SECURITY_FINANCE_SIGNOFF_MISSING');
 verifyReleaseEvidence({receiptPath:env.INDIA_RELEASE_EVIDENCE_PATH,
  publicKey:env.INDIA_RELEASE_AUTHORITY_PUBLIC_KEY,sha:env.GITHUB_SHA,phase});
 if(phase==='before'){
  if(env.GITHUB_OUTPUT)appendFileSync(env.GITHUB_OUTPUT,'previous_version='+latest+'\n');
  console.log(JSON.stringify({gate:'PRODUCTION_AI_FULL_WORKER_PREDEPLOY',result:'PASS',
   release:env.GITHUB_SHA,worker:WORKER,version_before:latest,db_schema:31,
   note:'No production database write performed by this gate.'}));
 }else{
  assert(/^[a-f0-9-]{36}$/.test(env.INDIA_PREVIOUS_VERSION||''),'ROLLBACK_REFERENCE_MISSING');
  assert(latest!==env.INDIA_PREVIOUS_VERSION,'DEPLOYMENT_VERSION_UNCHANGED');
  console.log(JSON.stringify({gate:'PRODUCTION_AI_FULL_WORKER_POSTDEPLOY',result:'PASS',
   release:env.GITHUB_SHA,version_after:latest,db_schema:31}));
 }
}
main().catch(e=>{
 console.error(JSON.stringify({gate:'PRODUCTION_AI_FULL_WORKER',result:'BLOCKED',
  reason:String(e.message||'UNKNOWN').slice(0,200),changed_production_db:false,
  note:'Do not bypass production release prerequisites.'}));
 process.exitCode=2;
});
