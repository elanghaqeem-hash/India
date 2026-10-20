'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  FileCheck,
  AlertTriangle,
  Building,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  Calculator,
  ChevronRight,
  Sparkles,
  BarChart3,
  Clock,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/formatters';
import { OpportunityStage, ServiceType } from '@/lib/types';

export default function Deal360Workspace() {
  const store = appStore.getState();
  const [opportunities, setOpportunities] = useState(store.opportunities);
  const [selectedStage, setSelectedStage] = useState<string>('all');

  // KPI Calculations
  const totalPipeline = opportunities.reduce((acc, o) => acc + o.estimated_value, 0);
  const weightedPipeline = opportunities.reduce((acc, o) => acc + (o.estimated_value * (o.probability / 100)), 0);
  const pendingApprovalsCount = store.approvals.filter(a => a.status === 'pending').length;
  const activeProposalsCount = store.proposals.filter(p => p.status === 'approved' || p.status === 'sent').length;
  const activeWalletsTotal = store.wallets.reduce((acc, w) => acc + w.available_balance, 0);

  const stages: Array<{ id: OpportunityStage; label: string; pct: number; color: string }> = [
    { id: 'prospecting', label: 'Prospecting', pct: 10, color: 'bg-slate-100 text-slate-700' },
    { id: 'qualified', label: 'Qualified (BANT)', pct: 25, color: 'bg-blue-100 text-blue-800' },
    { id: 'quotation_sent', label: 'Quotation Sent', pct: 40, color: 'bg-indigo-100 text-indigo-800' },
    { id: 'negotiation', label: 'Negotiation', pct: 60, color: 'bg-amber-100 text-amber-800' },
    { id: 'po_received', label: 'PO Received', pct: 85, color: 'bg-emerald-100 text-emerald-800' },
    { id: 'closed_won', label: 'Closed Won', pct: 100, color: 'bg-teal-100 text-teal-900' },
  ];

  const filteredOpps = selectedStage === 'all'
    ? opportunities
    : opportunities.filter(o => o.stage === selectedStage);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Deal 360 Workspace</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Commercial Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pusat kendali pipeline terpadu: CRM, Scoping Teknis, Dynamic Pricing BoQ, Otorisasi DoA & FlexGuard Wallet.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/scoping"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Calculator className="h-3.5 w-3.5 text-blue-600" />
            <span>Smart Scoping</span>
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Pricing Wizard</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Pipeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Pipeline</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-extrabold text-slate-900">
            {formatIDR(totalPipeline)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <span>{opportunities.length} active opportunities</span>
          </div>
        </div>

        {/* Weighted Forecast */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Weighted Forecast</span>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-extrabold text-emerald-700">
            {formatIDR(weightedPipeline)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Probabilitas tertimbang
          </div>
        </div>

        {/* Pending DoA Approvals */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Otorisasi</span>
            <AlertTriangle className={`h-4 w-4 ${pendingApprovalsCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <span>{pendingApprovalsCount}</span>
            {pendingApprovalsCount > 0 && (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                Action Req
              </span>
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            <Link href="/approvals" className="text-blue-600 hover:underline">
              Buka Decision Center &rarr;
            </Link>
          </div>
        </div>

        {/* Active Quotations */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Quotations</span>
            <FileCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-extrabold text-slate-900">
            {activeProposalsCount}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 font-medium">
            Quotation resmi ber-nomor
          </div>
        </div>

        {/* FlexGuard Balance */}
        <div className="col-span-2 lg:col-span-1 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/30 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-blue-900">
            <span className="text-[11px] font-bold uppercase tracking-wider">FlexGuard Mandays</span>
            <ShieldCheck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-lg sm:text-xl font-extrabold text-blue-950">
            {activeWalletsTotal} <span className="text-xs font-semibold text-blue-700">MD Available</span>
          </div>
          <div className="mt-1 text-[10px] text-blue-700 font-medium">
            <Link href="/flexguard" className="hover:underline flex items-center gap-0.5">
              <span>Kelola Token Wallet</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Pipeline Kanban Stage Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Commercial Sales Pipeline</h2>
            <p className="text-[11px] text-slate-500">Filter transaksi berdasarkan tahapan siklus bisnis</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedStage('all')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                selectedStage === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({opportunities.length})
            </button>
            {stages.map(s => {
              const count = opportunities.filter(o => o.stage === s.id).length;
              const isSelected = selectedStage === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStage(s.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{s.label}</span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.2 ${isSelected ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 font-bold'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Opportunities Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Opportunity & Layanan</th>
                <th className="py-2.5 px-3">Pelanggan & Tier</th>
                <th className="py-2.5 px-3">Nilai Estimasi</th>
                <th className="py-2.5 px-3">Tahapan</th>
                <th className="py-2.5 px-3">Target Close</th>
                <th className="py-2.5 px-3 text-right">Aksi Komersial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOpps.map(opp => {
                const stageInfo = stages.find(s => s.id === opp.stage);
                const company = store.companies.find(c => c.id === opp.company_id);
                return (
                  <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Opportunity Name & Type */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{opp.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">
                          {opp.service_type}
                        </span>
                        <span>AM: {opp.account_manager}</span>
                      </div>
                    </td>

                    {/* Customer & Tier */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800">{opp.company_name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 border border-indigo-200/50">
                          Tier {company?.client_tier || 'A'}
                        </span>
                        <span className="text-[11px] text-slate-400">{company?.industry}</span>
                      </div>
                    </td>

                    {/* Value */}
                    <td className="py-3 px-3">
                      <div className="font-extrabold text-slate-900">{formatIDR(opp.estimated_value)}</div>
                      <div className="text-[10px] text-emerald-600 font-semibold">
                        Probabilitas {opp.probability}%
                      </div>
                    </td>

                    {/* Stage */}
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stageInfo?.color || 'bg-slate-100 text-slate-700'}`}>
                        {stageInfo?.label || opp.stage}
                      </span>
                    </td>

                    {/* Close Date */}
                    <td className="py-3 px-3 text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{formatDate(opp.expected_closing_date)}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/pricing?opp=${opp.id}`}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2 py-1 text-[11px] font-semibold transition-colors"
                        >
                          <Calculator className="h-3 w-3" />
                          <span>Pricing BoQ</span>
                        </Link>
                        <Link
                          href={`/proposals`}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1 text-[11px] font-semibold transition-colors"
                        >
                          <span>Quotation</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
