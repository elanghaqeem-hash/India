#!/usr/bin/env node
/**
 * INDIA dedicated UAT D1 read-only preflight.
 * Requires a short-lived CLOUDFLARE_API_TOKEN with D1 Read permission.
 * Does NOT migrate, INSERT, UPDATE, DELETE, or expose customer/PII values.
 * Intentionally PINNED to the isolated UAT database; cannot target production.
 */
const ACCOUNT_ID='208155f241d4da84e1a6a9b44b7a8d28';
const UAT_DATABASE_ID='eaed652e-7322-4950-a304-dd50baa5de02';
const PROD_DATABASE_ID='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
const dbId=process.env.INDIA_UAT_D1_ID||UAT_DATABASE_ID;
if(dbId!==UAT_DATABASE_ID||dbId===PROD_DATABASE_ID){
 console.error('DENIED: read-only preflight accepts ONLY the dedicated INDIA UAT D1 ID.');
 process.exit(2);
}
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.error('NOT RUN: CLOUDFLARE_API_TOKEN is unavailable. No database access was attempted.');process.exit(2);}
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT_ID+'/d1/database/'+UAT_DATABASE_ID+'/query';
async function query(sql){
 if(!/^\s*(SELECT|PRAGMA foreign_key_check)\b/i.test(sql)||/;\s*\S/.test(sql))
  throw Error('Read-only SQL guard refused this query');
 const res=await fetch(endpoint,{method:'POST',headers:{
  Authorization:'Bearer '+token,'Content-Type':'application/json'
 },body:JSON.stringify({sql}),signal:AbortSignal.timeout(15000)});
 const json=await res.json().catch(()=>({}));
 if(!res.ok||json.success!==true||!Array.isArray(json.result)||!json.result[0]?.success)
  throw Error('Cloudflare D1 read-only request failed (HTTP '+res.status+').');
 return json.result[0].results||[];
}
async function main(){
 const tables=await query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('india_schema_migrations','india_members','india_sales_accounts','india_sales_opportunities','india_marketing_leads','india_marketing_lead_events','india_sales_audit') ORDER BY name");
 const names=new Set(tables.map(t=>t.name));
 const required=['india_schema_migrations','india_members','india_sales_accounts','india_sales_opportunities','india_marketing_leads','india_marketing_lead_events','india_sales_audit'];
 const missing=required.filter(t=>!names.has(t));
 const report={target:'dedicated-isolated-UAT',read_only:true,missing_tables:missing,
  schema_versions:[],foreign_key_violations:null,duplicate_account_names:null,
  orphan_sales_opportunities:null,converted_lead_inconsistencies:null,role_counts:{}};
 if(names.has('india_schema_migrations')){
  const versions=await query('SELECT version FROM india_schema_migrations ORDER BY version');
  report.schema_versions=versions.map(x=>x.version);
 }
 if(missing.length===0){
  const fk=await query('PRAGMA foreign_key_check');
  report.foreign_key_violations=fk.length;
  const dupes=await query("SELECT COUNT(*) AS n FROM (SELECT tenant_id,lower(trim(legal_name)) AS normalized FROM india_sales_accounts GROUP BY tenant_id,normalized HAVING COUNT(*)>1)");
  report.duplicate_account_names=Number(dupes[0]?.n??-1);
  const orphans=await query("SELECT COUNT(*) AS n FROM india_sales_opportunities o LEFT JOIN india_sales_accounts a ON a.tenant_id=o.tenant_id AND a.id=o.company_id WHERE a.id IS NULL");
  report.orphan_sales_opportunities=Number(orphans[0]?.n??-1);
  const bad=await query("SELECT COUNT(*) AS n FROM india_marketing_leads l WHERE l.status='converted' AND (l.converted_account_id IS NULL OR l.converted_opportunity_id IS NULL OR NOT EXISTS(SELECT 1 FROM india_sales_accounts a WHERE a.tenant_id=l.tenant_id AND a.id=l.converted_account_id) OR NOT EXISTS(SELECT 1 FROM india_sales_opportunities o WHERE o.tenant_id=l.tenant_id AND o.id=l.converted_opportunity_id AND o.company_id=l.converted_account_id))");
  report.converted_lead_inconsistencies=Number(bad[0]?.n??-1);
  const roles=await query("SELECT role,COUNT(*) AS n FROM india_members WHERE active=1 GROUP BY role");
  report.role_counts=Object.fromEntries(roles.map(r=>[String(r.role),Number(r.n)]));
 }
 const good=[3,4,5,6].every(v=>report.schema_versions.includes(v))&&missing.length===0&&
  [report.foreign_key_violations,report.duplicate_account_names,report.orphan_sales_opportunities,report.converted_lead_inconsistencies].every(v=>v===0);
 console.log(JSON.stringify({...report,result:good?'PASS':'BLOCKED'},null,2));
 if(!good)process.exitCode=2;
}
main().catch(err=>{console.error('UAT preflight unavailable: '+err.message);process.exitCode=2;});
