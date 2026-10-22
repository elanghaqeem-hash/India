#!/usr/bin/env node
/** Build ONE atomic D1 batch. This module never connects to a remote database.
 * Callers must verify backup restore, maintenance and remote batch rollback first.
 * Do not send statements in separate HTTP requests or retry an ambiguous write.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
export const canonicalFiles=[
 '0005_marketing_lead_flow.sql','0006_bid_and_requirements.sql',
 '0007_quotation_submission.sql','0008_po_legal_evidence.sql',
 '0009_lead_request_idempotency.sql','0010_marketing_campaigns.sql',
 '0011_marketing_sales_consolidation.sql'
];

// These checked-in migrations contain ordinary DDL/DML, no trigger bodies.
// Respect quoted strings, quoted names and SQL comments when splitting files.
export function splitSql(sql){
 const result=[];let current='',quote='',comment='';
 for(let i=0;i<sql.length;i++){
  const c=sql[i],next=sql[i+1];
  if(comment==='line'){if(c==='\n'){comment='';current+='\n';}continue;}
  if(comment==='block'){if(c==='*'&&next==='/'){comment='';i++;current+=' ';}continue;}
  if(quote){current+=c;if(c===quote){if(next===quote){current+=next;i++;}else quote='';}continue;}
  if(c==='-'&&next==='-'){comment='line';i++;continue;}
  if(c==='/'&&next==='*'){comment='block';i++;continue;}
  if(c==="'"||c==='"'||c==='`'){quote=c;current+=c;continue;}
  if(c==='['){quote=']';current+=c;continue;}
  if(c===';'){if(current.trim())result.push(current.trim());current='';continue;}
  current+=c;
 }
 if(quote||comment==='block')throw Error('Incomplete SQL input');
 if(current.trim())result.push(current.trim());
 if(result.some(s=>/^CREATE\s+(TEMP\s+)?TRIGGER\b/i.test(s)))throw Error('Trigger files require explicit statement boundaries');
 return result;
}

const literal=s=>"'"+s.replaceAll("'","''")+"'";
const assertion=(label,predicate)=>`INSERT INTO _india_bridge_assertions(label,ok) SELECT ${literal(label)},CASE WHEN (${predicate}) THEN 1 ELSE 0 END`;
const originals=['india_sales_accounts','india_sales_opportunities','india_sales_audit','india_members'];
export function buildBridgePlan(){
 const statements=[
  'CREATE TABLE _india_bridge_assertions(label TEXT PRIMARY KEY,ok INTEGER NOT NULL CHECK(ok=1))',
  assertion('legacy_shape',`(SELECT COUNT(*) FROM pragma_table_info('india_marketing_leads'))=22 AND NOT EXISTS(SELECT 1 FROM pragma_table_info('india_marketing_leads') WHERE name NOT IN ('id','tenant_id','company_name','contact_name','contact_email','contact_phone','service_interest','lead_source','campaign_code','qualification_notes','budget_status','decision_authority','requirement_summary','target_date','status','owner_email','converted_account_id','converted_opportunity_id','created_by','created_at','updated_at','version'))`),
  assertion('legacy_event_shape',`(SELECT COUNT(*) FROM pragma_table_info('india_marketing_lead_events'))=9 AND NOT EXISTS(SELECT 1 FROM pragma_table_info('india_marketing_lead_events') WHERE name NOT IN ('id','tenant_id','lead_id','action','actor_email','from_status','to_status','detail','created_at'))`),
  assertion('no_partial_bridge',`NOT EXISTS(SELECT 1 FROM sqlite_master WHERE name IN ('india_marketing_leads_phase18_archive','india_marketing_lead_events_phase18_archive','india_sales_lead_links','india_marketing_campaigns','india_schema_file_manifest','india_members_v2'))`),
  assertion('foreign_keys_before',`NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)`),
  assertion('converted_lineage_before',`NOT EXISTS(SELECT 1 FROM india_marketing_leads l LEFT JOIN india_sales_accounts a ON a.tenant_id=l.tenant_id AND a.id=l.converted_account_id LEFT JOIN india_sales_opportunities o ON o.tenant_id=l.tenant_id AND o.id=l.converted_opportunity_id WHERE (l.status='converted' AND (a.id IS NULL OR o.id IS NULL OR o.company_id<>a.id OR lower(a.created_by)<>lower(l.owner_email) OR lower(o.created_by)<>lower(l.owner_email))) OR (l.status<>'converted' AND (l.converted_account_id IS NOT NULL OR l.converted_opportunity_id IS NOT NULL)))`),
  assertion('customer_names_before',`NOT EXISTS(SELECT 1 FROM india_sales_accounts GROUP BY tenant_id,lower(trim(legal_name)) HAVING COUNT(*)>1)`),
  ...originals.map(t=>`CREATE TABLE _india_bridge_before_${t} AS SELECT * FROM ${t}`),
  ...splitSql(read('scripts/india-pr18-to-canonical-pre.sql')),
  ...canonicalFiles.flatMap(f=>splitSql(read('migrations/'+f))),
  ...splitSql(read('scripts/india-pr18-to-canonical-post.sql')),
  // The old UAT provisioner omitted version 3 despite the actual Sales tables.
  // Their exact data is compared below; establish file provenance explicitly.
  'INSERT OR IGNORE INTO india_schema_migrations(version) VALUES(3)',
  ...['0003_sales_workflow.sql','0004_india_sales_isolation.sql'].map(f=>`INSERT INTO india_schema_file_manifest(path,source_branch) VALUES(${literal('migrations/'+f)},'verified-existing-sales')`),
  assertion('lead_count',`(SELECT COUNT(*) FROM india_marketing_leads)=(SELECT COUNT(*) FROM india_marketing_leads_phase18_archive)`),
  assertion('lead_identity_owner_time',`NOT EXISTS(SELECT 1 FROM india_marketing_leads_phase18_archive a LEFT JOIN india_marketing_leads l ON l.id=a.id AND l.tenant_id=a.tenant_id WHERE l.id IS NULL OR l.account_name<>a.company_name OR l.assigned_sales_email<>a.owner_email OR l.version<>a.version OR l.created_by<>a.created_by OR l.created_at<>a.created_at OR l.updated_at<>a.updated_at OR l.contact_name<>a.contact_name OR l.contact_email<>a.contact_email OR l.source<>a.lead_source OR l.campaign<>a.campaign_code OR l.service_family<>a.service_interest OR l.expected_closing_date<>a.target_date OR l.status<>CASE a.status WHEN 'contacted' THEN 'assigned' WHEN 'qualified' THEN 'assigned' ELSE a.status END)`),
  assertion('converted_lineage_after',`(SELECT COUNT(*) FROM india_sales_lead_links)=(SELECT COUNT(*) FROM india_marketing_leads_phase18_archive WHERE status='converted') AND NOT EXISTS(SELECT 1 FROM india_marketing_leads_phase18_archive a LEFT JOIN india_sales_lead_links x ON x.tenant_id=a.tenant_id AND x.lead_id=a.id WHERE a.status='converted' AND (x.lead_id IS NULL OR x.customer_id<>a.converted_account_id OR x.opportunity_id<>a.converted_opportunity_id))`),
  assertion('event_count',`(SELECT COUNT(*) FROM india_marketing_lead_events)=(SELECT COUNT(*) FROM india_marketing_lead_events_phase18_archive)`),
  assertion('event_contents',`NOT EXISTS(SELECT * FROM india_marketing_lead_events_phase18_archive EXCEPT SELECT * FROM india_marketing_lead_events) AND NOT EXISTS(SELECT * FROM india_marketing_lead_events EXCEPT SELECT * FROM india_marketing_lead_events_phase18_archive)`),
  ...originals.map(t=>assertion('preserve_'+t,`(SELECT COUNT(*) FROM ${t})=(SELECT COUNT(*) FROM _india_bridge_before_${t}) AND NOT EXISTS(SELECT * FROM ${t} EXCEPT SELECT * FROM _india_bridge_before_${t}) AND NOT EXISTS(SELECT * FROM _india_bridge_before_${t} EXCEPT SELECT * FROM ${t})`)),
  assertion('foreign_keys_after',`NOT EXISTS(SELECT 1 FROM pragma_foreign_key_check)`),
  // Keep imported history immutable at the DB boundary, including direct SQL.
  ...['india_marketing_leads_phase18_archive','india_marketing_lead_events_phase18_archive'].flatMap(t=>['INSERT','UPDATE','DELETE'].map(op=>`CREATE TRIGGER ${t}_${op.toLowerCase()}_blocked BEFORE ${op} ON ${t} BEGIN SELECT RAISE(ABORT,'PR18 archive is immutable'); END`)),
  ...originals.map(t=>`DROP TABLE _india_bridge_before_${t}`),
  'DROP TABLE _india_bridge_assertions'
 ];
 const sha256=createHash('sha256').update(JSON.stringify(statements)).digest('hex');
 return {kind:'india-pr18-to-canonical',atomic_request_required:true,sha256,statements};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.slice(2).join(' ')!=='--plan'){
  console.error('Usage: node scripts/india-pr18-canonical-plan.mjs --plan (offline only)');process.exitCode=2;
 }else console.log(JSON.stringify(buildBridgePlan(),null,2));
}
