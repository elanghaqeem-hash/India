#!/usr/bin/env node
/**
 * Pinned and READ-ONLY inspection of the canonical INDIA UAT D1 database.
 * Will return BLOCKED until the PR18-to-PR19 bridge is completed and verified.
 * No customer identifiers, email addresses, SQL mutation or secrets are printed.
 */
const ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
const UAT='eaed652e-7322-4950-a304-dd50baa5de02';
const PROD='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5';
if((process.env.INDIA_UAT_D1_ID||UAT)!==UAT||process.env.INDIA_UAT_D1_ID===PROD){
 console.error('DENIED: only isolated INDIA D1 UAT can be inspected');process.exit(2);
}
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){console.error('NOT RUN: missing D1 read-only Cloudflare token');process.exit(2);}
const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/'+UAT+'/query';
async function select(sql){
 if(!/^\s*(SELECT|PRAGMA foreign_key_check)\b/i.test(sql)||/;\s*\S/.test(sql))
  throw Error('Read-only SQL guard refused request');
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({sql}),signal:AbortSignal.timeout(20000)});
 const j=await r.json();
 if(!r.ok||j.success!==true||!Array.isArray(j.result)||!j.result[0]?.success)
  throw Error('Cloudflare D1 query failed (HTTP '+r.status+')');
 return j.result[0].results||[];
}
async function main(){
 const expected=['india_schema_migrations','india_schema_file_manifest','india_members',
  'india_marketing_leads','india_marketing_lead_events','india_marketing_campaigns',
  'india_sales_accounts','india_sales_opportunities','india_sales_lead_links',
  'india_sales_audit','india_sales_bids','india_sales_requirements',
  'india_sales_submissions','india_sales_award_documents'];
 const names=(await select("SELECT name FROM sqlite_master WHERE type='table'")).map(r=>r.name);
 const missing=expected.filter(n=>!names.includes(n));
 const versions=names.includes('india_schema_migrations')
  ?(await select('SELECT version FROM india_schema_migrations ORDER BY version')).map(r=>r.version):[];
 const report={target:'isolated INDIA UAT D1',read_only:true,missing_tables:missing,versions,
  converted_leads:null,missing_converted_links:null,orphan_links:null,
  orphan_opportunities:null,duplicate_account_names:null,foreign_key_violations:null,
  manifest_count:null};
 if(!missing.length){
  const results=await Promise.all([
   select("SELECT COUNT(*) n FROM india_marketing_leads WHERE status='converted'"),
   select("SELECT COUNT(*) n FROM india_marketing_leads l WHERE l.status='converted' AND NOT EXISTS(SELECT 1 FROM india_sales_lead_links x WHERE x.tenant_id=l.tenant_id AND x.lead_id=l.id)"),
   select("SELECT COUNT(*) n FROM india_sales_lead_links x LEFT JOIN india_marketing_leads l ON l.id=x.lead_id AND l.tenant_id=x.tenant_id LEFT JOIN india_sales_accounts a ON a.id=x.customer_id AND a.tenant_id=x.tenant_id LEFT JOIN india_sales_opportunities o ON o.id=x.opportunity_id AND o.tenant_id=x.tenant_id WHERE l.id IS NULL OR a.id IS NULL OR o.id IS NULL OR o.company_id<>x.customer_id"),
   select("SELECT COUNT(*) n FROM india_sales_opportunities o LEFT JOIN india_sales_accounts a ON a.id=o.company_id AND a.tenant_id=o.tenant_id WHERE a.id IS NULL"),
   select("SELECT COUNT(*) n FROM (SELECT tenant_id,lower(trim(legal_name)) k FROM india_sales_accounts GROUP BY tenant_id,k HAVING COUNT(*)>1)"),
   select('PRAGMA foreign_key_check'),
   select('SELECT COUNT(*) n FROM india_schema_file_manifest')
  ]);
  report.converted_leads=results[0][0]?.n??-1;
  report.missing_converted_links=results[1][0]?.n??-1;
  report.orphan_links=results[2][0]?.n??-1;
  report.orphan_opportunities=results[3][0]?.n??-1;
  report.duplicate_account_names=results[4][0]?.n??-1;
  report.foreign_key_violations=results[5].length;
  report.manifest_count=results[6][0]?.n??0;
 }
 const ok=missing.length===0&&[3,4,5,6,7,8,9,10,11].every(v=>versions.includes(v))&&
  [report.missing_converted_links,report.orphan_links,report.orphan_opportunities,
   report.duplicate_account_names,report.foreign_key_violations].every(n=>n===0)&&
  Number(report.manifest_count)>0;
 console.log(JSON.stringify({...report,result:ok?'PASS':'BLOCKED'},null,2));
 if(!ok)process.exitCode=2;
}
main().catch(e=>{console.error('BLOCKED: '+String(e.message||e).slice(0,180));process.exitCode=2;});
