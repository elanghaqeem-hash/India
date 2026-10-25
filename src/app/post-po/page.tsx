'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Download, FileLock2, AlertCircle, CheckCircle2, ArrowRight, Plus, Trash2 } from 'lucide-react';

import {
  newPostPoPacket, validatePostPoPacket,
  type PostPoPacket, type RegistrationData, type ProjectData, type Pic, type ServiceFamily
} from '@/lib/post-po-documents';

import { downloadOfficialPostPoDocx } from '@/lib/post-po-official-layout';
import { prefillFromSales } from '@/lib/sales-to-post-po';
import {SERVICE_CATALOG,SERVICE_GROUPS,serviceDefinition} from '@/lib/sales-workflow';

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


export default function PostPoPage(){
 const [data,setData]=useState<PostPoPacket>(()=>newPostPoPacket());
 const [linkedOpportunity,setLinkedOpportunity]=useState('');
 const [sourceLoading,setSourceLoading]=useState(false);
 const [sourcePacket,setSourcePacket]=useState<PostPoPacket|null>(null);
 const [awardValid,setAwardValid]=useState(false);
 const [lookupId,setLookupId]=useState('');
 const [step,setStep]=useState<'sales'|'project'|'review'>('sales');
 const [message,setMessage]=useState('');

 const [officialTemplates,setOfficialTemplates]=useState<{registration:File|null;project:File|null}>({registration:null,project:null});
 const [exportLoading,setExportLoading]=useState<'registration'|'project'|null>(null);
 const load=async(id:string)=>{
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(id)){setMessage('Opportunity ID tidak valid');return;}
  setSourceLoading(true);setLinkedOpportunity('');setData(newPostPoPacket());setSourcePacket(null);
  setAwardValid(false);setMessage('');
  try{
   const [sales,award]=await Promise.all([
    fetch('/api/sales?entity=details&id='+encodeURIComponent(id),{cache:'no-store',credentials:'same-origin'}),
    fetch('/api/sales/award?opportunity_id='+encodeURIComponent(id),{cache:'no-store',credentials:'same-origin'})
   ]);
   const j=await sales.json(),a=await award.json();
   if(!sales.ok||!j.success||!award.ok||!a.success)throw Error(j.message||a.message||'Sesi Access atau dokumen asli tidak tersedia');
   if(j.deal.stage!=='closed_won')throw Error('Hanya transaksi Closed Won dengan PO/SPK terverifikasi yang boleh diterbitkan.');
   const dual=!!a.hasDualVerifiedPO&&!!j.poCheck?.verified_by;
   const original=prefillFromSales(j.account,j.deal,dual,Number(j.poCheck?.quotation_amount_before_vat||0));
   setData(original);setSourcePacket(original);setAwardValid(dual);
   setLinkedOpportunity(id);setStep('sales');
   setMessage(dual?'Data D1 dibaca. Isi field yang belum tersedia tanpa memodifikasi data Customer/PO kanonis.':'PO/SPK belum mendapat review Finance–Legal independen: export BLOCKED.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal memuat sumber transaksi D1');}
  finally{setSourceLoading(false);}
 };
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('opportunity_id')||'';
  setLookupId(id);if(id)void load(id);
 },[]);
 const findings=useMemo(()=>validatePostPoPacket(data),[data]);
 const unchanged=!!sourcePacket&&
  data.registration.customerId===sourcePacket.registration.customerId&&
  data.registration.customerName===sourcePacket.registration.customerName&&
  data.project.poNumber===sourcePacket.project.poNumber&&
  data.project.poDate===sourcePacket.project.poDate&&
  data.project.quotationNumber===sourcePacket.project.quotationNumber&&
  data.project.projectFeeBeforeVat===sourcePacket.project.projectFeeBeforeVat&&
  data.project.quotationAmountBeforeVat===sourcePacket.project.quotationAmountBeforeVat&&
  data.project.scope===sourcePacket.project.scope&&
  JSON.stringify(data.project.milestones)===JSON.stringify(sourcePacket.project.milestones)&&
  data.project.poVerified===sourcePacket.project.poVerified&&
  data.project.quotationReconciled===sourcePacket.project.quotationReconciled;
 const regIssues=findings.filter(x=>x.category==='registration');
 const prjIssues=findings.filter(x=>x.category==='project');
 const ready=findings.length===0&&!!linkedOpportunity&&awardValid&&unchanged;
 const r=data.registration,p=data.project;
 const reg=<K extends keyof RegistrationData>(key:K,value:RegistrationData[K])=>setData(d=>({...d,registration:{...d.registration,[key]:value}}));
 const proj=<K extends keyof ProjectData>(key:K,value:ProjectData[K])=>setData(d=>({...d,project:{...d.project,[key]:value}}));
 const pic=(key:'primary'|'technical'|'billing'|'tax',value:Pic)=>reg(key,value);
 const exportWord=async(kind:'registration'|'project')=>{
   if(!ready){setStep('review');setMessage('Masih ada field wajib yang perlu diperiksa.');return;}
   const template=officialTemplates[kind];
   if(!template){setMessage('Unggah file template Word V.042026 untuk '+(kind==='registration'?'Registrasi':'Project')+' terlebih dahulu.');return;}
   setExportLoading(kind);
   try{
     await downloadOfficialPostPoDocx(data,kind,template);
     setMessage('DOCX asli diisi dari sumber D1; dokumen final masih harus ditandatangani dan disimpan ke Document Vault.');
   }catch(err){
     setMessage(err instanceof Error?err.message:'Gagal membuat DOCX menggunakan template resmi.');
   }finally{setExportLoading(null);}
 };
 const commonInput=(label:string,key:keyof RegistrationData,help?:string,inputType='text')=>(
  <Field label={label} value={String(r[key]??'')} onChange={v=>reg(key,v as never)} help={help} type={inputType}/>
 );
 return <div className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50 p-5 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-3xl">
     <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700"><ClipboardCheck className="h-4 w-4"/> Post-PO Administration</div>
     <h1 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Form Registrasi &amp; Form Project</h1>
     <p className="mt-2 text-sm leading-relaxed text-slate-600">
      Pemeriksaan field wajib dari Sales, rekonsiliasi PO/Quotation, lalu ekspor dua formulir Word Technotama sebelum Kick Off Meeting.
     </p>
    </div>
    <span className={'rounded-full px-3 py-1.5 text-xs font-bold '+(ready?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}>
      {ready?'Data siap untuk DOCX unsigned':findings.length+' parameter perlu ditindaklanjuti atau approval PO belum lengkap'}
    </span>
   </div>
   <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
    <strong>Kontrol data:</strong> Data Sales terverifikasi diambil dari D1 dengan Cloudflare Access. Edit formulir dan KTP di layar ini tidak disimpan ke CRM. Verifikasi bukti NPWP, KTP dan PO sebelum finalisasi dokumen.
   </div>
  </header>

  {sourceLoading&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-xs">Mengambil data opportunity D1...</p>}
  {linkedOpportunity&&<p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">Terhubung dengan Opportunity {linkedOpportunity}. Bukti pribadi diisi langsung pada form ini.</p>}
  {!linkedOpportunity&&<form className="rounded-2xl border border-slate-200 bg-white p-4" onSubmit={e=>{e.preventDefault();void load(lookupId);}}>
    <label className="block text-xs font-semibold">Opportunity D1 yang sudah Closed Won
      <input className="mt-2 block w-full rounded-lg border p-2" value={lookupId} onChange={e=>setLookupId(e.target.value)} placeholder="Opportunity ID" required/>
    </label>
    <button type="submit" disabled={sourceLoading} className="mt-3 rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white">Muat data Customer dan PO/SPK dari D1</button>
    <p className="mt-2 text-xs text-slate-600">Tidak tersedia input customer dummy. Pilih Opportunity berizin dari Sales Pipeline.</p>
  </form>}

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
      {commonInput('No. KTP PIC Utama','primaryKtpNumber','Data pribadi sensitif; jangan diisi pada preview publik.','password')}
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
      {commonInput('Nama Penandatangan Technotama','defenderSignatory')}
      {commonInput('Jabatan Penandatangan Technotama','defenderSignatoryTitle')}
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
       {SERVICE_GROUPS.map(group=><optgroup key={group} label={group}>{SERVICE_CATALOG.filter(x=>x.group===group).map(x=><option key={x.name} value={x.name}>{x.name}</option>)}</optgroup>)}
      </select>
     </label>
    </div>
    <div className="mt-3 space-y-3">
     <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">{serviceDefinition(p.serviceFamily).guidance}</div>
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
      <div><div className="text-sm font-bold text-slate-900">{ready?'Sumber D1 dan field konsisten — dokumen unsigned':'Belum memenuhi gate Post-PO'}</div>
       <p className="text-xs text-slate-500">Registrasi: {regIssues.length} temuan · Proyek: {prjIssues.length} temuan</p></div>
     </div>
     {findings.length>0&&<div className="mt-3 max-h-[440px] overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
      <ul className="space-y-2 text-xs text-amber-950">
       {findings.map((f,i)=><li key={f.field+'-'+i} className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{f.category==='registration'?'Registrasi':'Project'} — {f.message}</span></li>)}
      </ul>
     </div>}
     {ready&&<p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">Field dokumen dan sumber D1 valid. Penandatanganan asli, Vault dan UAT belum dianggap PASS.</p>}
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
    <Section title="Unduh Dokumen" description="Generator mempertahankan layout asli Word V.042026, tidak lagi menyusun ulang tabel dua kolom.">
     <div className="mb-4 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
       <h3 className="text-xs font-bold text-violet-900">Template Word Resmi Technotama V.042026</h3>
       <p className="text-[11px] leading-relaxed text-slate-600">Unggah kedua template Word asli dari referensi sebelumnya. File dibaca hanya pada tab browser; logo, tabel, font, footer, klausul bilingual, dan kotak tanda tangan tetap dipertahankan. Template tidak dikirim ke server.</p>
       <label className="block text-xs font-semibold text-slate-700">
         Template Form Registrasi (.docx)
         <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={e=>setOfficialTemplates(previous=>({...previous,registration:e.target.files?.[0]||null}))}
          className="mt-1 block w-full max-w-full rounded-lg border border-violet-200 bg-white p-2 text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-violet-100 file:px-2 file:py-1 file:text-violet-800"/>
         <span className="mt-1 block font-normal text-slate-500">{officialTemplates.registration?'Dipilih: '+officialTemplates.registration.name:'Belum diunggah'}</span>
       </label>
       <label className="block text-xs font-semibold text-slate-700">
         Template Form Project One Time (.docx)
         <input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={e=>setOfficialTemplates(previous=>({...previous,project:e.target.files?.[0]||null}))}
          className="mt-1 block w-full max-w-full rounded-lg border border-violet-200 bg-white p-2 text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-violet-100 file:px-2 file:py-1 file:text-violet-800"/>
         <span className="mt-1 block font-normal text-slate-500">{officialTemplates.project?'Dipilih: '+officialTemplates.project.name:'Belum diunggah'}</span>
       </label>
     </div>
     <div className="space-y-2">
      <button type="button" disabled={!ready||!officialTemplates.registration||!!exportLoading} onClick={()=>void exportWord('registration')}
       className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">
       <Download className="h-4 w-4"/> Form Registrasi (.docx)
      </button>
      <button type="button" disabled={!ready||!officialTemplates.project||!!exportLoading} onClick={()=>void exportWord('project')}
       className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-3 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
       <Download className="h-4 w-4"/> Form Project (.docx)
      </button>
     </div>
     <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500"><FileLock2 className="mt-0.5 h-4 w-4 shrink-0"/> Gunakan template asli sebelum ekspor. Hasilnya belum resmi hingga diverifikasi, ditandatangani dan diarsipkan pada Document Vault.</p>
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
