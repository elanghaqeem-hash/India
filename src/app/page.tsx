'use client';

import React, { useState, useEffect } from 'react';
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
  Layers,
  Search,
  Filter,
  CheckCircle2,
  X,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/formatters';
import { Opportunity, OpportunityStage, ServiceType } from '@/lib/types';

export default function Deal360Workspace() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // New Opp Modal
  const [showNewOppModal, setShowNewOppModal] = useState(false);
  const [oppTitle, setOppTitle] = useState('');
  const [companyId, setCompanyId] = useState('comp-01');
  const [serviceType, setServiceType] = useState<ServiceType>('VAPT');
  const [estValue, setEstValue] = useState<number>(150000000);
  const [probability, setProbability] = useState<number>(50);
  const [accountManager, setAccountManager] = useState('M. Nadhil');
  const [oppNotes, setOppNotes] = useState('');

  const refreshData = () => {
    setOpportunities([...appStore.getState().opportunities]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const companies = appStore.getState().companies;
  const approvals = appStore.getState().approvals;
  const proposals = appStore.getState().proposals;
  const wallets = appStore.getState().wallets;

  // KPI Calculations
  const totalPipeline = opportunities.reduce((acc, o) => acc + o.estimated_value, 0);
  const weightedPipeline = opportunities.reduce((acc, o) => acc + (o.estimated_value * (o.probability / 100)), 0);
  const pendingApprovalsCount = approvals.filter(a => a.status === 'pending').length;
  const activeProposalsCount = proposals.filter(p => p.status === 'approved' || p.status === 'sent').length;
  const activeWalletsTotal = wallets.reduce((acc, w) => acc + w.available_balance, 0);

  const stages: Array<{ id: OpportunityStage; label: string; pct: number; color: string }> = [
    { id: 'prospecting', label: 'Prospecting', pct: 10, color: 'bg-slate-100 text-slate-700' },
    { id: 'qualified', label: 'Qualified (BANT)', pct: 25, color: 'bg-blue-100 text-blue-800' },
    { id: 'quotation_sent', label: 'Quotation Sent', pct: 40, color: 'bg-indigo-100 text-indigo-800' },
    { id: 'negotiation', label: 'Negotiation', pct: 60, color: 'bg-amber-100 text-amber-800' },
    { id: 'po_received', label: 'PO Received', pct: 85, color: 'bg-emerald-100 text-emerald-800' },
    { id: 'closed_won', label: 'Closed Won', pct: 100, color: 'bg-teal-100 text-teal-900' },
  ];

  const filteredOpps = opportunities.filter(o => {
    const matchStage = selectedStage === 'all' || o.stage === selectedStage;
    const matchSearch = o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.service_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStage && matchSearch;
  });

  const handleCreateOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    const comp = companies.find(c => c.id === companyId);
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          company_name: comp?.name || 'Client',
          name: oppTitle,
          service_type: serviceType,
          estimated_value: estValue,
          probability,
          account_manager: accountManager,
          notes: oppNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        refreshData();
        setShowNewOppModal(false);
        setOppTitle('');
        setOppNotes('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStageChange = async (id: string, newStage: OpportunityStage) => {
    try {
      await fetch('/api/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stage: newStage }),
      });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunAIPipelineReview = async () => {
    setIsAiLoading(true);
    setAiReport(null);
    try {
      const prompt = `Analisis performa pipeline komersial ICOP CyberBusiness 360:
Total Pipeline: Rp ${totalPipeline.toLocaleString('id-ID')} (${opportunities.length} opportunities)
Weighted Pipeline: Rp ${weightedPipeline.toLocaleString('id-ID')}
Daftar Deal Aktif:
${opportunities.map(o => `- ${o.name} (${o.company_name}) | Nilai: Rp ${o.estimated_value.toLocaleString('id-ID')} | Tahap: ${o.stage} (${o.probability}%)`).join('\n')}

Berikan penilaian kesehatan pipeline, deal yang paling berisiko / butuh akselerasi penawaran, rekomendasi taktik komersial untuk Account Manager (Sales), dan estimasi revenue closing bulan ini.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setAiReport(data.content);
      }
    } catch (err) {
      alert('Gagal menjalankan AI Review');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Deal 360 Workspace</h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              PRATINJAU / DEMO — DATA CONTOH
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pusat kendali pipeline terpadu: CRM, Scoping Teknis, Dynamic Pricing BoQ, Otorisasi DoA & FlexGuard Wallet.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunAIPipelineReview}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
            <span>{isAiLoading ? 'AI Menganalisis...' : 'AI Pipeline Health Check'}</span>
          </button>

          <button
            onClick={() => setShowNewOppModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ New Opportunity</span>
          </button>
        </div>
      </div>

      {/* AI Pipeline Health Report Banner */}
      {aiReport && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-purple-200 pb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-950">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>AI Executive Pipeline Strategy & Health Review</span>
            </div>
            <button onClick={() => setAiReport(null)} className="text-purple-600 hover:text-purple-900 font-bold text-xs">
              Tutup
            </button>
          </div>
          <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-white p-4 rounded-xl border border-purple-100 shadow-2xs font-sans">
            {aiReport}
          </div>
        </div>
      )}

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
            <Link href="/proposals" className="text-blue-600 hover:underline">
              Lihat Dokumen &rarr;
            </Link>
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

      {/* Pipeline Kanban Stage Tabs & Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari opportunity atau klien..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
                <th className="py-2.5 px-3">Tahapan Pipeline</th>
                <th className="py-2.5 px-3">Target Close</th>
                <th className="py-2.5 px-3 text-right">Aksi Komersial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOpps.map(opp => {
                const stageInfo = stages.find(s => s.id === opp.stage);
                const company = companies.find(c => c.id === opp.company_id);
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

                    {/* Stage Selector (Direct Inline Status Update) */}
                    <td className="py-3 px-3">
                      <select
                        value={opp.stage}
                        onChange={e => handleStageChange(opp.id, e.target.value as OpportunityStage)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border ${stageInfo?.color || 'bg-slate-100'}`}
                      >
                        {stages.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.label} ({s.pct}%)
                          </option>
                        ))}
                      </select>
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

      {/* New Opportunity Modal */}
      {showNewOppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Buat Opportunity Baru</h3>
              <button onClick={() => setShowNewOppModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateOpp} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Project / Opportunity *</label>
                <input
                  type="text"
                  required
                  value={oppTitle}
                  onChange={e => setOppTitle(e.target.value)}
                  placeholder="Contoh: Comprehensive VAPT Mobile Banking 2026..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pelanggan / Klien *</label>
                  <select
                    value={companyId}
                    onChange={e => setCompanyId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Tier {c.client_tier})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pilar Layanan *</label>
                  <select
                    value={serviceType}
                    onChange={e => setServiceType(e.target.value as ServiceType)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    {['VAPT', 'SOC', 'CTI', 'ISO', 'PDP', 'Hardening', 'IR'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Estimasi Nilai Kontrak (Rp) *</label>
                  <input
                    type="number"
                    required
                    value={estValue}
                    onChange={e => setEstValue(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Win Probability (%)</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={probability}
                    onChange={e => setProbability(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Catatan Kualifikasi (BANT)</label>
                <textarea
                  rows={2}
                  value={oppNotes}
                  onChange={e => setOppNotes(e.target.value)}
                  placeholder="Budget tersedia, timeline implementasi, decision maker..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewOppModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 text-xs shadow-xs"
                >
                  Simpan Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
