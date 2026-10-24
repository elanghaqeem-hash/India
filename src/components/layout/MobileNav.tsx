'use client';

import React,{useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutGrid, Menu, X} from 'lucide-react';
import {navigationForRole} from '@/lib/enterprise-navigation';

interface MobileNavProps {role:string;}

/** All ten groups remain reachable on Android without a 29-item bottom bar. */
export const MobileNav:React.FC<MobileNavProps> = ({role}) => {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const groups=navigationForRole(role);
  const shortcuts=groups.filter(x=>x.items.length>0).slice(0,3);
  return (
    <>
      {open && (
        <div className="no-print fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 max-h-[min(70dvh,650px)] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl lg:hidden" role="dialog" aria-modal="false" aria-label="Seluruh menu INDIA">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Menu INDIA sesuai role</h2>
            <button type="button" onClick={()=>setOpen(false)} aria-label="Tutup menu" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200"><X className="h-5 w-5"/></button>
          </div>
          {groups.map(group=>(
            <section key={group.id} className="mb-3 border-b border-slate-100 pb-2">
              <h3 className="px-2 py-1 text-xs font-semibold text-slate-500">{group.label}</h3>
              <div className="grid grid-cols-2 gap-1">
                {group.items.map(link=>(
                  <Link key={link.href} href={link.href} onClick={()=>setOpen(false)}
                    aria-current={pathname===link.href?'page':undefined}
                    className={`rounded-lg px-3 py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${pathname===link.href?'bg-indigo-50 text-indigo-800':'text-slate-700 hover:bg-slate-50'}`}>
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {groups.length===0&&<p className="text-sm text-slate-700">Belum ada menu untuk role ini.</p>}
        </div>
      )}
      <nav aria-label="Navigasi utama mobile" className="no-print fixed inset-x-0 bottom-0 z-50 flex min-h-16 items-center justify-around border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.04)] backdrop-blur-md lg:hidden">
        {shortcuts.map(group=>{
          const link=group.items[0];
          return <Link key={group.id} href={link.href} onClick={()=>setOpen(false)} aria-current={pathname===link.href?'page':undefined}
            className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-center text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-indigo-500 ${pathname===link.href?'text-indigo-700':'text-slate-600'}`}>
            <LayoutGrid className="h-5 w-5" aria-hidden="true"/>
            <span className="max-w-full truncate">{group.label.replace(/^\d+ · /,'')}</span>
          </Link>;
        })}
        <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Buka seluruh menu INDIA"
          className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500">
          {open?<X className="h-5 w-5"/>:<Menu className="h-5 w-5"/>}
          Semua menu
        </button>
      </nav>
    </>
  );
};
