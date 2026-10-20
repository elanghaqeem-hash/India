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
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        pendingApprovalsCount={pendingCount}
      />
      <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium leading-relaxed text-amber-900">
        Pratinjau India (DEMO) — seluruh data adalah contoh, bukan data pelanggan sebenarnya. Fitur penyimpanan, transaksi dan API dinonaktifkan sampai keamanan serta database siap.
      </div>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar pendingApprovalsCount={pendingCount} />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
      <MobileNav pendingApprovalsCount={pendingCount} />
    </div>
  );
};
