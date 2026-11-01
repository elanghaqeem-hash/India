#!/usr/bin/env node
/**
 * Catalog audit for INDIA 420-case staged UAT. Does NOT execute business UAT.
 * Only explicit real-user, release-scoped signed evidence may mark a case PASS.
 * Offline source validation; no API calls, D1 writes or production credentials.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const waves=[
 {batch:1,name:'Legacy INDIA business journeys',source:'legacy',count:210},
 {batch:2,name:'General Ledger / Close',prefix:'GL',count:35},
 {batch:3,name:'P2P / AP / Treasury',prefix:'P2P',count:35},
 {batch:4,name:'Cybersecurity Operations',prefix:'OPS',count:45},
 {batch:5,name:'HR / Resource / Assets',prefix:'HR',count:30},
 {batch:6,name:'Cross-domain End-to-End',prefix:'E2E',count:30},
 {batch:7,name:'Security / Access / Recovery',prefix:'SEC',count:35}
];
const argument=process.argv.find(x=>/^--batch=[1-7]$/.test(x));
if(!argument){console.error('Usage: node scripts/india-uat-420-batches.mjs --batch=1..7');process.exit(2)}
const batch=Number(argument.split('=')[1]);
const old=JSON.parse(readFileSync('docs/INDIA_UAT_210_CATALOG.json','utf8')).cases;
const erpDocument=JSON.parse(readFileSync('docs/INDIA_ERP_UAT_210_CATALOG.json','utf8'));
const erp=erpDocument.cases;
const errors=[];
function requireField(test,label){if(!test)errors.push(label)}
requireField(old.length===210,'Legacy catalog does not contain exactly 210 cases');
requireField(erp.length===210,'ERP catalog does not contain exactly 210 cases');
const all=[...old,...erp],ids=all.map(x=>x.id);
requireField(new Set(ids).size===420,'Duplicate or missing case identities across 420 cases');
for(const wave of waves){
 const cases=wave.source==='legacy'?old:erp.filter(c=>c.id.startsWith('ERP-'+wave.prefix+'-'));
 requireField(cases.length===wave.count,'Batch '+wave.batch+' has '+cases.length+' cases; expected '+wave.count);
}
requireField(erpDocument.release_gate==='BLOCKED','ERP catalog release gate must remain BLOCKED until signed UAT');
for(const c of old){
 requireField(!!(c.id&&c.scenario&&c.role&&c.priority),'Incomplete historical definition: '+c.id);
}
const evidence=['environment','source_sha','actor','executed_at','api_or_browser_trace','db_before_after','audit_event','document_or_ledger_reference'];
for(const c of erp){
 requireField(!!(c.id&&c.domain&&c.actor&&c.scenario&&c.preconditions&&c.expected&&c.workflow),'Incomplete ERP definition: '+c.id);
 requireField(Array.isArray(c.steps)&&c.steps.length>=2,'Incomplete ERP steps: '+c.id);
 requireField(['positive','negative'].includes(c.kind),'Missing case kind: '+c.id);
 requireField(evidence.every(k=>c.evidence_required?.includes(k)),'Missing required evidence fields: '+c.id);
 requireField(c.status==='NOT_RUN'&&c.run===null,'ERP status is not NOT_RUN; inspect provenance: '+c.id);
}
const wave=waves.find(x=>x.batch===batch);
const selected=wave.source==='legacy'?old:erp.filter(c=>c.id.startsWith('ERP-'+wave.prefix+'-'));
const row={
 schema:'india-uat420-catalog-batch-v1',
 created_at:new Date().toISOString(),repo:'elanghaqeem-hash/India',source_sha:process.env.GITHUB_SHA||null,
 batch:wave.batch,domain:wave.name,case_count:selected.length,
 case_ids:selected.map(c=>c.id),
 catalog_integrity:errors.length?'FAIL':'PASS',
 structural_issues:errors,
 business_uat_executed_cases:0,
 business_uat_passed_cases:0,
 business_uat_status:'NOT_RUN',
 technical_note:'This is an automated catalog validation only. Separate CI test commands are technical simulations, not signed per-case UAT.',
 release_gate:'HOLD',
 required_next:'Dedicated latest-schema Access UAT; distinct authorized role holders; before/after DB audit; independent recovery and eight function approvals.'
};
const target=join('artifacts','india-uat420','batch-'+batch+'.json');
mkdirSync(join('artifacts','india-uat420'),{recursive:true});
writeFileSync(target,JSON.stringify(row,null,2)+'\n');
console.log(JSON.stringify({batch,selected:selected.length,catalog_integrity:row.catalog_integrity,business_uat:row.business_uat_status,release:row.release_gate,issues:errors.slice(0,12)}));
process.exit(errors.length?1:0);
