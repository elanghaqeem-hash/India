export type BidDecision='pending'|'go'|'conditional_go'|'no_go';
export type ProcurementBid={opportunity_id:string;tenant_id:string;channel:string;
 bid_decision:BidDecision;proposed_by:string;decided_by:string|null;decision_reason:string};
export type RequirementEvidence={kind:string;status:string;compliance_status:string;reviewed_by:string|null};
export const needsTenderGate=(process:string):boolean=>/(?:^|\W)(?:tender|rfp|rfq|lpse|spse|pengadaan)(?:$|\W)/i.test(process);
export function canDecideBid(bid:ProcurementBid,role:string,actor:string):string|null{
 if(!['admin','approver'].includes(role))return 'Hanya Approver atau Admin dapat membuat keputusan Bid/No-Bid';
 if(bid.proposed_by.trim().toLowerCase()===actor.trim().toLowerCase())return 'Maker–Checker: pembuat Bid Request tidak boleh memberikan keputusan sendiri';
 if(bid.bid_decision!=='pending')return 'Keputusan Bid/No-Bid sudah terkunci. Perubahan memerlukan revisi terkontrol';
 return null;
}
export function procurementGate(
 process:string,bid:ProcurementBid|null,requirements:RequirementEvidence[]
):string[]{
 if(!needsTenderGate(process))return [];
 const missing:string[]=[];
 if(!bid||bid.bid_decision!=='go'||!bid.decided_by)missing.push('Bid/No-Bid harus GO dan disahkan Approver independen');
 if(!requirements.some(r=>['rks','kak','rfp','rfq'].includes(r.kind)&&r.status==='reviewed'&&r.compliance_status==='compliant'&&r.reviewed_by))
  missing.push('RKS/KAK/RFP requirement matrix harus sudah reviewed dan compliant');
 return missing;
}
export const requirementKinds=['rks','kak','rfp','rfq','nda','technical','commercial','vendor_quote','clarification'] as const;
export const complianceStatuses=['pending','compliant','partial','non_compliant','not_applicable'] as const;
