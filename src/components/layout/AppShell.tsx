'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { SystemRole } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<SystemRole>('sales');
  const [pendingCount] = useState<number>(1);
  const pathname = usePathname();
  const isD1Page = pathname.startsWith('/marketing/leads') || pathname.startsWith('/sales/pipeline') || pathname.startsWith('/boq');

  return (
    <div className="flex min-h-screen min-w-0 max-w-full flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingApprovalsCount={pendingCount}
      />
      <div role="status" className="no-print border-b border-slate-200">
        <div className={isD1Page
          ? "bg-blue-50 px-4 py-2 text-center text-xs font-medium leading-relaxed text-blue-900"
          : "bg-amber-50 px-4 py-2 text-center text-xs font-medium leading-relaxed text-amber-900"}>
          {isD1Page
            ? "Modul transaksi D1: penyimpanan dan hak akses mengikuti akun Cloudflare Access, bukan pilihan role pada header. Memerlukan migrasi database sebelum dapat digunakan."
            : "Pratinjau India (DEMO) — data contoh; API demo nonpersisten masih dinonaktifkan. Gunakan menu Marketing Leads / Sales Pipeline / BoQ untuk transaksi D1."}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 overflow-hidden print:block print:overflow-visible">
        <Sidebar pendingApprovalsCount={pendingCount} />
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip overflow-y-auto px-3 pb-28 pt-4 sm:p-6 lg:p-8 print:max-w-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
      <MobileNav pendingApprovalsCount={pendingCount} />
    </div>
  );
};
