export type FlexEventKind='ISSUE'|'TOPUP'|'RESERVE'|'RELEASE'|'DEBIT'|'REFUND'|'EXPIRY';
export type FlexTotals={issued:number;available:number;reserved:number;consumed:number;expired:number};
export type FlexEvent={kind:FlexEventKind;units:number};
export function walletTotals(events:readonly FlexEvent[]):FlexTotals{
 const s:FlexTotals={issued:0,available:0,reserved:0,consumed:0,expired:0};
 for(const e of events){
  if(!Number.isSafeInteger(e.units)||e.units<=0)throw Error('Token harus integer positif');
  switch(e.kind){
   case 'ISSUE':case 'TOPUP':s.issued+=e.units;s.available+=e.units;break;
   case 'RESERVE':s.available-=e.units;s.reserved+=e.units;break;
   case 'RELEASE':s.available+=e.units;s.reserved-=e.units;break;
   case 'DEBIT':s.reserved-=e.units;s.consumed+=e.units;break;
   case 'REFUND':s.consumed-=e.units;s.available+=e.units;break;
   case 'EXPIRY':s.available-=e.units;s.expired+=e.units;break;
  }
  if(s.available<0||s.reserved<0||s.consumed<0)throw Error('FLEXGUARD_INSUFFICIENT_BALANCE');
 }
 if(s.issued!==s.available+s.reserved+s.consumed+s.expired)throw Error('FLEXGUARD_LEDGER_RECONCILIATION');
 return s;
}
export const eventRoles:Record<FlexEventKind,readonly string[]>={
 ISSUE:['admin','finance'],TOPUP:['admin','finance'],RESERVE:['admin','sales','presales'],
 RELEASE:['admin','sales','presales'],DEBIT:['admin','presales'],REFUND:['admin','finance'],EXPIRY:['admin','finance']
};
export function canPostFlex(role:string,kind:FlexEventKind){return !!eventRoles[kind]?.includes(role);}
