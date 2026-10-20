'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  FileSearch,
  Calculator,
  Stamp,
  FileSpreadsheet,
  Wallet,
  TrendingUp,
  FileCheck2,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Sparkles,
  KanbanSquare,
} from 'lucide-react';

interface SidebarProps {
  pendingApprovalsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ pendingApprovalsCount = 1 }) => {
  const pathname = usePathname();

  const navigation = [
    { name: 'Sales Pipeline & CRM', href: '/sales/pipeline', icon: KanbanSquare, badge: 'D1' },
    { name: 'BoQ Management', href: '/boq', icon: ClipboardList, badge: 'D1' },
    {
      name: 'Deal 360 Workspace',
      href: '/',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      name: 'Customer Management',
      href: '/customers',
      icon: Building2,
      badge: null,
    },
    {
      name: 'Smart Scoping Wizard',
      href: '/scoping',
      icon: FileSearch,
      badge: 'VAPT / SOC',
    },
    {
      name: 'ICOP Pricing Engine',
      href: '/pricing',
      icon: Calculator,
      badge: 'BoQ A-E',
    },
    {
      name: 'Decision & DoA Center',
      href: '/approvals',
      icon: Stamp,
      badge: pendingApprovalsCount > 0 ? `${pendingApprovalsCount}` : null,
      highlight: pendingApprovalsCount > 0,
    },
    {
      name: 'Quotation & Offer Gen',
      href: '/proposals',
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      name: 'Post-PO Forms & Kick Off',
      href: '/post-po',
      icon: ClipboardCheck,
      badge: '2 Word',
    },
    {
      name: 'Tender Management',
      href: '/tender',
      icon: FileText,
      badge: 'LPSE/BUMN',
    },
    {
      name: 'FlexGuard Token Wallet',
      href: '/flexguard',
      icon: Wallet,
      badge: 'Ledger',
    },
    {
      name: 'AI Connections & API Keys',
      href: '/settings/ai',
      icon: Sparkles,
      badge: 'Multi-AI',
    },
  ];

  return (
    <aside className="no-print hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Commercial Navigation
          </div>
          {navigation.map(item => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : item.highlight
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Status Card: Baseline Info */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900 mb-1">
            <FileCheck2 className="h-4 w-4 text-blue-600" />
            <span>DefendIT360 Baseline</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Rate Card 2026 disahkan. PPN 11%, terms 30-50-20, denda keterlambatan 1‰/hari.
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-blue-700">
            <TrendingUp className="h-3 w-3" />
            <span>Target Gross Margin &ge; 25%</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
