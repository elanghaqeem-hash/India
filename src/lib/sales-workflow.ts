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
// Keep existing persisted values stable. BoQ categories remain compatible with D1.
export const SERVICE_CATALOG=[
 {name:'VAPT',group:'Offensive Security',boq:['VAPT'],guidance:'Cantumkan objek web/mobile/API/jaringan, jumlah target, otorisasi, metode pengujian, testing window, retest dan laporan.'},
 {name:'Red Team / Adversary Simulation',group:'Offensive Security',boq:['VAPT'],guidance:'Cantumkan tujuan simulasi, skenario, target yang diizinkan, rules of engagement, batas tindakan, jadwal dan laporan.'},
 {name:'Attack Surface Management',group:'Offensive Security',boq:['CTI','VAPT','TECHNOLOGY'],guidance:'Cantumkan domain/IP/aset eksternal, frekuensi discovery, validasi exposure, prioritas remediasi dan periode monitoring.'},
 {name:'SOC/MDR',group:'Defensive Security',boq:['SOC'],guidance:'Cantumkan periode, jam layanan, platform/SIEM, log sources, EPS, retensi, lisensi, SLA dan skema tenaga sesuai PO/SOW.'},
 {name:'CTI',group:'Defensive Security',boq:['CTI'],guidance:'Cantumkan domain/IP/brand yang dipantau, paket intelijen, periode, kanal eskalasi dan frekuensi laporan.'},
 {name:'Digital Risk Protection',group:'Defensive Security',boq:['CTI','TECHNOLOGY'],guidance:'Cantumkan brand/domain/akun, pemantauan kebocoran dan impersonation, takedown yang disepakati, periode dan SLA.'},
 {name:'Incident Response/DFIR',group:'Defensive Security',boq:['DFIR','IR'],guidance:'Cantumkan sumber bukti, batas otorisasi, chain of custody, analisis, SLA respons, pemulihan dan laporan forensik.'},
 {name:'Incident Response Retainer',group:'Defensive Security',boq:['IR','DFIR'],guidance:'Cantumkan periode retainer, jam/hari respons, SLA aktivasi, cakupan insiden, eskalasi dan ketentuan penggunaan.'},
 {name:'Threat Hunting / Compromise Assessment',group:'Defensive Security',boq:['SOC','DFIR'],guidance:'Cantumkan endpoint/log/bukti, hipotesis hunting, periode analisis, indikator kompromi dan laporan rekomendasi.'},
 {name:'Managed Security',group:'Defensive Security',boq:['SOC','TECHNOLOGY','Hardening'],guidance:'Cantumkan perangkat/platform yang dikelola, jam layanan, SLA, RACI, periode kontrak dan laporan layanan.'},
 {name:'Cybersecurity Governance',group:'Governance, Risk & Compliance',boq:['GRC','ISO','PDP','TRAINING'],guidance:'Cantumkan framework/regulasi yang dikontrak, entitas/unit, assessment, workshop, kebijakan, SOP dan deliverables.'},
 {name:'GRC / Risk Management',group:'Governance, Risk & Compliance',boq:['GRC'],guidance:'Cantumkan domain risiko, unit/proses, framework, risk assessment, risk register, KRI dan rencana mitigasi.'},
 {name:'ISO 27001 / ISMS',group:'Governance, Risk & Compliance',boq:['ISO','GRC'],guidance:'Cantumkan scope ISMS, entitas/lokasi, gap assessment, risk assessment, dokumen, audit internal dan pendampingan sertifikasi.'},
 {name:'ISO 27701 / Privacy Management',group:'Governance, Risk & Compliance',boq:['ISO','PDP','GRC'],guidance:'Cantumkan scope privasi, peran pengendali/prosesor, gap assessment, kontrol privasi, dokumen dan pendampingan.'},
 {name:'PDP / Data Privacy',group:'Governance, Risk & Compliance',boq:['PDP','GRC'],guidance:'Cantumkan proses dan data pribadi, ROPA, DPIA, dasar pemrosesan, prosedur hak subjek data dan rencana remediasi.'},
 {name:'DPO as a Service',group:'Governance, Risk & Compliance',boq:['PDP','GRC'],guidance:'Cantumkan periode penugasan, peran DPO, jam konsultasi, evaluasi kepatuhan, pelaporan dan eskalasi insiden privasi.'},
 {name:'IT Audit / IT Assurance',group:'Governance, Risk & Compliance',boq:['GRC'],guidance:'Cantumkan objek audit TI, periode, kriteria, ITGC/ITAC, pengujian bukti, laporan temuan dan tindak lanjut.'},
 {name:'IT Governance / IT Risk',group:'Governance, Risk & Compliance',boq:['GRC'],guidance:'Cantumkan domain tata kelola/risiko TI, framework, maturity assessment, kebijakan dan roadmap perbaikan.'},
 {name:'ICOFR / Internal Control',group:'Governance, Risk & Compliance',boq:['GRC'],guidance:'Cantumkan proses, akun/materialitas, BPM/RCM, CSA, ToD/ToE, temuan, remediation dan laporan pengendalian.'},
 {name:'BCM / BCP / DRP',group:'Governance, Risk & Compliance',boq:['GRC','ISO'],guidance:'Cantumkan proses kritis, BIA, RTO/RPO, strategi kontinuitas, BCP/DRP, skenario latihan dan evaluasi.'},
 {name:'Third Party / Vendor Risk Assessment',group:'Governance, Risk & Compliance',boq:['GRC'],guidance:'Cantumkan vendor dan tingkat kritikalitas, domain due diligence, penilaian kontrol, bukti dan rencana tindak lanjut.'},
 {name:'Cybersecurity Technology',group:'Technology & Implementation',boq:['TECHNOLOGY','Hardening'],guidance:'Cantumkan OEM/SKU, jumlah lisensi/appliance, subscription, support, implementasi, integrasi dan serah terima.'},
 {name:'SIEM / SOAR Implementation',group:'Technology & Implementation',boq:['TECHNOLOGY','SOC'],guidance:'Cantumkan platform/SKU, log source, sizing, retensi, use case, playbook, integrasi, UAT dan support.'},
 {name:'IAM / PAM',group:'Technology & Implementation',boq:['TECHNOLOGY','GRC'],guidance:'Cantumkan identitas/akun privileged, aplikasi target, MFA/SSO, approval, session recording, integrasi dan UAT.'},
 {name:'Network / Endpoint Security',group:'Technology & Implementation',boq:['TECHNOLOGY','Hardening'],guidance:'Cantumkan firewall/WAF/EDR/XDR/NDR, jumlah aset, arsitektur, lisensi, hardening, implementasi dan support.'},
 {name:'Cloud Security',group:'Technology & Implementation',boq:['TECHNOLOGY','Hardening','VAPT'],guidance:'Cantumkan provider/akun/workload, konfigurasi, posture assessment, pengujian yang diizinkan dan remediasi.'},
 {name:'Data Security / DLP',group:'Technology & Implementation',boq:['TECHNOLOGY','PDP'],guidance:'Cantumkan klasifikasi data, endpoint/kanal, kebijakan DLP, enkripsi, integrasi, lisensi dan UAT.'},
 {name:'DevSecOps / Secure Code Review',group:'Technology & Implementation',boq:['VAPT','TECHNOLOGY'],guidance:'Cantumkan repositori/bahasa, pipeline CI/CD, SAST/DAST/SCA, secret scanning, review kode dan hasil remediasi.'},
 {name:'OT / ICS Security',group:'Technology & Implementation',boq:['TECHNOLOGY','GRC','VAPT'],guidance:'Cantumkan aset industri, zona jaringan, batas pengujian aman, jendela kerja, otorisasi dan rekomendasi kontrol.'},
 {name:'Security Hardening',group:'Technology & Implementation',boq:['Hardening','TECHNOLOGY'],guidance:'Cantumkan server/perangkat/aplikasi, baseline konfigurasi, backup, perubahan disetujui, validasi dan rollback.'},
 {name:'Cybersecurity Training / Awareness',group:'Training & Advisory',boq:['TRAINING'],guidance:'Cantumkan topik, peserta, jumlah kelas/hari, metode, materi, praktik, evaluasi dan bukti pelaksanaan.'},
 {name:'Phishing Simulation',group:'Training & Advisory',boq:['TRAINING','VAPT'],guidance:'Cantumkan peserta/domain yang diizinkan, skenario, periode, perlindungan data, metrik dan tindak lanjut awareness.'},
 {name:'vCISO / Cybersecurity Advisory',group:'Training & Advisory',boq:['GRC'],guidance:'Cantumkan periode, ruang lingkup advisory, roadmap, rapat tata kelola, jam konsultasi dan pelaporan manajemen.'},
 {name:'FlexGuard / Security Subscription',group:'Training & Advisory',boq:['SOC','VAPT','CTI','GRC','IR','DFIR','TECHNOLOGY','TRAINING'],guidance:'Cantumkan paket layanan, periode, hak penggunaan/token sesuai kontrak, batas cakupan, SLA dan laporan konsumsi.'},
 {name:'Other',group:'Layanan Lainnya',boq:['Lainnya','VAPT','SOC','CTI','ISO','PDP','GRC','DFIR','IR','TECHNOLOGY','Hardening','TRAINING'],guidance:'Cantumkan setiap produk/layanan, kuantitas-satuan, objek lingkup, batas pekerjaan, hasil kerja dan SLA yang disepakati.'}
] as const;
export type ServiceFamily=(typeof SERVICE_CATALOG)[number]['name'];
export const SERVICE_FAMILIES:readonly ServiceFamily[]=SERVICE_CATALOG.map(x=>x.name);
export const SERVICE_GROUPS=[...new Set(SERVICE_CATALOG.map(x=>x.group))];
export const isServiceFamily=(value:unknown):value is ServiceFamily=>typeof value==='string'&&SERVICE_FAMILIES.includes(value as ServiceFamily);
export function serviceDefinition(value:string){return SERVICE_CATALOG.find(x=>x.name===value)||SERVICE_CATALOG[SERVICE_CATALOG.length-1];}
export const defaultBoqService=(family:string)=>serviceDefinition(family).boq[0];
// Shared lead attribution choices. Preserve historical free-text sources in existing records.
export const LEAD_SOURCES=[
 'Website / Formulir Online','Organic Search / SEO','Iklan Digital / SEM',
 'LinkedIn','Media Sosial','Email Campaign','WhatsApp / Telepon Masuk',
 'Webinar','Seminar / Konferensi','Workshop / Training','Pameran / Expo',
 'Referral Pelanggan','Referral Internal','Partner / Distributor / Principal',
 'Asosiasi / Komunitas','Outbound Prospecting','Tender / RFP / RFQ',
 'Pelanggan Existing / Renewal','Cross-sell / Upsell','Kunjungan / Pertemuan Bisnis',
 'Marketplace / Portal Pengadaan','Lainnya'
] as const;
// CRM choices describe the customer's procurement route, without replacing their procurement policy.
export const PROCUREMENT_PROCESSES=[
 'Pengadaan Langsung','Penunjukan Langsung / Sole Source',
 'Permintaan Penawaran / RFQ','Permintaan Proposal / RFP',
 'Tender Terbuka / Lelang Umum','Tender Terbatas / Undangan',
 'Seleksi Konsultan','Beauty Contest / Pitching',
 'E-Purchasing / E-Katalog','E-Tendering / E-Procurement',
 'Pembelian Melalui Partner / Distributor','Kontrak Payung / Framework Agreement',
 'Perpanjangan Kontrak / Renewal','Addendum / Perubahan Kontrak','Lainnya'
] as const;
export type SalesFields=Record<string,string>;
export type SalesAccount={
 id:string; customer_number:string; legal_name:string; fields:SalesFields;
 created_at:string; created_by?:string;
};
export type SalesDeal={
 id:string; company_id:string; company_name:string; title:string; stage:SalesStage;
 estimated_value:number; flow_version?:number; fields:SalesFields; created_at:string; created_by?:string;
};
export const ACCOUNT_FIELDS=[
 ['client_tier','Segmentasi pelanggan (opsional)'],['industry','Sektor industri'],['business_type','Bidang usaha'],['employee_band','Jumlah pegawai'],
 ['npwp','NPWP'],['company_phone','Nomor telepon perusahaan'],['fax','Nomor fax / N/A'],
 ['hq_address','Alamat kantor pusat'],['hq_province','Provinsi'],['hq_postal','Kode pos'],
 ['hq_province_code','Kode provinsi'],['hq_regency','Kabupaten / Kota'],['hq_regency_code','Kode kabupaten/kota'],
 ['hq_district','Kecamatan / Distrik'],['hq_district_code','Kode kecamatan'],
 ['hq_village','Desa / Kelurahan'],['hq_village_code','Kode desa/kelurahan'],['hq_village_kind','Jenis desa/kelurahan'],
 ['billing_same_as_hq','Alamat penagihan sama dengan kantor pusat (ya/tidak)'],
 ['billing_address','Alamat penagihan'],['billing_province','Provinsi penagihan'],['billing_postal','Kode pos penagihan'],
 ['primary_name','PIC utama - nama'],['primary_phone','PIC utama - telepon'],['primary_email','PIC utama - email'],
 ['technical_name','PIC teknis - nama'],['technical_phone','PIC teknis - telepon'],['technical_email','PIC teknis - email'],
 ['billing_name','PIC penagihan - nama'],['billing_phone','PIC penagihan - telepon'],['billing_email','PIC penagihan - email'],
 ['tax_name','PIC pajak - nama'],['tax_phone','PIC pajak - telepon'],['tax_email','PIC pajak - email'],
 ['customer_signatory','Penandatangan pelanggan'],['customer_signatory_title','Jabatan penandatangan pelanggan'],
 ['defender_signatory','Penandatangan Technotama'],['defender_signatory_title','Jabatan penandatangan Technotama'],
 ['maker','Pembuat'],['reviewer','Pemeriksa'],['executor','Pelaksana'],
] as const;
export const DEAL_FIELDS=[
 ['lead_source','Sumber lead'],['sales_owner','Sales owner'],['expected_closing_date','Target closing'],
 ['service_family','Jenis layanan Technotama'],['contract_model','One-Time / Recurring'],['client_need','Kebutuhan / pain point'],
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
 ['end_user','End User (jika berbeda dengan pelanggan)'],['quotation_to_pic','Nama penerima quotation'],
 ['quotation_sender_name','Penandatangan quotation'],['quotation_sender_title','Jabatan penandatangan quotation'],
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
 quotation_sent:['quotation_number','quotation_sent_at','quotation_valid_days','quotation_valid_until','quotation_sender_name','quotation_sender_title'],
 negotiation:['next_action','next_action_at','negotiation_notes'],
 pending_po:['customer_decision'],
 closed_won:['po_number','po_date','po_reference','po_amount_before_vat','scope_reconciliation'],
 closed_lost:['lost_reason','lost_notes'],
};
const has=(v:unknown)=>typeof v==='string' && v.trim().length>0;
export const phoneValid=(s:string)=>/^\+?[0-9][0-9\s().-]{7,19}$/.test(s.trim());
export const emailValid=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const dateValid=(s:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const time=Date.parse(s+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===s;
};
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
 // Closing Lost must remain possible for unqualified leads.
 // Full customer validation is required for advancement, not for early rejection.
 if(account&&stage!=='closed_lost')missing.push(...validateAccount(account).map(x=>'pelanggan.'+x));
 const ordered=SALES_STAGES.slice(0,9).map(x=>x[0]);
 const end=stage==='closed_lost'?-1:stage==='closed_won'?ordered.length-1:ordered.indexOf(stage);
 for(let i=0;i<=end;i++)for(const field of REQUIRED_BY_STAGE[ordered[i]]||[]){
  if(!has(deal.fields[field]))missing.push(field);
 }
 if(deal.fields.expected_closing_date&&!dateValid(deal.fields.expected_closing_date))missing.push('expected_closing_date (format)');
 if(deal.fields.next_action_at&&!dateValid(deal.fields.next_action_at))missing.push('next_action_at (format)');
 if(deal.fields.quotation_valid_until&&!dateValid(deal.fields.quotation_valid_until))missing.push('quotation_valid_until (format)');
 if(deal.fields.quotation_valid_days&&!(/^[0-9]{1,3}$/.test(deal.fields.quotation_valid_days)&&Number(deal.fields.quotation_valid_days)>0&&Number(deal.fields.quotation_valid_days)<=365))
  missing.push('quotation_valid_days (1-365)');
 if((stage==='pending_po'||stage==='closed_won')&&deal.fields.customer_decision!=='approved')missing.push('customer_decision (harus approved)');
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
 if(from==='closed_lost')return to==='prospecting'?null:'Reopen harus kembali ke Prospecting dengan jejak audit.';
 if(to==='closed_lost')return null;
 const open=SALES_STAGES.slice(0,9).map(x=>x[0]);
 if(to==='closed_won')return from==='pending_po'?null:'Won hanya setelah tahap Pending PO dan validasi PO.';
 const a=open.indexOf(from),b=open.indexOf(to);
 if(a<0||b<0)return 'Stage tidak dikenal';
 if(b>a+1)return 'Stage harus bertahap, tidak boleh melompati approval.';
 if(b<a)return 'Perubahan mundur harus melalui revisi terkontrol; tidak boleh langsung melompati stage.';
 return null;
}
export function stageProbability(stage:SalesStage):number{
 return SALES_STAGES.find(x=>x[0]===stage)?.[2]||0;
}
export function documentChecklist(deal:SalesDeal,account:SalesAccount){
 const f=account.fields,d=deal.fields;
 const registration=[
 ...ACCOUNT_FIELDS.filter(([k])=>k!=='client_tier'&&(!['billing_address','billing_province','billing_postal'].includes(k)||f.billing_same_as_hq==='tidak'))
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
