'use client';
import React,{useCallback,useEffect,useState} from 'react';

type Project={id:string;title:string;status:string};
type Allocation={id:string;allocation_month:string;person_days:number;display_name:string};
type Entry={id:string;work_date:string;minutes:number;billable:number;description:string;status:string;version:number;created_by:string;reviewed_by:string|null;daily_cost_idr:number};
const control='min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export default function TimesheetsPage(){
 const [projects,setProjects]=useState<Project[]>([]),[project,setProject]=useState(''),[allocations,setAllocations]=useState<Allocation[]>([]),[items,setItems]=useState<Entry[]>([]);
 const [allocation,setAllocation]=useState(''),[date,setDate]=useState(''),[minutes,setMinutes]=useState(480),[billable,setBillable]=useState(true),[description,setDescription]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reviewer,setReviewer]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[reviewNotes,setReviewNotes]=useState('');
 const load=useCallback(async(id:string)=>{
  const r=await fetch('/api/psa/timesheets'+(id?'?project_id='+encodeURIComponent(id):''),{cache:'no-store',credentials:'same-origin'});
  const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Gagal memuat timesheet');
  setProjects(j.projects||[]);setAllocations(j.allocations||[]);setItems(j.items||[]);setReviewer(j.reviewer===true);
 },[]);
 useEffect(()=>{void load(project).catch(e=>setError(String(e))).finally(()=>setLoading(false));},[load,project]);
 const action=async(payload:Record<string,unknown>)=>{
  setBusy(true);setError('');setMessage('');try{
   const r=await fetch('/api/psa/timesheets',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Penyimpanan gagal');
   setMessage(payload.action==='submit'?'Jam kerja disimpan dan menunggu review.':'Keputusan review tersimpan.');await load(project);
   if(payload.action==='submit')setDescription('');
  }catch(e){setError(e instanceof Error?e.message:'Penyimpanan gagal');}finally{setBusy(false);}
 };
 return <main className="mx-auto max-w-6xl space-y-5 pb-20">
  <header className="rounded-2xl bg-gradient-to-r from-slate-950 to-indigo-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-cyan-200">PSA · Workforce</p><h1 className="mt-2 text-2xl font-bold">Timesheet Proyek</h1><p className="mt-2 text-sm text-slate-200">Catat waktu pada alokasi aktif. Finance atau Approver meninjau secara independen; biaya belum diposting ke GL.</p></header>
  {loading&&<p role="status">Memuat daftar proyek…</p>}{error&&<p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}{message&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
  <label className="block text-sm font-semibold">Proyek <select className={'mt-2 '+control} value={project} onChange={e=>{setProject(e.target.value);setAllocation('');}}><option value="">Pilih proyek</option>{projects.map(p=><option key={p.id} value={p.id}>{p.title} · {p.status}</option>)}</select></label>
  {project&&<>
   {allocations.length>0&&<form onSubmit={e=>{e.preventDefault();void action({action:'submit',project_id:project,allocation_id:allocation,work_date:date,minutes,billable,description});}} className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
    <h2 className="sm:col-span-2 font-bold">Ajukan jam kerja</h2>
    <label className="text-sm">Alokasi aktif<select required className={'mt-1 '+control} value={allocation} onChange={e=>setAllocation(e.target.value)}><option value="">Pilih alokasi sendiri</option>{allocations.map(a=><option key={a.id} value={a.id}>{a.display_name} · {a.allocation_month} · {a.person_days} mandays</option>)}</select></label>
    <label className="text-sm">Tanggal kerja<input required className={'mt-1 '+control} type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label className="text-sm">Menit kerja (kelipatan 15; maks. 480)<input required className={'mt-1 '+control} type="number" min="15" max="480" step="15" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={billable} onChange={e=>setBillable(e.target.checked)}/>Billable</label>
    <label className="sm:col-span-2 text-sm">Keterangan pekerjaan<textarea required minLength={12} maxLength={1000} className={'mt-1 '+control} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <button disabled={busy||!allocation} className="min-h-11 rounded-xl bg-indigo-800 px-5 text-sm font-bold text-white disabled:opacity-50">Simpan dan ajukan review</button>
   </form>}
   <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Riwayat kerja ({items.length})</h2>
    {reviewer&&<label className="mt-4 block text-sm">Catatan review (minimal 12 karakter)<textarea className={'mt-1 '+control} maxLength={1000} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)}/></label>}
    <div className="mt-4 space-y-3">{items.map(t=><article key={t.id} className="rounded-xl border p-4 text-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{t.work_date} · {t.minutes/60} jam · {t.billable?'Billable':'Nonbillable'}</p><p className="text-slate-600">{t.description}</p><p className="mt-1 text-xs text-slate-500">{t.created_by} · {t.status} · v{t.version}{t.reviewed_by?' · reviewer '+t.reviewed_by:''}</p></div>{reviewer&&t.status==='submitted'&&<div className="flex gap-2"><button type="button" disabled={busy||reviewNotes.trim().length<12} onClick={()=>void action({action:'review',id:t.id,version:t.version,approve:true,notes:reviewNotes})} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white disabled:opacity-50">Setujui</button><button type="button" disabled={busy||reviewNotes.trim().length<12} onClick={()=>void action({action:'review',id:t.id,version:t.version,approve:false,notes:reviewNotes})} className="min-h-10 rounded-lg border border-rose-300 px-3 text-xs font-bold text-rose-700 disabled:opacity-50">Tolak</button></div>}</div></article>)}{items.length===0&&<p className="text-sm text-slate-500">Belum ada catatan untuk proyek ini.</p>}</div>
   </section>
  </>}
 </main>;
}
