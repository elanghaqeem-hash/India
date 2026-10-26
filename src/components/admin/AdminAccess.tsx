import React from 'react';
import Link from 'next/link';
import {headers} from 'next/headers';
import {authorizeBoQ} from '@/lib/boq-auth';

/** Server boundary: verify Access + active D1 membership before rendering children. */
export default async function AdminAccess({children}:{children:React.ReactNode}){
 const incoming=await headers();
 const auth=await authorizeBoQ(new Request('https://india.internal/api/admin/system',{headers:new Headers(incoming)}));
 if(!auth.ok||auth.identity.role!=='admin')return <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6">
  <h1 className="text-xl font-bold text-amber-950">Akses khusus Admin</h1>
  <p className="mt-2 text-sm text-amber-900">Registrasi user, parameter, opsi, dan API key hanya dapat dikelola oleh Admin aktif yang telah terverifikasi.</p>
  <Link href="/boq" className="mt-4 inline-block rounded-xl border bg-white px-4 py-3 text-sm font-semibold">Kembali ke workspace</Link>
 </section>;
 return <>{children}</>;
}
