'use client';
import React,{useCallback,useEffect,useState} from 'react';
import AdminNavigation from '@/components/admin/AdminNavigation';
import {roles} from '@/lib/boq-domain';
type Member={email:string;role:string;active:number;unit_key?:string};
type MemberInput={email:string;role:string;active:boolean;unit_key:string};
const empty:MemberInput={email:'',role:'viewer',active:true,unit_key:''};
const field='min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';
export default function BoQUsers(){
 const [members,setMembers]=useState<Member[]>([]),[form,setForm]=useState<MemberInput>(empty),[editing,setEditing]=useState(false),[units,setUnits]=useState<{setting_key:string;title:string}[]>([]);
 const [loading,setLoading]=useState(true),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  const r=await fetch('/api/boq/members',{credentials:'same-origin',cache:'no-store'}),j=await r.json();
  if(!r.ok||!j.success){setReady(false);setMembers([]);setUnits([]);throw Error(j.message||'Akses ditolak');}
  setMembers(j.users);setUnits(j.units||[]);setReady(true);
 },[]);
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Pengguna tidak dapat dimuat')).finally(()=>setLoading(false));},[load]);
 const save=async(member:MemberInput,clearForm=false)=>{
  setBusy(true);setError('');setNotice('');
  try{
   const r=await fetch('/api/boq/members',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(member)}),j=await r.json();
   if(!r.ok||!j.success)throw Error(j.message||'Pengguna tidak tersimpan');
   if(clearForm){setForm(empty);setEditing(false);}
   setNotice('Pengguna dan audit perubahan tersimpan.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Permintaan gagal');}
  finally{setBusy(false);}
 };
 return <main className="mx-auto max-w-5xl space-y-5 pb-20">
  <AdminNavigation/>
  <header className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-indigo-700">INDIA · KHUSUS ADMIN</p><h1 className="mt-1 text-2xl font-bold">Registrasi User</h1>
   <p className="mt-2 text-sm text-slate-600">Daftarkan email, tetapkan peran dan unit kerja, serta kelola status akses pengguna. Identitas juga harus diizinkan oleh kebijakan login Cloudflare Access.</p>
  </header>
  {loading&&<p role="status" className="rounded-xl border bg-white p-4 text-sm">Memverifikasi akses Admin…</p>}
  {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
  {!loading&&!ready&&<button className={field} onClick={()=>{setLoading(true);void load().then(()=>setError('')).catch(e=>setError(String(e.message))).finally(()=>setLoading(false));}}>Coba lagi</button>}
  {ready&&<>
   <form onSubmit={e=>{e.preventDefault();void save(form,true);}} className="space-y-4 rounded-2xl border bg-white p-5">
    <h2 className="font-bold">{editing?'Ubah pengguna':'Daftarkan pengguna'}</h2>
    <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
     <label className="space-y-1 text-xs font-semibold">Email<input type="email" autoComplete="email" required maxLength={254} readOnly={editing} value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className={field}/></label>
     <label className="space-y-1 text-xs font-semibold">Peran<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className={field}>{roles.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label className="space-y-1 text-xs font-semibold">Unit kerja<select value={form.unit_key} onChange={e=>setForm({...form,unit_key:e.target.value})} className={field}><option value="">Tanpa unit kerja</option>{units.map(x=><option key={x.setting_key} value={x.setting_key}>{x.title}</option>)}</select></label>
     <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Akses aktif</label>
    </fieldset>
    <div className="flex flex-wrap gap-2"><button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-indigo-800 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">{busy?'Menyimpan…':editing?'Simpan perubahan':'Daftarkan user'}</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setForm(empty);setEditing(false);}} className="min-h-11 rounded-xl border px-4 text-xs font-bold">Batal edit</button>}</div>
   </form>
   <section className="space-y-3" aria-label="Pengguna terdaftar"><h2 className="font-bold">Pengguna terdaftar ({members.length})</h2>{members.length===0&&<p className="text-sm text-slate-600">Belum ada pengguna.</p>}{members.map(m=><article key={m.email} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 text-xs">
    <div className="min-w-0 flex-1"><h3 className="break-all font-bold">{m.email}</h3><p className="mt-1 text-slate-600">{m.role} · {m.active?'Aktif':'Nonaktif'} · {units.find(u=>u.setting_key===m.unit_key)?.title||m.unit_key||'Tanpa unit kerja'}</p></div>
    <button disabled={busy} type="button" onClick={()=>{setEditing(true);setForm({email:m.email,role:m.role,active:!!m.active,unit_key:m.unit_key||''});setNotice('');}} className="min-h-11 rounded-xl border px-3" aria-label={'Ubah '+m.email}>Ubah</button>
    <button disabled={busy} type="button" onClick={()=>void save({email:m.email,role:m.role,active:!m.active,unit_key:m.unit_key||''})} className="min-h-11 rounded-xl border px-3" aria-label={(m.active?'Nonaktifkan ':'Aktifkan ')+m.email}>{m.active?'Nonaktifkan':'Aktifkan'}</button>
   </article>)}</section>
  </>}
 </main>;
}
