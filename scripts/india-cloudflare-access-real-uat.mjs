#!/usr/bin/env node
/**
 * Live INDIA Access + Cloudflare D1 UAT, intentionally NOT a simulator.
 * Writes uniquely named UAT leads/accounts/deals. No cleanup against live systems.
 * Requires three signed, currently valid human Cloudflare Access JWTs and read-only
 * Workers script-settings permission to attest INDlA_DB points at the isolated UAT D1.
 * Never paste JWTs in chat or commit them to Git.
 */
import {randomUUID} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';

const ACCOUNT_ID='208155f241d4da84e1a6a9b44b7a8d28';
const UAT_DB='eaed652e-7322-4950-a304-dd50baa5de02';
const PROD_DB='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const PROD_HOST='india.elang-haqeem.workers.dev';
const env=process.env;
let checks=0,ids=[];

function ensure(x,reason){if(!x)throw Error(reason);}
function item(name,pred){ensure(pred,'FAIL: '+name);checks++;console.log('PASS '+name);}
function config(){
 const worker=env.INDIA_UAT_WORKER_NAME||'';
 const allowed=env.INDIA_UAT_ALLOWED_HOST||'';
 const raw=env.INDIA_UAT_BASE_URL||'';
 ensure(raw,'INDIA_UAT_BASE_URL wajib diisi');
 const url=new URL(raw);
 ensure(url.protocol==='https:' && !url.username && !url.password && !url.search && !url.hash &&
   (url.pathname==='/'||url.pathname==='') && !url.port,'Base URL wajib HTTPS origin saja');
 ensure(/^(uat|staging)[a-z0-9-]{0,58}$/.test(worker),'Worker UAT harus diawali uat/staging');
 ensure(url.hostname===allowed && allowed!==PROD_HOST &&
   /uat|staging/i.test(allowed),'Hostname UAT tidak cocok/berisiko produksi');
 ensure(url.hostname.startsWith(worker+'.'),'Hostname tidak cocok dengan Worker UAT');
 ensure(env.INDIA_UAT_D1_ID===UAT_DB && env.INDIA_UAT_D1_ID!==PROD_DB,'D1 target bukan UAT terisolasi');
 ensure(env.INDIA_UAT_ALLOW_WRITE==='YES_ISOLATED_UAT','UAT write harus diizinkan eksplisit');
 ensure(env.CLOUDFLARE_API_TOKEN,'API token Worker READ wajib untuk verifikasi binding');
 const domain=env.INDIA_ACCESS_TEAM_DOMAIN||'';
 ensure(/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain),'Domain Access tidak sah');
 const aud=env.INDIA_ACCESS_AUD||'';
 ensure(aud.length>=30,'Access AUD wajib dan harus cocok dengan Worker UAT');
 const people=[
  ['Sales A','INDIA_UAT_JWT_SALES_A','INDIA_UAT_EMAIL_SALES_A','sales'],
  ['Sales B','INDIA_UAT_JWT_SALES_B','INDIA_UAT_EMAIL_SALES_B','sales'],
  ['Admin','INDIA_UAT_JWT_ADMIN','INDIA_UAT_EMAIL_ADMIN','admin']
 ].map(([label,t,e,role])=>({label,token:env[t],email:(env[e]||'').trim().toLowerCase(),role}));
 for(const p of people){
  ensure(p.token && p.token.split('.').length===3,'JWT asli untuk '+p.label+' belum tersedia');
  ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)&&!p.email.endsWith('.invalid'),
     'Alamat identitas Cloudflare Access '+p.label+' belum valid');
 }
 ensure(new Set(people.map(x=>x.email)).size===3,'Tiga identitas harus berbeda');
 return {worker,url,domain,aud,people};
}
async function verifyWorkerBinding(worker){
 const api='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT_ID+
  '/workers/scripts/'+encodeURIComponent(worker)+'/settings';
 const r=await fetch(api,{headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN},
   redirect:'manual',signal:AbortSignal.timeout(15000)});
 ensure(r.status===200,'Gagal memperoleh metadata Worker UAT (read-only), HTTP '+r.status);
 const j=await r.json();
 ensure(j.success && j.result,'Metadata Worker tidak terverifikasi');
 const bindings=j.result.bindings||[];
 const selected=bindings.filter(b=>b.name==='INDIA_DB' && (b.type==='d1'||b.type==='d1_database'));
 ensure(selected.length===1,'Binding INDIA_DB pada Worker UAT tidak ditemukan');
 const bindingId=selected[0].id||selected[0].database_id;
 ensure(bindingId===UAT_DB && bindingId!==PROD_DB,'STOP: Worker UAT tidak terikat D1 UAT yang benar');
 item('Cloudflare Worker binding INDIA_DB -> D1 UAT',true);
}
async function verifyAccessPeople(c){
 const keys=createRemoteJWKSet(new URL('https://'+c.domain+'/cdn-cgi/access/certs'));
 for(const p of c.people){
  const decoded=await jwtVerify(p.token,keys,{issuer:'https://'+c.domain,
   audience:c.aud,algorithms:['RS256'],clockTolerance:30});
  item(p.label+': JWT RS256 sah, email cocok',
   String(decoded.payload.email||'').toLowerCase()===p.email);
 }
}
async function request(c,person,path,method='GET',payload){
 const headers={Accept:'application/json','cf-access-jwt-assertion':person.token};
 if(method!=='GET'){headers.Origin=c.url.origin;headers['Content-Type']='application/json';}
 if(path==='/api/leads/convert')headers['x-india-lead-action']='convert';
 const url=new URL(path,c.url);
 ensure(url.origin===c.url.origin,'Origin request di luar UAT');
 const r=await fetch(url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),
  redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
 ensure(r.status<300 || r.status>=400,'Akses mengarah ke login/redirect; sesi Cloudflare Access belum siap: HTTP '+r.status);
 const type=r.headers.get('content-type')||'';
 ensure(type.includes('application/json'),'UAT menghasilkan non-JSON HTTP '+r.status+'; cek kebijakan Access');
 return {status:r.status,data:await r.json()};
}
function expect(result,status,name){
 item(name,result.status===status && (status>=400 ? result.data.success===false : result.data.success===true));
 return result.data;
}
function profile(){
 return {industry:'Information Technology',business_type:'Layanan Teknologi Informasi',employee_band:'100-500',
   company_phone:'02155501234',hq_address:'UAT TEST ONLY - NOT REAL ADDRESS',
   hq_province:'DKI Jakarta',hq_postal:'12345'};
}
function newLead(key){
 return {company_name:'PT INDIA UAT '+key,contact_name:'PIC UAT '+key,
  contact_email:'uat-'+key.toLowerCase()+'@example.invalid',contact_phone:'081200000055',
  service_interest:'VAPT',lead_source:'UAT Cloudflare Access',campaign_code:'LIVE-UAT',
  qualification_notes:'UAT scope and budget confirmed',budget_status:'Approved',
  decision_authority:'Head of IT',requirement_summary:'Isolated UAT lead conversion test',
  target_date:'2026-12-20'};
}
async function qualify(c,p,id){
 let x=expect(await request(c,p,'/api/leads','PATCH',{id,version:1,status:'contacted'}),200,'Lead -> contacted');
 x=expect(await request(c,p,'/api/leads','PATCH',{id,version:2,status:'qualified'}),200,'Lead -> qualified');
 return x.version;
}
const findId=(d,id)=>Array.isArray(d)&&d.some(v=>v.id===id);
async function run(){
 const c=config();
 await verifyWorkerBinding(c.worker);
 await verifyAccessPeople(c);
 const [a,b,admin]=c.people;
 for(const p of c.people){
  const res=expect(await request(c,p,'/api/leads'),200,p.label+': GET /api/leads via signed JWT');
  item(p.label+': RBAC server sesuai D1',res.role===p.role && res.email===p.email);
 }
 const marker=randomUUID().slice(0,8).toUpperCase();
 const leadA=expect(await request(c,a,'/api/leads','POST',newLead(marker+'-A')),201,'Sales A create lead');
 ids.push(leadA.id);
 const leadB=expect(await request(c,b,'/api/leads','POST',newLead(marker+'-B')),201,'Sales B create lead');
 ids.push(leadB.id);
 const aDetail=expect(await request(c,a,'/api/leads?id='+leadA.id),200,'Sales A reads own lead');
 item('A is owner',aDetail.lead.owner_email===a.email);
 expect(await request(c,b,'/api/leads?id='+leadA.id),403,'Sales B blocked from Sales A lead');
 expect(await request(c,a,'/api/leads?id='+leadB.id),403,'Sales A blocked from Sales B lead');
 const adminList=expect(await request(c,admin,'/api/leads'),200,'Admin views leads');
 item('Admin sees A and B',findId(adminList.leads,leadA.id)&&findId(adminList.leads,leadB.id));
 const av=await qualify(c,a,leadA.id);
 const bv=await qualify(c,b,leadB.id);
 const convPayloadA={lead_id:leadA.id,version:av,customer:profile(),
   project_title:'Live UAT '+marker+' Sales A VAPT',estimated_value:110000000,contract_model:'One-Time'};
 const convPayloadB={lead_id:leadB.id,version:bv,customer:profile(),
   project_title:'Live UAT '+marker+' Sales B VAPT',estimated_value:125000000,contract_model:'One-Time'};
 expect(await request(c,b,'/api/leads/convert','POST',convPayloadA),403,'Cross-owner convert blocked');
 const ca=expect(await request(c,a,'/api/leads/convert','POST',convPayloadA),201,'Sales A atomic convert');
 const cb=expect(await request(c,admin,'/api/leads/convert','POST',convPayloadB),201,'Admin converts B lead');
 item('Admin conversion retains Sales B ownership',cb.owner_email===b.email);
 item('IDs from server separate',ca.account_id!==cb.account_id&&ca.opportunity_id!==cb.opportunity_id);
 const converted=expect(await request(c,a,'/api/leads?id='+leadA.id),200,'Sales A reads converted lead');
 item('Lead foreign keys match Account & Opportunity',
   converted.lead.status==='converted' && converted.lead.converted_account_id===ca.account_id &&
   converted.lead.converted_opportunity_id===ca.opportunity_id);
 expect(await request(c,a,'/api/leads/convert','POST',convPayloadA),409,'Duplicate conversion rejected');
 const dealsA=expect(await request(c,a,'/api/sales?entity=deals'),200,'Sales A deals');
 const dealsB=expect(await request(c,b,'/api/sales?entity=deals'),200,'Sales B deals');
 const dealsAdmin=expect(await request(c,admin,'/api/sales?entity=deals'),200,'Admin deals');
 item('Sales A only sees owned new deal',findId(dealsA.deals,ca.opportunity_id)&&!findId(dealsA.deals,cb.opportunity_id));
 item('Sales B only sees owned new deal',findId(dealsB.deals,cb.opportunity_id)&&!findId(dealsB.deals,ca.opportunity_id));
 item('Admin sees both deals',findId(dealsAdmin.deals,ca.opportunity_id)&&findId(dealsAdmin.deals,cb.opportunity_id));
 expect(await request(c,a,'/api/sales?entity=details&id='+cb.opportunity_id),403,'Cross-owner details denied');
 const dA=expect(await request(c,admin,'/api/sales?entity=details&id='+ca.opportunity_id),200,'Admin detail & audit');
 item('Sales audit LEAD_CONVERSION present',Array.isArray(dA.history)&&
    dA.history.some(h=>h.action==='LEAD_CONVERSION'));
 const x=await request(c,a,'/api/sales','POST',{entity:'deal',company_id:cb.account_id,
   title:'FORBIDDEN CROSS-OWNER '+marker,estimated_value:5000000,fields:{}});
 expect(x,403,'Cross-owner opportunity creation denied');
 console.log(JSON.stringify({result:'PASS',test:'REAL_CLOUDFLARE_ACCESS_D1_UAT',
   checks,marker,created_lead_ids:ids,created_account_ids:[ca.account_id,cb.account_id],
   created_opportunity_ids:[ca.opportunity_id,cb.opportunity_id],
   warning:'UAT records retained; never use on production'},null,2));
}
run().catch(e=>{console.error(JSON.stringify({result:'BLOCKED_OR_FAIL',checks,
   created_lead_ids:ids,reason:String(e.message||e).slice(0,350),
   token_exposure:false}));process.exitCode=2;});
