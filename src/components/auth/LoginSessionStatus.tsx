'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight, CheckCircle2, RefreshCw, ShieldAlert} from 'lucide-react';
import {firstAccessibleHref} from '@/lib/enterprise-navigation';

type Session =
  | {status:'checking'}
  | {status:'signed-out'}
  | {status:'forbidden'}
  | {status:'unavailable'}
  | {status:'no-workspace';email:string;role:string}
  | {status:'ready';email:string;role:string;href:string};

/**
 * Read-only session display. The identity endpoint independently verifies
 * Cloudflare JWT + D1 membership. The browser never chooses its own role.
 * The login CTA remains a normal same-origin navigation to the Access-protected app.
 */
export function LoginSessionStatus() {
  const [session,setSession]=useState<Session>({status:'checking'});
  const [attempt,setAttempt]=useState(0);

  useEffect(()=>{
    const controller=new AbortController();
    async function check(){
      try{
        const response=await fetch('/api/sales/identity',{
          method:'GET',credentials:'same-origin',cache:'no-store',
          headers:{Accept:'application/json'},signal:controller.signal,
        });
        if(!response.ok){
          if(!controller.signal.aborted)setSession({
            status:response.status===401?'signed-out':response.status===403?'forbidden':'unavailable',
          });
          return;
        }
        if(!(response.headers.get('content-type')||'').includes('application/json'))
          throw new Error('Expected JSON response');
        const body=await response.json();
        if(body.success!==true || typeof body.identity?.role!=='string'
           || typeof body.identity?.email!=='string')
          throw new Error('Invalid identity');
        const role=body.identity.role,email=body.identity.email;
        const href=firstAccessibleHref(role);
        if(!controller.signal.aborted)setSession(href?{status:'ready',email,role,href}:{status:'no-workspace',email,role});
      }catch{
        if(!controller.signal.aborted)setSession({status:'unavailable'});
      }
    }
    void check();
    return ()=>controller.abort();
  },[attempt]);

  return (
    <div aria-live="polite" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status sesi pengguna</p>
        <button type="button" disabled={session.status==='checking'}
          onClick={()=>{setSession({status:'checking'});setAttempt(value=>value+1);}}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Periksa ulang
        </button>
      </div>
      {session.status==='checking'&&
        <p role="status" className="mt-2 text-sm text-slate-600">Memeriksa sesi Cloudflare Access dan keanggotaan INDIA…</p>}
      {session.status==='signed-out'&&
        <p role="status" className="mt-2 text-sm text-slate-600">Belum login. Gunakan tombol masuk di bawah untuk melanjutkan verifikasi akun.</p>}
      {session.status==='forbidden'&&
        <div role="alert" className="mt-2 flex items-start gap-2 text-sm text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Identitas belum diizinkan membuka INDIA. Administrator perlu memeriksa registrasi, status aktif dan role akun.</span>
        </div>}
      {session.status==='unavailable'&&
        <p role="status" className="mt-2 text-sm text-slate-600">
          Status sesi belum dapat dipastikan. Anda tetap dapat masuk melalui Cloudflare Access; pemeriksaan ulang tersedia di atas.
        </p>}
      {session.status==='no-workspace'&&
        <div role="alert" className="mt-2 text-sm text-amber-800">
          Akun <span className="break-all font-semibold">{session.email}</span> terverifikasi, tetapi belum memiliki menu untuk role {session.role}. Hubungi Administrator INDIA.
        </div>}
      {session.status==='ready'&&
        <div className="mt-2 space-y-3">
          <div className="flex items-start gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">Sesi terverifikasi</p>
              <p className="break-all text-xs text-slate-600">{session.email} · Role: {session.role}</p>
            </div>
          </div>
          <Link href={session.href} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
            Buka workspace sesuai role <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>}
    </div>
  );
}
