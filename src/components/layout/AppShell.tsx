'use client';

import React, { useState } from 'react';
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

  return (
    <div className="flex min-h-screen min-w-0 max-w-full flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingApprovalsCount={pendingCount}
      />
      <div role="status" className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium leading-relaxed text-amber-900">
        Pratinjau India (DEMO) — seluruh data adalah contoh, bukan data pelanggan sebenarnya. Fitur penyimpanan, transaksi dan API dinonaktifkan sampai keamanan serta database siap.
      </div>
      <div className="flex min-w-0 flex-1 overflow-hidden print:block print:overflow-visible">
        <Sidebar pendingApprovalsCount={pendingCount} />
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip overflow-y-auto p-3 pb-20 sm:p-6 lg:p-8 lg:pb-8 print:max-w-none print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
      <MobileNav pendingApprovalsCount={pendingCount} />
    </div>
  );
};
