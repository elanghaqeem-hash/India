'use client';
import React,{useEffect,useState} from 'react';
import Link from 'next/link';
import {UsersRound,SlidersHorizontal,ListChecks,KeyRound,ShieldCheck,ArrowRight,LockKeyhole} from 'lucide-react';
const actions=[
 {label:'Registrasi User',href:'/boq/users',desc:'Daftarkan email, tetapkan role, unit kerja, dan aktivasi akses.',icon:UsersRound},
 {label:'Parameter Sistem',href:'/settings/system',desc:'Kelola organisasi, approval, penomoran, integrasi, audit, dan monitoring.',icon:SlidersHorizontal},
 {label:'Registrasi Opsi',href:'/settings/options',desc:'Tambah dan kelola pilihan standar pada master dropdown INDIA.',icon:ListChecks},
 {label:'Registrasi API Key',href:'/settings/ai',desc:'Simpan key AI terenkripsi, atur prioritas provider, dan uji koneksi.',icon:KeyRound}
];
export default function AdministrationHome(){
 const [status,setStatus]=useState<'checking'|'allowed'|'denied'>('checking');
 const [error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void fetch('/api/admin/system',{signal:controller.signal,credentials:'same-origin',cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok||d.role!=='admin')throw Error(d.message||'Akses Admin diperlukan');setStatus('allowed');}).catch(e=>{if(!controller.signal.aborted){setStatus('denied');setError(e instanceof Error?e.message:'Akses ditolak');}});return()=>controller.abort();},[]);
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white sm:p-8"><div className="flex items-center gap-3"><div className="rounded-xl border border-white/20 bg-white/10 p-3"><ShieldCheck className="h-6 w-6 text-cyan-300"/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-200">INDIA · Technotama</p><h1 className="text-2xl font-extrabold sm:text-3xl">Pusat Administrasi</h1></div></div><p className="mt-4 max-w-2xl text-sm text-slate-200">Registrasi pengguna, parameter, opsi, dan API key dalam satu menu. Hanya untuk Administrator dengan sesi Cloudflare Access serta role Admin aktif di D1.</p></header>
  {status==='checking'&&<p className="rounded-xl border bg-white p-5 text-sm">Memverifikasi izin Administrator...</p>}
  {status==='denied'&&<div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900"><LockKeyhole className="h-5 w-5 shrink-0"/><p>{error}</p></div>}
  {status==='allowed'&&<><div className="grid gap-4 sm:grid-cols-2">{actions.map(x=>{const Icon=x.icon;return <Link href={x.href} key={x.href} className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"><div className="rounded-xl bg-indigo-50 p-3 text-indigo-800"><Icon className="h-6 w-6"/></div><div className="min-w-0 flex-1"><h2 className="text-base font-bold text-slate-900">{x.label}</h2><p className="mt-2 text-xs leading-relaxed text-slate-600">{x.desc}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-700">Buka menu <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></span></div></Link>;})}</div><p className="rounded-xl border bg-slate-100 p-4 text-xs text-slate-600">Perubahan parameter tertentu membutuhkan persetujuan Admin reviewer yang berbeda. API key tidak ditampilkan kembali setelah disimpan. Aktivasi user di INDIA tidak otomatis mengubah kebijakan login Cloudflare Access.</p></>}
 </main>;
}
