/**
 * Standardized scoping choices aligned with the BoQ service_type values.
 * Keep VAPT/SOC calculators unchanged; all other families collect evidence-backed
 * sizing inputs without inventing man-day or price formulas.
 */
export const SCOPING_SERVICE_TYPES = [
  'VAPT','SOC','CTI','ISO','PDP','Hardening','IR','GRC','DFIR','TECHNOLOGY','TRAINING','Lainnya',
] as const;
export type ScopingService = (typeof SCOPING_SERVICE_TYPES)[number];
export type ScopingField = {
  key: string;
  label: string;
  kind: 'select' | 'number' | 'text';
  required?: boolean;
  options?: readonly string[];
  unit?: string;
  help?: string;
};
export type ScopingDefinition = {
  label: string;
  subtitle: string;
  outputUnit: string;
  fields: readonly ScopingField[];
};
const choice = (key:string,label:string,options:readonly string[],required=true):ScopingField =>
  ({key,label,kind:'select',options,required});
const count = (key:string,label:string,unit:string,required=true):ScopingField =>
  ({key,label,kind:'number',unit,required});
const text = (key:string,label:string,required=true):ScopingField =>
  ({key,label,kind:'text',required});

export const SCOPING_DEFINITIONS:Record<ScopingService,ScopingDefinition> = {
  VAPT:{label:'VAPT / Pentest',subtitle:'Aplikasi, API, jaringan, source code dan red teaming',outputUnit:'MD',fields:[]},
  SOC:{label:'SOC / MDR',subtitle:'Monitoring, log source, EPS, operasi dan SLA',outputUnit:'Bulan',fields:[]},
  CTI:{label:'Cyber Threat Intelligence',subtitle:'Digital risk, threat intelligence, dark web dan brand monitoring',outputUnit:'Bulan',fields:[
    choice('cti_type','Jenis Layanan CTI',['Threat Intelligence Report','Dark Web Monitoring','Brand / Domain Monitoring','Attack Surface Monitoring','Executive Threat Monitoring','Managed CTI']),
    count('cti_assets','Domain / brand / aset yang dimonitor','aset'),
    count('cti_sources','Sumber atau organisasi intelijen','sumber',false),
    choice('cti_frequency','Frekuensi Pelaporan',['Harian','Mingguan','Bulanan','Insidental']),
    choice('cti_coverage','Cakupan Monitoring',['Indonesia','Regional ASEAN','Global']),
    count('cti_months','Durasi Kontrak','bulan'),
  ]},
  ISO:{label:'ISO & Sertifikasi',subtitle:'Gap assessment, implementasi, audit kesiapan dan sertifikasi',outputUnit:'Paket',fields:[
    choice('iso_standard','Standar',['ISO 27001','ISO 27701','ISO 22301','ISO 20000-1','ISO 9001','ISO 31000','Lainnya']),
    choice('iso_engagement','Jenis Pekerjaan',['Gap Assessment','Implementasi','Internal Audit','Readiness Assessment','Pendampingan Sertifikasi','Surveillance / Improvement']),
    count('iso_sites','Jumlah Lokasi / Site','site'),
    count('iso_units','Jumlah Unit Kerja','unit'),
    choice('iso_maturity','Kesiapan Awal',['Belum dinilai','Awal','Sebagian diterapkan','Sudah diterapkan']),
    count('iso_months','Target Durasi','bulan'),
  ]},
  PDP:{label:'PDP & Privacy',subtitle:'UU PDP, ROPA, DPIA, DPO dan privacy governance',outputUnit:'Paket',fields:[
    choice('pdp_type','Jenis Asesmen',['PDP Gap Assessment','ROPA','DPIA','DPO as a Service','Privacy Policy & SOP','Data Mapping / Assessment','Implementasi PDP End-to-End']),
    count('pdp_processes','Jumlah Proses Pengolahan Data','proses'),
    count('pdp_systems','Jumlah Aplikasi / Sistem','sistem'),
    count('pdp_parties','Jumlah Pihak Ketiga Pemroses','pihak',false),
    choice('pdp_sensitivity','Kategori Data',['Umum','Data Pribadi Spesifik','Campuran']),
    count('pdp_months','Durasi Pekerjaan','bulan'),
  ]},
  Hardening:{label:'Security Hardening',subtitle:'Baseline konfigurasi dan remediasi keamanan aset',outputUnit:'Paket',fields:[
    choice('hardening_target','Objek Hardening',['Windows Server','Linux Server','Network Devices','Firewall / WAF','Database','Cloud / Kubernetes','Endpoint','Multi-Platform']),
    count('hardening_assets','Jumlah Aset','aset'),
    choice('hardening_baseline','Standar Acuan',['CIS Benchmark','Vendor Best Practices','NIST','Kebijakan Internal']),
    choice('hardening_access','Akses Pelaksanaan',['Remote','Onsite','Hybrid']),
    choice('hardening_scope','Cakupan',['Assessment saja','Assessment + Remediation','Assessment + Remediation + Retest']),
    count('hardening_environments','Jumlah Environment','environment',false),
  ]},
  IR:{label:'Incident Response',subtitle:'IR retainer, triage, containment dan recovery',outputUnit:'Paket',fields:[
    choice('ir_model','Model Layanan',['Incident Response On Demand','IR Retainer','Incident Readiness','Tabletop Exercise','Malware Triage']),
    choice('ir_severity','Tingkat Kritikalitas',['Belum teridentifikasi','Low','Medium','High','Critical']),
    count('ir_assets','Estimasi Aset Terdampak','aset'),
    count('ir_hours','Jam Respons / Retainer','jam'),
    choice('ir_sla','Waktu Respons',['4 jam','8 jam','24 jam','Best Effort']),
    choice('ir_location','Lokasi Respons',['Remote','Onsite','Hybrid']),
  ]},
  GRC:{label:'Cybersecurity GRC',subtitle:'IT governance, risk, compliance, audit dan maturity',outputUnit:'Paket',fields:[
    choice('grc_type','Jenis Engagement',['GRC Gap Assessment','IT Risk Assessment','IT Governance','IT Audit','RCSA / Internal Control','BCM / BCP / DRP','Regulatory Compliance','Third Party Risk Management','Cyber Maturity Assessment']),
    choice('grc_framework','Framework',['OJK / BI','ISO 27001','ISO 31000','NIST CSF','COBIT','COSO','Multi-Framework']),
    count('grc_units','Jumlah Unit / Cabang','unit'),
    count('grc_processes','Jumlah Proses / Aktivitas','proses'),
    count('grc_controls','Jumlah Kontrol / Regulasi','kontrol',false),
    count('grc_months','Durasi','bulan'),
  ]},
  DFIR:{label:'Digital Forensics / DFIR',subtitle:'Forensic acquisition, analisis bukti dan investigasi digital',outputUnit:'Paket',fields:[
    choice('dfir_case','Jenis Kasus',['Endpoint Forensics','Server Forensics','Network Forensics','Email Forensics','Cloud Forensics','Malware Analysis','Full DFIR Investigation']),
    count('dfir_devices','Jumlah Perangkat / Evidence','perangkat'),
    count('dfir_data_gb','Estimasi Volume Data','GB'),
    choice('dfir_urgency','Prioritas',['Normal','Urgent','Critical']),
    choice('dfir_chain','Chain of Custody',['Dibutuhkan','Tidak dibutuhkan','Perlu konfirmasi']),
    choice('dfir_delivery','Model Pelaksanaan',['Lab / Remote','Onsite','Hybrid']),
  ]},
  TECHNOLOGY:{label:'Security Technology',subtitle:'SIEM, EDR, PAM, WAF, IAM, perangkat dan lisensi',outputUnit:'Paket',fields:[
    choice('technology_type','Jenis Solusi',['SIEM / SOAR','EDR / XDR','PAM','WAF / API Security','IAM / MFA','Firewall / Network Security','Vulnerability Management','Backup / DR','Lainnya']),
    choice('technology_model','Lingkup Pekerjaan',['Lisensi saja','Implementasi','Lisensi + Implementasi','Managed Service','Renewal / Upgrade']),
    count('technology_assets','Jumlah Device / User / Lisensi','unit'),
    count('technology_sites','Jumlah Site','site'),
    choice('technology_deployment','Lingkungan',['On-Premise','Cloud','Hybrid']),
    count('technology_months','Masa Lisensi / Layanan','bulan'),
  ]},
  TRAINING:{label:'Training & Awareness',subtitle:'Pelatihan, tabletop, workshop dan simulasi',outputUnit:'Paket',fields:[
    choice('training_type','Jenis Pelatihan',['Cybersecurity Awareness','Technical Security','SOC Analyst','VAPT / Secure Coding','GRC / Risk Management','PDP / DPO','ISO / Internal Audit','Incident Response Tabletop','Custom']),
    count('training_participants','Jumlah Peserta','peserta'),
    count('training_batches','Jumlah Batch','batch'),
    count('training_days','Durasi per Batch','hari'),
    choice('training_delivery','Metode',['Online','Onsite','Hybrid']),
    choice('training_materials','Output',['Materi dan Sertifikat','Materi, Praktik dan Sertifikat','Custom Deliverables']),
  ]},
  Lainnya:{label:'Layanan Lainnya',subtitle:'Scoping khusus di luar kategori standar',outputUnit:'Paket',fields:[
    text('other_service','Nama Layanan'),
    text('other_scope','Deskripsi Ruang Lingkup'),
    count('other_assets','Jumlah Objek / Aset','unit'),
    choice('other_delivery','Metode',['Remote','Onsite','Hybrid']),
    text('other_deliverables','Deliverables'),
  ]},
};

export function validateServiceScope(service:ScopingService,values:Record<string,string>):string[]{
  return SCOPING_DEFINITIONS[service].fields.filter(f=>{
    if(!f.required)return false;
    const value=values[f.key]?.trim()||'';
    return !value||(f.kind==='number'&&(!Number.isSafeInteger(Number(value))||Number(value)<=0));
  }).map(f=>f.label);
}

/** Produces a non-priced line for human review; pricing/costing remains in authorized D1 BoQ. */
export function summarizeServiceScope(service:ScopingService,values:Record<string,string>):string{
  const fields=SCOPING_DEFINITIONS[service].fields;
  const details=fields.filter(f=>(values[f.key]||'').trim()).map(f=>
    f.label+': '+values[f.key].trim()+(f.unit?' '+f.unit:''));
  return (SCOPING_DEFINITIONS[service].label+' | '+details.join('; ')).slice(0,900);
}
