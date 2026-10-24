'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {firstAccessibleHref} from '@/lib/enterprise-navigation';

type State='checking'|'denied'|'no-workspace';
/** The root is an identity-aware entry point, never a second CRM or KPI register. */
export default function IndiaHome(){
 const router=useRouter();
 const [state,setState]=useState<State>('checking');
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/sales/identity',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async response=>{
    if(!response.ok)throw Error('Akses belum terverifikasi');
    const payload=await response.json();
    if(payload.success!==true||typeof payload.identity?.role!=='string')throw Error('Identitas tidak valid');
    const target=firstAccessibleHref(payload.identity.role);
    if(!target){setState('no-workspace');return;}
    router.replace(target);
   })
   .catch(()=>{if(!controller.signal.aborted)setState('denied');});
  return ()=>controller.abort();
 },[router]);
 return <main className="mx-auto max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
  <h1 className="text-xl font-bold text-slate-900">INDIA · DefendIT360</h1>
  {state==='checking'&&<p role="status" className="text-sm text-slate-600">Memverifikasi Cloudflare Access dan keanggotaan D1 untuk membuka workspace sesuai role…</p>}
  {state==='denied'&&<div role="alert" className="space-y-2 text-sm text-rose-800"><p>Workspace tidak dapat dibuka. Sesi Cloudflare Access atau keanggotaan D1 belum terverifikasi. Tidak ada data demo yang ditampilkan.</p><Link href="/settings/system" className="underline">Bantuan Administrator</Link></div>}
  {state==='no-workspace'&&<p role="alert" className="text-sm text-amber-800">Identitas valid, tetapi belum memiliki modul yang diizinkan. Hubungi Administrator untuk memperoleh akses yang sesuai.</p>}
 </main>;
}
