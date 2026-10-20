// D1-backed Sales stage gates. Pure domain functions; no customer demo values.
export const TENANT='defendit360';
export const SALES_STAGES=[
 ['prospecting','Prospecting',10],
 ['qualified','Qualified',25],
 ['discovery','Discovery / Scoping',40],
 ['solution_design','Solution & BoQ',55],
 ['commercial_review','Commercial Approval',65],
 ['quotation_sent','Quotation Sent',70],
 ['negotiation','Negotiation',85],
 ['pending_po','Pending PO',95],
 ['closed_won','Closed Won',100],
 ['closed_lost','Closed Lost',0],
] as const;
export type SalesStage=(typeof SALES_STAGES)[number][0];
export const SERVICE_FAMILIES=['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other'] as const;
export type SalesFields=Record<string,string>;
export type SalesAccount={
 id:string; customer_number:string; legal_name:string; fields:SalesFields;
 created_at:string; created_by?:string;
};
export type SalesDeal={
 id:string; company_id:string; company_name:string; title:string; stage:SalesStage;
 estimated_value:number; fields:SalesFields; created_at:string; created_by?:string;
};
export const ACCOUNT_FIELDS=[
 ['client_tier','Segmentasi pelanggan'],['industry','Sektor industri'],['business_type','Bidang usaha'],['employee_band','Jumlah pegawai'],
 ['npwp','NPWP'],['company_phone','Nomor telepon perusahaan'],['fax','Nomor fax / N/A'],
 ['hq_address','Alamat kantor pusat'],['hq_province','Provinsi'],['hq_postal','Kode pos'],
 ['billing_same_as_hq','Alamat penagihan sama dengan kantor pusat (ya/tidak)'],
 ['billing_address','Alamat penagihan'],['billing_province','Provinsi penagihan'],['billing_postal','Kode pos penagihan'],
 ['primary_name','PIC utama - nama'],['primary_phone','PIC utama - telepon'],['primary_email','PIC utama - email'],
 ['technical_name','PIC teknis - nama'],['technical_phone','PIC teknis - telepon'],['technical_email','PIC teknis - email'],
 ['billing_name','PIC penagihan - nama'],['billing_phone','PIC penagihan - telepon'],['billing_email','PIC penagihan - email'],
 ['tax_name','PIC pajak - nama'],['tax_phone','PIC pajak - telepon'],['tax_email','PIC pajak - email'],
 ['customer_signatory','Penandatangan pelanggan'],['customer_signatory_title','Jabatan penandatangan pelanggan'],
 ['defender_signatory','Penandatangan DefendIT360'],['defender_signatory_title','Jabatan penandatangan DefendIT360'],
 ['maker','Pembuat'],['reviewer','Pemeriksa'],['executor','Pelaksana'],
] as const;
export const DEAL_FIELDS=[
 ['lead_source','Sumber lead'],['sales_owner','Sales owner'],['expected_closing_date','Target closing'],
 ['service_family','Jenis layanan DefendIT360'],['contract_model','One-Time / Recurring'],['client_need','Kebutuhan / pain point'],
 ['budget_status','Status/batas budget'],['decision_maker','Pengambil keputusan'],
 ['procurement_process','Proses procurement / tender'],['discovery_notes','Hasil discovery'],
 ['technical_scope','Scope pekerjaan'],['technical_specifications','Spesifikasi teknis'],
 ['scope_quantity','Jumlah aset & unit'],['service_level','SLA / jam layanan'],['delivery_model','Remote / Onsite / Hybrid'],
 ['resourcing_model','Shared / Dedicated / Belum dikonfirmasi'],['deliverables','Deliverables & retest'],
 ['project_site','Alamat lokasi pekerjaan'],['project_province','Provinsi lokasi pekerjaan'],
 ['project_postal','Kode pos lokasi pekerjaan'],['project_pic_name','PIC proyek'],
 ['project_pic_phone','Telepon PIC proyek'],['project_pic_email','Email PIC proyek'],
 ['implementation_timeline','Jadwal delivery'],['contract_duration','Durasi kontrak'],
 ['license_or_sku','SKU, lisensi / perangkat'],['asset_profile','Web/Mobile/API/IP/Endpoint/Log/EPS'],
 ['boq_id','BoQ D1 yang terhubung'],['costing_notes','HPP, pricing, margin (referensi tanpa angka rahasia)'],
 ['quotation_number','Nomor quotation final'],['quotation_sent_at','Tanggal submission quotation'],
 ['quotation_valid_days','Masa berlaku quotation (hari)'],['quotation_valid_until','Tanggal akhir berlaku quotation'],
 ['quotation_terms','Syarat & ketentuan quotation'],['quotation_payment_notes','Ketentuan penagihan/invoice'],
 ['methodology','Metodologi / Rule of Engagement'],['exclusions','Pengecualian lingkup'],
 ['team_composition','Komposisi tim yang disepakati'],
 ['next_action','Rencana follow-up'],['next_action_at','Tanggal follow-up'],
 ['negotiation_notes','Hasil negosiasi'],['customer_decision','Keputusan pelanggan (approved/pending/rejected)'],
 ['payment_terms','Termin pembayaran'],['payment_va','Rekening VA disetujui Finance'],
 ['payment_milestones','Rincian termin (diperiksa Finance)'],['scope_reconciliation','Catatan rekonsiliasi PO, SOW & quotation'],
 ['po_number','Nomor Purchase Order'],['po_date','Tanggal PO'],['po_reference','Referensi dokumen PO yang diterima'],
 ['po_amount_before_vat','Nilai PO sebelum PPN'],['lost_reason','Kategori alasan kalah'],['lost_notes','Penjelasan kalah'],
 ['competitor','Kompetitor (jika diketahui)'],['opportunity_notes','Catatan'],
] as const;
export const ACCOUNT_KEYS=new Set<string>(ACCOUNT_FIELDS.map(x=>x[0]));
export const DEAL_KEYS=new Set<string>(DEAL_FIELDS.map(x=>x[0]));
export const REQUIRED_BY_STAGE:Record<string,string[]>={
 prospecting:['lead_source','sales_owner','expected_closing_date','service_family'],
 qualified:['client_need','budget_status','decision_maker','procurement_process'],
 discovery:['discovery_notes','technical_scope','technical_specifications','scope_quantity','deliverables','delivery_model'],
 solution_design:['boq_id','implementation_timeline','contract_model','project_site'],
 commercial_review:['costing_notes'],
 quotation_sent:['quotation_number','quotation_sent_at','quotation_valid_days','quotation_valid_until'],
 negotiation:['next_action','next_action_at','negotiation_notes'],
 pending_po:['customer_decision'],
 closed_won:['po_number','po_date','po_reference','po_amount_before_vat','scope_reconciliation'],
 closed_lost:['lost_reason','lost_notes'],
};
const has=(v:unknown)=>typeof v==='string' && v.trim().length>0;
export const phoneValid=(s:string)=>/^\+?[0-9][0-9\s().-]{7,19}$/.test(s.trim());
export const emailValid=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const dateValid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
export function cleanFields(input:unknown,keys:Set<string>):SalesFields{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Data form wajib berupa object');
 const fields:SalesFields={};
 for(const [key,value] of Object.entries(input)){
  if(!keys.has(key)||typeof value!=='string'||value.length>3500)throw Error('Field tidak dikenal atau terlalu panjang: '+key);
  fields[key]=value.trim();
 }
 return fields;
}
export function validateAccount(a:SalesAccount):string[]{
 const f=a.fields,miss:string[]=[];
 if(!has(a.legal_name))miss.push('legal_name');
 for(const k of ['business_type','industry','employee_band','company_phone','hq_address','hq_province','hq_postal','primary_name','primary_phone','primary_email']){
  if(!has(f[k]))miss.push(k);
 }
 if(f.primary_email&&!emailValid(f.primary_email))miss.push('primary_email (format)');
 if(f.primary_phone&&!phoneValid(f.primary_phone))miss.push('primary_phone (format)');
 if(f.hq_postal&&!/^\d{5}$/.test(f.hq_postal))miss.push('hq_postal (format)');
 if(f.billing_same_as_hq==='tidak'){
  for(const k of ['billing_address','billing_province','billing_postal'])if(!has(f[k]))miss.push(k);
 }
 return miss;
}
export function requiredForStage(stage:SalesStage,deal:SalesDeal,account?:SalesAccount|null):string[]{
 const missing:string[]=[];
 if(!has(deal.title))missing.push('title');
 if(!Number.isFinite(deal.estimated_value)||deal.estimated_value<=0)missing.push('estimated_value');
 if(!account)missing.push('company_id (pelanggan harus terdaftar)');
 if(account)missing.push(...validateAccount(account).map(x=>'pelanggan.'+x));
 const ordered=SALES_STAGES.slice(0,9).map(x=>x[0]);
 const end=stage==='closed_lost'?0:ordered.indexOf(stage);
 for(let i=0;i<=end;i++)for(const field of REQUIRED_BY_STAGE[ordered[i]]||[]){
  if(!has(deal.fields[field]))missing.push(field);
 }
 if(deal.fields.expected_closing_date&&!dateValid(deal.fields.expected_closing_date))missing.push('expected_closing_date (format)');
 if(deal.fields.next_action_at&&!dateValid(deal.fields.next_action_at))missing.push('next_action_at (format)');
 if(deal.fields.quotation_valid_until&&!dateValid(deal.fields.quotation_valid_until))missing.push('quotation_valid_until (format)');
 if(deal.fields.quotation_valid_days&&!(/^[0-9]{1,3}$/.test(deal.fields.quotation_valid_days)&&Number(deal.fields.quotation_valid_days)>0&&Number(deal.fields.quotation_valid_days)<=365))
  missing.push('quotation_valid_days (1-365)');
 if(stage==='pending_po'&&deal.fields.customer_decision!=='approved')missing.push('customer_decision (harus approved)');
 if(stage==='closed_won'){
  if(!dateValid(deal.fields.po_date||''))missing.push('po_date (format)');
  const n=Number(deal.fields.po_amount_before_vat);
  if(!Number.isFinite(n)||n<=0)missing.push('po_amount_before_vat (nilai)');
 }
 if(stage==='closed_lost'){
  for(const x of REQUIRED_BY_STAGE.closed_lost)if(!has(deal.fields[x]))missing.push(x);
 }
 return [...new Set(missing)];
}
export function stageTransition(from:SalesStage,to:SalesStage):string|null{
 if(from===to)return null;
 if(from==='closed_won')return 'Deal Closed Won terkunci. Koreksi memerlukan proses administrasi terpisah.';
 if(from==='closed_lost'&&to!=='prospecting')return 'Reopen harus kembali ke Prospecting dengan jejak audit.';
 if(to==='closed_lost')return null;
 const open=SALES_STAGES.slice(0,9).map(x=>x[0]);
 if(to==='closed_won'&&from!=='pending_po')return 'Won hanya setelah tahap Pending PO dan validasi PO.';
 const a=open.indexOf(from),b=open.indexOf(to);
 if(a<0||b<0)return 'Stage tidak dikenal';
 if(b>a+1)return 'Stage harus bertahap, tidak boleh melompati approval.';
 return null;
}
export function stageProbability(stage:SalesStage):number{
 return SALES_STAGES.find(x=>x[0]===stage)?.[2]||0;
}
export function documentChecklist(deal:SalesDeal,account:SalesAccount){
 const f=account.fields,d=deal.fields;
 const registration=[
 ...ACCOUNT_FIELDS.filter(([k])=>!['billing_address','billing_province','billing_postal'].includes(k)||f.billing_same_as_hq==='tidak')
  .map(([k])=>k).filter(k=>!has(f[k])),
 ...(['npwp','fax','technical_name','technical_phone','technical_email','billing_name','billing_phone','billing_email','tax_name','tax_phone','tax_email'].filter(k=>!has(f[k]))),
 'primaryKtpNumber (isi pada form Post-PO, jangan simpan di CRM)',
 'npwpAttachmentConfirmed (unggah dan verifikasi)',
 'ktpAttachmentConfirmed (unggah dan verifikasi)',
 ];
 const project=['po_number','po_date','po_reference','quotation_number','technical_scope','technical_specifications',
  'service_family','scope_quantity','project_site','project_province','project_postal','project_pic_name',
  'project_pic_phone','project_pic_email','payment_terms','payment_va','payment_milestones','contract_duration',
  'implementation_timeline','scope_reconciliation','po_amount_before_vat'].filter(k=>!has(d[k]));
 return {registration:[...new Set(registration)],project};
}
export const safeID=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
