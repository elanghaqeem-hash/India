'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BarChart3,CheckCircle2,Plus,RefreshCw} from 'lucide-react';
import {campaignChannels,campaignStatuses} from '@/lib/marketing-campaign';
type Campaign={
 id:string;code:string;name:string;channel:string;status:string;owner_email:string;
 budget_idr:number;start_date:string;end_date:string;notes:string;revision:number;
 total:number;qualified:number;converted:number;conversionRate:number;
};
const empty=()=>({code:'',name:'',channel:'webinar',status:'planned',owner_email:'',
 budget_idr:'0',start_date:'',end_date:'',notes:''});
const input='mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-100';
const money=(n:number)=>'Rp'+Number(n||0).toLocaleString('id-ID');
async function request(method:'GET'|'POST'|'PATCH',body?:Record<string,unknown>){
 const res=await fetch('/api/marketing/campaigns',{method,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const json=await res.json();
 if(!res.ok||!json.success)throw Error(json.message||'Proses Campaign gagal');
 return json;
}
export default function MarketingCampaigns(){
 const [campaigns,setCampaigns]=useState<Campaign[]>([]);
 const [role,setRole]=useState('');
 const [editing,setEditing]=useState<Campaign|null>(null);
 const [form,setForm]=useState(empty());
 const [newMode,setNewMode]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const reload=useCallback(async()=>{
  try{const d=await request('GET');setCampaigns(d.campaigns||[]);setRole(d.role||'');}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const editable=role==='admin'||role==='marketing';
 const select=(c:Campaign)=>{
  setEditing(c);setNewMode(false);setMessage('');
  setForm({code:c.code,name:c.name,channel:c.channel,status:c.status,owner_email:c.owner_email,
   budget_idr:String(c.budget_idr),start_date:c.start_date,end_date:c.end_date,notes:c.notes});
 };
 const create=()=>{
  setEditing(null);setNewMode(true);setForm(empty());setMessage('');
 };
 const submit=async()=>{
  setBusy(true);setMessage('');
  try{
   const payload={...form,budget_idr:Number(form.budget_idr)};
   const result=editing
    ?await request('PATCH',{id:editing.id,revision:editing.revision,...payload})
    :await request('POST',payload);
   await reload();
   setMessage('Campaign '+result.code||'');
   setMessage(editing?'Revisi campaign tersimpan dan tercatat di audit.':'Campaign baru berhasil diregistrasi di D1.');
   setEditing(null);setNewMode(false);setForm(empty());
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const active=campaigns.filter(x=>x.status==='active').length;
 const leads=campaigns.reduce((s,x)=>s+x.total,0);
 const converted=campaigns.reduce((s,x)=>s+x.converted,0);
 return <main className="min-w-0 space-y-5 pb-24">
  <header className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <Link href="/sales/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft size={14}/> Marketing Leads</Link>
    <h1 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">Marketing Campaign Center</h1>
    <p className="mt-1 max-w-2xl text-xs text-slate-600">Campaign → Lead → Qualified → Converted Opportunity. Angka diambil dari transaksi D1, bukan estimasi atau data contoh.</p>
   </div>
   {editable&&<button type="button" disabled={busy} onClick={create} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white"><Plus size={15}/> Campaign Baru</button>}
  </header>
  {message&&<p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{message}</p>}
  <section className="grid grid-cols-3 gap-2">
   {([['Campaign Aktif',active],['Lead Teratribusi',leads],['Converted',converted]] as const).map(([label,count])=>
    <div key={label} className="rounded-xl border bg-white p-3">
     <div className="text-[11px] text-slate-500">{label}</div>
     <div className="mt-1 text-xl font-black tabular-nums">{count}</div>
    </div>)}
  </section>
  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
   <section className="min-w-0 space-y-3 rounded-xl border bg-white p-4">
    <div className="flex items-center justify-between">
     <h2 className="inline-flex items-center gap-2 text-sm font-bold"><BarChart3 size={16}/> Master Campaign</h2>
     <button type="button" disabled={busy} onClick={()=>void reload()} className="rounded-lg border p-2" aria-label="Refresh"><RefreshCw size={14}/></button>
    </div>
    {campaigns.length===0?<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Belum ada Campaign atau akses Anda hanya menampilkan Campaign aktif. Marketing dapat membuat Campaign baru.</p>:
     campaigns.map(c=><button key={c.id} onClick={()=>select(c)} className={'w-full rounded-lg border p-3 text-left '+(editing?.id===c.id?'border-blue-500 bg-blue-50':'hover:border-blue-200')}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs">{c.name}</strong><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase">{c.status}</span></div>
      <div className="mt-1 text-[11px] text-slate-500">{c.code} · {c.channel} · {c.owner_email}</div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-700">
       <span>Lead <b>{c.total}</b></span><span>Qualified <b>{c.qualified}</b></span>
       <span>Converted <b>{c.converted}</b></span><span>Conversion <b>{c.conversionRate}%</b></span>
      </div>
     </button>)}
   </section>
   {newMode||editing?<section className="min-w-0 rounded-xl border bg-white p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{editing?'Perbarui Campaign':'Registrasi Campaign'}</h2>
     {editing&&<span className="text-[11px] text-slate-500">Revision {editing.revision}</span>}
    </div>
    <p className="mt-1 text-xs text-slate-500">Hanya Marketing/Admin yang dapat membuat dan mengubah Campaign. Campaign final tidak dapat diedit.</p>
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
     {([
      ['code','Kode unik *','text'],['name','Nama campaign *','text'],
      ['owner_email','Owner email aktif *','email'],['budget_idr','Budget (IDR)','number'],
      ['start_date','Mulai','date'],['end_date','Berakhir','date']
     ] as const).map(([key,label,type])=><label key={key} className="min-w-0 text-xs font-semibold text-slate-700">{label}
       <input className={input} type={type} disabled={!editable||busy||(!!editing&&key==='code')}
        value={form[key]} onChange={e=>setForm(x=>({...x,[key]:e.target.value}))}/>
      </label>)}
     <label className="text-xs font-semibold text-slate-700">Channel
      <select className={input} disabled={!editable||busy} value={form.channel} onChange={e=>setForm(x=>({...x,channel:e.target.value}))}>
       {campaignChannels.map(x=><option value={x} key={x}>{x}</option>)}
      </select></label>
     <label className="text-xs font-semibold text-slate-700">Status
      <select className={input} disabled={!editable||busy} value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))}>
       {campaignStatuses.map(x=><option value={x} key={x}>{x}</option>)}
      </select></label>
    </div>
    <label className="mt-3 block text-xs font-semibold text-slate-700">Catatan Campaign
     <textarea rows={4} disabled={!editable||busy} className={input+' resize-y'} value={form.notes} onChange={e=>setForm(x=>({...x,notes:e.target.value}))}/>
    </label>
    <div className="mt-4 flex flex-wrap items-center gap-2">
     {editable&&<button type="button" disabled={busy||!form.name.trim()||!form.code.trim()||!form.owner_email.trim()||['cancelled','completed'].includes(editing?.status||'')}
      onClick={()=>void submit()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
       <CheckCircle2 size={16}/>{editing?'Simpan Revisi':'Daftarkan Campaign'}
      </button>}
     <button type="button" onClick={()=>{setNewMode(false);setEditing(null);}} className="rounded-lg border px-4 py-2.5 text-xs">Tutup</button>
    </div>
    {editing&&<p className="mt-3 text-xs text-slate-500">Budget tercatat: {money(editing.budget_idr)}. Revisi harus menggunakan versi terkini; tab lama ditolak server.</p>}
   </section>:<section className="flex min-h-60 items-center justify-center rounded-xl border bg-white p-5 text-center text-sm text-slate-500">Pilih Campaign untuk melihat efektivitas lead, atau buat campaign sebelum mendaftarkan lead baru.</section>}
  </div>
 </main>;
