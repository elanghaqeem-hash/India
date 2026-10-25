/** Verify a release authority's signed receipt and the actual evidence bytes.
 * Signing authority must be configured in the protected production environment.
 * This validator does not create signatures or certify assertions by itself.
 */
import {readFileSync,realpathSync} from 'node:fs';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash,verify,createPublicKey} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const GATES=['source','code_quality','database','backup','restore','rollback','access',
 'functional','cross_module','document_vault','finance','flexguard','ai','ui_ux','security',
 'monitoring','branding','signoff','deployment'];
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const requireEvidence=(ok,why)=>{if(!ok)throw Error(why);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyReleaseEvidence({receiptPath,publicKey,sha,phase='before',now=Date.now()}){
 requireEvidence(receiptPath&&publicKey,'SIGNED_RELEASE_EVIDENCE_MISSING');
 requireEvidence(/^[a-f0-9]{40}$/.test(sha||''),'INVALID_RELEASE_SHA');
 requireEvidence(['before','after'].includes(phase),'INVALID_RELEASE_PHASE');
 const envelope=JSON.parse(readFileSync(receiptPath,'utf8'));
 const key=createPublicKey(publicKey);
 requireEvidence(key.asymmetricKeyType==='ed25519','ED25519_RELEASE_AUTHORITY_REQUIRED');
 requireEvidence(typeof envelope.signature==='string'&&verify(null,Buffer.from(JSON.stringify(envelope.payload)),key,Buffer.from(envelope.signature,'base64')),'INVALID_RELEASE_SIGNATURE');
 const p=envelope.payload;
 requireEvidence(p.schema_version===1&&p.release_sha===sha,'STALE_RELEASE_EVIDENCE');
 requireEvidence(p.environment==='production'&&p.worker==='india'&&p.database_id==='8395dd84-1b7d-4eaf-9990-1d8e75a42cb5','RELEASE_TARGET_MISMATCH');
 requireEvidence(Number.isFinite(Date.parse(p.issued_at))&&Date.parse(p.issued_at)<=now&&Date.parse(p.expires_at)>now&&Date.parse(p.expires_at)-Date.parse(p.issued_at)<=24*60*60*1000,'EXPIRED_RELEASE_EVIDENCE');
 const dir=realpathSync(dirname(resolve(receiptPath)));
 const checkFile=e=>{
  requireEvidence(e&&typeof e.path==='string'&&!isAbsolute(e.path)&&/^[a-f0-9]{64}$/.test(e.sha256||''),'INVALID_EVIDENCE_REFERENCE');
  const path=realpathSync(resolve(dir,e.path)),rel=relative(dir,path);
  requireEvidence(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'EVIDENCE_OUTSIDE_BUNDLE');
  requireEvidence(hash(readFileSync(path))===e.sha256,'EVIDENCE_CHECKSUM_MISMATCH');
 };
 requireEvidence(Array.isArray(p.gates)&&p.gates.length===GATES.length&&new Set(p.gates.map(g=>g.id)).size===GATES.length,'INCOMPLETE_RELEASE_GATES');
 for(const id of GATES){
  const g=p.gates.find(g=>g.id===id);
  requireEvidence(g&&['PASS','FAIL','BLOCKED','NOT RUN','NOT APPLICABLE'].includes(g.status),'INVALID_GATE_STATUS_'+id);
  // Post-deployment proof is required only after deployment. No circular GO prerequisite.
  if(id==='deployment'&&phase==='before')continue;
  requireEvidence(g.status==='PASS'&&Array.isArray(g.evidence)&&g.evidence.length>0,'MANDATORY_GATE_NOT_PASS_'+id);
  g.evidence.forEach(checkFile);
 }
 const expected=JSON.parse(readFileSync(resolve(ROOT,'docs/INDIA_UAT_210_CATALOG.json'),'utf8')).cases;
 requireEvidence(Array.isArray(p.uat)&&p.uat.length===210&&new Set(p.uat.map(t=>t.id)).size===210,'UAT_210_REQUIRED');
 for(const c of expected){
  const t=p.uat.find(t=>t.id===c.id);
  requireEvidence(t&&t.priority===c.priority&&t.status==='PASS'&&t.release_sha===sha&&t.execution_kind==='real_cloudflare_access'&&t.actual_result&&t.tester_subject&&Number.isFinite(Date.parse(t.executed_at)),'REAL_UAT_MISSING_'+c.id);
  requireEvidence(Array.isArray(t.evidence)&&t.evidence.length>0,'UAT_EVIDENCE_MISSING_'+c.id);
  t.evidence.forEach(checkFile);
 }
 const roster=p.identities;
 requireEvidence(Array.isArray(roster)&&new Set(roster.map(i=>i.subject)).size===roster.length,'DISTINCT_IDENTITIES_REQUIRED');
 for(const [role,count] of Object.entries({admin:1,marketing:1,sales:2,presales:1,finance:1,approver:1,legal:1,viewer:1})){
  requireEvidence(roster.filter(i=>i.role===role&&i.auth_method==='cloudflare_access'&&i.jwt_signature_verified===true&&i.subject&&i.audience&&i.issuer?.endsWith('.cloudflareaccess.com')).length>=count,'REAL_ACCESS_ROLE_MISSING_'+role);
 }
 requireEvidence(p.uat.every(t=>roster.some(i=>i.subject===t.tester_subject)),'UAT_TESTER_NOT_IN_VERIFIED_ROSTER');
 for(const kind of ['security','finance','operations','release']){
  const s=p.signoffs?.find(s=>s.kind===kind);
  requireEvidence(s?.decision==='APPROVED'&&s.release_sha===sha&&s.subject&&s.reference,'SIGNOFF_MISSING_'+kind);
 }
 requireEvidence(p.open_critical===0&&p.open_high===0,'OPEN_CRITICAL_HIGH_DEFECTS');
 return {status:'PASS',decision:phase==='before'?'GO':'RELEASE_VERIFIED',release_sha:sha,verified_by:'configured_release_authority_signature',uat_pass:210};
}
