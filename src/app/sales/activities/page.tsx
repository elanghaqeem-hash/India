'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {CalendarDays,Clock3,PhoneCall,MapPin,Users,AlertTriangle,CheckCircle2,Bell,ArrowRight} from 'lucide-react';
type Task={id:string;lead_id:string|null;opportunity_id:string|null;owner_email:string;kind:string;subject:string;detail:string;target_name:string;customer_name:string;start_at:string;due_at:string;status:string;revision:number;outcome:string};
type Event={id:string;task_id:string;action:string;actor_email:string;detail:string;at:string;subject:string;owner_email:string};
type SLA={lead_id:string;owner_email:string;account_name:string;lead_number:string;response_due_at:string;first_response_at:string|null};
type Alert={alert_key:string;alert_type:string;message:string;read_at:string|null;created_at:string;recipient_email:string};
type Snapshot={role:string;identityEmail:string;tasks:Task[];events:Event[];slas:SLA[];alerts:Alert[];owners:{email:string;role:string}[];managers:{sales_email:string;manager_email:string}[];serverNow:string};
type Target={id:string;name:string;kind:'lead'|'opportunity';owner:string};
const kinds:Record<string,string>={visit:'Kunjungan',call:'Telepon',meeting:'Meeting',follow_up:'Follow-up'};
const statusName:Record<string,string>={scheduled:'Dijadwalkan',rescheduled:'Dijadwalkan ulang',completed:'Selesai',cancelled:'Dibatalkan'};
const input='min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 outline-none';
const asInstant=(v:string)=>new Date(/^\d{4}-\d{2}-\d{2} /.test(v)?v.replace(' ','T')+'Z':v);
const fmt=(v:string)=>new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(asInstant(v));
const localInput=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
async function call(method:'GET'|'POST'|'PATCH',path:string,body?:Record<string,unknown>){
 const r=await fetch(path,{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok||!data.success)throw Error(data.message||'Transaksi tidak berhasil');return data;
}
export default function SalesActivities(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[targets,setTargets]=useState<Target[]>([]);
 const [owner,setOwner]=useState(''),[tab,setTab]=useState<'next'|'calendar'|'overdue'|'timeline'|'alerts'|'manager'>('next');
 const [week,setWeek]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [target,setTarget]=useState(''),[kind,setKind]=useState('call'),[subject,setSubject]=useState(''),[detail,setDetail]=useState('');
 const [start,setStart]=useState(()=>localInput(new Date(Date.now()+3600000))),[due,setDue]=useState(()=>localInput(new Date(Date.now()+5400000)));
 const [outcomes,setOutcomes]=useState<Record<string,string>>({}),[managerSales,setManagerSales]=useState(''),[managerEmail,setManagerEmail]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const url='/api/sales/activities'+(owner?'?owner='+encodeURIComponent(owner):'');
   const a=await call('GET',url);
   const [l,d]=await Promise.all([call('GET','/api/marketing/leads'),call('GET','/api/sales?entity=deals')]);
   setSnapshot(a as Snapshot);
   setTargets([
    ...(l.leads||[]).filter((x:{status:string})=>!['converted','disqualified'].includes(x.status)).map((x:{id:string;lead_number:string;account_name:string;assigned_sales_email:string})=>({id:x.id,kind:'lead' as const,name:x.lead_number+' · '+x.account_name,owner:x.assigned_sales_email})),
    ...(d.deals||[]).filter((x:{stage:string})=>!['closed_won','closed_lost'].includes(x.stage)).map((x:{id:string;title:string;created_by:string})=>({id:x.id,kind:'opportunity' as const,name:x.title,owner:x.created_by}))
   ]);
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[owner]);
 useEffect(()=>{void refresh();},[refresh]);
 const run=async(f:()=>Promise<unknown>,ok:string)=>{
  setBusy(true);setMessage('');
  try{await f();setMessage(ok);await refresh();}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 };
 const create=(e:React.FormEvent)=>{e.preventDefault();
  const t=targets.find(x=>x.kind+':'+x.id===target);if(!t)return setMessage('Pilih Lead atau Opportunity terlebih dahulu');
  void run(()=>call('POST','/api/sales/activities',{action:'schedule',scope:t.kind,target_id:t.id,kind,subject,detail,start_at:new Date(start).toISOString(),due_at:new Date(due).toISOString()}),'Jadwal tersimpan di D1.');
 };
 const mutate=(t:Task,action:'complete'|'cancel'|'reschedule')=>{
  const outcome=outcomes[t.id]||'';
  if(action!=='reschedule'&&outcome.trim().length<3)return setMessage('Isi hasil atau alasan minimal 3 karakter.');
  void run(()=>call('PATCH','/api/sales/activities',{action,id:t.id,revision:t.revision,outcome,
   ...(action==='reschedule'?{start_at:new Date(start).toISOString(),due_at:new Date(due).toISOString()}:{})}),'Status aktivitas diperbarui.');
 };
 const now=Date.now(),tasks=(snapshot?.tasks||[]),open=tasks.filter(x=>x.status==='planned');
 const overdue=open.filter(x=>new Date(x.due_at).getTime()<=now),next=open.filter(x=>new Date(x.due_at).getTime()>now);
 const breached=(snapshot?.slas||[]).filter(x=>!x.first_response_at&&new Date(x.response_due_at).getTime()<=now);
 const monday=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7+week*7);return d;},[week]);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return d;});
 const dayKey=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const taskCard=(t:Task,actions=true)=><article key={t.id} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">{kinds[t.kind]||t.kind}</span>
   <span className="text-[11px] font-semibold text-slate-600">{fmt(t.start_at)} — {fmt(t.due_at)} WIB</span></div>
  <p className="mt-2 break-words text-sm font-bold text-slate-900">{t.subject}</p><p className="mt-1 break-words text-xs text-slate-600">{t.customer_name} · {t.target_name}</p>
  <p className="mt-1 break-all text-[11px] text-slate-500">Sales: {t.owner_email}</p>
  {t.detail&&<p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{t.detail}</p>}
  {actions&&t.status==='planned'&&<div className="mt-3 space-y-2 border-t pt-3">
   <textarea rows={2} aria-label={'Hasil atau alasan '+t.subject} className={input} placeholder="Hasil kontak, tindak lanjut, atau alasan pembatalan" value={outcomes[t.id]||''} onChange={e=>setOutcomes(x=>({...x,[t.id]:e.target.value}))}/>
   <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={()=>mutate(t,'complete')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Selesai</button>
    <button disabled={busy} onClick={()=>mutate(t,'reschedule')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">Jadwalkan ulang ke waktu pada form</button>
    <button disabled={busy} onClick={()=>mutate(t,'cancel')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Batalkan</button></div>
   </div>}
  <Link href={t.lead_id?'/sales/leads?lead_id='+encodeURIComponent(t.lead_id):'/sales/pipeline'} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700">Buka sumber data <ArrowRight size={13}/></Link>
 </article>;
 return <main className="min-w-0 space-y-5 pb-24">
  <header className="flex flex-wrap items-center justify-between gap-3"><div>
   <p className="text-xs font-extrabold uppercase tracking-wide text-blue-700">INDIA / Sales Execution</p>
   <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Activity & Follow-up Center</h1>
   <p className="mt-1 max-w-3xl text-xs text-slate-600">Jadwal Sales tersambung ke Lead dan Opportunity D1. SLA respons menggunakan waktu kalender (120 menit), notifikasi otomatis memerlukan Cloudflare Cron aktif.</p>
  </div><Link href="/sales/pipeline" className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700">Sales Pipeline →</Link></header>
  {message&&<div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{message}</div>}
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
   {([['Next Action',next.length,Clock3],['Overdue',overdue.length,AlertTriangle],['SLA Breached',breached.length,PhoneCall],['Notifikasi Baru',(snapshot?.alerts||[]).filter(x=>!x.read_at).length,Bell]] as const).map(([label,n,Icon])=>
    <div key={label} className="rounded-xl border bg-white p-3"><div className="flex items-center justify-between text-[11px] text-slate-600"><span>{label}</span><Icon size={17}/></div><p className="mt-2 text-2xl font-black tabular-nums">{n}</p></div>)}
  </div>
  <section className="rounded-xl border bg-white p-4">
   <div className="flex flex-wrap items-end gap-3"><div className="grow"><h2 className="text-sm font-bold">Jadwalkan Aktivitas</h2><p className="text-xs text-slate-500">Tanggal menggunakan zona perangkat; kalender tampil WIB (Asia/Jakarta).</p></div>
   {snapshot?.role==='admin'&&<label className="text-xs font-semibold">Kalender per Sales
    <select className={input} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Semua Sales</option>{snapshot.owners.filter(x=>x.role==='sales').map(x=><option key={x.email} value={x.email}>{x.email}</option>)}</select>
   </label>}</div>
   <form onSubmit={create} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <label className="text-xs font-semibold">Lead / Opportunity<select required className={input} value={target} onChange={e=>setTarget(e.target.value)}><option value="">Pilih target</option>{targets.filter(x=>!owner||x.owner===owner).map(x=><option key={x.kind+x.id} value={x.kind+':'+x.id}>{x.kind==='lead'?'Lead':'Opportunity'} · {x.name}</option>)}</select></label>
    <label className="text-xs font-semibold">Aktivitas<select className={input} value={kind} onChange={e=>setKind(e.target.value)}>{Object.entries(kinds).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label className="text-xs font-semibold">Subjek<input required minLength={3} maxLength={200} className={input} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
    <label className="text-xs font-semibold">Mulai<input required type="datetime-local" className={input} value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label className="text-xs font-semibold">Batas waktu / selesai<input required type="datetime-local" className={input} value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label className="text-xs font-semibold">Catatan<input maxLength={2000} className={input} value={detail} onChange={e=>setDetail(e.target.value)}/></label>
    <button disabled={busy||!snapshot||!target} type="submit" className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-3">Simpan Jadwal &amp; Reminder</button>
   </form>
  </section>
  <nav aria-label="Tampilan aktivitas" className="flex flex-wrap gap-2">
   {([['next','Next Action'],['calendar','Kalender'],['overdue','Overdue Queue'],['timeline','Activity Timeline'],['alerts','Pengingat & Eskalasi'],...(snapshot?.role==='admin'?[['manager','Sales Manager']]:[])] as string[][]).map(([key,label])=>
   <button key={key} onClick={()=>setTab(key as typeof tab)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(tab===key?'bg-slate-900 text-white':'border bg-white text-slate-700')}>{label}</button>)}
  </nav>
  {tab==='next'&&<section className="space-y-3"><h2 className="text-sm font-bold">Next Action · {next.length}</h2>
   {next.length===0?<p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Belum ada follow-up terjadwal.</p>:<div className="grid gap-3 md:grid-cols-2">{next.map(x=>taskCard(x))}</div>}</section>}
  {tab==='overdue'&&<section className="space-y-4">
   <h2 className="flex items-center gap-2 text-sm font-bold text-rose-700"><AlertTriangle size={16}/> Overdue Queue · {overdue.length} aktivitas / {breached.length} SLA Lead</h2>
   {breached.map(x=><article key={x.lead_id} className="rounded-xl border border-rose-200 bg-white p-3 text-xs">
    <b>Lead {x.lead_number} · {x.account_name}</b><p className="mt-1">Owner: {x.owner_email} · SLA {fmt(x.response_due_at)} WIB</p>
    <Link className="mt-2 inline-block font-bold text-blue-700" href={'/sales/leads?lead_id='+encodeURIComponent(x.lead_id)}>Buka Lead →</Link>
   </article>)}
   {overdue.length?<div className="grid gap-3 md:grid-cols-2">{overdue.map(x=>taskCard(x))}</div>:!breached.length&&<p className="text-sm text-slate-500">Tidak ada overdue pada filter ini.</p>}
  </section>}
  {tab==='calendar'&&<section className="rounded-xl border bg-white p-3 sm:p-4">
   <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={16}/> Kalender mingguan · WIB</h2>
    <div className="flex gap-2"><button className="rounded-lg border px-3 py-1 text-xs" onClick={()=>setWeek(x=>x-1)}>←</button><button className="rounded-lg border px-3 py-1 text-xs" onClick={()=>setWeek(0)}>Hari ini</button><button className="rounded-lg border px-3 py-1 text-xs" onClick={()=>setWeek(x=>x+1)}>→</button></div></div>
   <div className="grid min-w-0 gap-2 md:grid-cols-7">{days.map(d=>{
    const mine=tasks.filter(t=>dayKey(asInstant(t.start_at))===dayKey(d));
    return <div key={dayKey(d)} className="min-w-0 rounded-lg border bg-slate-50 p-2">
     <div className="mb-2 text-xs font-bold">{new Intl.DateTimeFormat('id-ID',{weekday:'short',day:'numeric',month:'short'}).format(d)}</div>
     <div className="space-y-2">{mine.map(t=><div key={t.id} className={'rounded-md bg-white p-2 text-[11px] shadow-sm '+(t.status!=='planned'?'opacity-50':'')}>
      <b className="block break-words">{t.subject}</b><span>{fmt(t.start_at)} WIB</span><p className="break-all text-slate-500">{t.owner_email}</p>
     </div>)}{!mine.length&&<span className="text-[11px] text-slate-400">—</span>}</div></div>;
   })}</div></section>}
  {tab==='timeline'&&<section className="space-y-3"><h2 className="text-sm font-bold">Activity Timeline · Riwayat D1</h2>
   {(snapshot?.events||[]).length===0?<p className="text-sm text-slate-500">Belum ada event aktivitas.</p>:
   <div className="space-y-2">{snapshot?.events.map(e=><div key={e.id} className="rounded-xl border bg-white p-3">
    <div className="flex flex-wrap justify-between gap-2 text-xs"><b>{statusName[e.action]||e.action} · {e.subject}</b><span className="text-slate-500">{fmt(e.at)} WIB</span></div>
    <p className="mt-1 text-xs text-slate-600">{e.detail}</p><p className="text-[11px] text-slate-400">{e.actor_email} · owner {e.owner_email}</p>
   </div>)}</div>}</section>}
  {tab==='alerts'&&<section className="space-y-3"><h2 className="text-sm font-bold">Reminder & Escalation Inbox</h2>
   {(snapshot?.alerts||[]).length===0?<p className="text-sm text-slate-500">Belum ada notifikasi. Aktivitas jatuh tempo dan SLA akan diproses scheduler bila Cron UAT/produksi telah diaktifkan.</p>:
    snapshot?.alerts.map(x=><div key={x.alert_key} className={'rounded-xl border p-3 '+(!x.read_at?'border-amber-200 bg-amber-50':'bg-white')}>
     <p className="text-xs font-bold">{x.alert_type.replaceAll('_',' ').toUpperCase()} · {x.message}</p>
     <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">{fmt(x.created_at)} WIB</span>
     {!x.read_at&&<button disabled={busy} onClick={()=>void run(()=>call('PATCH','/api/sales/activities',{action:'read_alert',alert_key:x.alert_key}),'Pengingat ditandai dibaca.')} className="rounded-lg border bg-white px-3 py-1 text-xs font-bold">Tandai dibaca</button>}</div>
    </div>)}</section>}
  {tab==='manager'&&snapshot?.role==='admin'&&<section className="max-w-2xl space-y-4 rounded-xl border bg-white p-4">
    <h2 className="flex items-center gap-2 text-sm font-bold"><Users size={17}/> Penetapan Sales Manager</h2>
    <p className="text-xs text-slate-600">Manager harus akun aktif dengan role Admin. Eskalasi masuk ke inbox in-app Manager setelah grace period. Jika belum dipetakan, Admin aktif menerima pemberitahuan.</p>
    <label className="block text-xs font-semibold">Sales<select className={input} value={managerSales} onChange={e=>setManagerSales(e.target.value)}><option value="">Pilih Sales</option>{snapshot.owners.filter(x=>x.role==='sales').map(x=><option key={x.email} value={x.email}>{x.email}</option>)}</select></label>
    <label className="block text-xs font-semibold">Sales Manager (Admin)<select className={input} value={managerEmail} onChange={e=>setManagerEmail(e.target.value)}><option value="">Pilih manager</option>{snapshot.owners.filter(x=>x.role==='admin').map(x=><option key={x.email} value={x.email}>{x.email}</option>)}</select></label>
    <button disabled={busy||!managerSales||!managerEmail} onClick={()=>void run(()=>call('POST','/api/sales/activities',{action:'assign_manager',sales_email:managerSales,manager_email:managerEmail}),'Pemetaan Sales Manager berhasil disimpan.')} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Simpan Pemetaan</button>
    <div className="space-y-1 text-xs text-slate-600">{snapshot.managers.map(x=><p key={x.sales_email}>{x.sales_email} → <b>{x.manager_email}</b></p>)}</div>
   </section>}
  <footer className="flex items-center gap-2 text-[11px] text-slate-500"><CheckCircle2 size={14}/> Data kegiatan tersimpan pada D1; tidak mengirim email eksternal secara otomatis.</footer>
 </main>;
}
