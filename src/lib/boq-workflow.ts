import { boqTotals, can, type BoQRole, type BoQLine, type CostLine } from './boq-domain';
export type WorkflowAction = 'submit'|'approve'|'reject'|'revise';
export type BoQWorkflowRecord={
 status:string; created_by:string; line_items:BoQLine[]; cost_items:CostLine[]; vat_rate:number;
};
export function checkTransition(
 action:WorkflowAction, row:BoQWorkflowRecord,
 actor:{role:BoQRole;email:string}, reason=''
):{valid:true;note:string}{
 const fail=(message:string):never=>{throw new Error(message);};
 if(action==='submit'){
  if(row.status!=='draft'||!can(actor.role,'submit'))fail('Hanya draft boleh dikirim oleh Sales/Pre-Sales/Finance/Admin');
  return {valid:true,note:'SUBMITTED'};
 }
 if(action==='revise'){
  if(!['submitted','approved','rejected'].includes(row.status)||!can(actor.role,'create'))
   fail('Revisi hanya diizinkan dari submitted, approved atau rejected');
  return {valid:true,note:'NEW_DRAFT_VERSION'};
 }
 if(!can(actor.role,'approve')||row.status!=='submitted')
  fail('Hanya Approver/Admin yang dapat memutuskan dokumen berstatus submitted');
 if(actor.email.toLowerCase()===row.created_by.toLowerCase())
  fail('Segregation of Duties: pembuat tidak boleh menyetujui atau menolak dokumen sendiri');
 if(action==='reject'){
  if(reason.trim().length<5)fail('Alasan penolakan harus minimal 5 karakter');
  return {valid:true,note:'REJECTED'};
 }
 const t=boqTotals(row.line_items,row.cost_items,row.vat_rate);
 if(!t.complete)fail('Seluruh HPP A-E harus lengkap sebelum approval');
 if((t.margin??-Infinity)<25&&(actor.role!=='admin'||reason.trim().length<15))
  fail('Margin di bawah 25% wajib disetujui Admin dengan alasan pengecualian minimal 15 karakter');
 return {valid:true,note:'APPROVED'};
}
