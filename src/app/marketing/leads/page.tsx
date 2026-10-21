'use client';

import React,{useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Building2,CheckCircle2,ChevronRight,ClipboardList,FileCheck2,
 Loader2,Plus,RefreshCw,Search,ShieldCheck,Users,X} from 'lucide-react';

type Status='new'|'contacted'|'qualified'|'disqualified'|'converted';
type Lead={
 id:string;version:number;status:Status;company_name:string;contact_name:string;contact_email:string;
 contact_phone:string;service_interest:string;lead_source:string;campaign_code:string;
 qualification_notes:string;budget_status:string;decision_authority:string;
 requirement_summary:string;target_date:string;owner_email:string;created_at:string;
 converted_account_id?:string|null;converted_opportunity_id?:string|null;
};
const statusText:Record<Status,string>={
 new:'Baru',contacted:'Dihubungi',qualified:'Terkualifikasi',
 disqualified:'Tidak lanjut',converted:'Terkonversi'
};
const stageColors:Record<Status,string>={
 new:'bg-slate-100 text-slate-700',contacted:'bg-blue-50 text-blue-700',
 qualified:'bg-emerald-50 text-emerald-700',disqualified:'bg-rose-50 text-rose-700',
 converted:'bg-violet-50 text-violet-700'
};
const fieldConfig=[
 ['company_name','Nama perusahaan*'],['contact_name','Nama PIC*'],['contact_email','Email PIC*'],
 ['contact_phone','Telepon PIC'],['service_interest','Layanan yang dibutuhkan*'],
 ['lead_source','Sumber lead*'],['campaign_code','Kode kampanye'],
 ['requirement_summary','Kebutuhan / pain point'],['budget_status','Status anggaran'],
 ['decision_authority','Pengambil keputusan'],['qualification_notes','Hasil kualifikasi'],
 ['target_date','Target closing']
] as const;
type Field=typeof fieldConfig[number][0];
const newForm=()=>Object.fromEntries(fieldConfig.map(x=>[x[0],''])) as Record<Field,string>;
const customerFields=[
 ['industry','Sektor industri'],['business_type','Bidang usaha'],
 ['employee_band','Jumlah pegawai'],['company_phone','Telepon perusahaan'],
 ['hq_address','Alamat kantor pusat'],['hq_province','Provinsi'],['hq_postal','Kode pos'],
 ['client_tier','Tier pelanggan (opsional)'],['technical_name','PIC teknis'],
 ['technical_phone','Telepon PIC teknis'],['technical_email','Email PIC teknis'],
 ['billing_name','PIC penagihan'],['billing_phone','Telepon penagihan'],
 ['billing_email','Email penagihan'],['tax_name','PIC pajak'],
 ['tax_phone','Telepon pajak'],['tax_email','Email pajak']
] as const;
type CustomerField=typeof customerFields[number][0];
const blankCustomer=()=>Object.fromEntries(customerFields.map(x=>[x[0],''])) as Record<CustomerField,string>;
const asString=(v:unknown)=>typeof v==='string'?v:'';
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
async function callAPI(url:string,method:'POST'|'PATCH',data:unknown,convert=false){
 const r=await fetch(url,{method,headers:{
  'Content-Type':'application/json','x-india-lead-action':convert?'convert':'update'
 },body:JSON.stringify(data),cache:'no-store'});
 const payload=await r.json().catch(()=>({success:false,message:'Respons server tidak valid'}));
 if(!r.ok||!payload.success){
  const extra=Array.isArray(payload.missing)?' — '+payload.missing.join(', '):'';
  throw Error((payload.message||'Transaksi gagal')+extra);
 }
 return payload;
}
function FormField({id,label,value,onChange}:{
 id:string;label:string;value:string;onChange:(value:string)=>void
}){
 const isLong=/summary|notes|address/.test(id);
 const inputClass='w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
 return <label className={isLong?'block sm:col-span-2':'block'}>
  <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
  {isLong?<textarea rows={3} className={inputClass} value={value} onChange={e=>onChange(e.target.value)} maxLength={2000}/>:
  <input className={inputClass} value={value} onChange={e=>onChange(e.target.value)}
   type={id.includes('email')?'email':id==='target_date'?'date':'text'}
   maxLength={id==='target_date'?10:2000}/>}
 </label>;
}
export default function MarketingLeadsPage(){
 const [leads,setLeads]=useState<Lead[]>([]);
 const [role,setRole]=useState(''),[actor,setActor]=useState('');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [notice,setNotice]=useState(''),[problem,setProblem]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|Status>('all');
 const [mode,setMode]=useState<'none'|'create'|'edit'|'convert'>('none');
 const [selected,setSelected]=useState<Lead|null>(null);
 const [fields,setFields]=useState(newForm());
 const [customer,setCustomer]=useState(blankCustomer());
 const [project,setProject]=useState(''),[value,setValue]=useState(''),
  [contractModel,setContractModel]=useState('One-Time');
 const [lastDeal,setLastDeal]=useState('');
 const refresh=useCallback(async()=>{
  setLoading(true);setProblem('');
  try{
   const response=await fetch('/api/leads',{cache:'no-store'});
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'Tidak dapat memuat lead');
   setLeads(Array.isArray(data.leads)?data.leads:[]);
   setRole(data.role||'');setActor(data.email||'');
  }catch(e){setProblem(e instanceof Error?e.message:'Gagal membaca database');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const visible=useMemo(()=>leads.filter(l=>
  (filter==='all'||l.status===filter)&&
  [l.company_name,l.contact_name,l.contact_email,l.service_interest,l.lead_source].join(' ').toLowerCase().includes(search.trim().toLowerCase())
 ),[leads,search,filter]);
 const stats=useMemo(()=>({
  total:leads.length,qualified:leads.filter(l=>l.status==='qualified').length,
  converted:leads.filter(l=>l.status==='converted').length,
  open:leads.filter(l=>l.status==='new'||l.status==='contacted').length
 }),[leads]);
 const close=()=>{if(saving)return;setMode('none');setSelected(null);setProblem('');};
 const create=()=>{setFields(newForm());setSelected(null);setProblem('');setMode('create');};
 const edit=(lead:Lead)=>{setSelected(lead);setFields(Object.fromEntries(fieldConfig.map(c=>[c[0],asString(lead[c[0]])])) as Record<Field,string>);
  setProblem('');setMode('edit');};
 const convert=(lead:Lead)=>{
  setSelected(lead);setCustomer(blankCustomer());setProject(lead.company_name+' — '+lead.service_interest);
  setValue('');setContractModel('One-Time');setProblem('');setMode('convert');
 };
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();setSaving(true);setProblem('');setNotice('');
  try{
   if(mode==='create')await callAPI('/api/leads','POST',fields);
   else if(mode==='edit'&&selected)await callAPI('/api/leads','PATCH',{id:selected.id,version:selected.version,fields});
   else throw Error('Tindakan tidak dikenali');
   setNotice(mode==='create'?'Lead berhasil didaftarkan':'Data Lead berhasil disimpan');
   setMode('none');setSelected(null);await refresh();
  }catch(e){setProblem(e instanceof Error?e.message:'Gagal menyimpan');}
  finally{setSaving(false);}
 };
 const setStage=async(lead:Lead,status:Status)=>{
  if(!window.confirm('Ubah status '+lead.company_name+' menjadi '+statusText[status]+'?'))return;
  setSaving(true);setProblem('');setNotice('');
  try{
   await callAPI('/api/leads','PATCH',{id:lead.id,version:lead.version,status});
   setNotice('Status berhasil diperbarui: '+statusText[status]);await refresh();
  }catch(e){setProblem(e instanceof Error?e.message:'Status gagal diperbarui');}
  finally{setSaving(false);}
 };
 const submitConversion=async(e:React.FormEvent)=>{
  e.preventDefault();if(!selected)return;
  setSaving(true);setProblem('');setNotice('');
  try{
   const data=await callAPI('/api/leads/convert','POST',{
    lead_id:selected.id,version:selected.version,customer,project_title:project,
    estimated_value:Number(value),contract_model:contractModel
   },true);
   setLastDeal(data.opportunity_id);
   setNotice('Konversi atomik berhasil. Customer '+data.customer_number+' dan Opportunity dibuat.');
   setMode('none');setSelected(null);await refresh();
  }catch(e){setProblem(e instanceof Error?e.message:'Gagal konversi');}
  finally{setSaving(false);}
 };
 return <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
     <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">D1 • Marketing & Sales</span>
      {role&&<span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">Role: {role}</span>}
     </div>
     <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Lead Management</h1>
     <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">
      Prospek baru, kualifikasi, dan konversi langsung ke Customer dan Opportunity.
      Data disimpan pada D1 dan terlacak berdasarkan akun Cloudflare Access.
     </p>
     {actor&&<p className="mt-2 text-xs text-slate-500">Pengguna: {actor}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
     <button onClick={()=>void refresh()} disabled={loading||saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
      <RefreshCw className="h-4 w-4"/> Refresh
     </button>
     {(role==='admin'||role==='sales')&&<button onClick={create} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">
      <Plus className="h-4 w-4"/> Lead Baru
     </button>}
    </div>
   </div>
   <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
    {([['Seluruh lead',stats.total],['Belum qualified',stats.open],['Qualified',stats.qualified],['Converted',stats.converted]] as const).map(([label,total])=>
     <div key={label} className="rounded-xl bg-slate-50 p-3 sm:p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{total}</p>
     </div>)}
   </div>
  </section>
  {notice&&<div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
   <CheckCircle2 className="mr-2 inline h-4 w-4"/>{notice}
   {lastDeal&&<Link className="ml-2 font-semibold underline" href={'/sales/pipeline?opportunity_id='+encodeURIComponent(lastDeal)}>
    Lihat Sales Pipeline <ArrowRight className="inline h-3.5 w-3.5"/></Link>}
  </div>}
  {problem&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{problem}</div>}
  <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
   <div className="flex flex-col gap-3 sm:flex-row">
    <label className="relative flex-1">
     <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/>
     <span className="sr-only">Cari lead</span>
     <input value={search} onChange={e=>setSearch(e.target.value)}
      placeholder="Cari perusahaan, PIC, layanan, sumber lead"
      className="min-h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none"/>
    </label>
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
     Status
     <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}
      className="min-h-11 min-w-36 rounded-lg border border-slate-200 px-3 text-sm">
      <option value="all">Semua</option>
      {(Object.keys(statusText) as Status[]).map(x=><option value={x} key={x}>{statusText[x]}</option>)}
     </select>
    </label>
   </div>
   {loading?<div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/> Membaca Lead D1…</div>:
   visible.length===0?<div className="py-16 text-center">
    <Users className="mx-auto h-9 w-9 text-slate-300"/>
    <p className="mt-3 text-sm font-semibold text-slate-600">Tidak ada lead untuk filter ini</p>
    <p className="mt-1 text-xs text-slate-400">Belum ada data yang diterima dari database untuk pengguna ini.</p>
   </div>:
   <div className="mt-4 grid gap-3 lg:grid-cols-2">
    {visible.map(lead=><article key={lead.id} className="min-w-0 rounded-xl border border-slate-200 p-4 transition-shadow hover:shadow-sm">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={'rounded-md px-2 py-1 text-[11px] font-bold '+stageColors[lead.status]}>{statusText[lead.status]}</span>
      <span className="text-xs text-slate-400">v{lead.version}</span>
     </div>
     <h2 className="mt-3 break-words text-base font-bold text-slate-900">{lead.company_name}</h2>
     <p className="mt-1 break-all text-xs text-slate-500">{lead.contact_name} · {lead.contact_email}</p>
     <p className="mt-2 text-sm text-slate-700">{lead.service_interest}</p>
     <p className="mt-1 text-xs text-slate-500">Sumber: {lead.lead_source} · Owner: {lead.owner_email}</p>
     <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      {lead.status!=='converted'&&lead.status!=='disqualified'&&<button onClick={()=>edit(lead)}
       disabled={saving} className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700">Edit</button>}
      {lead.status==='new'&&<button onClick={()=>void setStage(lead,'contacted')} disabled={saving}
       className="min-h-9 rounded-lg bg-blue-50 px-3 text-xs font-bold text-blue-700">Tandai dihubungi</button>}
      {lead.status==='contacted'&&<button onClick={()=>void setStage(lead,'qualified')} disabled={saving}
       className="min-h-9 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700">Qualify</button>}
      {(lead.status==='new'||lead.status==='contacted')&&<button onClick={()=>void setStage(lead,'disqualified')} disabled={saving}
       className="min-h-9 rounded-lg bg-rose-50 px-3 text-xs font-bold text-rose-700">Disqualify</button>}
      {lead.status==='qualified'&&<button onClick={()=>convert(lead)} disabled={saving}
       className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-indigo-700 px-3 text-xs font-bold text-white">
       Konversi <ChevronRight className="h-3.5 w-3.5"/>
      </button>}
      {lead.status==='converted'&&lead.converted_opportunity_id&&
       <Link href={'/sales/pipeline?opportunity_id='+encodeURIComponent(lead.converted_opportunity_id)}
        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
        <ClipboardList className="h-3.5 w-3.5"/> Opportunity
       </Link>}
     </div>
    </article>)}
   </div>}
  </section>
  {mode!=='none'&&<div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode==='convert'?'Konversi Lead':mode==='edit'?'Edit Lead':'Tambah Lead'}>
   <div className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl">
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
     <div>
      <h2 className="text-lg font-bold text-slate-900">{mode==='convert'?'Konversi ke Customer & Opportunity':mode==='edit'?'Perbarui Lead':'Registrasi Lead Baru'}</h2>
      <p className="mt-1 text-xs text-slate-500">{mode==='convert'?'Satu transaksi database: Lead, Customer, Opportunity dan audit trail':'Simpan terlebih dahulu sebelum mengubah status'}</p>
     </div>
     <button aria-label="Tutup" disabled={saving} onClick={close} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button>
    </div>
    <form onSubmit={mode==='convert'?submitConversion:save} className="flex min-h-0 flex-1 flex-col">
     <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
      {mode!=='convert'?<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
       {fieldConfig.map(([id,label])=><FormField key={id} id={id} label={label} value={fields[id]}
        onChange={value=>setFields(prev=>({...prev,[id]:value}))}/>)}
      </div>:
      <>
       <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-sm">
        <p className="font-bold text-indigo-950">{selected?.company_name}</p>
        <p className="mt-1 text-xs text-indigo-700">Kontak: {selected?.contact_name} · {selected?.contact_email}</p>
        <p className="mt-2 text-xs text-indigo-800">Kontak utama dikunci dari Lead. Sales owner tetap pemilik Lead, termasuk jika Admin melakukan konversi.</p>
       </div>
       <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {customerFields.map(([id,label])=><FormField key={id} id={id} label={label} value={customer[id]}
         onChange={value=>setCustomer(prev=>({...prev,[id]:value}))}/>)}
        <div className="sm:col-span-2">
         <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={customer.hq_address!==''&&customer.hq_address===customer.hq_address} readOnly className="hidden"/>
          <ShieldCheck className="h-4 w-4 text-indigo-700"/> Kolom industri, bidang usaha, jumlah pegawai, telepon kantor, alamat, provinsi dan kode pos wajib.
         </label>
        </div>
        <FormField id="project_title" label="Nama opportunity / proyek*" value={project} onChange={setProject}/>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Estimasi nilai (IDR)*</span>
         <input required type="number" min={1} max={10000000000000} step={1} value={value} onChange={e=>setValue(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm"/>
         {Number(value)>0&&<p className="mt-1 text-xs text-slate-500">{money(Number(value))}</p>}
        </label>
        <label><span className="mb-1.5 block text-xs font-semibold text-slate-700">Model kontrak</span>
         <select value={contractModel} onChange={e=>setContractModel(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm">
          <option>One-Time</option><option>Recurring</option>
         </select>
        </label>
       </div>
      </>}
      {problem&&<div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{problem}</div>}
     </div>
     <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white p-4 sm:px-6">
      <button type="button" onClick={close} disabled={saving}
       className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700">Batal</button>
      <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white disabled:opacity-50">
       {saving&&<Loader2 className="h-4 w-4 animate-spin"/>}
       {mode==='convert'?<><FileCheck2 className="h-4 w-4"/> Konversi Atomik</>:mode==='edit'?'Simpan Perubahan':'Daftarkan Lead'}
      </button>
     </div>
    </form>
   </div>
  </div>}
  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-950">
   <div className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4"/> Keamanan transaksi</div>
   <p className="mt-1">Lead disimpan di D1 dengan owner dan audit perubahan. Sales hanya melihat lead miliknya; Admin dapat mengelola lead. Jika email dan nama perusahaan sudah terdaftar sebagai lead aktif, pendaftaran akan ditolak. Konversi customer baru tidak menimpa customer yang sudah ada.</p>
  </div>
 </div>;
}
