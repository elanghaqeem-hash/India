'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Station={href:string;name:string;description:string;roles:readonly string[]};
const STATIONS:readonly Station[]=[
 {href:'/boq',name:'BoQ & Pricing Approval',description:'Review BoQ dan keputusan maker-checker pada dokumen D1.',roles:['admin','sales','presales','finance','approver','legal']},
 {href:'/sales/bid-readiness',name:'Tender Bid/No-Bid & Compliance',description:'Kelengkapan RKS/KAK, bukti asli dan keputusan reviewer independen.',roles:['admin','presales','approver','finance','legal']},
 {href:'/sales/award',name:'PO/SPK Finance & Legal',description:'Verifikasi dokumen asli dan review ganda sebelum Closed Won.',roles:['admin','sales','finance','approver','legal']},
 {href:'/sales/billing',name:'BAST, Invoice & Collection',description:'Approval Finance, alokasi pembayaran dan rekonsiliasi.',roles:['admin','finance','approver']},
 {href:'/sales/renewals',name:'Contract & Renewal',description:'Persetujuan kontrak dan perubahan masa layanan.',roles:['admin','sales','presales','finance','approver','legal']}
];
export default function CanonicalApprovalLinks(){
 const [role,setRole]=useState<string|null>(null);
 const [state,setState]=useState<'checking'|'ready'|'denied'>('checking');
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
 const available=STATIONS.filter(s=>role&&s.roles.includes(role));
 return <main className="mx-auto max-w-5xl space-y-5 pb-24">
  <header className="rounded-2xl border border-slate-200 bg-white p-5">
   <h1 className="text-xl font-bold text-slate-900">Approval Center · Canonical Workflows</h1>
   <p className="mt-2 text-sm text-slate-600">Setiap approval diproses di modul transaksi D1 terkait, bukan melalui daftar atau saldo approval simulasi. Antrian approval gabungan lintas modul belum tersedia; tidak ada hitungan pending yang direkayasa.</p>
  </header>
  {state==='checking'&&<p role="status" className="text-sm">Memverifikasi identitas Cloudflare Access…</p>}
  {state==='denied'&&<p role="alert" className="rounded-lg border border-rose-200 p-4 text-sm text-rose-800">Sesi Access/D1 belum terverifikasi; tidak ada tindakan approval yang diizinkan.</p>}
  {state==='ready'&&<section className="grid gap-3 md:grid-cols-2" aria-label="Modul approval berizin">
   {available.map(s=><Link key={s.href} href={s.href} className="rounded-xl border border-slate-200 bg-white p-5 hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500">
    <h2 className="text-sm font-bold text-slate-900">{s.name}</h2><p className="mt-2 text-xs text-slate-600">{s.description}</p><p className="mt-3 text-xs font-semibold text-indigo-700">Buka transaksi D1 →</p>
   </Link>)}
   {available.length===0&&<p role="status" className="rounded-xl border p-4 text-sm">Tidak ada workflow approval untuk role ini.</p>}
  </section>}
 </main>;
}
