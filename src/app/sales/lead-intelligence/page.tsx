'use client';
import React,{useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,BarChart3,CalendarClock,CheckCircle2,RefreshCcw,ShieldAlert,Target} from 'lucide-react';
type Row={id:string;lead_number:string;account_name:string;status:string;source:string;campaign:string;version:number;
 assigned_sales_email:string;score:number;temperature:'Hot'|'Warm'|'Cold';policy_version:string;
 breakdown:{bant:number;fit:number;engagement:number};explanation:string[];
 reason_code?:string|null;reason_text?:string|null;nurture_state?:string|null;next_touch_at?:string|null;plan_version?:number|null;
 cadence_days?:number|null;nurture_channel?:string|null};
type Metric={label:string;total:number;converted?:number;won?:number};
type Overview={total:number;qualified:number;converted:number;won:number;disqualified:number};
type Analysis={overall:Overview;by_source:Metric[];by_owner:Metric[];by_reason:Metric[];definition:string};
type Detail={plan?:{version:number;cadence_days:number;channel:string;state:string;next_touch_at:string;touch_count:number}|null;
 events:{event_type:string;detail:string;actor_email:string;created_at:string}[]};
const reasons:Record<string,string>={
 NO_BUDGET:'Budget belum tersedia',NO_AUTHORITY:'Pengambil keputusan belum jelas',TIMING_LATER:'Belum siap membeli',
 NO_FIT:'Produk/layanan tidak sesuai',NO_RESPONSE:'Tidak ada respons',DUPLICATE:'Lead duplikat',
 INVALID_CONTACT:'Kontak tidak valid',OTHER:'Alasan lainnya',LEGACY_UNCLASSIFIED:'Alasan lama belum diklasifikasi'
};
const soft=new Set(['NO_BUDGET','TIMING_LATER','NO_RESPONSE']);
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none';
const pill=(t:string)=>t==='Hot'?'bg-red-50 text-red-700':t==='Warm'?'bg-amber-50 text-amber-800':'bg-blue-50 text-blue-700';
const rate=(n:number,d:number)=>d?((n/d)*100).toFixed(1)+'%':'0%';
const today=()=>new Date().toLocaleDateString('en-CA');
async function request(method:'GET'|'POST',url:string,data?:Record<string,unknown>){
 const res=await fetch(url,{method,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
 const json=await res.json();
 if(!res.ok||!json.success)throw Error(json.message||'Permintaan gagal');
 return json;
}
export default function LeadIntelligence(){
 const [rows,setRows]=useState<Row[]>([]),[overview,setOverview]=useState<Analysis|null>(null);
 const [selected,setSelected]=useState<Row|null>(null),[detail,setDetail]=useState<Detail|null>(null);
 const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[reason,setReason]=useState('TIMING_LATER');
 const [reasonText,setReasonText]=useState(''),[cadence,setCadence]=useState(30),[channel,setChannel]=useState('follow_up');
 const [nextDate,setNextDate]=useState(today()),[touchNotes,setTouchNotes]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async(id?:string)=>{
  const [q,a]=await Promise.all([request('GET','/api/marketing/lead-intelligence?mode=queue'),
   request('GET','/api/marketing/lead-intelligence?mode=analytics')]);
  setRows(q.leads||[]);setOverview(a);
  if(id){
   const match=(q.leads as Row[]).find(x=>x.id===id)||null;setSelected(match);
   if(match){
    const d=await request('GET','/api/marketing/lead-intelligence?mode=detail&id='+encodeURIComponent(id));
    setDetail(d);
    if(d.plan){setCadence(d.plan.cadence_days);setChannel(d.plan.channel);setNextDate(d.plan.next_touch_at);}
    else{setCadence(match.temperature==='Hot'?7:match.temperature==='Warm'?14:30);setChannel('follow_up');setNextDate(today());}
   }
  }
 },[]);
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[load]);
 const pick=async(x:Row)=>{
  setSelected(x);setDetail(null);setReasonText('');
  try{const d=await request('GET','/api/marketing/lead-intelligence?mode=detail&id='+encodeURIComponent(x.id));setDetail(d);
   setCadence(d.plan?.cadence_days??(x.temperature==='Hot'?7:x.temperature==='Warm'?14:30));
   setChannel(d.plan?.channel||'follow_up');setNextDate(d.plan?.next_touch_at||today());
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 };
 const run=async(action:string,payload:Record<string,unknown>={})=>{
  if(!selected)return;
  if(action==='disqualify'&&!window.confirm('Simpan reason code dan ubah status Lead menjadi Disqualified?'))return;
  setBusy(true);setMessage('');
  try{
   await request('POST','/api/marketing/lead-intelligence',{id:selected.id,version:selected.version,
    plan_version:detail?.plan?.version,action,...payload});
   await load(selected.id);setMessage('Transaksi '+action+' berhasil disimpan di D1 dan audit log.');
   if(action==='touch')setTouchNotes('');
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const filtered=useMemo(()=>rows.filter(x=>{
  const matches=filter==='all'||(filter==='due'&&x.nurture_state==='active'&&!!x.next_touch_at&&x.next_touch_at<=today())||
   (filter==='disqualified'&&x.status==='disqualified')||x.temperature===filter;
  return matches&&(x.account_name+' '+x.lead_number+' '+x.assigned_sales_email).toLowerCase().includes(search.toLowerCase());
 }),[rows,search,filter]);
 const due=rows.filter(x=>x.nurture_state==='active'&&x.next_touch_at&&x.next_touch_at<=today()).length;
 return <main className="min-w-0 space-y-5 pb-24 text-slate-900">
  <header className="flex flex-wrap items-center justify-between gap-3">
   <div><Link href="/sales/leads" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft size={14}/> Kembali ke Leads</Link>
    <h1 className="mt-2 flex items-center gap-2 text-xl font-extrabold sm:text-2xl"><Target size={22}/> Lead Intelligence</h1>
    <p className="mt-1 max-w-3xl text-xs text-slate-600">Skor terukur, nurturing tanpa pengiriman otomatis, alasan diskualifikasi dan reaktivasi. Status Qualified tetap tunduk pada BANT.</p>
   </div>
   <Link href="/sales/activities" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Sales Activity Timeline →</Link>
  </header>
  {message&&<div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">{message}</div>}
  <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
   {[
    ['Lead Tercatat',overview?.overall.total??0],['Hot (500 terbaru)',rows.filter(x=>x.temperature==='Hot').length],
    ['Nurture Due (500 terbaru)',due],['Converted',overview?.overall.converted??0],['Won',overview?.overall.won??0]
   ].map(([label,value])=><div key={label} className="min-w-0 rounded-xl border bg-white p-3">
     <div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 text-2xl font-black tabular-nums">{value}</div></div>)}
  </section>
  <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
   <section className="min-w-0 rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Lead Score & Nurture Queue</h2>
    <div className="mt-3 flex flex-wrap gap-2">
     {['all','Hot','Warm','Cold','due','disqualified'].map(s=><button type="button" key={s} onClick={()=>setFilter(s)}
      aria-pressed={filter===s} className={'rounded-md border px-3 py-1.5 text-xs '+(filter===s?'border-blue-500 bg-blue-50 text-blue-800':'text-slate-600')}>
      {s==='all'?'Semua':s==='due'?'Due':s==='disqualified'?'Disqualified':s}</button>)}
    </div>
    <input aria-label="Cari Lead" className={'mt-3 '+field} placeholder="Cari perusahaan / nomor / owner" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="mt-3 max-h-[720px] space-y-2 overflow-y-auto">
     {!filtered.length&&<p className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">Belum ada Lead sesuai filter.</p>}
     {filtered.map(x=><button key={x.id} type="button" onClick={()=>void pick(x)}
      className={'w-full rounded-xl border p-3 text-left hover:border-blue-300 '+(selected?.id===x.id?'border-blue-500 bg-blue-50':'bg-white')}>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0">
       <b className="block truncate text-sm">{x.account_name}</b><span className="text-[11px] text-slate-500">{x.lead_number} · {x.status}</span></div>
       <span className={'shrink-0 rounded-md px-2 py-1 text-xs font-bold '+pill(x.temperature)}>{x.score}/100 · {x.temperature}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
       <span>BANT {x.breakdown.bant}/60</span><span>Fit {x.breakdown.fit}/25</span><span>Aktivitas {x.breakdown.engagement}/15</span>
      </div>
      {x.next_touch_at&&<p className="mt-1 flex items-center gap-1 text-[11px]"><CalendarClock size={12}/> {x.nurture_state} · berikutnya {x.next_touch_at}</p>}
      {x.reason_code&&<p className="mt-1 text-[11px] text-rose-700">{reasons[x.reason_code]||x.reason_code}</p>}
     </button>)}
    </div><p className="mt-2 text-[10px] text-slate-500">Daftar dibatasi 500 Lead terbaru. Analitik menggunakan seluruh Lead yang berhak Anda lihat.</p>
   </section>
   <section className="min-w-0 space-y-4">
    {!selected?<div className="flex min-h-44 items-center justify-center rounded-xl border bg-white p-5 text-center text-sm text-slate-500">Pilih Lead untuk membuat Nurture Plan, mencatat aktivitas atau menilai reaktivasi.</div>:
    <div className="space-y-4 rounded-xl border bg-white p-4">
     <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-base font-bold">{selected.account_name}</h2>
      <p className="break-all text-xs text-slate-500">{selected.assigned_sales_email}</p></div>
      <Link className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-700" href={'/sales/leads?lead_id='+encodeURIComponent(selected.id)}>BANT / Convert →</Link></div>
     <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="font-semibold">Skor {selected.score} — {selected.temperature}</div>
      <p className="mt-1 text-xs text-slate-600">{selected.explanation.join(' · ')||'Informasi qualification belum cukup.'}</p></div>
     {selected.status!=='converted'&&selected.status!=='disqualified'&&
      <div className="space-y-2 border-t pt-3"><h3 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={15}/> Disqualification</h3>
       <label className="block text-xs font-semibold">Reason Code<select className={'mt-1 '+field} value={reason} onChange={e=>setReason(e.target.value)}>
        {Object.entries(reasons).filter(([k])=>k!=='LEGACY_UNCLASSIFIED').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
       <label className="block text-xs font-semibold">Alasan faktual<textarea className={'mt-1 '+field} rows={2} value={reasonText} onChange={e=>setReasonText(e.target.value)} placeholder="Alasan, informasi terakhir dan tindak lanjut"/></label>
       <p className="text-xs text-slate-500">{soft.has(reason)?'Reason ini dapat masuk nurturing dan diaktifkan kembali.':'Reason ini tidak bisa direaktivasi otomatis.'}</p>
       <button disabled={busy||reasonText.trim().length<3} onClick={()=>void run('disqualify',{reason_code:reason,reason_text:reasonText})}
        className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50">Disqualify dengan Reason Code</button>
      </div>}
     {selected.status==='disqualified'&&<div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
      <p className="text-xs text-rose-800">Reason: {reasons[selected.reason_code||'']||selected.reason_code||'Belum diklasifikasi'}. {selected.reason_text||''}</p>
      {soft.has(selected.reason_code||'')&&<button disabled={busy} onClick={()=>void run('reactivate')}
       className="mt-2 inline-flex items-center gap-1 rounded-md bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><RefreshCcw size={13}/> Reactivate → Assigned</button>}
     </div>}
     {['new','assigned','disqualified'].includes(selected.status)&&
      <div className="space-y-3 border-t pt-3">
       <h3 className="flex items-center gap-2 text-sm font-bold"><CalendarClock size={15}/> Nurture Plan</h3>
       <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Interval<select className={'mt-1 '+field} value={cadence} onChange={e=>setCadence(Number(e.target.value))}>
         {[7,14,30,60,90].map(n=><option key={n} value={n}>{n} hari</option>)}</select></label>
        <label className="text-xs font-semibold">Channel<select className={'mt-1 '+field} value={channel} onChange={e=>setChannel(e.target.value)}>
         {['follow_up','call','email','meeting'].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
        <label className="text-xs font-semibold sm:col-span-2">Tanggal berikutnya<input type="date" className={'mt-1 '+field} value={nextDate} onChange={e=>setNextDate(e.target.value)}/></label>
       </div>
       <p className="text-xs text-slate-500">Status: {detail?.plan?.state||'Belum dibuat'} · Touch tercatat: {detail?.plan?.touch_count||0}. Penjadwalan hanya untuk tindak lanjut manual, bukan email/WhatsApp otomatis.</p>
       <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={()=>void run('plan',{cadence_days:cadence,channel,next_touch_at:nextDate})}
         className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Simpan Plan</button>
        {detail?.plan?.state==='active'&&<button disabled={busy} onClick={()=>void run('pause')} className="rounded-lg border px-3 py-2 text-xs font-semibold">Pause</button>}
        {detail?.plan?.state==='paused'&&<button disabled={busy} onClick={()=>void run('resume',{next_touch_at:nextDate})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Resume</button>}
        {['active','paused'].includes(detail?.plan?.state||'')&&<button disabled={busy} onClick={()=>void run('complete')} className="rounded-lg border px-3 py-2 text-xs font-semibold">Complete</button>}
       </div>
       {detail?.plan?.state==='active'&&<div className="rounded-lg bg-slate-50 p-3">
        <label className="block text-xs font-semibold">Catatan touch aktual<textarea className={'mt-1 '+field} rows={2} value={touchNotes} onChange={e=>setTouchNotes(e.target.value)} placeholder="Apa yang dilakukan, tanpa mengarang respons pelanggan"/></label>
        <button disabled={busy||touchNotes.trim().length<3} onClick={()=>void run('touch',{summary:touchNotes,channel,cadence_days:cadence})}
         className="mt-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 disabled:opacity-50">Catat Touch dan Jadwalkan Berikutnya</button></div>}
      </div>}
     <div className="border-t pt-3"><h3 className="text-sm font-bold">Immutable Lifecycle History</h3>
      {!detail?<p className="mt-2 text-xs text-slate-500">Memuat histori...</p>:detail.events.length===0?<p className="mt-2 text-xs text-slate-500">Belum ada event nurturing.</p>:
       <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">{detail.events.map((x,i)=><div key={i} className="rounded-lg bg-slate-50 p-2 text-xs">
        <b>{x.event_type}</b> · {x.created_at}<p className="mt-1 break-words">{x.detail}</p><span className="text-slate-500">{x.actor_email}</span></div>)}</div>}
     </div>
    </div>}
   </section>
  </div>
  {overview&&<section className="space-y-4 rounded-xl border bg-white p-4">
   <h2 className="flex items-center gap-2 text-sm font-bold"><BarChart3 size={18}/> Conversion Analysis (seluruh Lead sesuai hak akses)</h2>
   <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {[
     ['Lead → Opportunity',rate(overview.overall.converted,overview.overall.total)],
     ['Opportunity → Won',rate(overview.overall.won,overview.overall.converted)],
     ['Lead → Won',rate(overview.overall.won,overview.overall.total)],
     ['Disqualification',rate(overview.overall.disqualified,overview.overall.total)]
    ].map(([title,value])=><div key={title} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{title}</p><p className="text-xl font-black">{value}</p></div>)}
   </div>
   <div className="grid gap-4 lg:grid-cols-3">
    {([['Sumber Lead',overview.by_source],['Sales Owner',overview.by_owner],['Reason Code',overview.by_reason]] as const).map(([title,items])=>
     <div key={title} className="min-w-0"><h3 className="mb-2 text-xs font-bold">{title}</h3>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs">
       <thead className="bg-slate-50"><tr><th className="p-2">Kategori</th><th className="p-2">Lead</th><th className="p-2">{title==='Reason Code'?'% Total':'Conv.'}</th></tr></thead>
       <tbody>{items.map(x=><tr key={x.label} className="border-t"><td className="break-words p-2">{reasons[x.label]||x.label}</td>
        <td className="p-2">{x.total}</td><td className="p-2">{rate(title==='Reason Code'?x.total:x.converted||0,title==='Reason Code'?overview.overall.total:x.total)}</td></tr>)}</tbody>
      </table></div>
     </div>)}
   </div><p className="text-xs text-slate-500">{overview.definition}</p>
  </section>}
  <p className="flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 size={14}/> Semua perubahan disimpan melalui Cloudflare Access dan D1 dengan version check; skor dihitung dari data aktual, bukan prediksi AI.</p>
 </main>;
}
