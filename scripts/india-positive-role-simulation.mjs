#!/usr/bin/env node
/**
 * INDIA isolated positive-path simulation orchestrator.
 * Source/localhost synthetic actors only. No Cloudflare Access token, production
 * D1 binding, SIEM/EDR command, payment instruction or customer data.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
if(process.argv[2]!=='--ci') { console.error('Run in isolated CI with --ci only'); process.exit(2); }
const legacy=JSON.parse(readFileSync('docs/INDIA_UAT_210_CATALOG.json','utf8'));
const erp=JSON.parse(readFileSync('docs/INDIA_ERP_UAT_210_CATALOG.json','utf8'));
const positive=erp.cases.filter(c=>c.kind==='positive');
const domains=Object.fromEntries(['GL','P2P','OPS','HR','E2E','SEC'].map(x=>[x,positive.filter(c=>c.id.startsWith('ERP-'+x+'-')).length]));
const actors=[...new Set(positive.flatMap(c=>String(c.actor).split(',').map(s=>s.trim()).filter(Boolean)))].sort();
const suites=[
 {id:'core_business_roles_and_menus',label:'16-domain automated business, approval, sales, vault and security gate',bin:'npm',args:['run','gate:automated'],level:'synthetic_src_and_isolated_db'},
 {id:'erp_psa_roles',label:'ERP GL, AP, procurement, cyber and PSA transaction simulations',bin:'npm',args:['run','gate:erp'],level:'synthetic_isolated_db'},
 {id:'positive_catalog_integrity',label:'Validate the 210 ERP cases including positive role-specific scenarios',bin:'node',args:['--test','tests/india-erp-uat-catalog.test.cjs'],level:'scenario_definition_only'},
 {id:'signed_evidence_guard',label:'Release evidence authenticity and maker-checker proof checks',bin:'node',args:['--test','tests/release-evidence.test.cjs'],level:'synthetic_negative_guard'},
 {id:'localhost_build',label:'Produce a localhost Next.js application for browser role simulation',bin:'npm',args:['run','build'],level:'local_build_only'},
 {id:'browser_role_uis',label:'Playwright desktop/mobile local browser scenario and role fixture flows',bin:'npm',args:['run','test:modules-browser'],level:'synthetic_http_and_browser'}
];
const output=[];
for(const s of suites){
 console.log('\n==== START '+s.id+' ====');
 const at=Date.now();
 const p=spawnSync(s.bin,s.args,{cwd:root,encoding:'utf8',timeout:25*60*1000,
   maxBuffer:8*1024*1024,env:{...process.env,CI:'true'}});
 const log=(p.stdout||'')+'\n'+(p.stderr||'');
 const state=p.status===0&&!p.error?'PASS':'FAIL';
 console.log(log.slice(-6000));
 console.log('==== '+state+' '+s.id+' ====');
 output.push({id:s.id,label:s.label,scope:s.level,status:state,exit_code:p.status,
   duration_ms:Date.now()-at,diagnostic_tail:state==='FAIL'?log.slice(-2500):undefined,error:p.error?.code||null});
 // Browser tests need successful local build; record as BLOCKED if not buildable.
 if(s.id==='localhost_build'&&state!=='PASS'){
  output.push({id:'browser_role_uis',scope:'synthetic_http_and_browser',status:'BLOCKED',reason:'Next.js build failed'});
  break;
 }
}
const success=output.every(x=>x.status==='PASS')&&output.length===suites.length;
const result={name:'INDIA all-role positive-path technical simulation',generated_at:new Date().toISOString(),
 source_sha:process.env.GITHUB_SHA||null,git_pr:process.env.GITHUB_REF||null,
 scope:'isolated synthetic source/database and localhost browser only',
 catalog:{legacy_total:legacy.cases.length,erp_total:erp.cases.length,erp_positive:positive.length,
  erp_positive_by_domain:domains,erp_positive_actor_labels:actors,
  note:'Catalog cases are NOT_RUN; ERP positive cases are a definition inventory, NOT 88 executed case results.'},
 runs:output,technical_gate:success?'PASS':'FAIL',
 real_access_uat:'NOT_RUN',operational_certificate:'NOT_CERTIFIED',production_release:'HOLD',
 required_live_proof:['Real Access JWT and individual user sessions','Approved enterprise role grants and revocation',
  '420 distinct release-bound signed UAT evidence objects','Independent D1 backup, restore and reconciliation',
  'Actual live finance/treasury/HR and external SIEM-EDR connectors','8 independent business approvals']};
mkdirSync('artifacts/india-positive-uat',{recursive:true});
writeFileSync('artifacts/india-positive-uat/result.json',JSON.stringify(result,null,2)+'\n',{mode:0o600});
if(process.env.GITHUB_STEP_SUMMARY){
 const rows=output.map(x=>'| '+x.id+' | '+x.status+' | '+x.scope+' |').join('\n');
 appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 '# INDIA Positive UAT (synthetic CI only)\n\n'+
 'Technical gate: **'+result.technical_gate+'**; Operational UAT: **NOT RUN**, Release: **HOLD**.\n\n'+
 '| Phase | Result | Scope |\n|---|---|---|\n'+rows+'\n\n'+
 'The '+positive.length+' ERP positive catalog entries and '+actors.length+' actor labels are **inventory, not executed proofs**.\n');
}
console.log(JSON.stringify({technical_gate:result.technical_gate,erp_positive_catalog_cases:positive.length,
 actors:actors.length,phases:output.length,production_release:'HOLD'}));
process.exit(success?0:1);
