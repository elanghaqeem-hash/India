export type Submission={id:string;opportunity_id:string;boq_id:string;boq_version:number;
 quotation_number:string;recipient_email:string;channel:string;status:string;created_by:string;
 evidence_reference:string;evidence_sha256:string;verified_by:string|null};
export type FinalBoq={id:string;version:number;quotation_number:string;status:string;opportunity_id:string|null};
export const sha256Valid=(value:string)=>/^[a-f0-9]{64}$/i.test(value);
export const same=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
export function verifySubmissionRights(doc:Submission,role:string,actor:string):string|null{
 if(!['approver','finance','admin'].includes(role))return 'Hanya Finance/Approver/Admin yang dapat memverifikasi pengiriman quotation';
 if(same(doc.created_by,actor))return 'Segregation of Duties: pembuat bukti tidak boleh menjadi reviewer sendiri';
 if(doc.status!=='reported')return 'Hanya bukti pengiriman berstatus Reported yang boleh diverifikasi';
 if(!doc.evidence_reference||!sha256Valid(doc.evidence_sha256))return 'Referensi dan checksum asli wajib untuk verifikasi';
 return null;
}
export function submissionMatches(doc:Submission,boq:FinalBoq,opportunityId:string):boolean{
 return doc.status==='verified'&&!!doc.verified_by&&doc.id!==''&&doc.opportunity_id===opportunityId&&
 boq.opportunity_id===opportunityId&&boq.status==='approved'&&
 doc.boq_id===boq.id&&doc.boq_version===boq.version&&doc.quotation_number===boq.quotation_number&&
 sha256Valid(doc.evidence_sha256);
}
