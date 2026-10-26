'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ListChecks,RefreshCcw,ShieldCheck,Save} from 'lucide-react';

type Option={id:string;group_key:string;option_value:string;option_label:string;description:string;sort_order:number;active:number;version:number;updated_by:string;updated_at:string};
const input='min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const empty={group_key:'',option_value:'',option_label:'',description:'',sort_order:100,active:true,version:0};
export default function AdminOptionsPage(){
 const [items,setItems]=useState<Option[]>([]);
 const [form,setForm]=useState({...empty});
 const [allowed,setAllowed]=useState(false);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [filter,setFilter]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/admin/options',{credentials:'same-origin',cache:'no-store'});
  const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Akses registrasi opsi ditolak');
  setAllowed(true);setItems(j.items||[]);
 },[]);
 useEffect(()=>{void load().catch(e=>{setAllowed(false);setError(e instanceof Error?e.message:'Akses ditolak');}).finally(()=>setLoading(false));},[load]);
 const groups=useMemo(()=>[...new Set(items.map(x=>x.group_key))].sort(),[items]);
 const selected=items.filter(x=>!filter||x.group_key===filter);
 const edit=(x:Option)=>{setForm({group_key:x.group_key,option_value:x.option_value,option_label:x.option_label,description:x.description,sort_order:x.sort_order,active:x.active===1,version:x.version});setMessage('');window.scrollTo({top:0,behavior:'smooth'});};
 const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setMessage('');setError('');
  try{
   const r=await fetch('/api/admin/options',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,action:'save'})});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Penyimpanan ditolak');
   setForm({...empty});setMessage('Opsi dan audit perubahan berhasil disimpan.');
   try{await load();}catch{setMessage('Opsi tersimpan, tetapi daftar belum dapat dimuat ulang. Perbarui halaman untuk verifikasi.');}
  }catch(e){setError(e instanceof Error?e.message:'Penyimpanan gagal');}
  finally{setBusy(false);}
 };
 const toggle=async(x:Option)=>{setBusy(true);setError('');setMessage('');
  try{const r=await fetch('/api/admin/options',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',group_key:x.group_key,option_value:x.option_value,option_label:x.option_label,description:x.description,sort_order:x.sort_order,active:x.active!==1,version:x.version})});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Gagal mengubah status');
   setMessage('Status opsi berhasil disimpan.');
   try{await load();}catch{setMessage('Status opsi tersimpan, tetapi daftar belum dapat dimuat ulang. Perbarui halaman untuk verifikasi.');}}
  catch(e){setError(e instanceof Error?e.message:'Perubahan gagal');}finally{setBusy(false);}
 };
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-white to-indigo-50 p-5 sm:p-6">
   <Link href="/settings/options" className="text-xs font-semibold text-indigo-700">Opsi / Registrasi Opsi</Link>
   <div className="mt-2 flex items-center gap-3"><span className="rounded-xl bg-indigo-900 p-3 text-white"><ListChecks className="h-5 w-5"/></span><div><h1 className="text-xl font-extrabold sm:text-2xl">Registrasi Opsi INDIA</h1><p className="text-xs text-slate-600">Master dropdown terpusat, berkode, dapat diaktifkan/nonaktifkan, dan terekam dalam audit.</p></div></div>
   <p className="mt-4 flex items-center gap-2 text-xs text-indigo-900"><ShieldCheck className="h-4 w-4"/> Pembuatan dan perubahan hanya oleh Admin. Pengguna terotorisasi lain hanya dapat membaca pilihan aktif.</p>
  </header>
  {loading&&<p role="status" className="rounded-xl border bg-white p-4">Memverifikasi akses Admin...</p>}
  {error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</p>}
  {message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
  {!loading&&allowed&&<>
   <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold">{form.version?'Perbarui opsi':'Tambah opsi baru'}</h2><button type="button" onClick={()=>setForm({...empty})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Reset</button></div>
    <div className="grid gap-4 md:grid-cols-2">
     <label className="text-xs font-semibold text-slate-700">Grup pilihan (kode) <input className={'mt-1 '+input} list="india-option-groups" pattern="[a-z][a-z0-9_-]{1,60}" required readOnly={form.version>0} value={form.group_key} onChange={e=>setForm(p=>({...p,group_key:e.target.value.toLowerCase()}))} placeholder="contoh: sumber_lead"/><datalist id="india-option-groups">{groups.map(g=><option key={g} value={g}/>)}</datalist></label>
     <label className="text-xs font-semibold text-slate-700">Kode opsi <input className={'mt-1 '+input} pattern="[a-z][a-z0-9_-]{1,60}" required readOnly={form.version>0} value={form.option_value} onChange={e=>setForm(p=>({...p,option_value:e.target.value.toLowerCase()}))} placeholder="contoh: referral"/></label>
     <label className="text-xs font-semibold text-slate-700">Label opsi <input className={'mt-1 '+input} minLength={2} maxLength={120} required value={form.option_label} onChange={e=>setForm(p=>({...p,option_label:e.target.value}))} placeholder="contoh: Referensi Partner"/></label>
     <label className="text-xs font-semibold text-slate-700">Urutan tampilan <input type="number" className={'mt-1 '+input} min={0} max={9999} required value={form.sort_order} onChange={e=>setForm(p=>({...p,sort_order:Number(e.target.value)}))}/></label>
    </div>
    <label className="block text-xs font-semibold text-slate-700">Keterangan <textarea className={'mt-1 '+input} maxLength={500} rows={2} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></label>
    <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={e=>setForm(p=>({...p,active:e.target.checked}))}/>Aktif dan tersedia bagi pengguna</label>
    <button disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-800 px-5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>Simpan opsi</button>
   </form>
   <section className="rounded-2xl border bg-white p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Opsi terdaftar ({selected.length})</h2><div className="flex gap-2"><select className={input} aria-label="Filter grup pilihan" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Semua grup</option>{groups.map(g=><option key={g}>{g}</option>)}</select><button disabled={busy} onClick={()=>void load().catch(e=>setError(String(e)))} title="Muat ulang" aria-label="Muat ulang opsi" className="rounded-lg border p-3"><RefreshCcw className="h-4 w-4"/></button></div></div>
    <div className="space-y-2">{selected.map(x=><div key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 text-xs"><div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{x.option_label}</p><p className="break-all text-slate-500">{x.group_key} / {x.option_value} · v{x.version} · Urut {x.sort_order}</p>{x.description&&<p className="mt-1 text-slate-600">{x.description}</p>}</div><span className={x.active?'font-semibold text-emerald-700':'font-semibold text-amber-700'}>{x.active?'Aktif':'Nonaktif'}</span><button type="button" onClick={()=>edit(x)} className="min-h-10 rounded-lg border px-3 font-semibold">Edit</button><button type="button" disabled={busy} onClick={()=>void toggle(x)} className="min-h-10 rounded-lg border px-3 font-semibold disabled:opacity-50">{x.active?'Nonaktifkan':'Aktifkan'}</button></div>)}{selected.length===0&&<p className="py-7 text-center text-xs text-slate-500">Belum ada opsi tersimpan di grup ini.</p>}</div>
   </section>
  </>}
 </main>;
}
