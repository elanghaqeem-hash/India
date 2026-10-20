'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileSearch, Calculator, Stamp, FileSpreadsheet, ClipboardList } from 'lucide-react';

interface MobileNavProps {
  pendingApprovalsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ pendingApprovalsCount = 1 }) => {
  const pathname = usePathname();

  const items = [
    { label: 'Deal 360', href: '/', icon: LayoutDashboard },
    { label: 'BoQ', href: '/boq', icon: ClipboardList },
    { label: 'Pricing', href: '/pricing', icon: Calculator },
    { label: 'Approval', href: '/approvals', icon: Stamp, badge: pendingApprovalsCount },
    { label: 'Quotation', href: '/proposals', icon: FileSpreadsheet },
  ];

  return (
    <nav aria-label="Navigasi utama mobile" className="no-print fixed inset-x-0 bottom-0 z-50 flex min-h-16 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(15,23,42,0.04)] backdrop-blur-md lg:hidden">
      <div className="grid h-full w-full grid-cols-5 items-center">
        {items.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-extrabold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="w-full truncate px-0.5 text-center text-[10px] tracking-tight">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 h-0.5 w-6 rounded-full bg-blue-600" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
