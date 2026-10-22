import type {D1DB} from '@/lib/boq-auth';
import type {Requirement,Clause,Checklist} from '@/lib/bid-readiness';
import {TENANT} from '@/lib/sales-workflow';
import {openDocument,type VaultDoc} from '@/lib/document-vault';

/**
 * All tender evidence is bound to the current Opportunity, the server-computed
 * SHA-256 and the original immutable encrypted bytes. User-entered filenames,
 * archive locators and SHA strings alone are not sufficient.
 */
type Original={document_id:string;kind:string;file_name:string;evidence_reference:string;sha256:string};
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export async function tenderVaultGaps(db:D1DB,opportunity:string,requirements:Requirement[],clauses:Clause[],checklist:Checklist[]){
 const {results}=await db.prepare('SELECT document_id,kind,file_name,evidence_reference,sha256 FROM india_tender_vault_originals WHERE tenant_id=? AND opportunity_id=? LIMIT 501')
  .bind(TENANT,opportunity).all<Original>();
 if(results.length>500)return ['Jumlah dokumen asli melebihi batas verifikasi 500; lakukan pemeriksaan arsip.'];
 const matches=(ref:string,hash:string,name?:string,kind?:string)=>
   results.some(v=>v.evidence_reference===ref&&same(v.sha256,hash)&&(!name||v.file_name===name)&&(!kind||v.kind===kind));
 const gaps:string[]=[];
 for(const r of requirements){
  const kind=['rks','kak'].includes(r.kind)?r.kind:'supporting';
  if(!matches(r.file_reference,r.source_content_hash,undefined,kind))gaps.push('Sumber RKS/KAK '+r.title+' belum terhubung ke file asli Vault.');
 }
 for(const c of clauses.filter(c=>c.mandatory===1))
  if(!matches(c.evidence_reference,c.evidence_sha256))gaps.push('Klausul '+c.clause_reference+' belum memiliki bukti asli yang sesuai.');
 for(const c of checklist.filter(c=>c.mandatory===1))
  if(!matches(c.evidence_reference,c.evidence_sha256,c.document_name))gaps.push('Checklist '+c.item_code+' belum memiliki file asli Vault yang cocok.');
 return gaps;
}
export async function authenticateTenderOriginal(db:D1DB,opportunity:string,reference:string,sha:string,filename:string){
 const row=await db.prepare(`SELECT * FROM india_document_library WHERE tenant_id=? AND opportunity_id=?
 AND 'vault:'||id=? AND sha256=? AND file_name=?`).bind(TENANT,opportunity,reference,sha.toLowerCase(),filename).first<VaultDoc>();
 if(!row)throw Error('TENDER_VAULT_EVIDENCE: file asli/Opportunity/SHA-256 tidak cocok');
 await openDocument(db,row,'library'); // AES-GCM AAD + SHA-256; fails closed on corruption/missing key.
 return row;
}
