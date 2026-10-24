import {getCloudflareContext} from '@opennextjs/cloudflare';
import type {D1DB} from './boq-auth';
import {TENANT} from './sales-workflow';
import {vaultID} from './document-vault-links';
export {vaultID,vaultDownload} from './document-vault-links';
import JSZip from 'jszip';

export const VAULT_MAX_BYTES=8*1024*1024;
export const VAULT_CHUNK_BYTES=256*1024;
export const VAULT_KINDS=['proposal','submission','negotiation','po','spk','contract','award_letter'] as const;
export type VaultKind=typeof VAULT_KINDS[number];
export type VaultDoc={id:string;tenant_id:string;opportunity_id:string;release_id:string;kind:string;file_name:string;media_type:string;byte_length:number;sha256:string;iv:string;chunk_count:number;created_by:string;created_at?:string};
const utf8=new TextEncoder();
const b64=(bytes:Uint8Array)=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const vaultReference=(id:string)=>'vault:'+id;
export const documentHash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),x=>x.toString(16).padStart(2,'0')).join('');
export async function documentKey(){
 const env=(await getCloudflareContext({async:true})).env as {INDIA_DOCUMENT_ENCRYPTION_KEY?:string};
 if(!env.INDIA_DOCUMENT_ENCRYPTION_KEY)throw Error('VAULT_KEY_UNAVAILABLE');
 const bytes=unb64(env.INDIA_DOCUMENT_ENCRYPTION_KEY);
 if(bytes.length!==32)throw Error('VAULT_KEY_UNAVAILABLE');
 return crypto.subtle.importKey('raw',new Uint8Array(bytes),'AES-GCM',false,['encrypt','decrypt']);
}
const aad=(d:VaultDoc)=>utf8.encode(JSON.stringify(['INDIA-DOCUMENT-v1',d.id,d.tenant_id,d.opportunity_id,d.release_id,d.kind,d.file_name,d.media_type,d.byte_length,d.sha256]));
export async function sealDocument(doc:VaultDoc,bytes:Uint8Array){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(doc)},await documentKey(),new Uint8Array(bytes)));
 const chunks:string[]=[];for(let i=0;i<encrypted.length;i+=VAULT_CHUNK_BYTES)chunks.push(b64(encrypted.subarray(i,i+VAULT_CHUNK_BYTES)));
 return {iv:b64(iv),chunks};
}
export async function openDocument(db:D1DB,doc:VaultDoc,source:'release'|'library'='release'){
 const chunkTable=source==='library'?'india_document_library_chunks':'india_document_chunks';
 // Bound each database response even for the maximum-sized original.
 const rows:{part:number;ciphertext:string}[]=[];
 for(let offset=0;offset<doc.chunk_count;offset+=4){const page=await db.prepare('SELECT part,ciphertext FROM '+chunkTable+' WHERE document_id=? ORDER BY part LIMIT 4 OFFSET ?').bind(doc.id,offset).all<{part:number;ciphertext:string}>();rows.push(...page.results);}
 if(rows.length!==doc.chunk_count||rows.some((r,i)=>r.part!==i))throw Error('VAULT_INTEGRITY');
 const chunks=rows.map(r=>unb64(r.ciphertext)),size=chunks.reduce((n,c)=>n+c.length,0);
 if(size!==doc.byte_length+16)throw Error('VAULT_INTEGRITY');
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 const bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(unb64(doc.iv)),additionalData:aad(doc)},await documentKey(),data));
 if(bytes.length!==doc.byte_length||await documentHash(bytes)!==doc.sha256)throw Error('VAULT_INTEGRITY');
 return bytes;
}
export async function requireVaultDocument(db:D1DB,reference:string,sha:string,opportunity:string,release:string,kind:string){
 const id=vaultID(reference);if(!id)throw Error('VAULT_EVIDENCE: Unggah dokumen asli ke Document Vault.');
 const doc=await db.prepare('SELECT * FROM india_document_vault WHERE id=? AND tenant_id=? AND opportunity_id=? AND release_id=? AND kind=? AND sha256=?').bind(id,TENANT,opportunity,release,kind,sha.toLowerCase()).first<VaultDoc>();
 if(!doc)throw Error('VAULT_EVIDENCE: Dokumen, checksum atau versi paket tidak cocok.');
 // Authenticate the stored bytes before evidence can advance a transaction.
 await openDocument(db,doc);return doc;
}
export async function inspectDocument(name:string,bytes:Uint8Array):Promise<string|null>{
 const ext=name.toLowerCase().split('.').pop(),head=new TextDecoder().decode(bytes.subarray(0,8));
 if(ext==='docx'&&bytes[0]===80&&bytes[1]===75){try{const zip=await JSZip.loadAsync(bytes);if(zip.file('[Content_Types].xml')&&zip.file('word/document.xml')&&!Object.keys(zip.files).some(x=>/vbaProject|\.bin$/i.test(x)))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';}catch{return null;}}
 if(ext==='pdf'&&head.startsWith('%PDF-'))return 'application/pdf';
 if(['jpg','jpeg'].includes(ext||'')&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(ext==='png'&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(ext==='eml'&&/^(From|To|Received|MIME-Version|Date|Subject):/i.test(new TextDecoder().decode(bytes.subarray(0,100))))return 'message/rfc822';
 return null;
}
export function vaultError(e:unknown){
 const s=String(e);if(s.includes('VAULT_EVIDENCE:'))return {status:422,message:s.slice(s.indexOf('VAULT_EVIDENCE:')+16)};
 if(s.includes('VAULT_KEY_UNAVAILABLE'))return {status:503,message:'Kunci Document Vault belum dikonfigurasi.'};
 return {status:503,message:'Dokumen tidak tersedia atau integritas penyimpanan gagal diperiksa.'};
}

/** Reauthenticate exactly the four originals used by the accepted current release before Won. */
export async function authenticateWonOriginals(db:D1DB,opportunity:string){
 const row=await db.prepare(`SELECT r.id AS release_id,r.proposal_reference,r.proposal_sha256,
 s.evidence_reference AS submission_ref,s.evidence_sha256 AS submission_sha,
 n.evidence_reference AS decision_ref,n.evidence_sha256 AS decision_sha,
 a.archive_reference AS award_ref,a.original_sha256 AS award_sha,a.document_kind
 FROM india_sales_releases r
 JOIN india_sales_negotiations n ON n.release_id=r.id AND n.tenant_id=r.tenant_id AND n.opportunity_id=r.opportunity_id
 AND n.rowid=(SELECT max(n2.rowid) FROM india_sales_negotiations n2 WHERE n2.release_id=r.id) AND n.decision='approved'
 JOIN india_sales_submissions s ON s.id=n.submission_id AND s.release_id=r.id AND s.tenant_id=r.tenant_id AND s.opportunity_id=r.opportunity_id AND s.status='verified'
 JOIN india_sales_po_checks c ON c.release_id=r.id AND c.tenant_id=r.tenant_id AND c.opportunity_id=r.opportunity_id
 JOIN india_sales_award_documents a ON a.id=c.award_id AND a.release_id=r.id AND a.tenant_id=r.tenant_id AND a.opportunity_id=r.opportunity_id
 WHERE r.tenant_id=? AND r.opportunity_id=? AND r.status='approved'`).bind(TENANT,opportunity)
 .first<{release_id:string;proposal_reference:string;proposal_sha256:string;submission_ref:string;submission_sha:string;decision_ref:string;decision_sha:string;award_ref:string;award_sha:string;document_kind:string}>();
 if(!row)throw Error('VAULT_EVIDENCE: Empat dokumen asli versi paket yang sama wajib sebelum Won.');
 for(const [reference,sha,kind] of [[row.proposal_reference,row.proposal_sha256,'proposal'],[row.submission_ref,row.submission_sha,'submission'],[row.decision_ref,row.decision_sha,'negotiation'],[row.award_ref,row.award_sha,row.document_kind]])
  await requireVaultDocument(db,reference,sha,opportunity,row.release_id,kind);
}
