#!/usr/bin/env node
/**
 * INDIA feasibility: REAL signed Cloudflare Access, remote UAT D1 and UAT Worker.
 * Never runs transactions until all six real human JWT identities, UAT bindings,
 * versioned D1 schema and target release have been validated independently.
 * Modes: --preflight (read only), --transactions (writes synthetic UAT records).
 * No production targets and no JWT/API secrets are logged.
 */
import {randomUUID} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const env=process.env,ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
const PROD_DB='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const keys=[['Sales A','SALES_A','sales'],['Sales B','SALES_B','sales'],
 ['Presales','PRESALES','presales'],['Finance','FINANCE','finance'],
 ['Approver','APPROVER','approver'],['Admin','ADMIN','admin']];
let checks=0,writes=0;
function check(ok,message){if(!ok)throw Error('BLOCKED_OR_FAIL: '+message);checks++;console.log('PASS '+message);}
function setup(){
 const mode=process.argv[2]||'--preflight';
 check(['--preflight','--transactions'].includes(mode),'supported mode');
 const worker=env.INDIA_UAT_WORKER_NAME||'',base=new URL(env.INDIA_UAT_BASE_URL||'https://uat-india.elang-haqeem.workers.dev');
 check(/^(uat|staging)[a-z0-9-]*$/.test(worker),'Worker named UAT only');
 check(base.protocol==='https:'&&!base.port&&base.pathname==='/'&&!base.username&&!base.password&&
  !base.search&&!base.hash&&base.hostname===worker+'.elang-haqeem.workers.dev'&&base.hostname!=='india.elang-haqeem.workers.dev',
 'HTTPS origin pinned to isolated UAT Worker');
 check(env.INDIA_UAT_D1_ID==='eaed652e-7322-4950-a304-dd50baa5de02'&&env.INDIA_UAT_D1_ID!==PROD_DB,'UAT DB ID pinned');
 check(env.INDIA_UAT_EXPECT_SHA&&/^[0-9a-f]{40}$/.test(env.INDIA_UAT_EXPECT_SHA),'exact intended release SHA pinned');
 return {mode,worker,base,db:env.INDIA_UAT_D1_ID};
}
async function cf(path,method='GET',body){
 check(!!env.INDIA_UAT_CF_READ_TOKEN,'read-only Cloudflare API token configured');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  method,headers:{Authorization:'Bearer '+env.INDIA_UAT_CF_READ_TOKEN,'Content-Type':'application/json'},
  body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(16000)});
 const j=await r.json();
 check(r.ok&&j.success===true,'Cloudflare read-only API '+path.split('/').slice(0,4).join('/'));
 return j.result;
}
async function sql(db,query){
 const x=await cf('/d1/database/'+db+'/query','POST',{sql:query});
 check(Array.isArray(x)&&x.every(r=>r.success),'D1 read-only SQL');
 return x[0]?.results||[];
}
async function preflight(c){
 const r=await fetch(new URL('/api/sales/feasibility?opportunity_id=uat-preflight-only',c.base),{
   redirect:'manual',headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
 const loc=r.headers.get('location')||'';
 const accessRedirect=r.status>=300&&r.status<400&&/cloudflareaccess\\.com|\\/cdn-cgi\\/access\\//.test(loc);
 check([401,403].includes(r.status)||accessRedirect,'Cloudflare Access rejects anonymous request (HTTP '+r.status+')');
 const s=await cf('/workers/scripts/'+c.worker+'/settings');
 const bind=(s.bindings||[]).filter(x=>x.name==='INDIA_DB');
 check(bind.length===1&&(bind[0].id||bind[0].database_id)===c.db,'actual UAT Worker bound to UAT D1');
 const release=(s.bindings||[]).find(x=>x.name==='INDIA_RELEASE_SHA');
 check((release?.text||release?.value)===env.INDIA_UAT_EXPECT_SHA,'UAT Worker deploy exactly equals intended release');
 const versions=await sql(c.db,'SELECT MAX(version) AS version FROM india_schema_migrations');
 check(versions[0]?.version>=25,'D1 feasibility canonical migration 0025 applied');
 const names=await sql(c.db,"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('india_feasibility_plans','india_resource_people','india_resource_allocations','india_feasibility_costs','india_vendor_offers','india_vendors')");
 check(names.length===6,'all D1 feasibility and supplier tables present');
 check((await sql(c.db,'PRAGMA quick_check'))[0]?.quick_check==='ok','D1 quick_check');
 check((await sql(c.db,'PRAGMA foreign_key_check')).length===0,'D1 foreign key integrity');
}
async function people(c){
 const team=env.INDIA_UAT_ACCESS_TEAM_DOMAIN||'',aud=env.INDIA_UAT_ACCESS_AUD||'';
 check(/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)&&aud.length>30,'actual Cloudflare Access tenant/AUD provided');
 const jwks=createRemoteJWKSet(new URL('https://'+team+'/cdn-cgi/access/certs'));
 const list=[];
 for(const [label,key,role] of keys){
  const token=env['INDIA_UAT_JWT_'+key],email=(env['INDIA_UAT_EMAIL_'+key]||'').trim().toLowerCase();
  check(token?.split('.').length===3,'three-part signed JWT supplied: '+label);
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/(^|[.@])(invalid|example|test)([.@]|$)/.test(email),
    'real, non-fixture mailbox configured: '+label);
  const decoded=await jwtVerify(token,jwks,{issuer:'https://'+team,audience:aud,algorithms:['RS256'],clockTolerance:30});
  check(String(decoded.payload.email||'').trim().toLowerCase()===email,'RS256 Access identity verified: '+label);
  list.push({label,key,role,token,email});
 }
 check(new Set(list.map(x=>x.email)).size===6,'six distinct human Access identity emails');
 return Object.fromEntries(list.map(x=>[x.key,x]));
}
async function http(c,p,path,method='GET',payload){
 const target=new URL(path,c.base);
 check(target.origin===c.base.origin,'request destination remains isolated UAT');
 const headers={'cf-access-jwt-assertion':p.token,Accept:'application/json'};
 if(method!=='GET'){headers['Content-Type']='application/json';headers.Origin=c.base.origin;}
 if(payload?.entity==='convert')headers['x-india-lead-action']='convert';
 const r=await fetch(target,{method,headers,redirect:'manual',cache:'no-store',
  body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(18000)});
 check(r.status<300||r.status>=400,'no Cloudflare Access redirect: '+p.label);
 check((r.headers.get('content-type')||'').includes('application/json'),'application JSON: '+p.label);
 return {status:r.status,body:await r.json()};
}
function expect(x,status,label){
 check(x.status===status&&(status>=400?x.body.success===false:x.body.success===true),label+' HTTP '+status);
 return x.body;
}
async function verifyPeopleCanRead(c,p){
 // Must prove ALL role sessions work on candidate route before any test records are created.
 for(const [label,key] of keys){
  const r=await http(c,p[key],'/api/sales/feasibility?opportunity_id=uat-preflight-only');
  expect(r,404,label+' Access token accepted by app and D1 role');
 }
}
async function makeDeal(c,p,tag){
 const seed=randomUUID().slice(0,10).toUpperCase();
 const lead={entity:'lead',request_key:randomUUID(),account_name:'INDIA LIVE UAT '+seed+' '+tag,
  contact_name:'UAT Only',contact_email:'uat-'+seed.toLowerCase()+'@example.invalid',
  assigned_sales_email:p.email,service_family:'VAPT',source:'LIVE UAT feasibility',campaign:'ISOLATED',
  estimated_value_idr:110000000,expected_closing_date:'2026-12-20',qualification:{}};
 const created=expect(await http(c,p,'/api/marketing/leads','POST',lead),201,tag+' lead creation');writes++;
 expect(await http(c,p,'/api/marketing/leads','PATCH',{id:created.id,version:1,status:'qualified',
  qualification:{need:'Controlled VAPT UAT',budget_status:'Approved',decision_maker:'Head of IT',
   procurement_process:'Direct',contact_phone:'081200000055',discovery_notes:'Signed human Access UAT'}}),200,tag+' qualify');writes++;
 const body={entity:'convert',id:created.id,version:2,customer_fields:{
  industry:'Information Technology',business_type:'Layanan Teknologi Informasi',
  employee_band:'100-500',company_phone:'02155501234',
  hq_address:'SYNTHETIC UAT ONLY',hq_province:'DKI Jakarta',hq_postal:'12345'},
  opportunity_title:'INDIA LIVE UAT '+seed+' '+tag};
 const converted=expect(await http(c,p,'/api/marketing/leads','POST',body),201,tag+' atomic Lead to Opportunity');writes++;
 return converted.opportunity_id;
}
const form={action:'plan',service_line:'VAPT',start_date:'2026-11-01',end_date:'2026-11-30',months:1,
 asset_count:2,pd_per_asset:3,retest_pct:20,coordination_pd:1,base_pd:0,coverage_hours:0,
 staffing:0,coverage_days:0,target_margin_pct:25};
async function transaction(c,p){
 // One authorized consent gate: intentionally writes UNIQUE SYNTHETIC records only.
 check(env.INDIA_UAT_ALLOW_WRITE==='YES_ISOLATED_UAT','explicit permission for UAT synthetic transactions');
 await verifyPeopleCanRead(c,p);
 const dealA=await makeDeal(c,p.SALES_A,'A'),dealB=await makeDeal(c,p.SALES_B,'B');
 const resourceName='LIVE UAT ENGINEER '+randomUUID().slice(0,8);
 const endpoint=id=>'/api/sales/feasibility?opportunity_id='+encodeURIComponent(id);
 const read=async (who,id)=>expect(await http(c,p[who],endpoint(id)),200,'feasibility GET '+who);
 const post=async (who,id,data,status=201)=> {
   const v=await read(who,id);
   const r=await http(c,p[who],'/api/sales/feasibility','POST',{
     opportunity_id:id,flow_version:v.deal.flow_version,...data});
   const result=expect(r,status,who+' '+data.action);
   if(status===201)writes++;
   return result;
 };
 expect(await http(c,p.SALES_B,endpoint(dealA)),403,'Sales B forbidden Sales A opportunity');
 await post('PRESALES',dealA,form);
 await post('PRESALES',dealB,form);
 const person=await post('FINANCE',dealA,{action:'resource',display_name:resourceName,
  email:'isolated-'+randomUUID().slice(0,8)+'@uat.invalid',skills:'VAPT, API, Web',capacity_pd_month:10,daily_cost_idr:10000});
 await post('PRESALES',dealA,{action:'allocate',person_id:person.id,allocation_month:'2026-11',
  work_role:'UAT VAPT engineer',person_days:8.2});
 await post('PRESALES',dealB,{action:'allocate',person_id:person.id,allocation_month:'2026-11',
  work_role:'Conflicting reservation',person_days:4},409);
 await post('SALES_A',dealA,{action:'cost',cost_type:'license',description:'Forbidden HPP change',sku:'SKU',unit:'unit',quantity:1,periods:1,unit_price_idr:100},403);
 const sales=await read('SALES_A',dealA),pre=await read('PRESALES',dealA),fin=await read('FINANCE',dealA);
 check(sales.report.internal_cost_idr===null&&pre.report.internal_cost_idr===null,'Sales and Presales HPP concealed');
 check(sales.people.every(x=>x.daily_cost_idr===undefined),'Sales does not receive engineer daily cost');
 check(fin.report.required_pd===8.2&&fin.report.internal_cost_idr===82000,'actual D1 VAPT PD and HPP calculation');
 check(fin.report.approval_ready===true,'Finance decision prerequisites pass');
 await post('PRESALES',dealA,{action:'review',version:fin.plan.version,decision:'approved',
  review_notes:'Self approval must fail'},403);
 await post('APPROVER',dealA,{action:'review',version:fin.plan.version,decision:'approved',
  review_notes:'Independent review of capacity, scope and cost completed'});
 const approved=await read('FINANCE',dealA);
 check(approved.plan.status==='approved'&&approved.report.ready===true,'independent feasibility approval persists');
 await post('FINANCE',dealA,{action:'cost',cost_type:'tooling',description:'Post-approval test tool',
  sku:'',unit:'unit',quantity:1,periods:1,unit_price_idr:10000});
 const changed=await read('FINANCE',dealA);
 check(changed.plan.status==='draft'&&changed.report.ready===false,'cost change invalidates approval');
 console.log(JSON.stringify({result:'PASS',type:'LIVE_CLOUDFLARE_ACCESS_FEASIBILITY_UAT',
  release_sha:env.INDIA_UAT_EXPECT_SHA,worker:c.worker,checks,writes,deal_ids:[dealA,dealB],
  note:'Synthetic UAT records retained for audit; never use on production'},null,2));
}
async function main(){
 const c=setup();
 await preflight(c);
 console.log('PASS READ_ONLY_LIVE_PREFLIGHT');
 if(c.mode==='--transactions'){const p=await people(c);await transaction(c,p);}
 else console.log(JSON.stringify({result:'PASS',mode:'READ_ONLY_LIVE_PREFLIGHT',checks,writes}));
}
main().catch(e=>{console.error(JSON.stringify({result:'BLOCKED_OR_FAIL',mode:process.argv[2]||'--preflight',
 checks,writes,reason:String(e?.message||e).slice(0,250),jwt_exposed:false}));process.exitCode=2;});
