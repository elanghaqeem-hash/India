export type Bid = {channel:string;bid_decision:string;decided_by:string|null;tender_number:string;tender_deadline:string}|null;
export type Requirement = {id:string;kind:string;title:string;status:string;compliance_status:string;file_reference:string;source_content_hash:string;reviewed_by:string|null};
export type Clause = {id:string;requirement_id:string;clause_reference:string;category:string;mandatory:number;requirement_text:string;response_text:string;status:string;compliance_status:string;is_gap:number;evidence_reference:string;evidence_sha256:string;reviewed_by:string|null};
export type Checklist = {id:string;item_code:string;category:string;label:string;mandatory:number;document_name:string;evidence_reference:string;evidence_sha256:string;source_clause_id:string|null;due_at:string|null;status:string;version:number;created_by:string;checked_by:string|null;review_notes:string|null};
export type Deadline = {id:string;milestone:string;due_at:string;status:string;notes:string;version:number;created_by:string;reviewed_by:string|null;review_notes:string|null};
export const checklistCategories=['administrative','technical','commercial'] as const;
export const milestoneKinds=['clarification','aanwijzing','administrative','technical','commercial','submission'] as const;
export const shaValid=(v:string)=>/^[a-f0-9]{64}$/i.test(v);
export function validDeadline(s:string):boolean {
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
 if(!m)return false;
 const [y,mo,d,h,mi,se]=m.slice(1,7).map(Number);
 if(y<2000||y>2100||mo<1||mo>12||d<1||h>23||mi>59||se>59||!Number.isFinite(Date.parse(s)))return false;
 if(new Date(Date.UTC(y,mo-1,d)).getUTCFullYear()!==y||
    new Date(Date.UTC(y,mo-1,d)).getUTCMonth()!==mo-1||
    new Date(Date.UTC(y,mo-1,d)).getUTCDate()!==d)return false;
 if(m[7]!=='Z'){const [hh,mm]=m[7].slice(1).split(':').map(Number);if(hh>14||mm>59||(hh===14&&mm!==0))return false;}
 return true;
}
const quote=(x:unknown)=>{
 let s=String(x??'');
 if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
};
export function safeCSV(rows:unknown[][]):string {
 return '\uFEFF'+rows.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
}
export type Report={ready:boolean;gaps:string[];deadline_status:'missing'|'pending_review'|'expired'|'due_soon'|'scheduled';deadline_at:string|null;hours_remaining:number|null;mandatory_total:number;mandatory_ready:number;clause_total:number;clause_compliant:number;matrix_total:number;matrix_compliant:number;score:number};
export function buildBidReport(bid:Bid,requirements:Requirement[],clauses:Clause[],checklist:Checklist[],deadlines:Deadline[],now=new Date()):Report {
 const gaps:string[]=[];
 if(!bid||!['rfq','rfp','tender'].includes(bid.channel)||bid.bid_decision!=='go'||!bid.decided_by)gaps.push('Bid/No-Bid GO independen belum tersedia untuk paket tender.');
 const rks=requirements.filter(r=>['rks','kak','rfp','rfq'].includes(r.kind));
 if(!rks.length)gaps.push('Registrasi RKS/KAK/RFP/RFQ belum tersedia.');
 let compliant=0;
 for(const r of rks){
  const lines=clauses.filter(c=>c.requirement_id===r.id);
  const mandatory=lines.filter(c=>c.mandatory===1);
  const gap=mandatory.some(c=>c.is_gap!==0||c.status!=='reviewed'||c.compliance_status!=='compliant'||!shaValid(c.evidence_sha256)||!c.evidence_reference);
  const ok=r.status==='reviewed'&&r.compliance_status==='compliant'&&!!r.reviewed_by&&shaValid(r.source_content_hash)&&!!r.file_reference&&mandatory.length>0&&!gap;
  if(ok)compliant++;else gaps.push('RKS/KAK "'+r.title+'" belum lengkap/ditinjau atau masih memiliki klausul mandatory tidak patuh.');
 }
 const mandatory=checklist.filter(c=>c.mandatory===1);
 const valid=(c:Checklist)=>c.status==='ready'&&!!c.checked_by&&c.checked_by.toLowerCase()!==c.created_by.toLowerCase()&&!!c.document_name&&c.evidence_reference.length>=8&&shaValid(c.evidence_sha256)&&(!c.due_at||(validDeadline(c.due_at)&&Date.parse(c.due_at)>=now.getTime()));
 const checked=mandatory.filter(valid);
 for(const category of checklistCategories)if(!mandatory.some(c=>c.category===category))gaps.push('Checklist mandatory kategori '+category+' belum didaftarkan.');
 for(const c of mandatory)if(!valid(c))gaps.push('Dokumen mandatory '+c.item_code+' belum ready dengan evidence dan review independen.');
 const sub=deadlines.find(d=>d.milestone==='submission');
 let deadline_status:Report['deadline_status']='missing',hours_remaining:number|null=null;
 if(!sub||!validDeadline(sub.due_at))gaps.push('Deadline submission dengan tanggal, jam, dan offset zona waktu belum tercatat.');
 else{
  hours_remaining=Number(((Date.parse(sub.due_at)-now.getTime())/3600000).toFixed(2));
  if(sub.status!=='approved'||!sub.reviewed_by||sub.reviewed_by.toLowerCase()===sub.created_by.toLowerCase()){
   deadline_status='pending_review';gaps.push('Deadline submission belum disahkan reviewer independen.');
  }else if(hours_remaining<=0){deadline_status='expired';gaps.push('Batas akhir submission telah lewat.');}
  else deadline_status=hours_remaining<=72?'due_soon':'scheduled';
 }
 const total=1+Math.max(1,rks.length)+3+mandatory.length;
 const complete=(bid?.bid_decision==='go'&&!!bid.decided_by?1:0)+compliant+checklistCategories.filter(x=>mandatory.some(c=>c.category===x)).length+checked.length;
 return {ready:gaps.length===0,gaps,deadline_status,deadline_at:sub?.due_at||null,hours_remaining,
  mandatory_total:mandatory.length,mandatory_ready:checked.length,clause_total:clauses.length,clause_compliant:clauses.filter(c=>c.status==='reviewed'&&c.compliance_status==='compliant'&&!c.is_gap).length,
  matrix_total:rks.length,matrix_compliant:compliant,score:Math.min(100,Math.round(100*complete/total))};
}
export function matrixCSV(rows:Clause[],requirements:Requirement[]):string {
 const names=new Map(requirements.map(x=>[x.id,x.title]));
 return safeCSV([['RKS/KAK','Pasal','Kategori','Mandatory','Persyaratan','Respon','Status','Compliance','Evidence Reference','SHA-256','Reviewer','Gap'],
 ...rows.map(c=>[names.get(c.requirement_id)||c.requirement_id,c.clause_reference,c.category,c.mandatory?'Ya':'Tidak',c.requirement_text,c.response_text,c.status,c.compliance_status,c.evidence_reference,c.evidence_sha256,c.reviewed_by||'',c.is_gap?'Ya':'Tidak'])]);
}
export function checklistCSV(rows:Checklist[]):string {
 return safeCSV([['Kode','Kategori','Persyaratan Dokumen','Mandatory','Nama File','Status','Arsip Bukti','SHA-256','Klausul Terkait','Batas Waktu','Reviewer','Catatan'],
 ...rows.map(c=>[c.item_code,c.category,c.label,c.mandatory?'Ya':'Tidak',c.document_name,c.status,c.evidence_reference,c.evidence_sha256,c.source_clause_id||'',c.due_at||'',c.checked_by||'',c.review_notes||''])]);
}
export function reportCSV(report:Report,opp:string,title:string):string{
 return safeCSV([['Bid Readiness Report','INDIA / Technotama'],['Opportunity',opp],['Nama Paket',title],['Hasil',report.ready?'READY':'NOT READY'],
 ['Skor indikatif (bukan izin submission)',report.score],['RKS/KAK lulus',report.matrix_compliant+'/'+report.matrix_total],
 ['Klausul compliant',report.clause_compliant+'/'+report.clause_total],['Dokumen mandatory lengkap',report.mandatory_ready+'/'+report.mandatory_total],
 ['Status deadline',report.deadline_status],['Deadline (zona waktu eksplisit)',report.deadline_at||'Belum disahkan'],
 ['Jam tersisa',report.hours_remaining??''],['Catatan','Referensi/SHA-256 tidak membuktikan file asli tersedia; lakukan verifikasi Document Vault.'],
 ['Gap','Penjelasan'],...report.gaps.map((x,i)=>['GAP-'+(i+1),x])]);
}
