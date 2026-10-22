import {requiredForStage, validateAccount, type SalesAccount,type SalesDeal} from './sales-workflow';
import {needsTenderGate} from './sales-procurement';
export type JourneyState='complete'|'pending'|'blocked'|'manual_review';
export type JourneyGate={key:string;label:string;owner:string;state:JourneyState;missing:string[];description:string};
export function salesJourney(a:SalesAccount,d:SalesDeal,input:{
 lead_number?:string|null;boq_status?:string|null;boq_linked?:boolean;
 release_status?:string|null;negotiation_decision?:string|null;quotation_record?:boolean;submission_proof?:boolean;po_check?:boolean;po_original?:boolean;
 legal_approved?:boolean;procurement_gaps?:string[];procurement_required?:boolean;
}):JourneyGate[]{
 const accountGaps=validateAccount(a);
 const phase=(step:'qualified'|'discovery'|'solution_design'|'commercial_review'|'quotation_sent'|'negotiation'|'pending_po'|'closed_won')=>
  requiredForStage(step,d,a);
 const gate=(key:string,label:string,owner:string,state:JourneyState,missing:string[],description:string):JourneyGate=>
 ({key,label,owner,state,missing,description});
 const boqLinked=!!d.fields.boq_id && input.boq_linked===true && input.boq_status==='approved';
 const offer=phase('quotation_sent').length===0;
 const negotiation=phase('negotiation').length===0;
 const signedProof=input.submission_proof===true;
 const poOriginal=input.po_original===true;
 const tenderRequired=input.procurement_required??needsTenderGate(d.fields.procurement_process||'');
 return [
  gate('lead','Marketing / Lead','Marketing',input.lead_number?'complete':'manual_review',
   input.lead_number?[]:['Lead Number belum terhubung (direct Sales entry)'],
   'Lacak campaign dan sumber prospek; direct entry diperbolehkan tetapi harus diketahui'),
  gate('customer','Customer Master','Sales',accountGaps.length?'blocked':'complete',accountGaps,
   'Data pelanggan wajib sebelum Qualified'),
  gate('qualification','Lead/Deal Qualification','Sales',phase('qualified').length?'blocked':'complete',phase('qualified'),
   'Need, budget, pengambil keputusan, procurement, dan target'),
  gate('scoping','Technical Scoping','Presales',phase('discovery').length||input.release_status===null?'blocked':'complete',input.release_status===null?['Validasi Presales pada paket aktif belum tersedia']:phase('discovery'),
   'Scoping teknis, aset, deliverables, dan model delivery'),
  gate('bid','Tender / RKS-KAK / Bid GO','Sales / Presales / Approver',
   tenderRequired?
     (!input.procurement_gaps||input.procurement_gaps.length>0?'blocked':'complete'):'pending',
   tenderRequired?
     (input.procurement_gaps||['Bid/No-Bid dan RKS/KAK belum dievaluasi']):[],
   'Tender/RFQ/RFP harus lulus GO dan compliance review sebelum Quotation'),
  gate('commercial','BoQ & Commercial Approval','Finance / Approver',boqLinked?'complete':'blocked',
   boqLinked?[]:['BoQ approved harus cocok Opportunity ID, customer dan proyek'],
   'Referensi BoQ final, costing dan independen approval'),
  gate('proposal','Proposal / SOW Approval','Presales / Approver',input.release_status==='approved'?'complete':'blocked',input.release_status==='approved'?[]:['Proposal paket aktif belum approved'],'Proposal dan checksum terikat ke versi BoQ dan scope yang sama'),
  gate('quotation','Quotation DOCX','Sales / Approver',
   offer&&boqLinked?(input.release_status==='approved'?'complete':'manual_review'):'blocked',
   offer&&boqLinked?(input.release_status==='approved'?[]:['Persetujuan dokumen final/penandatangan belum otomatis dibuktikan']):phase('quotation_sent'),
   'Generator Word adalah draft; pengiriman dan tanda tangan memerlukan bukti'),
  gate('submission','Proof of Submission','Sales',signedProof?'complete':'blocked',
   signedProof?[]:['Bukti pengiriman/acknowledgment quotation belum tercatat dan disahkan'],
   'Diperlukan sebelum kontrak/PO digunakan sebagai keputusan pelanggan'),
  gate('negotiation','Negotiation','Sales',input.negotiation_decision==='approved'?'complete':negotiation?'manual_review':'blocked',
   input.negotiation_decision==='approved'?[]:negotiation?['Keputusan pelanggan dengan bukti pada versi paket aktif diperlukan']:phase('negotiation'),
   'Negosiasi dan perubahan komersial dengan riwayat versi'),
  gate('po','PO / Contract Review','Finance / Legal',
   input.po_check&&poOriginal&&input.legal_approved?'complete':input.po_check?'manual_review':'blocked',
   [!input.po_check?'Belum ada pemeriksaan PO oleh Finance':null,!poOriginal?'Bukti PO asli belum diarsipkan':null,
     !input.legal_approved?'Persetujuan Legal/kontrak belum tercatat':null].filter((x):x is string=>!!x),
   'PO yang cocok dengan quotation belum otomatis membuktikan dokumen asli'),
  gate('won','Closed Won','Sales / Management',
   d.stage==='closed_won'?(input.po_check&&poOriginal&&input.legal_approved?'complete':'manual_review'):'pending',
   d.stage==='closed_won'?[]:phase('closed_won'),'Closed Won hanya setelah approval bisnis lengkap'),
 ];
}
