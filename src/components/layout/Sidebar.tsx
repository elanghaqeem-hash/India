'use client';

import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ChevronDown, ShieldCheck} from 'lucide-react';
import {navigationForRole} from '@/lib/enterprise-navigation';

interface SidebarProps { role: string; }

/** Desktop UX only. API access is always enforced on the server. */
export const Sidebar:React.FC<SidebarProps> = ({role}) => {
  const pathname=usePathname();
  const groups=navigationForRole(role);
  return (
    <aside aria-label="Navigasi modul INDIA" className="no-print hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-indigo-700"/> INDIA Business Platform
        </div>
        <p className="mt-1 text-xs text-slate-500">Modul sesuai hak akses akun</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3">
        {groups.map(group => (
          <details key={group.id} className="group rounded-lg" defaultOpen={group.items.some(x=>x.href===pathname)||group.id==='workspace'}>
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
              <span>{group.label}</span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"/>
            </summary>
            <div className="mb-2 ml-2 space-y-0.5 border-l border-slate-200 pl-2">
              {group.items.map(link=>(
                <Link key={link.href} href={link.href} aria-current={pathname===link.href?'page':undefined}
                  className={`block rounded-md px-3 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${pathname===link.href?'bg-indigo-50 font-semibold text-indigo-800':'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
        ))}
        {groups.length===0 && <p className="px-3 py-4 text-xs text-amber-700">Belum ada modul yang dapat diakses oleh role ini. Hubungi Admin.</p>}
      </nav>
      <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-500">
        Data transaksi dan persetujuan tetap divalidasi melalui Cloudflare Access dan D1.
      </p>
    </aside>
  );
};
