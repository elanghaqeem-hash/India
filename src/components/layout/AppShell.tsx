'use client';

import React,{useCallback,useEffect,useState} from 'react';
import {Navbar} from './Navbar';
import {Sidebar} from './Sidebar';
import {MobileNav} from './MobileNav';
import {AIWorkbench} from '@/components/ai/AIWorkbench';

interface AppShellProps { children:React.ReactNode; }
type Identity={email:string;role:string};
type Session={status:'checking'|'ready'|'denied';identity:Identity|null};

/** Authenticated role comes only from Cloudflare Access + D1 membership.
 * No hardcoded user identities, selectable security roles, or fake approval counts.
 */
export const AppShell:React.FC<AppShellProps> = ({children})=>{
  const [session,setSession]=useState<Session>({status:'checking',identity:null});
  const [pendingApprovalsCount,setPendingApprovalsCount]=useState<number|null>(null);
  const [desktopMenuOpen,setDesktopMenuOpen]=useState(true);
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const [menuPreferenceLoaded,setMenuPreferenceLoaded]=useState(false);

  useEffect(()=>{
    try {
      const saved=window.localStorage.getItem('india:right-navigation-open');
      if(saved==='true'||saved==='false')setDesktopMenuOpen(saved==='true');
    } catch {/* Local storage is optional, including in privacy mode. */}
    setMenuPreferenceLoaded(true);
  },[]);
  useEffect(()=>{
    if(!menuPreferenceLoaded)return;
    try {window.localStorage.setItem('india:right-navigation-open',String(desktopMenuOpen));}
    catch {/* Keep the menu usable when storage is unavailable. */}
  },[desktopMenuOpen,menuPreferenceLoaded]);

  const onToggleMenu=useCallback(()=>{
    if(window.matchMedia('(min-width: 1024px)').matches)setDesktopMenuOpen(value=>!value);
    else setMobileMenuOpen(value=>!value);
  },[]);
  const onCloseMenu=useCallback(()=>{
    if(window.matchMedia('(min-width: 1024px)').matches)setDesktopMenuOpen(false);
    else setMobileMenuOpen(false);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/sales/identity',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async res=>{
        if(!res.ok)throw Error('Sesi Cloudflare Access / D1 belum dapat diverifikasi.');
        const data=await res.json();
        if(data.success!==true||typeof data.identity?.role!=='string'||typeof data.identity?.email!=='string')
          throw Error('Identitas tidak valid');
        if(!controller.signal.aborted)setSession({status:'ready',identity:data.identity});
      })
      .catch(()=>{if(!controller.signal.aborted)setSession({status:'denied',identity:null});});
    return ()=>controller.abort();
  },[]);
  // The bell count is real, role-scoped D1 data, or null when not verified. Never assume zero on failure.
  useEffect(()=>{
    if(session.status!=='ready'){setPendingApprovalsCount(null);return;}
    const controller=new AbortController();
    const refresh=async()=>{
      try{
        const response=await fetch('/api/sales/approval-queue',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal});
        const data=await response.json();
        if(!response.ok||data.success!==true||!Array.isArray(data.items))throw Error('Approval queue unavailable');
        if(!controller.signal.aborted)setPendingApprovalsCount(data.items.length);
      }catch{if(!controller.signal.aborted)setPendingApprovalsCount(null);}
    };
    void refresh();
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh();};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{controller.abort();document.removeEventListener('visibilitychange',onVisible);};
  },[session.status]);
  const role=session.status==='ready'?session.identity?.role??null:null;
  return (
    <div className="flex min-h-screen min-w-0 max-w-full flex-col bg-slate-50 text-slate-900">
      <Navbar role={role} email={session.identity?.email??null} pendingApprovalsCount={pendingApprovalsCount} onToggleMenu={onToggleMenu} desktopMenuOpen={desktopMenuOpen} mobileMenuOpen={mobileMenuOpen}/>
      <div role="status" className="no-print border-b border-slate-200 bg-slate-100 px-4 py-2 text-center text-xs font-medium text-slate-700">
        {session.status==='checking'?'Memverifikasi sesi Cloudflare Access…':
         session.status==='ready'? `Sesi terverifikasi · Role: ${role}`:
         'Sesi belum terverifikasi. Fitur transaksi memerlukan Cloudflare Access dan skema D1 yang sesuai.'}
      </div>
      <div className="flex min-w-0 flex-1 overflow-hidden print:block print:overflow-visible">
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip overflow-y-auto px-3 pb-28 pt-4 sm:p-6 lg:p-8 print:max-w-none print:overflow-visible print:p-0">
          {role&&<AIWorkbench/>}
          {children}
        </main>
        {role&&<Sidebar role={role} desktopOpen={desktopMenuOpen} mobileOpen={mobileMenuOpen} onClose={onCloseMenu}/>}
      </div>
      {role&&<MobileNav role={role}/>}
    </div>
  );
};
