'use client';

import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {
  BriefcaseBusiness, Calculator, ChartNoAxesCombined, ChevronDown, ClipboardCheck,
  Handshake, LayoutDashboard, Megaphone, PanelLeftClose, Search, Settings2,
  ShieldCheck, UsersRound, WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {navigationForRole} from '@/lib/enterprise-navigation';

interface SidebarProps {
  role: string;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onClose: () => void;
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  workspace: LayoutDashboard,
  marketing: Megaphone,
  crm: UsersRound,
  presales: ClipboardCheck,
  commercial: Calculator,
  delivery: BriefcaseBusiness,
  cash: WalletCards,
  partners: Handshake,
  reporting: ChartNoAxesCombined,
  governance: ShieldCheck,
  administration: Settings2,
};

function NavigationContent({role, onClose, onNavigate, mobile}:{
  role:string; onClose:()=>void; onNavigate:()=>void; mobile:boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const groups = navigationForRole(role);
  const totalMenus = groups.reduce((total, group) => total + group.items.length, 0);
  const term = query.trim().toLocaleLowerCase('id');
  const filtered = groups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      !term || group.label.toLocaleLowerCase('id').includes(term)
      || item.label.toLocaleLowerCase('id').includes(term)),
  })).filter(group => group.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 px-5 pb-5 pt-5 text-white">
        <div className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-cyan-400/10 blur-2xl"/>
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-inner">
              <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true"/>
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">Technotama</p>
              <h2 className="text-base font-extrabold tracking-tight">INDIA Navigation</h2>
              <p className="text-[11px] text-slate-300">Menu lengkap sesuai hak akses</p>
            </div>
          </div>
          <button type="button" onClick={onClose} autoFocus={mobile}
            aria-label="Sembunyikan sidebar kiri" title="Sembunyikan sidebar kiri"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <PanelLeftClose className="h-4 w-4" aria-hidden="true"/>
          </button>
        </div>
        <div className="relative mt-5 flex items-center justify-between gap-2">
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold text-cyan-100">{groups.length} kelompok · {totalMenus} menu</span>
          <span className="text-[10px] font-medium text-slate-300">Role: {role}</span>
        </div>
      </div>
      <div className="shrink-0 border-b border-slate-100 px-4 py-4">
        <label htmlFor={mobile?'india-menu-search-mobile':'india-menu-search-desktop'}
          className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cari menu</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true"/>
          <input id={mobile?'india-menu-search-mobile':'india-menu-search-desktop'} type="search"
            value={query} onChange={event=>setQuery(event.target.value)}
            placeholder="Cari modul atau fitur…" autoComplete="off"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"/>
        </div>
      </div>
      <nav aria-label="Daftar modul INDIA" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-4">
        {filtered.map(group=>{
          const Icon = GROUP_ICONS[group.id] || LayoutDashboard;
          const activeGroup = group.items.some(item=>pathname===item.href || pathname.startsWith(item.href+'/'));
          return (
            <details key={group.id+':'+(term?'search':'default')} open={Boolean(term)||activeGroup||group.id==='workspace'}
              className="group rounded-2xl border border-transparent bg-white open:border-slate-100 open:bg-slate-50/80">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 group-open:bg-indigo-100">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true"/>
                </span>
                <span className="min-w-0 flex-1 leading-snug">{group.label.replace(/^\d+ · /,'')}</span>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] text-slate-400">{group.items.length}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true"/>
              </summary>
              <div className="mb-2 ml-7 space-y-1 border-l-2 border-indigo-100 pl-3 pr-2">
                {group.items.map(item=>{
                  const active=pathname===item.href || pathname.startsWith(item.href+'/');
                  return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}
                      aria-current={active?'page':undefined}
                      className={['relative flex min-h-10 items-center rounded-lg px-3 py-2 text-xs leading-snug transition focus-visible:outline-2 focus-visible:outline-indigo-500',
                        active?'bg-gradient-to-r from-indigo-100 to-blue-50 font-bold text-indigo-900 shadow-sm before:absolute before:-left-[14px] before:h-6 before:w-0.5 before:rounded before:bg-indigo-600':'font-medium text-slate-600 hover:bg-white hover:text-indigo-800'].join(' ')}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        })}
        {filtered.length===0&&(
          <div role="status" className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-600">
            {groups.length===0?'Belum ada modul untuk role ini. Hubungi Admin.':'Menu tidak ditemukan. Coba kata kunci lain.'}
            {term&&<button type="button" onClick={()=>setQuery('')} className="mt-3 block w-full font-semibold text-indigo-700 underline">Hapus pencarian</button>}
          </div>
        )}
      </nav>
      <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <p className="text-[11px] font-semibold text-slate-600">INDIA · Integrated Business Platform</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">Akses menu mengikuti role yang diverifikasi melalui Cloudflare Access dan D1.</p>
      </div>
    </div>
  );
}

/** Left-hand navigation. Menus use the canonical role-scoped route catalog. */
export const Sidebar:React.FC<SidebarProps> = ({role,desktopOpen,mobileOpen,onClose}) => {
  useEffect(()=>{
    if(!mobileOpen)return;
    const before=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const onEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    window.addEventListener('keydown',onEscape);
    return ()=>{document.body.style.overflow=before;window.removeEventListener('keydown',onEscape);};
  },[mobileOpen,onClose]);

  return (
    <>
      <div className={['no-print hidden shrink-0 overflow-hidden border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:block',
        desktopOpen?'w-80 border-r':'w-0'].join(' ')}>
        {desktopOpen&&(
          <aside id="india-left-sidebar-desktop" aria-label="Navigasi modul INDIA"
            className="sticky top-0 h-[calc(100dvh-4rem)] w-80 overflow-hidden">
            <NavigationContent role={role} onClose={onClose} onNavigate={()=>{}} mobile={false}/>
          </aside>
        )}
      </div>
      {mobileOpen&&(
        <div className="no-print fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="Tutup navigasi INDIA" onClick={onClose}
            className="absolute inset-0 h-full w-full bg-slate-950/55 backdrop-blur-[2px]"/>
          <aside id="india-left-sidebar-mobile" role="dialog" aria-modal="true" aria-label="Navigasi modul INDIA"
            className="absolute inset-y-0 left-0 h-[100dvh] w-[min(22rem,90vw)] overflow-hidden border-r border-white/20 bg-white shadow-2xl">
            <NavigationContent role={role} onClose={onClose} onNavigate={onClose} mobile={true}/>
          </aside>
        </div>
      )}
    </>
  );
};
