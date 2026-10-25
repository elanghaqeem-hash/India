/**
 * Synthetic test data for the public Post-PO preview only.
 * No names, identifiers, approval checks, real contracts, or client data are asserted.
 * Every resulting packet is permanently marked DEMO until the user resets the form.
 */
import type { PostPoPacket, Pic, ServiceFamily, PaymentMilestone } from './post-po-documents';

type ServiceExample = {
  description: string;
  quantity: string;
  scope: string;
  specifications: string;
  fee: number;
  duration: string;
  durationUnit: 'hari' | 'bulan' | 'tahun';
  deadline: string;
  timeline: string;
};
const SERVICE_EXAMPLES: Partial<Record<ServiceFamily, ServiceExample>> = {
  'VAPT': {
    description: 'SIMULASI: Vulnerability Assessment & Penetration Testing Aplikasi',
    quantity: '2 aplikasi web + 1 API gateway (contoh)',
    scope: 'SIMULASI: pengujian keamanan aplikasi web dan API, konfirmasi target dan rules of engagement, verifikasi temuan, retest, serta laporan eksekutif dan teknis.',
    specifications: 'Contoh metode: Grey Box; referensi OWASP WSTG/ASVS; 2 web apps dan 1 API gateway. Target/IP asli belum tersedia.',
    fee: 125000000,
    duration: '30',
    durationUnit: 'hari',
    deadline: '2026-11-20',
    timeline: 'Minggu 1: kickoff & persiapan; Minggu 2-3: pengujian; Minggu 4: pelaporan dan retest (SIMULASI).'
  },
  'SOC/MDR': {
    description: 'SIMULASI: Managed SOC / MDR monitoring 12 bulan',
    quantity: '12 bulan layanan (contoh)',
    scope: 'SIMULASI: onboarding log sources, triage alert, monitoring, eskalasi insiden dan laporan bulanan. Cakupan dan jam operasional aktual wajib mengikuti PO/SOW.',
    specifications: 'Contoh arsitektur FortiSIEM dan ACT Pro; estimasi 50 log sources. EPS, retensi, SLA serta personel shared/dedicated belum disepakati.',
    fee: 480000000,
    duration: '12',
    durationUnit: 'bulan',
    deadline: '2027-10-20',
    timeline: 'Bulan 1: onboarding dan tuning; Bulan 2-12: layanan operasional (SIMULASI).'
  },
  'CTI': {
    description: 'SIMULASI: Cyber Threat Intelligence Monitoring',
    quantity: '1 paket berlangganan 12 bulan (contoh)',
    scope: 'SIMULASI: monitoring domain, identifikasi paparan kredensial dan ancaman relevan, eskalasi temuan prioritas, laporan berkala.',
    specifications: 'Contoh pemantauan: 2 domain dan 3 brand keyword; kuota laporan dan penyedia feed belum disetujui.',
    fee: 180000000,
    duration: '12',
    durationUnit: 'bulan',
    deadline: '2027-10-20',
    timeline: 'Bulan 1: baseline; Bulan 2-12: monitoring dan laporan (SIMULASI).'
  },
  'Cybersecurity Governance': {
    description: 'SIMULASI: Assessment ISO 27001 dan Tata Kelola Keamanan Informasi',
    quantity: '1 paket assessment dan penyusunan dokumen (contoh)',
    scope: 'SIMULASI: kick off, gap assessment, wawancara, review kebijakan dan penyusunan roadmap remediasi.',
    specifications: 'Contoh acuan ISO/IEC 27001:2022; 1 organisasi, 3 workshop; bukan klaim sertifikasi.',
    fee: 200000000,
    duration: '60',
    durationUnit: 'hari',
    deadline: '2026-12-20',
    timeline: 'Minggu 1-2: asesmen; Minggu 3-6: analisis; Minggu 7-8: laporan (SIMULASI).'
  },
  'Incident Response/DFIR': {
    description: 'SIMULASI: Digital Forensics and Incident Response',
    quantity: '5 endpoint/laptop (contoh)',
    scope: 'SIMULASI: akuisisi bukti berdasarkan izin, analisis forensik, dokumentasi chain of custody, rekomendasi dan laporan.',
    specifications: '5 unit endpoint simulasi; imaging forensik dan pemeriksaan artefak. Kewenangan atas perangkat dan akses harus diverifikasi.',
    fee: 150000000,
    duration: '20',
    durationUnit: 'hari',
    deadline: '2026-11-10',
    timeline: 'Minggu 1: penerimaan dan akuisisi; Minggu 2-3: analisis serta pelaporan (SIMULASI).'
  },
  'Cybersecurity Technology': {
    description: 'SIMULASI: Pengadaan Lisensi dan Implementasi Security Platform',
    quantity: '1 paket implementasi + 12 bulan lisensi (contoh)',
    scope: 'SIMULASI: aktivasi lisensi, konfigurasi awal, integrasi terbatas, knowledge transfer dan serah terima.',
    specifications: 'Contoh SKU belum ditetapkan. Merek/OEM, sizing, model support, SLA dan lisensi wajib dipastikan dari BoQ final.',
    fee: 320000000,
    duration: '45',
    durationUnit: 'hari',
    deadline: '2026-12-05',
    timeline: 'Minggu 1-2: persiapan; Minggu 3-5: konfigurasi; Minggu 6: UAT (SIMULASI).'
  },
  'Other': {
    description: 'SIMULASI: Layanan Keamanan Siber Tambahan',
    quantity: '1 paket pekerjaan (contoh)',
    scope: 'SIMULASI: ruang lingkup, objek, hasil pekerjaan dan pengecualian menunggu PO/SOW.',
    specifications: 'Contoh generik; isi spesifikasi sesuai produk/layanan yang telah dibeli klien.',
    fee: 95000000,
    duration: '30',
    durationUnit: 'hari',
    deadline: '2026-11-20',
    timeline: 'Tahap persiapan, pelaksanaan dan pelaporan (SIMULASI).'
  }
};

export const DUMMY_DATA_NOTICE =
  'DATA DUMMY / HANYA SIMULASI — bukan data pelanggan, PO, NPWP, KTP, bukti verifikasi, atau persetujuan nyata.';

function missing(value:string|undefined|null):boolean { return !value || !value.trim(); }
function useIfEmpty(current:string, fallback:string):string { return missing(current) ? fallback : current; }
function examplePic(name:string, idx:number):Pic {
  return {name, mobile:'+62 800 0000 000'+idx, email:'pic'+idx+'@example.com'};
}
function fillPic(current:Pic, fallback:Pic):Pic {
  return {
    name:useIfEmpty(current.name,fallback.name),
    mobile:useIfEmpty(current.mobile,fallback.mobile),
    email:useIfEmpty(current.email,fallback.email)
  };
}
function fillMilestones(current:PaymentMilestone[],fee:number):PaymentMilestone[]{
  // Retain existing paid amounts and existing milestone descriptions.
  // If a single default blank row exists, demonstrate two 50:50 stages.
  const rows=current.map(m=>({...m}));
  const singleBlank=rows.length===1 && missing(rows[0].label) && !rows[0].amount && missing(rows[0].trigger);
  if(singleBlank){
    const half=Math.floor(fee/2);
    return [
      {label:'Termin 1 / Simulasi',amount:half,trigger:'Setelah PO dan dokumen lengkap (contoh)'},
      {label:'Termin 2 / Simulasi',amount:fee-half,trigger:'Setelah BAST (contoh)'}
    ];
  }
  if(rows.length===0)return [{label:'Termin 1 / Simulasi',amount:fee,trigger:'Setelah PO (contoh)'}];
  const currentSum=rows.reduce((sum,m)=>sum+Number(m.amount||0),0);
  const emptyIndexes=rows.map((m,i)=>(m.amount<=0?i:-1)).filter(i=>i>=0);
  const missingBudget=Math.max(0,fee-currentSum);
  return rows.map((m,i)=>({
    label:useIfEmpty(m.label,'Termin '+(i+1)+' / Simulasi'),
    amount:m.amount>0?m.amount:
      (i===emptyIndexes[0]?missingBudget:0),
    trigger:useIfEmpty(m.trigger,'Tahap '+(i+1)+' (contoh)')
  }));
}

/** Fill only blank text and zero currency fields, leaving user-entered values intact.
 * The entire result is marked isDemo, irrespective of which values were pre-existing.
 * Evidence checkboxes deliberately remain false if not already checked.
 */
export function fillEmptyPostPoWithDummy(source:PostPoPacket):PostPoPacket {
  const base:PostPoPacket=structuredClone(source);
  const r=base.registration, p=base.project;
  const example=SERVICE_EXAMPLES[p.serviceFamily]||SERVICE_EXAMPLES.Other!;
  r.customerId=useIfEmpty(r.customerId,'DEMO-CUST-0001');
  r.customerName=useIfEmpty(r.customerName,'PT SIMULASI SIBER NUSANTARA (DUMMY)');
  r.businessType=useIfEmpty(r.businessType,'Layanan Teknologi Informasi');
  if(!r.employeeBand)r.employeeBand='100-500';
  r.hqAddress=useIfEmpty(r.hqAddress,'ALAMAT FIKTIF: Jl. Contoh Siber No. 10, Jakarta Timur');
  r.hqProvince=useIfEmpty(r.hqProvince,'DKI Jakarta');
  r.hqPostalCode=useIfEmpty(r.hqPostalCode,'13210');
  if(!r.billingSameAsHq){
    r.billingAddress=useIfEmpty(r.billingAddress,r.hqAddress);
    r.billingProvince=useIfEmpty(r.billingProvince,r.hqProvince);
    r.billingPostalCode=useIfEmpty(r.billingPostalCode,r.hqPostalCode);
  }
  // Non-official synthetic number pattern; never use for tax/KYC identification.
  r.npwp=useIfEmpty(r.npwp,'9999999900001111');
  r.primaryKtpNumber=useIfEmpty(r.primaryKtpNumber,'9999999900001111');
  r.companyPhone=useIfEmpty(r.companyPhone,'+62 800 0000 0000');
  r.fax=useIfEmpty(r.fax,'N/A - SIMULASI');
  r.primary=fillPic(r.primary,examplePic('Aulia Simulasi - PIC Utama',1));
  r.technical=fillPic(r.technical,examplePic('Bima Simulasi - PIC Teknis',2));
  r.billing=fillPic(r.billing,examplePic('Citra Simulasi - PIC Penagihan',3));
  r.tax=fillPic(r.tax,examplePic('Danu Simulasi - PIC Pajak',4));
  r.customerSignatory=useIfEmpty(r.customerSignatory,'Direktur Pelanggan (SIMULASI)');
  r.customerSignatoryTitle=useIfEmpty(r.customerSignatoryTitle,'Direktur Utama (contoh)');
  r.defenderSignatory=useIfEmpty(r.defenderSignatory,'Pejabat DefendIT360 (SIMULASI)');
  r.defenderSignatoryTitle=useIfEmpty(r.defenderSignatoryTitle,'Pejabat Berwenang (contoh)');
  r.maker=useIfEmpty(r.maker,'Sales Demo');
  r.reviewer=useIfEmpty(r.reviewer,'Pemeriksa Demo');
  r.executor=useIfEmpty(r.executor,'Pelaksana Demo');

  p.poNumber=useIfEmpty(p.poNumber,'PO-DEMO-2026-001');
  p.poDate=useIfEmpty(p.poDate,'2026-10-20');
  p.quotationNumber=useIfEmpty(p.quotationNumber,'QT-DEMO-2026-001');
  p.serviceDescription=useIfEmpty(p.serviceDescription,example.description);
  p.quantityAndUnit=useIfEmpty(p.quantityAndUnit,example.quantity);
  p.scope=useIfEmpty(p.scope,example.scope);
  p.technicalSpecifications=useIfEmpty(p.technicalSpecifications,example.specifications);
  p.projectPic=fillPic(p.projectPic,examplePic('Eka Simulasi - PIC Proyek',5));
  p.deliveryAddress=useIfEmpty(p.deliveryAddress,r.hqAddress);
  p.deliveryProvince=useIfEmpty(p.deliveryProvince,r.hqProvince);
  p.deliveryPostalCode=useIfEmpty(p.deliveryPostalCode,r.hqPostalCode);
  if(!p.paymentVA)p.paymentVA='BCA'; // Choice only, never a real approved VA.
  if(p.quotationAmountBeforeVat<=0 && p.projectFeeBeforeVat>0)p.quotationAmountBeforeVat=p.projectFeeBeforeVat;
  if(p.projectFeeBeforeVat<=0 && p.quotationAmountBeforeVat>0)p.projectFeeBeforeVat=p.quotationAmountBeforeVat;
  if(p.quotationAmountBeforeVat<=0)p.quotationAmountBeforeVat=example.fee;
  if(p.projectFeeBeforeVat<=0)p.projectFeeBeforeVat=example.fee;
  p.milestones=fillMilestones(p.milestones,p.projectFeeBeforeVat);
  if(missing(p.durationValue)){
    p.durationValue=example.duration;
    p.durationUnit=example.durationUnit;
  }
  p.completionDeadline=useIfEmpty(p.completionDeadline,example.deadline);
  p.timeline=useIfEmpty(p.timeline,example.timeline);
  p.notes=useIfEmpty(p.notes,DUMMY_DATA_NOTICE);
  // Proof of real PO or supporting attachments is never asserted here.
  base.isDemo=true;
  return base;
}

export function createDemoPostPoPacket(source:PostPoPacket,serviceFamily:ServiceFamily='VAPT'):PostPoPacket {
  const base:PostPoPacket=structuredClone(source);
  base.project.serviceFamily=serviceFamily;
  return fillEmptyPostPoWithDummy(base);
}
