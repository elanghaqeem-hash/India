'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileSearch, Calculator, Stamp, FileSpreadsheet } from 'lucide-react';

interface MobileNavProps {
  pendingApprovalsCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({ pendingApprovalsCount = 1 }) => {
  const pathname = usePathname();

  const items = [
    { label: 'Deal 360', href: '/', icon: LayoutDashboard },
    { label: 'Scoping', href: '/scoping', icon: FileSearch },
    { label: 'Pricing', href: '/pricing', icon: Calculator },
    { label: 'Approval', href: '/approvals', icon: Stamp, badge: pendingApprovalsCount },
    { label: 'Quotation', href: '/proposals', icon: FileSpreadsheet },
  ];

  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t border-slate-200 bg-white/95 px-2 backdrop-blur-md lg:hidden">
      <div className="grid h-full w-full grid-cols-5 items-center">
        {items.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex flex-col items-center justify-center py-1 transition-colors ${
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
              <span className="mt-1 text-[10px] tracking-tight">{item.label}</span>
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
