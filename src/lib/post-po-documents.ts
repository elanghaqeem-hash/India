// Post-PO form schema and independent Word output. Reference: DefendIT360 V.0426 forms.
// No customer identifiers, signatories or financial figures are invented as fallbacks.
export type Pic = { name: string; mobile: string; email: string };
export type EmployeeBand = '' | '<100' | '100-500' | '>500';
import type {ServiceFamily} from './sales-workflow';
export type {ServiceFamily} from './sales-workflow';
export interface RegistrationData {
  customerId: string;
  customerName: string;
  businessType: string;
  employeeBand: EmployeeBand;
  hqAddress: string;
  hqProvince: string;
  hqPostalCode: string;
  billingSameAsHq: boolean;
  billingAddress: string;
  billingProvince: string;
  billingPostalCode: string;
  npwp: string;
  companyPhone: string;
  primaryKtpNumber: string;
  fax: string;
  primary: Pic;
  technical: Pic;
  billing: Pic;
  tax: Pic;
  npwpAttachmentConfirmed: boolean;
  ktpAttachmentConfirmed: boolean;
  customerSignatory: string;
  customerSignatoryTitle: string;
  defenderSignatory: string;
  defenderSignatoryTitle: string;
  maker: string;
  reviewer: string;
  executor: string;
}
export type PaymentMilestone = { label: string; amount: number; trigger: string };
export interface ProjectData {
  poNumber: string;
  poDate: string;
  poVerified: boolean;
  quotationNumber: string;
  quotationAmountBeforeVat: number;
  serviceFamily: ServiceFamily;
  serviceDescription: string;
  quantityAndUnit: string;
  scope: string;
  technicalSpecifications: string;
  projectPic: Pic;
  deliveryAddress: string;
  deliveryProvince: string;
  deliveryPostalCode: string;
  paymentVA: '' | 'BCA' | 'OCBC NISP';
  projectFeeBeforeVat: number;
  milestones: PaymentMilestone[];
  durationValue: string;
  durationUnit: 'hari' | 'bulan' | 'tahun';
  completionDeadline: string;
  timeline: string;
  notes: string;
  quotationReconciled: boolean;
}
export type PostPoPacket = { registration: RegistrationData; project: ProjectData; isDemo?: boolean };
export type ValidationFinding = { field: string; message: string; category: 'registration' | 'project' };
export function emptyPic(): Pic { return {name:'', mobile:'', email:''}; }
export function newPostPoPacket(): PostPoPacket {
  return {
    registration: {
      customerId:'',customerName:'',businessType:'',employeeBand:'',
      hqAddress:'',hqProvince:'',hqPostalCode:'',billingSameAsHq:true,
      billingAddress:'',billingProvince:'',billingPostalCode:'',
      npwp:'',companyPhone:'',primaryKtpNumber:'',fax:'',
      primary:emptyPic(),technical:emptyPic(),billing:emptyPic(),tax:emptyPic(),
      npwpAttachmentConfirmed:false,ktpAttachmentConfirmed:false,
      customerSignatory:'',customerSignatoryTitle:'',
      defenderSignatory:'',defenderSignatoryTitle:'',
      maker:'',reviewer:'',executor:''
    },
    project: {
      poNumber:'',poDate:'',poVerified:false,quotationNumber:'',
      quotationAmountBeforeVat:0,serviceFamily:'VAPT',
      serviceDescription:'',quantityAndUnit:'',scope:'',technicalSpecifications:'',
      projectPic:emptyPic(),deliveryAddress:'',deliveryProvince:'',deliveryPostalCode:'',
      paymentVA:'',projectFeeBeforeVat:0,milestones:[{label:'',amount:0,trigger:''}],
      durationValue:'',durationUnit:'hari',completionDeadline:'',timeline:'',notes:'',
      quotationReconciled:false
    }
  };
}
const present=(s: unknown)=>typeof s==='string' && s.trim().length>0;
const phone=(s:string)=>/^\+?[0-9][0-9\s().-]{7,19}$/.test(s.trim());
const email=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
const postal=(s:string)=>/^\d{5}$/.test(s.trim());
const digits=(s:string)=>s.replace(/\D/g,'');
function picErrors(value:Pic,prefix:string,category:ValidationFinding['category']):ValidationFinding[] {
  const issues:ValidationFinding[]=[];
  if(!present(value?.name)) issues.push({field:prefix+'.name',message:'Nama PIC '+prefix+' wajib',category});
  if(!phone(value?.mobile||'')) issues.push({field:prefix+'.mobile',message:'Nomor HP PIC '+prefix+' belum valid',category});
  if(!email(value?.email||'')) issues.push({field:prefix+'.email',message:'Email PIC '+prefix+' belum valid',category});
  return issues;
}
export function validatePostPoPacket(data:PostPoPacket):ValidationFinding[] {
  const r=data.registration,p=data.project;
  const issues:ValidationFinding[]=[];
  const req=(field:string,value:unknown,message:string,category:ValidationFinding['category'])=>{
    if(!present(value)) issues.push({field,message,category});
  };
  req('customerId',r.customerId,'Customer ID wajib diterbitkan oleh sistem', 'registration');
  req('customerName',r.customerName,'Nama badan usaha wajib','registration');
  req('businessType',r.businessType,'Bidang usaha wajib','registration');
  if(!r.employeeBand) issues.push({field:'employeeBand',message:'Jumlah pegawai wajib dipilih','category':'registration'});
  req('hqAddress',r.hqAddress,'Alamat kantor pusat wajib','registration');
  req('hqProvince',r.hqProvince,'Provinsi kantor pusat wajib','registration');
  if(!postal(r.hqPostalCode)) issues.push({field:'hqPostalCode',message:'Kode pos kantor pusat harus 5 angka',category:'registration'});
  if(!r.billingSameAsHq){
    req('billingAddress',r.billingAddress,'Alamat penagihan wajib','registration');
    req('billingProvince',r.billingProvince,'Provinsi alamat penagihan wajib','registration');
    if(!postal(r.billingPostalCode)) issues.push({field:'billingPostalCode',message:'Kode pos penagihan harus 5 angka',category:'registration'});
  }
  if(![15,16].includes(digits(r.npwp).length)||/^0+$/.test(digits(r.npwp))) issues.push({field:'npwp',message:'NPWP harus 15/16 digit dan bukan nomor dummy',category:'registration'});
  if(!phone(r.companyPhone)) issues.push({field:'companyPhone',message:'Telepon badan usaha wajib/format belum valid',category:'registration'});
  if(!/^\d{16}$/.test(digits(r.primaryKtpNumber))||/^0+$/.test(digits(r.primaryKtpNumber))) issues.push({field:'primaryKtpNumber',message:'Nomor KTP PIC utama harus 16 digit dan bukan nomor dummy',category:'registration'});
  // The original V.0426 document marks fax with *. Explicit N/A is acceptable only as reviewed exception.
  req('fax',r.fax,'Nomor fax atau keterangan N/A terkonfirmasi wajib','registration');
  for(const name of ['primary','technical','billing','tax'] as const) issues.push(...picErrors(r[name],name,'registration'));
  if(!r.npwpAttachmentConfirmed) issues.push({field:'npwpAttachmentConfirmed',message:'Dokumen NPWP harus dikonfirmasi tersedia','category':'registration'});
  if(!r.ktpAttachmentConfirmed) issues.push({field:'ktpAttachmentConfirmed',message:'Dokumen KTP PIC utama harus dikonfirmasi tersedia','category':'registration'});
  req('customerSignatory',r.customerSignatory,'Penandatangan pelanggan wajib dikonfirmasi','registration');
  req('customerSignatoryTitle',r.customerSignatoryTitle,'Jabatan penandatangan pelanggan wajib','registration');
  req('defenderSignatory',r.defenderSignatory,'Penandatangan DefendIT360 wajib dikonfirmasi','registration');
  req('defenderSignatoryTitle',r.defenderSignatoryTitle,'Jabatan penandatangan DefendIT360 wajib','registration');
  req('maker',r.maker,'Nama pembuat internal wajib','registration');
  req('reviewer',r.reviewer,'Nama pemeriksa internal wajib','registration');
  req('executor',r.executor,'Nama pelaksana internal wajib','registration');

  req('poNumber',p.poNumber,'Nomor PO pelanggan wajib','project');
  req('poDate',p.poDate,'Tanggal PO wajib','project');
  if(!p.poVerified) issues.push({field:'poVerified',message:'PO harus telah diterima dan diperiksa terhadap dokumen asli',category:'project'});
  req('quotationNumber',p.quotationNumber,'Nomor quotation terpilih wajib','project');
  req('serviceDescription',p.serviceDescription,'Deskripsi produk/jasa wajib','project');
  req('quantityAndUnit',p.quantityAndUnit,'Jumlah dan satuan wajib','project');
  req('scope',p.scope,'Lingkup pekerjaan sesuai PO/SOW wajib','project');
  req('technicalSpecifications',p.technicalSpecifications,'Spesifikasi layanan/produk wajib sesuai jenis layanan','project');
  issues.push(...picErrors(p.projectPic,'projectPic','project'));
  req('deliveryAddress',p.deliveryAddress,'Alamat lokasi proyek wajib','project');
  req('deliveryProvince',p.deliveryProvince,'Provinsi lokasi proyek wajib','project');
  if(!postal(p.deliveryPostalCode)) issues.push({field:'deliveryPostalCode',message:'Kode pos lokasi proyek harus 5 angka',category:'project'});
  if(!p.paymentVA) issues.push({field:'paymentVA',message:'Virtual Account BCA / OCBC perlu dipilih dan diverifikasi Finance',category:'project'});
  if(!Number.isFinite(p.projectFeeBeforeVat)||p.projectFeeBeforeVat<=0) issues.push({field:'projectFeeBeforeVat',message:'Nilai proyek sebelum PPN wajib lebih dari nol',category:'project'});
  if(!Number.isFinite(p.quotationAmountBeforeVat)||p.quotationAmountBeforeVat<=0) issues.push({field:'quotationAmountBeforeVat',message:'Nilai quotation sebelum PPN wajib',category:'project'});
  if(p.quotationAmountBeforeVat>0&&p.projectFeeBeforeVat>0&&Math.abs(p.projectFeeBeforeVat-p.quotationAmountBeforeVat)>1) issues.push({field:'quotationAmountBeforeVat',message:'Nilai PO dan quotation tidak konsisten; revisi quotation/approval diperlukan',category:'project'});
  if(!p.quotationReconciled) issues.push({field:'quotationReconciled',message:'Kesesuaian PO/quotation/scope harus diverifikasi Sales dan Finance',category:'project'});
  if(p.milestones.length===0) issues.push({field:'milestones',message:'Minimal satu termin pembayaran wajib',category:'project'});
  p.milestones.forEach((m,i)=>{
    req('milestones.'+i+'.label',m.label,'Deskripsi termin '+(i+1)+' wajib','project');
    req('milestones.'+i+'.trigger',m.trigger,'Trigger jatuh tempo termin '+(i+1)+' wajib','project');
    if(!Number.isFinite(m.amount)||m.amount<=0) issues.push({field:'milestones.'+i+'.amount',message:'Nominal termin '+(i+1)+' harus > 0',category:'project'});
  });
  const sum=p.milestones.reduce((a,m)=>a+Number(m.amount||0),0);
  if(p.projectFeeBeforeVat>0&&Math.abs(sum-p.projectFeeBeforeVat)>1) issues.push({field:'milestones',message:'Jumlah seluruh termin harus sama dengan nilai proyek sebelum PPN',category:'project'});
  if(!((Number(p.durationValue)>0)||present(p.completionDeadline))) issues.push({field:'durationValue',message:'Jangka waktu atau tanggal selesai wajib','category':'project'});
  if(p.completionDeadline && Number.isNaN(Date.parse(p.completionDeadline))) issues.push({field:'completionDeadline',message:'Tanggal selesai proyek tidak valid',category:'project'});
  return issues;
}
/** Demo previews ignore missing proof files but never authorize actual execution. */
export function validatePostPoDemoPacket(data:PostPoPacket):ValidationFinding[]{
  const unverifiable=new Set(['npwpAttachmentConfirmed','ktpAttachmentConfirmed','poVerified','quotationReconciled']);
  return validatePostPoPacket(data).filter(issue=>!unverifiable.has(issue.field));
}
export function isReadyForKickoff(data:PostPoPacket):boolean{
  return !data.isDemo && validatePostPoPacket(data).length===0;
}
const xml=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const W='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function para(s:unknown,bold=false):string {return '<w:p><w:pPr><w:spacing w:after="95"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/>'+(bold?'<w:b/>':'')+'</w:rPr><w:t xml:space="preserve">'+xml(s)+'</w:t></w:r></w:p>';}
function row(label:string,value:unknown):string {return '<w:tr>'+tc(label,true)+tc(value)+'</w:tr>';}
function tc(value:unknown,header=false):string{return '<w:tc><w:tcPr><w:tcW w:w="'+(header?'3350':'6450')+'" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="D2D7E0"/></w:tcBorders>'+(header?'<w:shd w:fill="F0EBF7"/>':'')+'</w:tcPr>'+para(value,header)+'</w:tc>';}
function tbl(rows:string):string{return '<w:tbl><w:tblPr><w:tblW w:w="9800" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="A0A0A0"/><w:bottom w:val="single" w:sz="4" w:color="A0A0A0"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3350"/><w:gridCol w:w="6450"/></w:tblGrid>'+rows+'</w:tbl>';}
function h(s:string):string{return '<w:p><w:pPr><w:shd w:fill="59318B"/><w:spacing w:before="180" w:after="110"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>'+xml(s)+'</w:t></w:r></w:p>';}
function brand(title:string,isDemo=false):string {return (isDemo?h('DATA DUMMY / SIMULASI — DILARANG DIGUNAKAN SEBAGAI DOKUMEN RESMI')+para('NOMOR PO, NPWP/KTP, HARGA, IDENTITAS, DAN NAMA PENANDATANGAN ADALAH CONTOH. BUKAN BUKTI PENGESAHAN.',true):'')+para('DEFENDIT360 | PT DATA ENKRIPSI INFORMASI TEKNOLOGI',true)+para('CONFIDENTIAL  •  FORMULIR V.0426  •  '+title,true);}
function lines(value:string):string {return String(value).split(/\r?\n/).filter(Boolean).map(x=>para(x)).join('');}
const clientTerms=[
  'PELANGGAN wajib melampirkan salinan dokumen pendukung antara lain NPWP & KTP (Penanggung Jawab Utama). The CUSTOMER is required to attach supporting copy document such as NPWP & KTP (Main Person in Charge).',
  'PELANGGAN dengan ini memberikan persetujuannya kepada DEFEND IT360 untuk melakukan pemrosesan data PELANGGAN termasuk data pribadi (apabila ada) sesuai dengan kepentingan pemberian layanan DEFEND IT360 kepada PELANGGAN dan pemasaran sesuai dengan ketentuan peraturan perundang-undangan. The CUSTOMER hereby gives its consent to DEFEND IT360 to process CUSTOMER data including personal data (if any) in accordance with the interests of providing DEFEND IT360 services to the CUSTOMER and marketing in accordance with the provisions of laws and regulations.',
  "PELANGGAN dengan ini menyetujui kebijakan privasi DEFEND IT360 sebagaimana tertuang dalam https://www.defendit360.co.id/id/kebijakan-privasi/ yang akan diperbaharui dari waktu ke waktu. The CUSTOMERS hereby agree to DEFEND IT360's privacy policy as stated in https://www.Defend IT360.co.id/id/kebijakan-privasi/ which will be updated from time to time.",
  'PELANGGAN mewakili badan hukum atau diri sendiri menyatakan bahwa seluruh data yang diberikan dalam formulir ini adalah benar. Pelanggan wajib memberitahukan kepada DEFEND IT360 apabila terjadi perubahan data PELANGGAN. Dalam hal PELANGGAN tidak memberitahukan perubahan data PELANGGAN kepada DEFEND IT360, maka DEFEND IT360 akan mengacu kepada data pelanggan dalam Formulir Registrasi Pelanggan ini. The CUSTOMER hereby represents a legal entity or self declare that all data provided in this form is correct. The CUSTOMER is obliged to notify DEFEND IT360 if there is a change in CUSTOMER data. If CUSTOMER does not notify DEFEND IT360 of changes to CUSTOMER data, DEFEND IT360 will refer to customer data in this Customer Registration Form.'
];
const projectTerms=[
  'PELANGGAN dilarang melakukan perubahan jumlah/jenis/spesifikasi Proyek tanpa persetujuan tertulis dari DEFEND IT360. CUSTOMER is prohibited to change to the amount/type/specification of Project without written approval from DEFEND IT360.',
  'PELANGGAN wajib melakukan pembayaran 14 (empat belas) hari setelah dokumen penagihan diserahkan oleh DEFEND IT360. Dalam hal terjadi keterlambatan pembayaran yang dilakukan oleh PELANGGAN, maka PELANGGAN akan dikenakan denda keterlambatan pembayaran sebesar 1‰ (satu permil) dari nilai tagihan per hari keterlambatan dengan denda maksimal sebesar 5% (lima persen) dari nilai Total Proyek. The CUSTOMER is obliged to make payment 14 (fourteen) days after invoice document is submitted by DEFEND IT360. In the event of a late payment made by the CUSTOMER, the CUSTOMER will be subject to a late payment fine of 1‰ (one per mil) of the invoice value per day of delay with a maximum fine of 5% (five percent) of Project Fee.',
  'PELANGGAN wajib menyiapkan dan memastikan Lokasi Pemasangan / Penyerahan dalam kondisi siap untuk dilakukannya penyerahan Proyek. Dalam hal Lokasi Penyerahan Proyek belum siap karena kelalaian PELANGGAN dan/atau pihak ketiga lainnya sehingga menyebabkan terjadinya keterlambatan Penyerahan Proyek, maka Para Pihak sepakat bahwa DEFEND IT360 tetap berhak menagih dan menerima pembayaran atas Biaya Proyek dari PELANGGAN, paling lambat 14 (empat belas) hari kalender setelah diajukannya tagihan/invoice, tanpa disyaratkan adanya Berita Acara Serah Terima (BAST). The CUSTOMER is obliged to prepare and ensure that the Installation / Delivery Location is in a ready condition for the Project to be submitted. In the event that the Project Delivery Location is not ready due to the negligence of the CUSTOMER and/or other third parties causing delays in the Project Delivery, the Parties agree that DEFEND IT360 still has the right to collect and receive payment for the Project Fee from the CUSTOMER, no later than 14 (fourteen) calendar days after the submission of the bill/invoice, without the requirement for a Minutes of Handover (BAST).',
  'DEFEND IT360 tetap berhak menagih dan menerima pembayaran atas Biaya Proyek meskipun BAST belum ditandatangani yang disebabkan oleh karena kelalaian PELANGGAN. DEFEND IT360 still has the right to collect and receive Project Fee payment although BAST has not been signed because of the negligence from the CUSTOMER.',
  'Dalam hal PELANGGAN melakukan pembatalan Proyek setelah menandatangani Formulir ini, maka PELANGGAN tetap berkewajiban membayar seluruh Biaya Proyek. In the event that the Customer cancel the Project after signing this Form, then the Customer is still obliged to pay the Project Fee.',
  'PELANGGAN dengan ini memberikan persetujuannya kepada DEFEND IT360 untuk melakukan pemrosesan data PELANGGAN termasuk data pribadi (apabila ada) sesuai dengan kepentingan pemberian layanan DEFEND IT360 kepada PELANGGAN dan pemasaran sesuai dengan ketentuan peraturan perundang-undangan. The CUSTOMER hereby gives its consent to DEFEND IT360 to process CUSTOMER data including personal data (if any) in accordance with the interests of providing DEFEND IT360 services to the CUSTOMER and marketing in accordance with the provisions of laws and regulations.',
  "PELANGGAN dengan ini menyetujui kebijakan privasi DEFEND IT360 sebagaimana tertuang dalam https://www.defendit360.co.id/id/kebijakan-privasi/ yang akan diperbaharui dari waktu ke waktu. The CUSTOMERS hereby agree to DEFEND IT360's privacy policy as stated in https://www.DEFEND IT360.co.id/id/kebijakan-privasi/ which will be updated from time to time."
];
function wordDocument(body:string):string {
 return W+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+
 '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="820" w:right="950" w:bottom="820" w:left="950"/></w:sectPr></w:body></w:document>';
}
function formatIDR(amount:number){return 'Rp '+new Intl.NumberFormat('id-ID').format(amount);}
function registrationBody(data:RegistrationData,isDemo=false):string {
 let s=brand('FORMULIR REGISTRASI PELANGGAN / CUSTOMER REGISTRATION FORM',isDemo);
 s+=h('1. DATA PELANGGAN / CUSTOMER DATA')+tbl(
  row('Customer ID *',data.customerId)+row('Nama / Name *',data.customerName)+
  row('Jenis Bidang Usaha / Business Type *',data.businessType)+row('Jumlah Pegawai / Employees *',data.employeeBand)+
  row('Kantor Pusat / Headquarter Address *',data.hqAddress)+row('Provinsi / Kode Pos *',data.hqProvince+' / '+data.hqPostalCode)+
  row('Alamat Penagihan / Billing *',data.billingSameAsHq?data.hqAddress:data.billingAddress)+
  row('Provinsi / Kode Pos Penagihan *',data.billingSameAsHq?data.hqProvince+' / '+data.hqPostalCode:data.billingProvince+' / '+data.billingPostalCode)+
  row('NPWP *',data.npwp)+row('Telepon Perusahaan *',data.companyPhone)+
  row('KTP PIC Utama *',data.primaryKtpNumber)+row('Fax *',data.fax)
 );
 s+=h('2. DATA PENANGGUNG JAWAB / PERSONS IN CHARGE');
 for(const [label,pic] of [['Utama / Main PIC',data.primary],['Teknis / Technical PIC',data.technical],['Penagihan / Billing PIC',data.billing],['Pajak / Tax PIC',data.tax]] as Array<[string,Pic]>){
  s+=tbl(row(label+' *',pic.name)+row('Mobile *',pic.mobile)+row('Email *',pic.email));
 }
 s+=h('DOKUMEN PENDUKUNG / SUPPORTING DOCUMENTS')+
  tbl(row('NPWP',data.npwpAttachmentConfirmed?'Dikonfirmasi tersedia':'Belum tersedia')+row('KTP PIC Utama',data.ktpAttachmentConfirmed?'Dikonfirmasi tersedia':'Belum tersedia'));
 s+=h('SYARAT-SYARAT & KETENTUAN / TERMS & CONDITIONS')+clientTerms.map(x=>para(x)).join('');
 s+=h('PENGESAHAN / SIGNATURES')+
  tbl(row('PELANGGAN / CUSTOMER',data.customerSignatory+' | '+data.customerSignatoryTitle)+row('DEFENDIT360',data.defenderSignatory+' | '+data.defenderSignatoryTitle)+
  row('Tanggal/Tanda Tangan/Cap','________________________________________')+
  row('Pembuat / Maker',data.maker)+row('Pemeriksa / Reviewer',data.reviewer)+row('Pelaksana / Executor',data.executor));
 return s+para(isDemo?'SIMULASI / DATA DUMMY - Tidak sah sebagai registrasi dan bukan persetujuan pelanggan.':'Form belum bertanda tangan. Tanda tangan dan pengesahan tetap diperlukan.',true);
}
function projectBody(data:PostPoPacket):string {
 const r=data.registration,p=data.project;
 let s=brand('FORMULIR PROYEK / PROJECT FORM',!!data.isDemo);
 s+=h('1. DATA PELANGGAN / CUSTOMER DATA')+
  tbl(row('Customer ID *',r.customerId)+row('Nama Pelanggan *',r.customerName));
 s+=h('2. DATA PROYEK / PROJECT DATA')+
  tbl(row('Nomor PO Pelanggan *',p.poNumber)+row('Tanggal PO *',p.poDate)+
  row('Nomor Quotation',p.quotationNumber)+row('Jenis Produk / Layanan *',p.serviceFamily)+
  row('Rincian Proyek *',p.serviceDescription)+row('Jumlah / Satuan *',p.quantityAndUnit)+
  row('Lingkup Pekerjaan *',p.scope)+row('Spesifikasi Teknis *',p.technicalSpecifications)+
  row('Penanggung Jawab Proyek *',p.projectPic.name)+row('Mobile / Email *',p.projectPic.mobile+' / '+p.projectPic.email)+
  row('Lokasi Penyerahan Proyek *',p.deliveryAddress)+row('Provinsi / Kode Pos *',p.deliveryProvince+' / '+p.deliveryPostalCode));
 s+=h('3. DETAIL BIAYA / FEE DETAILS')+
  tbl(row('Virtual Account Payment *',p.paymentVA)+row('Total Biaya Sebelum PPN *',formatIDR(p.projectFeeBeforeVat))+
  row('PPN','Belum termasuk; mengikuti PO / kontrak / invoice terverifikasi')+
  row('Nominal Quotation Sebelum PPN',formatIDR(p.quotationAmountBeforeVat)));
 s+=tbl(row('Termin Pembayaran / Payment Schedule *',p.milestones.map((x,i)=>(i+1)+'. '+x.label+' — '+formatIDR(x.amount)+' — '+x.trigger).join(' | ')));
 s+=h('4. JANGKA WAKTU PROYEK / TERM OF PROJECT')+
  tbl(row('Durasi / Duration *',p.durationValue+' '+p.durationUnit)+row('Tanggal Penyelesaian',p.completionDeadline||'-')+
  row('Timeline Proyek',p.timeline||'Tidak dilampirkan')+row('Catatan Tambahan',p.notes||'-'));
 s+=h('SYARAT-SYARAT & KETENTUAN / TERMS & CONDITIONS')+projectTerms.map(x=>para(x)).join('');
 s+=para('Klausul di atas mengikuti redaksi referensi V.0426; Legal wajib memverifikasi kesesuaian dengan PO/PKS yang telah disepakati.',true);
 s+=h('PENGESAHAN / SIGNATURES')+
  tbl(row('PELANGGAN / CUSTOMER',r.customerSignatory+' | '+r.customerSignatoryTitle)+
  row('DEFENDIT360',r.defenderSignatory+' | '+r.defenderSignatoryTitle)+
  row('Tanggal / Materai / Cap','________________________________________')+
  row('Customer ID',r.customerId)+row('Installation ID','Diisi internal saat penugasan')+
  row('Pembuat / Maker',r.maker)+row('Pemeriksa / Reviewer',r.reviewer)+row('Pelaksana / Executor',r.executor));
 return s+para(data.isDemo?'SIMULASI / DATA DUMMY - Tidak sah sebagai PO, persetujuan kerja, atau dasar Kick Off.':'Dokumen belum ditandatangani. Kick Off hanya setelah verifikasi dan otorisasi internal.',true);
}
function crc32(data:Uint8Array):number{let c=0xFFFFFFFF;for(let j=0;j<data.length;j++){c^=data[j];for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return(c^0xFFFFFFFF)>>>0;}
function zip(entries:Array<[string,string]>):Uint8Array{
 const enc=new TextEncoder();const ls:Uint8Array[]=[],cs:Uint8Array[]=[];let offset=0;
 for(const [name,value] of entries){const n=enc.encode(name),d=enc.encode(value),crc=crc32(d);
  const l=new Uint8Array(30+n.length+d.length),v=new DataView(l.buffer);
  v.setUint32(0,0x04034B50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);
  v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,n.length,true);
  l.set(n,30);l.set(d,30+n.length);
  const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);
  cv.setUint32(0,0x02014B50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);
  cv.setUint32(16,crc,true);cv.setUint32(20,d.length,true);cv.setUint32(24,d.length,true);
  cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);
  ls.push(l);cs.push(c);offset+=l.length;
 }
 const cd=cs.reduce((v,x)=>v+x.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);
 dv.setUint32(0,0x06054B50,true);dv.setUint16(8,cs.length,true);dv.setUint16(10,cs.length,true);
 dv.setUint32(12,cd,true);dv.setUint32(16,offset,true);
 const out=new Uint8Array(offset+cd+22);let pos=0;
 for(const chunk of [...ls,...cs,end]){out.set(chunk,pos);pos+=chunk.length;}return out;
}
export type PostPoDocKind = 'registration'|'project';
export function createPostPoDocx(packet:PostPoPacket,kind:PostPoDocKind):Uint8Array{
 const issues=packet.isDemo?validatePostPoDemoPacket(packet):validatePostPoPacket(packet);
 if(issues.length)throw new Error('Dokumen belum dapat diterbitkan. Ada '+issues.length+' parameter wajib belum valid.');
 const ct=W+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
 const rels=W+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
 return zip([['[Content_Types].xml',ct],['_rels/.rels',rels],['word/document.xml',wordDocument(kind==='registration'?registrationBody(packet.registration,!!packet.isDemo):projectBody(packet))]]);
}
export function downloadPostPoDocx(packet:PostPoPacket,kind:PostPoDocKind):void{
 const bytes=createPostPoDocx(packet,kind);const view=new Uint8Array(bytes.length);view.set(bytes);
 const url=URL.createObjectURL(new Blob([view.buffer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
 const link=document.createElement('a');link.href=url;
 const safe=packet.project.poNumber.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,60);
 link.download='INDIA_DefendIT360_'+(packet.isDemo?'DEMO_':'')+(kind==='registration'?'Form_Registrasi':'Form_Project')+'_'+safe+'.docx';
 document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/** Readiness audit of the *existing* Sales customer schema. Never marks a customer
 * compliant merely because a name, tier and one email have been entered.
 * Returns only source-backed fields. Missing fields are handled in the Post-PO form.
 */
export type SalesCustomerSnapshot = {
  customer_id?:string;name?:string;legal_name?:string;industry?:string;npwp?:string;
  address?:string;contacts?:Array<{name?:string;email?:string;phone?:string;is_primary?:boolean}>;
  business_type?:string;employee_band?:EmployeeBand;hq_province?:string;hq_postal_code?:string;
  billing_same_as_hq?:boolean;billing_address?:string;billing_province?:string;billing_postal_code?:string;
  company_phone?:string;primary_ktp_number?:string;fax?:string;
};
export function auditExistingSalesCustomer(company:SalesCustomerSnapshot):{
  mapped:Partial<RegistrationData>; missing:string[]
}{
 const mapped:Partial<RegistrationData>={};
 if(present(company.customer_id))mapped.customerId=company.customer_id!;
 if(present(company.legal_name||company.name))mapped.customerName=(company.legal_name||company.name)!;
 if(present(company.business_type))mapped.businessType=company.business_type!;
 if(company.employee_band)mapped.employeeBand=company.employee_band;
 if(present(company.address))mapped.hqAddress=company.address!;
 if(present(company.hq_province))mapped.hqProvince=company.hq_province!;
 if(present(company.hq_postal_code))mapped.hqPostalCode=company.hq_postal_code!;
 if(present(company.billing_address))mapped.billingAddress=company.billing_address!;
 if(present(company.billing_province))mapped.billingProvince=company.billing_province!;
 if(present(company.billing_postal_code))mapped.billingPostalCode=company.billing_postal_code!;
 if(company.billing_same_as_hq!==undefined)mapped.billingSameAsHq=company.billing_same_as_hq;
 if(present(company.npwp) && !/^0[0.]*$/.test(company.npwp!.replace(/[-]/g,'')))mapped.npwp=company.npwp!;
 if(present(company.company_phone))mapped.companyPhone=company.company_phone!;
 if(present(company.primary_ktp_number))mapped.primaryKtpNumber=company.primary_ktp_number!;
 if(present(company.fax))mapped.fax=company.fax!;
 const p=company.contacts?.find(x=>x.is_primary)||company.contacts?.[0];
 if(p)mapped.primary={name:p.name||'',mobile:p.phone||'',email:p.email||''};
 const critical:Array<[string,unknown]>=[
  ['Customer ID',mapped.customerId],['Nama pelanggan',mapped.customerName],
  ['Jenis bidang usaha',mapped.businessType],['Jumlah pegawai',mapped.employeeBand],
  ['Alamat kantor pusat',mapped.hqAddress],['Provinsi',mapped.hqProvince],
  ['Kode pos',mapped.hqPostalCode],['Alamat penagihan/same-as-HQ',mapped.billingSameAsHq===true?'same':mapped.billingAddress],
  ['NPWP',mapped.npwp],['Telepon perusahaan',mapped.companyPhone],
  ['KTP PIC utama',mapped.primaryKtpNumber],['Fax atau N/A',mapped.fax],
  ['PIC utama',mapped.primary?.name],['Mobile PIC utama',mapped.primary?.mobile],
  ['Email PIC utama',mapped.primary?.email],
  ['PIC teknis',undefined],['PIC penagihan',undefined],['PIC pajak',undefined],
  ['Bukti NPWP',undefined],['Bukti KTP',undefined],['Penandatangan',undefined],
 ];
 return {mapped,missing:critical.filter(([,v])=>!present(v)).map(([k])=>k)};
}
