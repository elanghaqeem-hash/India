'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,ClipboardList,Megaphone,Plus,Search,UserRoundCheck} from 'lucide-react';
import {SERVICE_FAMILIES} from '@/lib/sales-workflow';
import {POSTAL_FIELDS} from '@/lib/indonesia-postal';
import {PostalAddressFields} from '@/components/sales/PostalAddressFields';
import {StandardCustomerChoice} from '@/components/sales/StandardCustomerChoice';
import {ManagedOptionSelect} from '@/components/sales/ManagedOptionSelect';
type Lead={id:string;version:number;lead_number:string;account_name:string;source:string;campaign:string;campaign_id?:string|null;service_family:string;
 contact_name:string;contact_email:string;assigned_sales_email:string;estimated_value_idr:number;
 expected_closing_date:string;status:'new'|'assigned'|'qualified'|'disqualified'|'converted';
 qualification:Record<string,string>;updated_at:string};
type CampaignOption={id:string;code:string;name:string;status:string;revision:number};
type Detail={lead:Lead;activities:{kind:string;summary:string;created_at:string}[];
 link:{opportunity_id:string;customer_id:string}|null};
const statuses:Record<string,string>={new:'Lead Baru',assigned:'Assigned',qualified:'Qualified',disqualified:'Disqualified',converted:'Converted'};
const cls='w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500';
const customerFields=[['client_tier','Segmentasi pelanggan (opsional)'],['industry','Sektor industri'],['business_type','Bidang usaha'],['employee_band','Jumlah pegawai'],['company_phone','Telepon kantor'],['hq_address','Alamat kantor pusat'],['technical_name','PIC teknis'],['technical_email','Email PIC teknis'],['billing_name','PIC penagihan'],['billing_email','Email penagihan'],['tax_name','PIC pajak'],['tax_email','Email pajak']] as const;
const initialCustomer=()=>Object.fromEntries([...customerFields.map(([name])=>[name,'']),...POSTAL_FIELDS.map(name=>[name,''])]) as Record<string,string>;
const flds=[
 ['need','Kebutuhan / pain point'],['budget_status','Budget / status pendanaan'],
 ['decision_maker','Pengambil keputusan'],['procurement_process','Proses pengadaan'],
 ['discovery_notes','Catatan discovery'],['contact_phone','Nomor telepon PIC'],
 ['target_next_action','Rencana tindak lanjut'],['disqualification_reason','Alasan tidak diteruskan']
] as const;
const empty=()=>({account_name:'',source:'',campaign:'',campaign_id:'',service_family:'VAPT',contact_name:'',contact_email:'',
 assigned_sales_email:'',estimated_value_idr:'',expected_closing_date:''});
async function api(method:'GET'|'POST'|'PATCH',url:string,data?:Record<string,unknown>){
 const response=await fetch(url,{method,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json',...(data?.entity==='convert'?{'x-india-lead-action':'convert'}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const j=await response.json();
 if(!response.ok||!j.success)throw Error((j.message||'Transaksi gagal')+(j.missing?.length?' — '+j.missing.join(', '):''));
 return j;
}
const money=(v:number)=>'Rp'+Number(v||0).toLocaleString('id-ID');
export default function MarketingLeads(){
 const [list,setList]=useState<Lead[]>([]);
 const [scores,setScores]=useState<Record<string,{score:number;temperature:string}>>({});
 const [campaigns,setCampaigns]=useState<CampaignOption[]>([]);
 const [campaignError,setCampaignError]=useState('');
 const [role,setRole]=useState('');
 const [form,setForm]=useState(empty());
 // Stable for safe network retries; regenerated only for the next new Lead.
 const [requestKey,setRequestKey]=useState('');
 const [selected,setSelected]=useState<Detail|null>(null);
 const [qualification,setQualification]=useState<Record<string,string>>({});
 const [customerProfile,setCustomerProfile]=useState(initialCustomer());
 const [title,setTitle]=useState('');
 const [activity,setActivity]=useState('');
 const [query,setQuery]=useState('');
 const [newMode,setNewMode]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const j=await api('GET','/api/marketing/leads');setList(j.leads||[]);setRole(j.role||'');
   // Marketing/Admin see planned campaigns too. Sales remains restricted by the API.
   // Never silently mislabel an API failure as an empty Campaign directory.
   try{
    const c=await api('GET','/api/marketing/campaigns');
    setCampaigns(c.campaigns||[]);setCampaignError('');
   }catch(e){
    setCampaigns([]);
    setCampaignError(e instanceof Error?e.message:String(e));
   }
   const intelligence=await api('GET','/api/marketing/lead-intelligence?mode=queue').catch(()=>({leads:[]}));
   setScores(Object.fromEntries((intelligence.leads||[]).map((x:{id:string;score:number;temperature:string})=>[x.id,{score:x.score,temperature:x.temperature}])));
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[]);
 const load=async(id:string)=>{
  const j=await api('GET','/api/marketing/leads?id='+encodeURIComponent(id));
  setSelected(j);setQualification(j.lead.qualification||{});
  setTitle(j.lead.account_name+' — '+j.lead.service_family);
  // Never carry customer contact/billing fields into another Lead or Sales account.
  setCustomerProfile(initialCustomer());
  setNewMode(false);
 };
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('lead_id');if(id)void load(id);},[]);
 const run=async(fn:()=>Promise<unknown>,result:string,next?:string)=>{
  setBusy(true);setMessage('');
  try{const j=await fn() as {id?:string;opportunity_id?:string};await refresh();
   if(next||j.id)await load(next||j.id||'');
   setMessage(result+(j.opportunity_id?' • Opportunity '+j.opportunity_id:''));}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const activateCampaign=async(c:CampaignOption)=>{
  if(!['admin','marketing'].includes(role)||!['planned','paused'].includes(c.status)||busy)return;
  setBusy(true);setMessage('');
  try{
   await api('PATCH','/api/marketing/campaigns',{id:c.id,revision:c.revision,status:'active'});
   await refresh();
   setForm(prev=>({...prev,campaign_id:c.id,campaign:c.name}));
   setMessage(`Campaign "${c.name}" berhasil diaktifkan dan dipilih untuk Lead baru.`);
  }catch(e){setMessage('Gagal mengaktifkan Campaign: '+(e instanceof Error?e.message:String(e)));}
  finally{setBusy(false);}
 };
 const create=()=>void run(async()=>{
  const id=requestKey||crypto.randomUUID();
  const result=await api('POST','/api/marketing/leads',{entity:'lead',...form,request_key:id,
   estimated_value_idr:Number(form.estimated_value_idr||0),qualification:{}});
  setRequestKey(crypto.randomUUID());
  return result;
 },'Lead tersimpan di D1');
 const changeStatus=(status:'assigned'|'qualified')=>{
  if(!selected)return;
  void run(()=>api('PATCH','/api/marketing/leads',{id:selected.lead.id,version:selected.lead.version,status,qualification}),
   'Status dan qualification disimpan.',selected.lead.id);
 };
 const convert=()=>{
  if(!selected||!title.trim())return;
  if(!window.confirm('Konversi Lead Qualified ini menjadi Customer/Opportunity? Proses ini membuat link permanen dan tidak boleh dilakukan dua kali.'))return;
  void run(()=>api('POST','/api/marketing/leads',{entity:'convert',id:selected.lead.id,version:selected.lead.version,opportunity_title:title,customer_fields:customerProfile}),
   'Lead terkonversi.',selected.lead.id);
 };
 const note=()=>{
  if(!selected||!activity.trim())return;
  void run(()=>api('POST','/api/marketing/leads',{entity:'activity',id:selected.lead.id,kind:'note',summary:activity}),
   'Aktivitas dicatat.',selected.lead.id);setActivity('');
 };
 const qualified=list.filter(x=>x.status==='qualified').length;
 const converted=list.filter(x=>x.status==='converted').length;
 const shown=list.filter(x=>(x.account_name+' '+x.lead_number+' '+x.source+' '+x.campaign).toLowerCase().includes(query.toLowerCase()));
 const activeCampaigns=campaigns.filter(x=>x.status==='active');
 const inactiveCampaigns=campaigns.filter(x=>x.status!=='active');
 const campaignStatusText:Record<string,string>={planned:'Direncanakan',paused:'Dijeda',completed:'Selesai',cancelled:'Dibatalkan'};
 return <main className="min-w-0 space-y-5 pb-24">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div><div className="flex items-center gap-2 text-xs font-bold text-blue-700"><Megaphone size={16}/> INDIA · Marketing</div>
    <h1 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">Lead-to-Opportunity Workspace</h1>
    <p className="mt-1 max-w-2xl text-xs text-slate-600">Lead → Qualification → Konversi Customer/Opportunity → Sales Pipeline. Semua menggunakan sumber data D1 yang sama.</p>
   </div>
   <button type="button" disabled={busy||!['admin','marketing','sales'].includes(role)} onClick={()=>{setNewMode(true);setSelected(null);setMessage('');setForm(empty());setRequestKey(crypto.randomUUID());}}
    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Plus size={15}/> Lead Baru</button>
  </header>
  <div className="flex flex-wrap gap-2">
   <Link href="/sales/campaigns" className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Kelola Campaign &amp; Attribution →</Link>
   <Link href="/sales/pipeline" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-700">Sales Pipeline →</Link>
   <Link href="/sales/activities" className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700">Jadwal &amp; Follow-up →</Link>
   <Link href="/sales/lead-intelligence" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Lead Score · Nurturing · Conversion Analysis →</Link>
  </div>
  {message&&<div role="status" className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{message}</div>}
  <section className="grid grid-cols-3 gap-2">
   {([['Total Lead',list.length],['Qualified',qualified],['Converted',converted]] as const).map(([name,count])=>
    <div key={name} className="rounded-xl border bg-white p-3 sm:p-4"><div className="text-[11px] text-slate-500">{name}</div><div className="text-xl font-black tabular-nums text-slate-900">{count}</div></div>)}
  </section>
  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="flex items-center gap-2 text-sm font-bold"><Search size={15}/> Daftar Lead</h2>
    <input value={query} onChange={e=>setQuery(e.target.value)} className={cls} placeholder="Cari pelanggan, campaign, lead number"/>
    {shown.length===0?<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Belum ada lead sesuai pencarian. Registrasi Lead Baru untuk memulai pipeline.</p>:shown.map(x=>
     <button key={x.id} onClick={()=>void load(x.id)} className={'block w-full rounded-lg border p-3 text-left hover:border-blue-300 '+(selected?.lead.id===x.id?'border-blue-500 bg-blue-50':'')}>
      <div className="flex justify-between gap-2"><b className="min-w-0 truncate text-xs">{x.account_name}</b><span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold">{statuses[x.status]||x.status}</span></div>
      <div className="mt-1 text-[11px] text-slate-500">{x.lead_number} · {x.service_family} · {money(x.estimated_value_idr)}</div>
      <div className="mt-1 break-all text-[11px] text-slate-500">{x.assigned_sales_email}</div>
      {scores[x.id]&&<div className="mt-1 text-[11px] font-semibold text-blue-700">Lead Score {scores[x.id].score}/100 · {scores[x.id].temperature}</div>}
     </button>)}
   </section>
   {newMode?<section className="rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Registrasi Lead Baru</h2>
    <p className="mt-1 text-xs text-slate-500">Gunakan identitas perusahaan yang sebenarnya. Tidak ada data dummy yang diisi otomatis.</p>
    <div className="mt-4">
     <label className="block text-xs font-semibold text-slate-700">Campaign terdaftar (opsional, mengikat attribution ke D1)
      <select className={'mt-1 '+cls} disabled={busy} value={form.campaign_id} onChange={e=>{
       const id=e.target.value,selected=activeCampaigns.find(x=>x.id===id);
       setForm(v=>({...v,campaign_id:selected?.id||'',campaign:selected?.name||''}));
      }}>
       <option value="">Tanpa Campaign terdaftar</option>
       {activeCampaigns.map(x=><option key={x.id} value={x.id}>{x.code} — {x.name} (Aktif)</option>)}
       {inactiveCampaigns.length>0&&<optgroup label="Terdaftar — belum dapat dipilih">
        {inactiveCampaigns.map(x=><option key={x.id} value={x.id} disabled>{x.code} — {x.name} ({campaignStatusText[x.status]||x.status})</option>)}
       </optgroup>}
      </select>
     </label>
     {campaignError?<div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
      Gagal memuat Campaign: {campaignError}. <button type="button" disabled={busy} onClick={()=>void refresh()} className="font-bold underline">Muat ulang</button>
     </div>:inactiveCampaigns.length>0&&['admin','marketing'].includes(role)?
      <details open={activeCampaigns.length===0} className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
       <summary className="cursor-pointer font-semibold">{inactiveCampaigns.length} Campaign terdaftar belum aktif — lihat dan aktifkan</summary>
       <p className="mt-2">Campaign berstatus Direncanakan/Dijeda sudah tersimpan di D1, tetapi belum dapat dihubungkan ke Lead baru sampai diaktifkan.</p>
       <div className="mt-2 space-y-2">
        {inactiveCampaigns.map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white p-2">
         <span className="min-w-0 break-words"><b>{x.name}</b> <span className="font-normal">({campaignStatusText[x.status]||x.status})</span></span>
         {['planned','paused'].includes(x.status)&&<button type="button" disabled={busy} onClick={()=>void activateCampaign(x)}
          className="rounded-md bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-50">Aktifkan &amp; pilih</button>}
        </div>)}
       </div>
      </details>:!campaignError&&activeCampaigns.length===0?
      <p className="mt-2 text-xs text-amber-800">Belum ada Campaign aktif. Minta Marketing/Admin mengaktifkan Campaign dari menu Kelola Campaign sebelum dikaitkan ke Lead.</p>:null}
    </div>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    {([
     ['account_name','Perusahaan / Prospek *'],['source','Sumber Lead *'],['campaign','Kampanye / Event'],
     ['contact_name','Nama PIC'],['contact_email','Email PIC'],['assigned_sales_email','Sales Owner (email aktif) *'],
     ['estimated_value_idr','Estimasi nilai IDR'],['expected_closing_date','Target closing']
    ] as const).map(([key,label])=><label key={key} className="min-w-0 text-xs font-semibold text-slate-700">{label}
      {key==='source'?<ManagedOptionSelect group="lead_source" label={label} required value={form.source} onChange={value=>setForm(s=>({...s,source:value}))} className={'mt-1 '+cls}/>:<input className={'mt-1 '+cls} disabled={key==='campaign'&&!!form.campaign_id}
       type={key==='contact_email'||key==='assigned_sales_email'?'email':key==='expected_closing_date'?'date':key==='estimated_value_idr'?'number':'text'}
       value={form[key]} onChange={e=>setForm(s=>({...s,[key]:e.target.value}))}/>}</label>)}
    <label className="text-xs font-semibold text-slate-700">Jenis produk / layanan *
     <select className={'mt-1 '+cls} value={form.service_family} onChange={e=>setForm(s=>({...s,service_family:e.target.value}))}>
      {SERVICE_FAMILIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    </div>
    <button disabled={busy||!form.account_name.trim()||!form.source.trim()||!form.assigned_sales_email.trim()} onClick={create}
     className="mt-4 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Simpan Lead</button>
   </section>:selected?<section className="min-w-0 space-y-4 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">{selected.lead.account_name}</h2>
     <p className="text-xs text-slate-500">{selected.lead.lead_number} • {statuses[selected.lead.status]}</p></div>
     {selected.link&&<Link href={'/sales/pipeline?opportunity_id='+encodeURIComponent(selected.link.opportunity_id)}
      className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={15}/> Buka Opportunity <ArrowRight size={13}/></Link>}</div>
    <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Sales Owner: <b>{selected.lead.assigned_sales_email}</b>. Lead Qualified harus memenuhi Need, Budget, Decision Maker dan Procurement. Customer ID diterbitkan saat konversi.</div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
     {flds.map(([k,label])=><label key={k} className="text-xs font-semibold text-slate-700">{label}
       {k==='procurement_process'?<ManagedOptionSelect group="procurement_process" label={label} value={qualification[k]||''}
        disabled={selected.lead.status==='converted'} onChange={value=>setQualification(q=>({...q,[k]:value}))} className={'mt-1 '+cls}/>:<textarea rows={k==='discovery_notes'?3:2} disabled={selected.lead.status==='converted'}
        value={qualification[k]||''} onChange={e=>setQualification(q=>({...q,[k]:e.target.value}))}
        className={'mt-1 '+cls+' resize-y disabled:bg-slate-100'}/>}</label>)}
    </div>
    {!['converted','disqualified'].includes(selected.lead.status)&&<div className="flex flex-wrap gap-2">
     {selected.lead.status==='new'&&<button disabled={busy} onClick={()=>changeStatus('assigned')} className="rounded-lg border px-3 py-2 text-xs font-bold">Tandai Assigned</button>}
     <button disabled={busy} onClick={()=>changeStatus('qualified')} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white"><UserRoundCheck size={15}/> Simpan & Qualified</button>
     <Link href="/sales/lead-intelligence" className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Disqualified dengan Reason Code →</Link>
    </div>}
    {selected.lead.status==='qualified'&&<div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
     <div className="flex items-center gap-2 text-xs font-bold text-emerald-900"><ClipboardList size={16}/> Konversi menjadi Customer + Opportunity</div>
     <p className="text-xs text-emerald-900">Konversi hanya dapat dilakukan Sales pemilik Lead atau Admin. Data kebutuhan, owner dan sumber Lead akan dipetakan tanpa input ulang.</p>
     <input className={cls} aria-label="Nama proyek" value={title} onChange={e=>setTitle(e.target.value)}/>
     <details className="rounded-lg border border-emerald-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-emerald-900">Data Registrasi Customer / Project untuk Form Word</summary><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{customerFields.map(([field,label])=>
 field==='client_tier'||field==='industry'||field==='business_type'
  ?<StandardCustomerChoice key={field} field={field} label={label} value={customerProfile[field]||''} industry={customerProfile.industry||''}
    onChange={v=>setCustomerProfile(old=>({...old,[field]:v}))}/>
  :<label key={field} className="min-w-0 text-xs font-medium text-slate-700">{label}
     <input className={'mt-1 '+cls} type={field.includes('email')?'email':'text'} value={customerProfile[field]}
      onChange={e=>setCustomerProfile(old=>({...old,[field]:e.target.value}))}/>
    </label>)}<PostalAddressFields values={customerProfile} onChange={patch=>setCustomerProfile(old=>({...old,...patch}))}/></div></details>
     <button disabled={busy||!title.trim()} onClick={convert} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Convert Lead → Opportunity</button>
    </div>}
    <div className="border-t pt-3"><h3 className="text-sm font-bold">Aktivitas Marketing</h3>
     <textarea value={activity} onChange={e=>setActivity(e.target.value)} rows={2} className={'mt-2 '+cls} placeholder="Catatan kunjungan, telepon, respons atau tindak lanjut"/>
     <button onClick={note} disabled={busy||!activity.trim()} className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold">Catat Aktivitas</button>
     <div className="mt-3 space-y-2">{selected.activities.map((a,i)=><p key={i} className="border-t pt-2 text-xs"><b>{a.kind}</b> · {a.summary}<span className="block text-slate-500">{a.created_at}</span></p>)}</div>
    </div>
   </section>:<section className="flex min-h-60 items-center justify-center rounded-xl border bg-white p-5 text-center text-sm text-slate-500">Pilih Lead untuk melihat qualification, histori, dan konversi menjadi Opportunity.</section>}
  </div>
 </main>;
}
