'use client';

import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Download, FileLock2, AlertCircle, CheckCircle2, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { appStore } from '@/lib/store';
import {
  newPostPoPacket, validatePostPoPacket, downloadPostPoDocx, auditExistingSalesCustomer,
  type PostPoPacket, type RegistrationData, type ProjectData, type Pic, type ServiceFamily
} from '@/lib/post-po-documents';

const SERVICE_GUIDANCE: Record<ServiceFamily,string> = {
  'VAPT':'Cantumkan objek aplikasi/web/API/mobile/jaringan, jumlah target, metode black/grey/white box, testing window, retest, dan deliverables yang tercantum PO/SOW.',
  'SOC/MDR':'Cantumkan periode, jam layanan, platform/SIEM, log sources, EPS, retensi, lisensi, SLA, skema tenaga shared/dedicated hanya jika disebut PO/SOW.',
  'CTI':'Cantumkan paket intelijen, monitored assets, domain/IP/brand, jenis intelligence report, periode, kanal eskalasi, dan frekuensi deliverables.',
  'Cybersecurity Governance':'Cantumkan framework ISO/POJK/UU PDP yang dikontrak, jumlah workshop/assessment, entitas/unit, kebijakan, SOP dan deliverables.',
  'Incident Response/DFIR':'Cantumkan perangkat/sumber bukti, batas otorisasi, chain of custody, jenis analisis, SLA, pemulihan, dan laporan forensik.',
  'Cybersecurity Technology':'Cantumkan nama OEM/SKU, jumlah lisensi/appliance, masa subscription, support, implementasi, integrasi, dan serah terima.',
  'Other':'Cantumkan setiap produk/layanan, kuantitas-satuan, objek lingkup, batas pekerjaan, hasil kerja, dan SLA jika disepakati.'
};

function Field({label,value,onChange,type='text',help,required=true,placeholder}:{
  label:string;value:string|number;onChange:(s:string)=>void;type?:string;help?:string;required?:boolean;placeholder?:string
}){
  return <label className="block min-w-0 text-xs font-semibold text-slate-700">
    <span>{label}{required&&<span className="ml-1 text-rose-600">*</span>}</span>
    <input type={type} min={type==='number'?'0':undefined} value={value} onChange={e=>onChange(e.target.value)}
      placeholder={placeholder} className="mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"/>
    {help&&<span className="mt-1 block text-[11px] font-normal text-slate-500">{help}</span>}
  </label>;
}
function Textarea({label,value,onChange,help,required=true}:{label:string;value:string;onChange:(s:string)=>void;help?:string;required?:boolean}){
 return <label className="block min-w-0 text-xs font-semibold text-slate-700">
  {label}{required&&<span className="ml-1 text-rose-600">*</span>}
  <textarea rows={3} value={value} onChange={e=>onChange(e.target.value)}
   className="mt-1 block min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"/>
  {help&&<span className="mt-1 block text-[11px] font-normal text-slate-500">{help}</span>}
 </label>;
}
function Section({title,description,children}:{title:string;description:string;children:React.ReactNode}){
 return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
  <header className="mb-4 border-b border-slate-100 pb-3">
   <h2 className="text-sm font-bold text-slate-900">{title}</h2>
   <p className="mt-1 text-xs text-slate-500">{description}</p>
  </header>{children}
 </section>;
}
function PicFields({title,value,onChange}:{title:string;value:Pic;onChange:(v:Pic)=>void}){
 return <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
  <h3 className="mb-3 text-xs font-bold text-violet-800">{title}</h3>

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
   <Field label="Nama Lengkap" value={value.name} onChange={name=>onChange({...value,name})}/>
   <Field label="Nomor Mobile" value={value.mobile} onChange={mobile=>onChange({...value,mobile})}/>
   <Field label="Email" type="email" value={value.email} onChange={email=>onChange({...value,email})}/>
  </div>
 </div>;
}
const serviceTypes:ServiceFamily[]=['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other'];

export default function PostPoPage(){
 const [data,setData]=useState<PostPoPacket>(newPostPoPacket);
 const [step,setStep]=useState<'sales'|'project'|'review'>('sales');
 const [message,setMessage]=useState('');
 const [selectedSalesCustomer,setSelectedSalesCustomer]=useState('');
 const availableSalesCustomers=appStore.getState().companies;
 const salesSource=availableSalesCustomers.find(x=>x.id===selectedSalesCustomer);
 const salesAudit=salesSource?auditExistingSalesCustomer(salesSource):null;
 const findings=useMemo(()=>validatePostPoPacket(data),[data]);
 const regIssues=findings.filter(x=>x.category==='registration');
 const prjIssues=findings.filter(x=>x.category==='project');
 const ready=findings.length===0;
 const r=data.registration,p=data.project;
 const reg=<K extends keyof RegistrationData>(key:K,value:RegistrationData[K])=>setData(d=>({...d,registration:{...d.registration,[key]:value}}));
 const proj=<K extends keyof ProjectData>(key:K,value:ProjectData[K])=>setData(d=>({...d,project:{...d.project,[key]:value}}));
 const pic=(key:'primary'|'technical'|'billing'|'tax',value:Pic)=>reg(key,value);
 const exportWord=(kind:'registration'|'project')=>{
   if(!ready){setStep('review');setMessage('Dokumen final dikunci karena masih ada data wajib yang belum tervalidasi.');return;}
   try {downloadPostPoDocx(data,kind);setMessage('Dokumen Word berhasil disiapkan di browser. Dokumen tetap perlu tanda tangan pihak berwenang.');}
   catch(err){setMessage(err instanceof Error?err.message:'Pembuatan dokumen gagal');}
 };
 const commonInput=(label:string,key:keyof RegistrationData,help?:string)=>(
  <Field label={label} value={String(r[key]??'')} onChange={v=>reg(key,v as never)} help={help}/>
 );
 return <div className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50 p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-3xl">
     <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700"><ClipboardCheck className="h-4 w-4"/> Post-PO Administration</div>
     <h1 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Form Registrasi &amp; Form Project</h1>
     <p className="mt-2 text-sm leading-relaxed text-slate-600">
      Pemeriksaan field wajib dari Sales, rekonsiliasi PO/Quotation, lalu ekspor dua formulir Word DefendIT360 sebelum Kick Off Meeting.
     </p>
    </div>
    <span className={'rounded-full px-3 py-1.5 text-xs font-bold '+(ready?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}>
      {ready?'Siap untuk dokumen unsigned':findings.length+' parameter perlu ditindaklanjuti'}
    </span>
   </div>
   <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
    <strong>Pratinjau aman:</strong> India saat ini belum memiliki autentikasi/RBAC dan database produksi yang terverifikasi.
    Isian pada layar ini hanya berada dalam memori tab browser dan tidak dikirim/disimpan ke server. Jangan gunakan data KTP asli pada pratinjau publik.
    Integrasi dengan input Sales historis, verifikasi PO asli, serta persetujuan legal/finance memerlukan backend produksi.
   </div>
  </header>

  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
   <div className="flex items-start gap-2">
    <FileLock2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-600"/>
    <div>
     <h2 className="text-sm font-bold text-slate-900">Audit Master Data Sales Sebelumnya</h2>
     <p className="mt-1 text-xs leading-relaxed text-slate-500">Pilih record Customer Master yang tersedia di sesi aplikasi. Pemeriksaan ini hanya membaca field yang benar-benar ada; record seed adalah data contoh dan tidak boleh dipakai untuk dokumen legal.</p>
    </div>
   </div>
   <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
    <label className="text-xs font-semibold text-slate-700">Customer Master Sales
     <select value={selectedSalesCustomer} onChange={e=>setSelectedSalesCustomer(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
      <option value="">Pilih record untuk audit kelengkapan</option>
      {availableSalesCustomers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select>
    </label>
    {salesAudit&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
     <div className="font-bold">{salesAudit.missing.length} gap data pada Customer Master Sales</div>
     <div className="mt-1 max-h-28 overflow-y-auto">{salesAudit.missing.join(' · ')}</div>
     <p className="mt-2 font-medium">Perlu dilengkapi dan diverifikasi sebelum Word final. Record demo tidak disalin ke dokumen.</p>
    </div>}
   </div>
  </section>

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
   {([['sales','1. Sales / Customer Master','Identitas, NPWP dan PIC'],['project','2. PO & Project','Scope, biaya dan durasi'],['review','3. Validasi & Download','Pemeriksaan sebelum Kick Off']] as const).map(([id,title,desc])=>(
    <button type="button" key={id} onClick={()=>{setStep(id);setMessage('');}} className={'rounded-xl border p-4 text-left transition-colors '+(step===id?'border-violet-500 bg-violet-50 ring-1 ring-violet-500':'border-slate-200 bg-white hover:border-violet-300')}>
     <div className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-900">{title}</span><ArrowRight className="h-4 w-4 text-violet-600"/></div>
     <p className="mt-1 text-[11px] text-slate-500">{desc}</p>
    </button>
   ))}
  </div>

  {step==='sales'&&<div className="space-y-4">
   <Section title="A. Data Pelanggan" description="Mengikuti Formulir Registrasi Pelanggan V.0426. Di sistem produksi field berikut menjadi kewajiban saat Sales mendaftarkan customer.">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
     {commonInput('Customer ID', 'customerId','Diterbitkan oleh sistem/master data; jangan membuat ID palsu.')}
     {commonInput('Nama Legal Perusahaan', 'customerName')}
     {commonInput('Jenis Bidang Usaha', 'businessType')}
     <label className="block text-xs font-semibold text-slate-700">Jumlah Pegawai *
      <select value={r.employeeBand} onChange={e=>reg('employeeBand',e.target.value as RegistrationData['employeeBand'])}
       className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
       <option value="">Pilih jumlah pegawai</option><option value="<100">Kurang dari 100</option>
       <option value="100-500">100–500</option><option value=">500">Lebih dari 500</option>
      </select>
     </label>
    </div>
    <div className="mt-3 space-y-3">
     <Textarea label="Alamat Kantor Pusat" value={r.hqAddress} onChange={v=>reg('hqAddress',v)}/>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {commonInput('Provinsi Kantor Pusat','hqProvince')}
      {commonInput('Kode Pos Kantor Pusat','hqPostalCode')}
     </div>
     <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
      <input type="checkbox" checked={r.billingSameAsHq} onChange={e=>reg('billingSameAsHq',e.target.checked)}
       className="h-4 w-4 accent-violet-700"/> Alamat penagihan sama dengan alamat kantor pusat
     </label>
     {!r.billingSameAsHq&&<>
      <Textarea label="Alamat Penagihan" value={r.billingAddress} onChange={v=>reg('billingAddress',v)}/>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
       {commonInput('Provinsi Alamat Penagihan','billingProvince')}
       {commonInput('Kode Pos Penagihan','billingPostalCode')}
      </div>
     </>}
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {commonInput('NPWP Badan Usaha','npwp')}
      {commonInput('Telepon Perusahaan','companyPhone')}
      {commonInput('No. KTP PIC Utama','primaryKtpNumber','Data pribadi sensitif; jangan diisi pada preview publik.')}
      {commonInput('Fax / Konfirmasi N/A','fax','Di referensi V.0426 fax bertanda wajib; N/A hanya jika ditinjau.')}
     </div>
    </div>
   </Section>
   <Section title="B. Penanggung Jawab Pelanggan" description="Empat PIC wajib memiliki nama, telepon mobile dan email. Sales dapat menyalin kontak hanya bila memang orang yang sama.">
    <div className="space-y-3">
     <PicFields title="Penanggung Jawab Utama" value={r.primary} onChange={v=>pic('primary',v)}/>
     <button type="button" onClick={()=>setData(d=>({...d,registration:{...d.registration,technical:{...d.registration.primary},billing:{...d.registration.primary},tax:{...d.registration.primary}}}))}
      className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50">
      Gunakan PIC utama untuk PIC teknis, penagihan, dan pajak (hanya jika sama)
     </button>
     <PicFields title="Penanggung Jawab Teknis" value={r.technical} onChange={v=>pic('technical',v)}/>
     <PicFields title="Penanggung Jawab Penagihan" value={r.billing} onChange={v=>pic('billing',v)}/>
     <PicFields title="Penanggung Jawab Pajak" value={r.tax} onChange={v=>pic('tax',v)}/>
    </div>
   </Section>
   <Section title="C. Kelengkapan Legal & Pengesahan" description="Dokumen pendukung harus diverifikasi dan penandatangan dikonfirmasi. Jangan menganggap tanda tangan telah dilakukan otomatis.">
    <div className="space-y-3">
     <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={r.npwpAttachmentConfirmed} onChange={e=>reg('npwpAttachmentConfirmed',e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700"/>Salinan NPWP telah tersedia dan diperiksa (tidak diunggah/tersimpan di demo).</label>
     <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={r.ktpAttachmentConfirmed} onChange={e=>reg('ktpAttachmentConfirmed',e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700"/>Salinan KTP PIC utama telah tersedia dan diperiksa (tidak diunggah/tersimpan di demo).</label>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {commonInput('Nama Penandatangan Pelanggan','customerSignatory')}
      {commonInput('Jabatan Penandatangan Pelanggan','customerSignatoryTitle')}
      {commonInput('Nama Penandatangan DefendIT360','defenderSignatory')}
      {commonInput('Jabatan Penandatangan DefendIT360','defenderSignatoryTitle')}
      {commonInput('Pembuat / Maker','maker')}
      {commonInput('Pemeriksa / Reviewer','reviewer')}
      {commonInput('Pelaksana / Executor','executor')}
     </div>
    </div>
   </Section>
   <div className="flex justify-end"><button type="button" onClick={()=>setStep('project')} className="rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-bold text-white">Lanjut ke PO & Project →</button></div>
  </div>}

  {step==='project'&&<div className="space-y-4">
   <Section title="D. Purchase Order & Rincian Produk / Layanan" description="PO yang diterima wajib direkonsiliasi dengan quotation dan scope yang telah disetujui.">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
     <Field label="Nomor PO Pelanggan" value={p.poNumber} onChange={v=>proj('poNumber',v)}/>
     <Field label="Tanggal PO" type="date" value={p.poDate} onChange={v=>proj('poDate',v)}/>
     <Field label="Nomor Quotation / Proposal" value={p.quotationNumber} onChange={v=>proj('quotationNumber',v)}/>
     <label className="block text-xs font-semibold text-slate-700">Jenis Layanan / Produk *
      <select value={p.serviceFamily} onChange={e=>proj('serviceFamily',e.target.value as ServiceFamily)}
       className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
       {serviceTypes.map(service=><option value={service} key={service}>{service}</option>)}
      </select>
     </label>
    </div>
    <div className="mt-3 space-y-3">
     <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">{SERVICE_GUIDANCE[p.serviceFamily]}</div>
     <Field label="Nama Paket / Uraian Produk & Jasa" value={p.serviceDescription} onChange={v=>proj('serviceDescription',v)}/>
     <Field label="Kuantitas & Satuan (mis. 2 aplikasi / 12 bulan)" value={p.quantityAndUnit} onChange={v=>proj('quantityAndUnit',v)}/>
     <Textarea label="Scope of Work Sesuai PO/SOW" value={p.scope} onChange={v=>proj('scope',v)}/>
     <Textarea label="Spesifikasi Teknis Sesuai Produk/Layanan" value={p.technicalSpecifications} onChange={v=>proj('technicalSpecifications',v)}/>
     <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={p.poVerified} onChange={e=>proj('poVerified',e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700"/>PO telah diterima dan diperiksa terhadap dokumen asli (konfirmasi internal, bukan verifikasi otomatis)</label>
    </div>
   </Section>
   <Section title="E. PIC Proyek & Lokasi Penyerahan" description="Alur kerja menuju project handover dan Kick Off Meeting.">
    <PicFields title="Penanggung Jawab Proyek Pelanggan" value={p.projectPic} onChange={v=>proj('projectPic',v)}/>
    <button type="button" onClick={()=>proj('projectPic',{...r.primary})} className="mt-3 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700">Gunakan PIC Utama jika juga bertanggung jawab atas proyek</button>
    <div className="mt-3 space-y-3">
     <Textarea label="Alamat Lokasi Penyerahan Proyek" value={p.deliveryAddress} onChange={v=>proj('deliveryAddress',v)}/>
     <button type="button" onClick={()=>setData(d=>({...d,project:{...d.project,deliveryAddress:d.registration.hqAddress,deliveryProvince:d.registration.hqProvince,deliveryPostalCode:d.registration.hqPostalCode}}))}
      className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700">Sama dengan alamat kantor pusat</button>
     <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Provinsi Lokasi Proyek" value={p.deliveryProvince} onChange={v=>proj('deliveryProvince',v)}/>
      <Field label="Kode Pos Lokasi Proyek" value={p.deliveryPostalCode} onChange={v=>proj('deliveryPostalCode',v)}/>
     </div>
    </div>
   </Section>
   <Section title="F. Fee & Termin Pembayaran" description="Nilai proyek tidak termasuk PPN seperti format referensi. Nominal termin harus tepat sama dengan nilai sebelum PPN.">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
     <Field label="Nilai Quotation Sebelum PPN (Rp)" type="number" value={p.quotationAmountBeforeVat||''} onChange={v=>proj('quotationAmountBeforeVat',Number(v))}/>
     <Field label="Total Biaya Proyek Sebelum PPN (Rp)" type="number" value={p.projectFeeBeforeVat||''} onChange={v=>proj('projectFeeBeforeVat',Number(v))}/>
     <label className="block text-xs font-semibold text-slate-700">Virtual Account yang Disetujui Finance *
      <select value={p.paymentVA} onChange={e=>proj('paymentVA',e.target.value as ProjectData['paymentVA'])} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
       <option value="">Pilih VA terverifikasi</option><option value="BCA">Bank Central Asia (BCA)</option><option value="OCBC NISP">OCBC NISP</option>
      </select>
     </label>
    </div>
    <div className="mt-4 space-y-3">
     {p.milestones.map((m,i)=><div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center justify-between">
       <h3 className="text-xs font-bold text-slate-800">Termin {i+1}</h3>
       {p.milestones.length>1&&<button type="button" aria-label={'Hapus termin '+(i+1)}
        onClick={()=>proj('milestones',p.milestones.filter((_,j)=>j!==i))} className="text-rose-600"><Trash2 className="h-4 w-4"/></button>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
       <Field label="Keterangan Tahap" value={m.label} onChange={v=>proj('milestones',p.milestones.map((x,j)=>j===i?{...x,label:v}:x))}/>
       <Field label="Nominal (Rp)" type="number" value={m.amount||''} onChange={v=>proj('milestones',p.milestones.map((x,j)=>j===i?{...x,amount:Number(v)}:x))}/>
       <Field label="Waktu / Trigger Pembayaran" value={m.trigger} onChange={v=>proj('milestones',p.milestones.map((x,j)=>j===i?{...x,trigger:v}:x))}/>
      </div>
     </div>)}
     <button type="button" onClick={()=>proj('milestones',[...p.milestones,{label:'',amount:0,trigger:''}])} className="flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-700"><Plus className="h-4 w-4"/> Tambah Termin</button>
     <div className="rounded-lg bg-slate-100 p-3 text-xs">Total termin: <strong>Rp {p.milestones.reduce((a,m)=>a+Number(m.amount||0),0).toLocaleString('id-ID')}</strong> / biaya proyek <strong>Rp {p.projectFeeBeforeVat.toLocaleString('id-ID')}</strong></div>
     <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={p.quotationReconciled} onChange={e=>proj('quotationReconciled',e.target.checked)} className="mt-0.5 h-4 w-4 accent-violet-700"/>Nominal, ruang lingkup dan termin di PO sudah direkonsiliasi dengan quotation oleh Sales/Finance.</label>
    </div>
   </Section>
   <Section title="G. Jangka Waktu Proyek" description="Jangka waktu dan/atau tanggal paling lambat selesai dari PO/SOW, bukan hasil asumsi.">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
     <Field label="Durasi Proyek" type="number" value={p.durationValue} onChange={v=>proj('durationValue',v)} required={false}/>
     <label className="block text-xs font-semibold text-slate-700">Satuan Durasi
      <select value={p.durationUnit} onChange={e=>proj('durationUnit',e.target.value as ProjectData['durationUnit'])} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
       <option value="hari">Hari</option><option value="bulan">Bulan</option><option value="tahun">Tahun</option>
      </select>
     </label>
     <Field label="Tanggal Paling Lambat Selesai" type="date" value={p.completionDeadline} onChange={v=>proj('completionDeadline',v)} required={false}/>
    </div>
    <div className="mt-3 space-y-3">
     <Textarea label="Timeline Proyek" value={p.timeline} onChange={v=>proj('timeline',v)} required={false}/>
     <Textarea label="Catatan Tambahan" value={p.notes} onChange={v=>proj('notes',v)} required={false}/>
    </div>
   </Section>
   <div className="flex justify-end"><button type="button" onClick={()=>setStep('review')} className="rounded-lg bg-violet-700 px-4 py-2.5 text-xs font-bold text-white">Periksa Validasi →</button></div>
  </div>}

  {step==='review'&&<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
   <div className="space-y-4 lg:col-span-2">
    <Section title="Readiness Check Sebelum Kick Off" description="Setiap isian wajib ditandai jelas. Form final hanya bisa diunduh jika semua parameter terpenuhi.">
     <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">
      {ready?<CheckCircle2 className="h-8 w-8 text-emerald-600"/>:<AlertCircle className="h-8 w-8 text-amber-600"/>}
      <div><div className="text-sm font-bold text-slate-900">{ready?'Lulus validasi struktur & konsistensi':'Belum memenuhi gate Post-PO'}</div>
       <p className="text-xs text-slate-500">Registrasi: {regIssues.length} temuan · Proyek: {prjIssues.length} temuan</p></div>
     </div>
     {findings.length>0&&<div className="mt-3 max-h-[440px] overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
      <ul className="space-y-2 text-xs text-amber-950">
       {findings.map((f,i)=><li key={f.field+'-'+i} className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{f.category==='registration'?'Registrasi':'Project'} — {f.message}</span></li>)}
      </ul>
     </div>}
     {ready&&<p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">Validasi field dan angka lulus. Tanda tangan, bukti penerimaan PO, persetujuan legal, dan verifikasi sumber asli tetap memerlukan kontrol manual/produksi.</p>}
    </Section>
    <Section title="Kontrol Operasional" description="Urutan tanggung jawab sesudah PO dan sebelum Kick Off.">
     <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-slate-700">
      <li>Sales memastikan Customer Master, PIC, pajak, alamat dan bukti kelengkapan administrasi.</li>
      <li>Sales/Pre-Sales merekonsiliasi PO, quotation, nama produk, kuantitas, scope, SOW dan harga.</li>
      <li>Finance memverifikasi rekening VA serta nominal dan trigger pembayaran.</li>
      <li>Legal/Management memastikan klausul, otorisasi, penandatangan serta dokumen pendukung.</li>
      <li>Project Manager mengonfirmasi timeline, resource, lokasi, scope dan kesiapan Kick Off Meeting.</li>
     </ol>
    </Section>
   </div>
   <div className="space-y-4">
    <Section title="Unduh Dokumen" description="File Word terpisah sesuai kedua referensi DefendIT360.">
     <div className="space-y-2">
      <button type="button" disabled={!ready} onClick={()=>exportWord('registration')}
       className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">
       <Download className="h-4 w-4"/> Form Registrasi (.docx)
      </button>
      <button type="button" disabled={!ready} onClick={()=>exportWord('project')}
       className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-3 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
       <Download className="h-4 w-4"/> Form Project (.docx)
      </button>
     </div>
     <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><FileLock2 className="mt-0.5 h-4 w-4 shrink-0"/> Tombol aktif setelah validasi lengkap; file unsigned harus diperiksa dan ditandatangani sebelum digunakan secara resmi.</p>
    </Section>
    <Section title="Ringkasan Tahap" description="Pemeriksaan kesiapan sumber data Sales.">
     <div className="space-y-2 text-xs text-slate-700">
      <p>Registrasi <strong className="float-right">{regIssues.length===0?'Lengkap':'Belum Lengkap'}</strong></p>
      <p>PO & Project <strong className="float-right">{prjIssues.length===0?'Lengkap':'Belum Lengkap'}</strong></p>

      <p className="text-[11px] text-slate-500">Indikator hanya visual. Gate ditentukan berdasarkan seluruh temuan, bukan persentase.</p>
     </div>
    </Section>
   </div>
  </div>}
  {message&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-800">{message}</p>}
 </div>;
}
