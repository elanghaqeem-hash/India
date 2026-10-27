import type {Metadata} from 'next';
import Link from 'next/link';
import {ArrowRight, LockKeyhole, LogOut, ShieldCheck} from 'lucide-react';

export const metadata:Metadata={
  title:'Login INDIA | Technotama',
  description:'Masuk ke INDIA Business Management Platform dengan Cloudflare Access.',
};

/** Entry page for users. Access challenges may run before this page is served. */
export default function IndiaLoginPage(){
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-4 py-12 text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(79,70,229,0.35),transparent_45%),radial-gradient(circle_at_80%_85%,rgba(8,145,178,0.22),transparent_40%)]"/>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 shadow-lg" aria-hidden="true">
            <ShieldCheck className="h-7 w-7 text-cyan-300"/>
          </span>
          <div>
            <p className="text-xl font-extrabold tracking-tight text-slate-900">INDIA <span className="text-indigo-700">360</span></p>
            <p className="text-xs font-semibold text-slate-500">Technotama · Business Management Platform</p>
          </div>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Akses aman</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Login INDIA</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Masuk menggunakan identitas perusahaan yang diizinkan oleh Cloudflare Access. Hak akses menu mengikuti peran yang telah didaftarkan administrator INDIA.</p>
        <Link href="/" className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
          <LockKeyhole className="h-5 w-5" aria-hidden="true"/> Masuk dengan Cloudflare Access <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true"/>
        </Link>
        <a href="/cdn-cgi/access/logout" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
          <LogOut className="h-4 w-4" aria-hidden="true"/> Akhiri sesi / ganti akun
        </a>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs leading-5 text-slate-500">Tidak memiliki akses? Hubungi Administrator INDIA untuk registrasi email, role, dan unit kerja. INDIA tidak menyimpan password lokal.</p>
        </div>
      </div>
      <p className="absolute bottom-3 left-3 right-3 text-center text-[11px] text-slate-400">© Technotama · Secure Enterprise Access</p>
    </main>
  );
}
