export type AwardDoc={id:string;opportunity_id:string;document_kind:string;document_number:string;archive_reference:string;original_sha256:string;
 created_by:string;finance_reviewed_by:string|null;legal_reviewed_by:string|null};
export const validDigest=(x:string)=>/^[0-9a-f]{64}$/i.test(x);
export function awardReviewAllowed(doc:AwardDoc,role:string,email:string,kind:'finance'|'legal'):string|null{
 if(kind==='finance'&&!['finance','approver'].includes(role))return 'Pemeriksaan finance hanya Finance/Approver';
 if(kind==='legal'&&role!=='legal')return 'Legal approval harus diberikan pengguna berperan Legal';
 if(doc.created_by.toLowerCase()===email.toLowerCase())return 'Maker–Checker: pengunggah referensi award tidak boleh mereview sendiri';
 if(!doc.archive_reference||!validDigest(doc.original_sha256))return 'Referensi arsip asli dan SHA256 wajib valid';
 if(kind==='finance'&&doc.finance_reviewed_by)return 'Bukti sudah diperiksa Finance';
 if(kind==='legal'&&doc.legal_reviewed_by)return 'Bukti sudah diperiksa Legal';
 if(kind==='finance'&&doc.legal_reviewed_by?.toLowerCase()===email.toLowerCase())return 'Finance dan Legal wajib berbeda';
 if(kind==='legal'&&doc.finance_reviewed_by?.toLowerCase()===email.toLowerCase())return 'Finance dan Legal wajib berbeda';
 return null;
}
export function validAwardForWon(doc:AwardDoc,poNumber:string):boolean{
 return ['po','spk'].includes(doc.document_kind)&&
 !!doc.finance_reviewed_by&&!!doc.legal_reviewed_by&&
 doc.finance_reviewed_by.toLowerCase()!==doc.legal_reviewed_by.toLowerCase()&&
 !!doc.archive_reference&&validDigest(doc.original_sha256)&&
 doc.document_number.trim().toLowerCase()===poNumber.trim().toLowerCase();
}
