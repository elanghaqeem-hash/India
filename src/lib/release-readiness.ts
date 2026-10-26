/**
 * Read-only migration ledger/manifest diagnostics for the Admin health page.
 * Matching SQL identifiers are NOT evidence of an executed rollback, backup,
 * encryption-key continuity, live Cloudflare Access UAT, or a production signoff.
 */
export const REQUIRED_LEDGER_VERSIONS: readonly number[] =
  Array.from({length:19},(_,i)=>i+13);

/** Canonical main paths; pre-0021 ledgers do not necessarily record manifest paths. */
export const CANONICAL_MANIFEST_PATHS: readonly string[] = [
 'migrations/0021_tender_bid_readiness.sql',
 'migrations/0022_document_vault_governance.sql',
 'migrations/0023_tender_vault_integrity.sql',
 'migrations/0024_executive_sales_targets.sql',
 'migrations/0025_vendor_resource_feasibility.sql',
 'migrations/0026_partner_reporting_administration.sql',
 'migrations/0027_customer_delivery_cash_renewal.sql',
 'migrations/0028_ai_mistral_provider.sql',
 'migrations/0029_indonesia_postal_reference.sql',
 'migrations/0030_flexguard_immutable_ledger.sql',
 'migrations/0031_setting_versioned_deletion.sql',
];

type LedgerRow={version:number|string};
type ManifestRow={path:string};
export type SchemaReadiness={
 status:'reconciled'|'incomplete';
 latest_applied_version:number|null;
 required_through_version:number;
 applied_versions:number[];
 missing_versions:number[];
 missing_manifest_paths:string[];
 conflicting_manifest_paths:string[];
 manifest_without_ledger:string[];
 evidence_scope:string;
};

export function evaluateSchemaReadiness(
 migrations:readonly LedgerRow[], manifest:readonly ManifestRow[]
):SchemaReadiness {
 const applied=migrations.map(x=>Number(x.version)).filter(Number.isSafeInteger);
 const versionSet=new Set(applied);
 const paths=manifest.map(x=>x.path).filter(x=>typeof x==='string');
 const pathSet=new Set(paths);
 const missing_versions=REQUIRED_LEDGER_VERSIONS.filter(v=>!versionSet.has(v));
 const missing_manifest_paths=CANONICAL_MANIFEST_PATHS.filter(p=>!pathSet.has(p));
 const canonicalVersionMap=new Map(CANONICAL_MANIFEST_PATHS.map(p=>[Number(p.slice(11,15)),p]));
 const conflicting_manifest_paths=paths.filter(p=>{
  const found=/^migrations\/(\d{4})_/.exec(p);
  if(!found)return false;
  const canonical=canonicalVersionMap.get(Number(found[1]));
  return canonical!==undefined&&canonical!==p;
 });
 const manifest_without_ledger=paths.filter(p=>{
  const found=/^migrations\/(\d{4})_/.exec(p);
  return found!==null && canonicalVersionMap.has(Number(found[1])) && !versionSet.has(Number(found[1]));
 });
 return {
  status:missing_versions.length||missing_manifest_paths.length||conflicting_manifest_paths.length||manifest_without_ledger.length?'incomplete':'reconciled',
  latest_applied_version:applied.length?Math.max(...applied):null,
  required_through_version:31, applied_versions:applied.sort((a,b)=>a-b),
  missing_versions,missing_manifest_paths,conflicting_manifest_paths,manifest_without_ledger,
  evidence_scope:'Ledger/manifest consistency only. SQL hashes, native backup, restored original documents, Access identities, financial UAT and rollback require independent evidence.',
 };
}


/** A live database ping cannot establish any of these operational proofs. */
export const MASTER_RELEASE_GATES = [
 ['source','Source'],['code_quality','Code Quality'],['database','Database'],
 ['backup','Backup'],['restore','Restore'],['rollback','Rollback'],['access','Access'],
 ['functional','Functional'],['cross_module','Cross-module'],['document_vault','Document Vault'],
 ['finance','Finance'],['flexguard','FlexGuard'],['ai','AI'],['ui_ux','UI/UX'],
 ['security','Security'],['monitoring','Monitoring'],['branding','Branding'],
 ['signoff','Sign-off'],['deployment','Deployment'],
] as const;
export function pendingMasterReleaseGates(){
 return MASTER_RELEASE_GATES.map(([id,label])=>({id,label,status:'BLOCKED' as const,
  reason:'Bukti terverifikasi pada exact release SHA dan environment belum tersedia pada health check ini.'}));
}
