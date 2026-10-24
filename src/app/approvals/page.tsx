'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Station={href:string;name:string;description:string;roles:readonly string[]};
type Task={id:string;kind:string;title:string;opportunity_id:string|null;created_at:string;href:string};
type Queue={items:Task[];truncated:boolean;generated_at:string;included_kinds:string[]};
const STATIONS:readonly Station[]=[
 {href:'/boq',name:'BoQ & Pricing Approval',description:'Review BoQ dan keputusan maker-checker pada dokumen D1.',roles:['admin','sales','presales','finance','approver','legal']},
 {href:'/sales/bid-readiness',name:'Tender Bid/No-Bid & Compliance',description:'Kelengkapan RKS/KAK, bukti asli dan keputusan reviewer independen.',roles:['admin','presales','approver','finance','legal']},
 {href:'/sales/award',name:'PO/SPK Finance & Legal',description:'Verifikasi dokumen asli dan review ganda sebelum Closed Won.',roles:['admin','sales','finance','approver','legal']},
 {href:'/sales/billing',name:'BAST, Invoice & Collection',description:'Approval Finance, alokasi pembayaran dan rekonsiliasi.',roles:['admin','finance','approver']},
 {href:'/sales/renewals',name:'Contract & Renewal',description:'Persetujuan kontrak dan perubahan masa layanan.',roles:['admin','sales','presales','finance','approver','legal']}
];
const LABELS:Record<string,string>={boq:'BoQ',tender_deadline:'Tender deadline',tender_checklist:'Tender checklist',award_finance:'PO Finance',award_legal:'PO Legal',feasibility:'Technical feasibility',invoice:'Invoice',payment:'Collection',contract:'Contract'};
export default function CanonicalApprovalLinks(){
 const [role,setRole]=useState<string|null>(null);
 const [state,setState]=useState<'checking'|'ready'|'denied'>('checking');
 const [queue,setQueue]=useState<Queue|null>(null);
 const [queueState,setQueueState]=useState<'loading'|'ready'|'error'>('loading');
 const [queueError,setQueueError]=useState('');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/sales/identity',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    if(!response.ok)throw Error('Tidak terautentikasi');
    const payload=await response.json();
    if(payload.success!==true||typeof payload.identity?.role!=='string')throw Error('Akses tidak tersedia');
    if(!controller.signal.aborted){setRole(payload.identity.role);setState('ready');}
   })
   .catch(()=>{if(!controller.signal.aborted)setState('denied');});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(state!=='ready')return;
  const controller=new AbortController();
  void fetch('/api/sales/approval-queue',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok||body.success!==true||!Array.isArray(body.items))throw Error(body.message||'Antrian D1 tidak dapat diverifikasi');
    if(!controller.signal.aborted){setQueue(body as Queue);setQueueState('ready');setQueueError('');}
   })
   .catch(e=>{if(!controller.signal.aborted){setQueue(null);setQueueState('error');setQueueError(e instanceof Error?e.message:'Antrian D1 belum tersedia');}});
  return ()=>controller.abort();
 },[state,refresh]);
 const available=STATIONS.filter(s=>role&&s.roles.includes(role));
 return <main className="mx-auto max-w-5xl space-y-5 pb-24">
  <header className="rounded-2xl border border-slate-200 bg-white p-5">
   <h1 className="text-xl font-bold text-slate-900">Approval Center · Canonical Workflows</h1>
   <p className="mt-2 text-sm text-slate-600">Antrian bersumber langsung dari transaksi D1 dan kewenangan reviewer. Setiap keputusan tetap harus diproses di modul asal dengan pengujian maker-checker, persyaratan bukti dan versi transaksi. Antrian ini belum mencakup seluruh jenis persetujuan enterprise.</p>
  </header>
  {state==='checking'&&<p role="status" className="text-sm">Memverifikasi identitas Cloudflare Access…</p>}
  {state==='denied'&&<p role="alert" className="rounded-lg border border-rose-200 p-4 text-sm text-rose-800">Sesi Access/D1 belum terverifikasi; tidak ada tindakan approval yang diizinkan.</p>}
  {state==='ready'&&<>
   <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Antrian persetujuan nyata">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <h2 className="text-sm font-bold text-slate-900">Menunggu review dari transaksi D1</h2>
     <button type="button" onClick={()=>{setQueue(null);setQueueState('loading');setRefresh(v=>v+1);}} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-indigo-700">Refresh</button>
    </div>
    {queueState==='loading'&&<p role="status" className="text-sm text-slate-600">Memuat status review dari D1…</p>}
    {queueState==='error'&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Antrian tidak dapat dibaca; bukan berarti tidak ada pekerjaan. {queueError}</p>}
    {queueState==='ready'&&queue&&<>
     <p className="text-xs text-slate-600">{queue.truncated?'Sedikitnya ':'Jumlah dalam cakupan antrian: '}{queue.items.length} item{queue.truncated?' (hasil dibatasi; bukan total keseluruhan)':''}. Data ditarik {queue.generated_at}.</p>
     {queue.items.length===0?<p role="status" className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">Tidak ada transaksi menunggu review pada kategori dan role yang sudah tercakup. Periksa modul asal untuk jenis approval lain.</p>:
      <div className="space-y-2">{queue.items.map(t=><article key={t.kind+':'+t.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
       <div className="min-w-0"><p className="text-xs font-semibold text-indigo-700">{LABELS[t.kind]||t.kind}</p><p className="break-words text-sm font-medium text-slate-900">{t.title}</p><p className="mt-1 text-[11px] text-slate-500">Referensi: {t.id}</p></div>
       <Link href={t.href} className="shrink-0 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700">Periksa di sumber →</Link>
      </article>)}</div>}
    </>}
   </section>
   <section className="grid gap-3 md:grid-cols-2" aria-label="Modul approval berizin">
    {available.map(s=><Link key={s.href} href={s.href} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500">
     <h2 className="text-sm font-bold text-slate-900">{s.name}</h2><p className="mt-2 text-xs text-slate-600">{s.description}</p><p className="mt-3 text-xs font-semibold text-indigo-700">Buka transaksi D1 →</p>
    </Link>)}
    {available.length===0&&<p role="status" className="rounded-xl border p-4 text-sm">Tidak ada workflow approval untuk role ini.</p>}
   </section>
  </>}
 </main>;
}
