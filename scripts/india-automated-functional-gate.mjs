#!/usr/bin/env node
/**
 * INDIA business and administration menus + transaction modules: reproducible SOURCE-ONLY automated gate.
 * Executes actual project tests; refuses PASS when any case fails, when a nav target is missing,
 * or when TypeScript fails. Never accesses production, reads secrets or fabricates human UAT.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const groups=[
 {name:'01 Executive & Workspace',checks:['test:executive','test:activities']},
 {name:'02 Marketing & Lead Intelligence',checks:['test:marketing','test:consolidation']},
 {name:'03 Customer 360 & Sales',checks:['test:sales','test:sales-transactions']},
 {name:'04 Tender & Presales Feasibility',checks:['test:bid-readiness','test:feasibility']},
 {name:'05 Pricing, BoQ & Approval',checks:['test:pricing','test:boq','test:boq-domain','test:boq-workflow','test:quotation-docx','test:menu-approval']},
 {name:'06 Delivery & Post-PO',checks:['test:post-po','test:service-operations','test:psa-timesheets']},
 {name:'07 Cash, Renewal & FlexGuard',checks:['test:service-operations','test:flexguard']},
 {name:'08 Partners, Vendor & OEM',checks:['test:modules-13-15']},
 {name:'09 Reports & AI',checks:['test:modules-13-15','test:ai']},
 {name:'10 Secure Vault',checks:['test:document-vault']},
 {name:'11 Administration',checks:['test:admin','test:modules-13-15','test:ai']},
 {name:'Cross-module Transaction & SoD',checks:['test:p1-p2','test:india-negative','test:scoping-upload']},
 {name:'Postal Reference & Import',checks:['test:postal']},
 {name:'Server Runtime & Layout',checks:['test:runtime-compat','test:layout']},
 {name:'Release evidence & abuse prevention',checks:['test:release-controls']},
 {name:'Integrated Commercial Operations',checks:['test:consolidation','test:sales-transactions','test:service-operations']},
];
const manual=[
 'Cloudflare Access OTP/JWT nyata per role dan negative cross-owner UAT',
 'Tanda tangan Finance/Legal/Security/release owner serta pemeriksaan original Vault',
 'Perangkat Android fisik dan validasi UX langsung oleh pengguna',
 'API key provider AI asli dan uji external outbound berizin'
];
const infrastructure=[
 'Hash SHA-256 dump D1 original + independent restore/rollback di environment Cloudflare terpisah',
 'Migrasi 0033 dari baseline UAT/produksi yang diverifikasi dan real transaction replay pada dedicated isolated Access UAT',
 'Kontinuitas kunci AES Vault/AI dan monitoring/backup restore',
 'Deploy produksi, rollback rehearsal dan signoff yang sesuai'
];
const commands=[...new Set(['typecheck',...groups.flatMap(x=>x.checks)])];
const outcome=new Map();
const evidence=[];
function execute(cmd){
 const result=spawnSync('npm',['run',cmd],{
  cwd:root,encoding:'utf8',timeout:6*60*1000,maxBuffer:16*1024*1024,
  env:{...process.env,CI:'true'}
 });
 const passed=result.status===0&&!result.error;
 const output=(result.stdout||'')+'\n'+(result.stderr||'');
 if(!passed)console.error('FAIL '+cmd+' — '+(result.error?.message||output.slice(-1800)));
 else console.log('PASS '+cmd);
 return {status:passed?'PASS':'FAIL',exit_code:result.status,error:result.error?.code||null};
}
function verifyMenus(){
 const nav=readFileSync(join(root,'src/lib/enterprise-navigation.ts'),'utf8');
 const links=[...nav.matchAll(/item\('[^']+','(\/[^']+)'/g)].map(x=>x[1]);
 const missing=links.filter(href=>!existsSync(join(root,'src/app',href.slice(1),'page.tsx')));
 const duplicates=links.filter((href,i)=>links.indexOf(href)!==i);
 if(!links.includes('/approvals')||!links.includes('/flexguard')||!links.includes('/post-po'))
  missing.push('Required approval/FlexGuard/Post-PO menu');
 if(!links.length||missing.length||duplicates.length)
  throw Error('Invalid menu structure: missing='+missing.join(',')+'; duplicates='+duplicates.join(','));
 const middleware=readFileSync(join(root,'src/middleware.ts'),'utf8');
 if(!middleware.includes("'/api/reference/postal'")||!middleware.includes("path.startsWith('/api/sales/')"))
  throw Error('D1 API middleware missing canonical protected routes');
 for(const blocked of ['/api/tenders','/api/wallets','/api/approvals','/api/opportunities','/api/proposals']){
  if(middleware.includes("  '"+blocked+"',"))throw Error('Legacy demo API was re-enabled: '+blocked);
 }
 return {status:'PASS',unique_menu_routes:links.length,groups:[...nav.matchAll(/\{id:'[^']+',label:/g)].length,missing_routes:[],unreviewed_apis:[]};
}
if(process.argv[2]!=='--ci'){
 console.error('Use --ci; this task does not deploy or mutate a D1 database.');
 process.exit(2);
}
let structure;
try{structure=verifyMenus();console.log('PASS '+structure.groups+' navigation groups / '+structure.unique_menu_routes+' routes');}
catch(error){structure={status:'FAIL',error:String(error)};console.error(String(error));}
for(const command of commands){const result=execute(command);outcome.set(command,result);evidence.push({command,...result});}
const matrix=groups.map(x=>({
 name:x.name,scope:'automated_source_only',checks:x.checks,
 status:structure.status==='PASS'&&x.checks.every(k=>outcome.get(k)?.status==='PASS')&&outcome.get('typecheck')?.status==='PASS'?'PASS':'FAIL'
}));
const ok=structure.status==='PASS'&&matrix.every(x=>x.status==='PASS');
const artifact={
 name:'INDIA Automated Functional Gate',scope:'source_and_synthetic_transaction_tests_only',
 generated_at:new Date().toISOString(),sha:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),
 source_dirty:spawnSync('git',['diff','--quiet','HEAD'],{cwd:root}).status!==0,
 status:ok?'PASS':'FAIL',menu_routes:structure,tests:evidence,
 matrix,user_uat_pending:manual,non_user_infrastructure_pending:infrastructure,
 production_release:'HOLD',notes:'Source test PASS is not remote D1 UAT, manual signoff or production availability.'
};
const dir=join(root,'artifacts','india-automated-gate');mkdirSync(dir,{recursive:true});
writeFileSync(join(dir,'result.json'),JSON.stringify(artifact,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({automated_status:artifact.status,menus:matrix.length,pass:matrix.filter(x=>x.status==='PASS').length,
 menu_routes:structure.unique_menu_routes||0,source_only:true,production_release:'HOLD'}));
process.exit(ok?0:1);
