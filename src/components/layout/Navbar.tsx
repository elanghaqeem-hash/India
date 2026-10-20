'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Shield, Bell, UserCheck, Search, ChevronDown, CheckCircle2 } from 'lucide-react';
import { SystemRole } from '@/lib/types';

interface NavbarProps {
  currentRole: SystemRole;
  onRoleChange: (role: SystemRole) => void;
  pendingApprovalsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  pendingApprovalsCount = 1,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const roles: Array<{ role: SystemRole; label: string; badge: string }> = [
    { role: 'sales', label: 'M. Nadhil (Sales / AM)', badge: 'Maker' },
    { role: 'pre_sales', label: 'Hendri (Pre-Sales Eng)', badge: 'Solution & Pricing' },
    { role: 'head_sales', label: 'Reza Fahlevi (Head Sales)', badge: 'VP / Approver' },
    { role: 'management', label: 'Direktur Utama (Management)', badge: 'Director / Final' },
    { role: 'project_manager', label: 'Bambang (Project Manager)', badge: 'Delivery' },
    { role: 'client_maker', label: 'Budi Santoso (Klien Maker)', badge: 'Portal Klien' },
  ];

  const currentRoleInfo = roles.find(r => r.role === currentRole) || roles[0];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.01]">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 text-white shadow-md shadow-blue-500/20">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-slate-900 text-base sm:text-lg">ICOP</span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60">360</span>
              </div>
              <p className="hidden text-[10px] font-medium text-slate-500 sm:block -mt-1">
                DefendIT360 Enterprise OS
              </p>
            </div>
          </Link>
        </div>

        {/* Global Quick Search (Desktop) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari Customer, Opportunity, Quotation, Tender..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-normal text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
        </div>

        {/* Role Switcher & Notifications */}
        <div className="flex items-center gap-3">
          {/* Pending Approvals Notification Link */}
          <Link
            href="/approvals"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
            title="Pusat Otorisasi & Keputusan"
          >
            <Bell className="h-4 w-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                {pendingApprovalsCount}
              </span>
            )}
          </Link>

          {/* Interactive Role Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors focus:outline-none"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-semibold text-slate-900 leading-tight">{currentRoleInfo.label}</div>
                <div className="text-[10px] text-blue-600 font-medium">{currentRoleInfo.badge}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Pilih Profil & Role (RBAC Simulation)
                </div>
                {roles.map(r => (
                  <button
                    key={r.role}
                    onClick={() => {
                      onRoleChange(r.role);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors ${
                      currentRole === r.role
                        ? 'bg-blue-50 text-blue-800 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div>{r.label}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{r.badge}</div>
                    </div>
                    {currentRole === r.role && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
