// Technotama India - BoQ validation and RBAC rules. No demo data or implicit HPP.
export type BoQRole = 'admin'|'marketing'|'finance'|'presales'|'sales'|'approver'|'legal'|'viewer';
export type BoQStatus = 'draft'|'submitted'|'approved'|'rejected'|'archived';
export type BoQLine = {description:string; quantity:number; unit:string; unit_price:number; service_type:string};
export type CostLine = {code:'A'|'B'|'C'|'D'|'E'; amount:number};
export type BoQPayload = {
 customer_name:string; project_name:string; quotation_number:string; service_type:string;
 vat_rate:number; payment_terms:string; opportunity_id?:string|null; notes?:string|null;
 line_items:BoQLine[]; cost_items?:CostLine[];
};
export const roles:BoQRole[]=['admin','marketing','finance','presales','sales','approver','legal','viewer'];
export const costRoles:BoQRole[]=['admin','finance'];
export const salesRoles:BoQRole[]=['admin','finance','presales','sales'];
export const approvalRoles:BoQRole[]=['admin','approver'];

const s=(x:unknown,max=240)=>typeof x==='string'?x.trim().slice(0,max):'';
const num=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)?x:NaN;
const money=(x:unknown)=>{const v=num(x);return Number.isFinite(v)&&v>=0&&v<=1e13&&Math.round(v*100)/100===v;};
const allowedServiceTypes=new Set(['VAPT','SOC','CTI','ISO','PDP','Hardening','IR','Lainnya','GRC','DFIR','TRAINING','TECHNOLOGY']);
const codes=['A','B','C','D','E'] as const;
export function validateBoQ(value:unknown):BoQPayload {
 if (!value || typeof value!=='object'||Array.isArray(value))throw new Error('Formulir BoQ tidak valid');
 const p=value as Record<string,unknown>;
 const customer_name=s(p.customer_name),project_name=s(p.project_name),quotation_number=s(p.quotation_number,100);
 const service_type=s(p.service_type,30),vat_rate=num(p.vat_rate),payment_terms=s(p.payment_terms,30);
 if(!customer_name||!project_name||!quotation_number)throw new Error('Klien, proyek, dan nomor quotation wajib diisi');
 if(!allowedServiceTypes.has(service_type))throw new Error('Jenis layanan tidak valid');
 if(!Number.isFinite(vat_rate)||vat_rate<0||vat_rate>1)throw new Error('Tarif PPN harus antara 0 dan 1 (contoh 0.11)');
 if(!['30-50-20','30-60-10','50-50','100'].includes(payment_terms))throw new Error('Termin pembayaran tidak valid');
 if(!Array.isArray(p.line_items)||p.line_items.length<1||p.line_items.length>100)throw new Error('BoQ wajib mempunyai 1-100 item');
 const line_items=p.line_items.map((raw,i)=>{
   if(!raw||typeof raw!=='object')throw new Error('Item nomor '+(i+1)+' tidak valid');
   const v=raw as Record<string,unknown>;
   const description=s(v.description,900),unit=s(v.unit,50),service_type=s(v.service_type,30);
   const quantity=num(v.quantity),unit_price=num(v.unit_price);
   if(!description||!unit||!allowedServiceTypes.has(service_type)||!money(unit_price)||
      !Number.isFinite(quantity)||quantity<=0||quantity>100000||Math.round(quantity*1000)/1000!==quantity)
      throw new Error('Item '+(i+1)+': deskripsi, layanan, qty atau harga tidak valid');
   return {description,unit,service_type,quantity,unit_price};
 });
 let cost_items:CostLine[]|undefined;
 if(p.cost_items!==undefined){
  if(!Array.isArray(p.cost_items)||p.cost_items.length>5)throw new Error('HPP maksimal komponen A-E');
  const found=new Set<string>();
  cost_items=p.cost_items.map((raw)=>{
    if(!raw||typeof raw!=='object')throw new Error('Komponen HPP tidak valid');
    const v=raw as Record<string,unknown>,code=s(v.code);
    if(!codes.some(x=>x===code)||found.has(code)||!money(v.amount))throw new Error('Kode HPP duplikat/tidak valid atau jumlah negatif');
    found.add(code);return {code:code as CostLine['code'],amount:num(v.amount)};
  });
 }
 const subtotal=line_items.reduce((a,b)=>a+b.quantity*b.unit_price,0);
 if(!Number.isFinite(subtotal)||subtotal<=0||subtotal>1e14)throw new Error('Nilai BoQ harus lebih besar dari nol');
 return {customer_name,project_name,quotation_number,service_type,vat_rate,payment_terms,
   opportunity_id:s(p.opportunity_id,120)||null,notes:s(p.notes,1800)||null,line_items,cost_items};
}
export function boqTotals(lines:BoQLine[],costs:CostLine[]|undefined,vat_rate:number){
 const subtotal=Math.round(lines.reduce((a,b)=>a+b.quantity*b.unit_price,0)*100)/100;
 const vat_amount=Math.round(subtotal*vat_rate*100)/100;
 const grand_total=Math.round((subtotal+vat_amount)*100)/100;
 const complete=Array.isArray(costs)&&codes.every(code=>costs.some(x=>x.code===code));
 const hpp=complete?costs!.reduce((a,b)=>a+b.amount,0):null;
 const gp=hpp===null?null:subtotal-hpp;
 const margin=gp===null?null:Math.round(gp/subtotal*10000)/100;
 return {subtotal,vat_amount,grand_total,hpp,gp,margin,complete};
}
export function can(role:BoQRole, action:'create'|'read_cost'|'edit_cost'|'edit_draft'|'submit'|'approve'|'manage_members'){
 if(action==='read_cost'||action==='edit_cost')return costRoles.includes(role);
 if(action==='create'||action==='edit_draft'||action==='submit')return salesRoles.includes(role);
 if(action==='approve')return approvalRoles.includes(role);
 return role==='admin';
}
