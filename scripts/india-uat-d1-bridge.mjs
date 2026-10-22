#!/usr/bin/env node
/** UAT-only bridge. Exactly one write request; never retries an ambiguous commit. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildBridgePlan} from './india-pr18-canonical-plan.mjs';

export const ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
export const UAT='eaed652e-7322-4950-a304-dd50baa5de02';
const tables=['india_marketing_leads','india_marketing_lead_events','india_sales_accounts',
 'india_sales_opportunities','india_sales_audit','india_members','india_schema_migrations'];
export const snapshotQueries=[
 "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name",
 ...tables.map(t=>'SELECT * FROM '+t+' ORDER BY '+(t==='india_members'?'email':t==='india_schema_migrations'?'version':'id'))
];
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'
 ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const fingerprint=rows=>createHash('sha256').update(JSON.stringify(stable(rows))).digest('hex');
export function verifyBackup(path,expectedHash){
 if(!/^[a-f0-9]{64}$/.test(expectedHash||''))throw Error('Explicit SHA-256 of the saved export is required');
 const bytes=readFileSync(path),sha256=createHash('sha256').update(bytes).digest('hex');
 if(sha256!==expectedHash)throw Error('Backup SHA-256 mismatch');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA foreign_keys=ON');db.exec(bytes.toString('utf8'));
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Restored backup has invalid foreign keys');
  const source=fingerprint(snapshotQueries.map(q=>db.prepare(q).all()));
  const plan=buildBridgePlan();db.exec('BEGIN IMMEDIATE');
  try{for(const statement of plan.statements)db.exec(statement);db.exec('COMMIT');}
  catch(e){db.exec('ROLLBACK');throw e;}
  return {backup_sha256:sha256,source_fingerprint:source,plan_sha256:plan.sha256,
   restore_and_migration:'PASS',statements:plan.statements.length};
 }finally{db.close();}
}
export async function main(args=process.argv.slice(2),env=process.env){
 if((env.INDIA_UAT_D1_ID||UAT)!==UAT)throw Error('DENIED: target must be the pinned isolated INDIA UAT database');
 const [mode,path,hash,...extra]=args;
 if(!['--check-backup','--apply'].includes(mode)||!path||!hash||extra.length)
  throw Error('Usage: --check-backup|--apply BACKUP_SQL SHA256');
 const verified=verifyBackup(path,hash);
 if(mode==='--check-backup'){console.log(JSON.stringify(verified,null,2));return;}
 if(env.INDIA_UAT_MAINTENANCE_CONFIRMED!=='1'||env.INDIA_UAT_REMOTE_ROLLBACK_VERIFIED!=='1')
  throw Error('BLOCKED: maintenance and remote rollback rehearsal must both be verified');
 const token=env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('NOT RUN: missing Cloudflare token');
 const url=`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${UAT}/query`;
 const query=async sql=>{
  const res=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
  const payload=await res.json();
  if(!res.ok||payload.success!==true||!Array.isArray(payload.result)||payload.result.some(x=>x.success!==true))
   throw Error('D1 request failed; inspect state read-only before any further write');
  return payload.result.map(x=>x.results);
 };
 const before=await query(snapshotQueries.join(';'));
 if(fingerprint(before)!==verified.source_fingerprint)throw Error('BLOCKED: live UAT changed since the backup');
 const plan=buildBridgePlan();
 // A D1 REST query with all statements is one batch, including validation CHECKs.
 // Remote DDL rollback must have been proven against a restored clone first.
 await query(plan.statements.join(';\n')+';');
 const after=await query('SELECT COUNT(*) n FROM india_sales_lead_links; PRAGMA foreign_key_check');
 if(after[1].length)throw Error('BLOCKED: post-migration foreign key verification failed');
 console.log(JSON.stringify({...verified,target:'isolated INDIA UAT',migration:'PASS',converted_links:after[0][0].n},null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error(String(e.message||e).slice(0,220));process.exitCode=2;});
