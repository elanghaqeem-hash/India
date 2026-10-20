'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Calculator,
  Sliders,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  calculateDAI,
  calculateHRCost,
  calculateBoQ,
  calculate3Ranges,
  CLIENT_TIER_MULTIPLIERS,
} from '@/lib/pricing-engine';
import { evaluateQuotationDoA } from '@/lib/doa-engine';
import { formatIDR, formatPercent, generateQuotationNumber } from '@/lib/formatters';
import { appStore } from '@/lib/store';
import {
  ClientTier,
  LocationType,
  PriceRange,
  RoleLevel,
  DAIIndices,
} from '@/lib/types';

type StaffingRow = {
  role_level: RoleLevel;
  mandays: number;
  cost_rate_override?: number;
  selling_rate_override?: number;
};

const STAFFING_LABELS: Partial<Record<RoleLevel, string>> = {
  project_manager: 'Project Manager',
  lead: 'Lead',
  senior: 'Senior',
  junior: 'Junior',
  technical_writer: 'Technical Writer',
};

function PricingEngineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial params from query
  const initService = searchParams.get('service') || 'VAPT';
  const initMD = Number(searchParams.get('md')) || 18;

  // Pricing State
  const [clientTier, setClientTier] = useState<ClientTier>('A');
  const [locationType, setLocationType] = useState<LocationType>('remote');
  const [daiIndices, setDaiIndices] = useState<DAIIndices>({
    cpi_index: 1.0,
    fx_index: 1.0,
    market_index: 1.0,
    urgency_index: 1.0,
  });

  // HR Staffing Mix for Component A
  const [staffing, setStaffing] = useState<StaffingRow[]>([
    { role_level: 'project_manager', mandays: 2 },
    { role_level: 'lead', mandays: 4 },
    { role_level: 'senior', mandays: 8 },
    { role_level: 'junior', mandays: 4 },
    { role_level: 'technical_writer', mandays: 0, cost_rate_override: 0, selling_rate_override: 0 },
  ]);

  // BoQ Other Components
  const [compBCommissionPct, setCompBCommissionPct] = useState<number>(5.0); // 5%
  const [compCDocuments, setCompCDocuments] = useState<number>(2000000); // Rp 2jt default
  const [compDTools, setCompDTools] = useState<number>(3500000); // Burp / Nessus
  const [compETravel, setCompETravel] = useState<number>(0);

  // Selected Price Range
  const [selectedRange, setSelectedRange] = useState<PriceRange>('standard');
  const [customPriceOverride, setCustomPriceOverride] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState<number>(0);

  // AI Pricing Advisor State
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiAdvising, setAiAdvising] = useState<boolean>(false);

  // Sync staffing total if query MD changed
  useEffect(() => {
    if (initMD && initMD !== 18) {
      setStaffing([
        { role_level: 'project_manager', mandays: Math.max(1, Math.round(initMD * 0.15)) },
        { role_level: 'lead', mandays: Math.max(1, Math.round(initMD * 0.25)) },
        { role_level: 'senior', mandays: Math.max(2, Math.round(initMD * 0.40)) },
        { role_level: 'junior', mandays: Math.max(1, Math.round(initMD * 0.20)) },
        { role_level: 'technical_writer', mandays: 0, cost_rate_override: 0, selling_rate_override: 0 },
      ]);
    }
  }, [initMD]);

  // Dynamic Calculations
  const calculatedDAI = calculateDAI(daiIndices);
  const tierMultiplier = CLIENT_TIER_MULTIPLIERS[clientTier].default;

  const updateMandays = (role: RoleLevel, nextValue: number) => {
    const safeValue = Number.isFinite(nextValue) ? Math.max(0, Math.min(10000, nextValue)) : 0;
    setStaffing(prev => prev.map(item => item.role_level === role ? { ...item, mandays: safeValue } : item));
  };

  const updateWriterRate = (field: 'cost_rate_override' | 'selling_rate_override', nextValue: number) => {
    const safeValue = Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0;
    setStaffing(prev => prev.map(item =>
      item.role_level === 'technical_writer' ? { ...item, [field]: safeValue } : item
    ));
  };

  const technicalWriter = staffing.find(item => item.role_level === 'technical_writer');
  const writerHasUnconfiguredRate = Boolean(technicalWriter && technicalWriter.mandays > 0 &&
    (!technicalWriter.cost_rate_override || !technicalWriter.selling_rate_override));

  const hrCostResult = calculateHRCost(staffing, locationType);
  const compATotal = hrCostResult.totalHRCost;
  const sellingBaseline = hrCostResult.totalSellingBaseline;

  // Intermediate total cost for computing commission
  const rawSubTotalCost = compATotal + compCDocuments + compDTools + compETravel;
  const compBTotal = Math.round(rawSubTotalCost * (compBCommissionPct / 100));

  const totalCost = compATotal + compBTotal + compCDocuments + compDTools + compETravel;

  // 3 Ranges
  const ranges = calculate3Ranges({
    totalInternalCost: totalCost,
    totalSellingBaseline: sellingBaseline,
    dai: calculatedDAI,
    tierMultiplier: tierMultiplier,
  });

  const baseChosenPrice = customPriceOverride || (
    selectedRange === 'floor' ? ranges.floor_price :
    selectedRange === 'premium' ? ranges.premium_price :
    ranges.standard_price
  );
  const finalQuotedPrice = Math.round(baseChosenPrice * (1 - discountPct / 100));

  // BoQ Final Result
  const boq = calculateBoQ({
    component_a_total: compATotal,
    component_b_total: compBTotal,
    component_c_total: compCDocuments,
    component_d_total: compDTools,
    component_e_total: compETravel,
    quoted_price: finalQuotedPrice,
  });

  // DoA Evaluation
  const doa = evaluateQuotationDoA({
    grandTotal: finalQuotedPrice,
    discountPct: discountPct,
    grossMarginPct: boq.gross_margin_pct,
  });

  // AI Pricing Advice Handler
  const handleGetAiPricingAdvice = async () => {
    setAiAdvising(true);
    setAiAdvice(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'pricing_analysis',
          prompt: `Berikan tinjauan komersial dan strategi win rate untuk penawaran harga ini:
- Klien Tier: ${clientTier} (Multiplier: ${tierMultiplier}x)
- Lokasi Pekerjaan: ${locationType}
- Internal Cost (BoQ): ${formatIDR(totalCost)}
- Quoted Price: ${formatIDR(finalQuotedPrice)} (Range: ${selectedRange}, Diskon: ${discountPct}%)
- Gross Profit: ${formatIDR(boq.gross_profit)}
- Gross Margin: ${formatPercent(boq.gross_margin_pct)} (Target minimal 25%)
- DoA Level Diperlukan: ${doa.requiredLevel.toUpperCase()}
- Rekomendasi 3 Ranges: Floor (${formatIDR(ranges.floor_price)}), Standard (${formatIDR(ranges.standard_price)}), Premium (${formatIDR(ranges.premium_price)})

Berikan saran komersial singkat (3-4 butir) mengenai kewajaran harga, strategi mitigasi margin, dan taktik negosiasi.`
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiAdvice(data.content);
      } else {
        setAiAdvice('Gagal meminta saran AI: ' + (data.message || 'Error'));
      }
    } catch (e: any) {
      setAiAdvice('Koneksi AI gagal: ' + e.message);
    } finally {
      setAiAdvising(false);
    }
  };

  // Handle Submit to Proposal & Approval
  const handleCreateQuotation = () => {
    if (writerHasUnconfiguredRate) {
      alert('Lengkapi cost rate dan selling rate Technical Writer sebelum membuat quotation.');
      return;
    }
    const store = appStore.getState();
    const seq = store.proposals.length + 1;
    const qNum = generateQuotationNumber(seq);

    const newProp = {
      id: `prop-${Date.now()}`,
      opportunity_id: 'opp-01',
      opportunity_name: 'VAPT Mobile & Internet Banking Comprehensive',
      company_id: 'comp-01',
      company_name: 'PT Bank Central Nusantara Tbk',
      quotation_number: qNum,
      version: 1,
      status: 'pending_approval' as const,
      subtotal: finalQuotedPrice,
      vat_amount: Math.round(finalQuotedPrice * 0.11),
      grand_total: Math.round(finalQuotedPrice * 1.11),
      discount_pct: discountPct,
      payment_terms: '30-50-20' as const,
      valid_days: 14,
      valid_until: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      client_tier: clientTier,
      selected_price_range: selectedRange,
      line_items: [
        {
          line_number: 1,
          service_type: 'VAPT' as const,
          description: `Cybersecurity Penetration Testing Scope (${staffing.reduce((a, b) => a + b.mandays, 0)} MD) - Tier ${clientTier}`,
          quantity: 1,
          unit: 'Paket',
          unit_price: finalQuotedPrice,
          line_total: finalQuotedPrice,
        },
      ],
      created_by: 'M. Nadhil (Sales)',
      submitted_at: new Date().toISOString(),
      notes: `Generated via ICOP Dynamic Pricing Engine. DAI: ${calculatedDAI}, Tier Multiplier: ${tierMultiplier}x.`,
      created_at: new Date().toISOString(),
    };

    appStore.addProposal(newProp);

    // Also register in Approval Center if requires review
    appStore.addApproval({
      id: `appr-${Date.now()}`,
      entity_type: 'quotation',
      entity_id: newProp.id,
      title: `Quotation #${newProp.quotation_number} - ${newProp.company_name}`,
      requestor_name: 'M. Nadhil',
      requestor_role: 'sales',
      required_level: doa.requiredLevel,
      status: 'pending',
      transaction_value: newProp.grand_total,
      discount_pct: discountPct,
      gross_margin_pct: boq.gross_margin_pct,
      reason: doa.reasons.join('. '),
      created_at: new Date().toISOString(),
    });

    router.push('/proposals');
  };

  return (
    <div className="min-w-0 space-y-5">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">ICOP Dynamic Pricing Engine</h1>
              <p className="text-xs text-slate-500">
                Formula Agile: Base Rate &times; DAI &times; Client Tier Multiplier &bull; BoQ Internal A+B+C+D+E &bull; Floor/Standard/Premium
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-800">
              DAI: {calculatedDAI}
            </span>
            <span className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-800">
              Tier {clientTier} ({tierMultiplier}x)
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        {/* Left Column: Input Parameter & Staffing */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* Card 1: Client Tier & Market Index (DAI) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-600" />
                <span>1. Parameter Komersial & Dynamic Adjustment Index (DAI)</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Client Tier Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Klasifikasi Client Tier
                </label>
                <select
                  value={clientTier}
                  onChange={e => setClientTier(e.target.value as ClientTier)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {Object.entries(CLIENT_TIER_MULTIPLIERS).map(([tier, data]) => (
                    <option key={tier} value={tier}>
                      {data.label} (Multiplier: {data.default}x)
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Type */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Lokasi Pelaksanaan
                </label>
                <select
                  value={locationType}
                  onChange={e => setLocationType(e.target.value as LocationType)}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="remote">Remote (Standard)</option>
                  <option value="jabotabek">Onsite Jabotabek</option>
                  <option value="luar_jabotabek">Onsite Luar Jabotabek</option>
                  <option value="overseas">Overseas / Regional ASEAN (2.5x - 3.0x)</option>
                </select>
              </div>
            </div>

            {/* DAI Sliders Grid */}
            <div className="border-t border-slate-100 pt-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Dynamic Adjustment Index Factors (Weights: 40% CPI + 30% FX + 20% Market + 10% Urgency)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                    <span>CPI (Inflasi)</span>
                    <span className="font-bold text-slate-900">{daiIndices.cpi_index}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={daiIndices.cpi_index}
                    onChange={e => setDaiIndices({ ...daiIndices, cpi_index: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                    <span>FX Kurs Valas</span>
                    <span className="font-bold text-slate-900">{daiIndices.fx_index}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={daiIndices.fx_index}
                    onChange={e => setDaiIndices({ ...daiIndices, fx_index: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                    <span>Market Comp</span>
                    <span className="font-bold text-slate-900">{daiIndices.market_index}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={daiIndices.market_index}
                    onChange={e => setDaiIndices({ ...daiIndices, market_index: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                    <span>Urgency / Rush</span>
                    <span className="font-bold text-slate-900">{daiIndices.urgency_index}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.5"
                    step="0.05"
                    value={daiIndices.urgency_index}
                    onChange={e => setDaiIndices({ ...daiIndices, urgency_index: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Component A: cards on phones/tablets; a four-column table on larger displays. */}
          <section aria-labelledby="hr-boq-heading" className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 id="hr-boq-heading" className="text-base font-bold leading-snug text-slate-900">
                  2. BoQ Komponen A: Human Resources
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Hitung biaya tenaga kerja berdasarkan role, mandays, dan tarif per MD.
                </p>
              </div>
              <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 sm:text-right">
                <p className="text-[11px] font-semibold text-blue-700">Subtotal HR</p>
                <p className="mt-1 text-lg font-extrabold tabular-nums text-blue-950">{formatIDR(compATotal)}</p>
                <p className="mt-1 text-[11px] text-blue-700">
                  {staffing.reduce((sum, item) => sum + item.mandays, 0)} total mandays
                </p>
              </div>
            </div>

            {/* Technical Writer is optional. Its rates require explicit entry and are not represented as official rates. */}
            <div className="min-w-0 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:p-4">
              <div>
                <p className="text-sm font-bold text-indigo-950">Technical Writer</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Peran penyusunan laporan, dokumentasi teknis, dan finalisasi deliverable.
                  Tarif belum tersedia pada rate card; masukkan tarif sesuai persetujuan internal.
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <label htmlFor="writer-cost-rate" className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Cost Rate / MD (Rp)</span>
                  <input
                    id="writer-cost-rate"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1000"
                    value={technicalWriter?.cost_rate_override ?? 0}
                    onChange={event => updateWriterRate('cost_rate_override', Number(event.target.value))}
                    className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <label htmlFor="writer-selling-rate" className="block min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">Selling Rate / MD (Rp)</span>
                  <input
                    id="writer-selling-rate"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1000"
                    value={technicalWriter?.selling_rate_override ?? 0}
                    onChange={event => updateWriterRate('selling_rate_override', Number(event.target.value))}
                    className="h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
              {writerHasUnconfiguredRate && (
                <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Technical Writer sudah memiliki mandays. Lengkapi kedua tarif sebelum membuat quotation.
                </p>
              )}
            </div>

            {/* Touch-friendly role cost cards on small and medium viewports. */}
            <div className="space-y-2.5 xl:hidden">
              {staffing.map((item, idx) => {
                const detail = hrCostResult.details[idx];
                const label = STAFFING_LABELS[item.role_level] || item.role_level.replace(/_/g, ' ');
                return (
                  <div key={item.role_level} className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-bold text-slate-900">{label}</p>
                        {item.role_level === 'technical_writer' && (
                          <p className="mt-0.5 text-[11px] text-indigo-600">Dokumentasi & pelaporan</p>
                        )}
                      </div>
                      <label className="w-24 shrink-0">
                        <span className="mb-1 block text-right text-[11px] font-medium text-slate-500">Mandays</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="10000"
                          step="0.5"
                          aria-label={`Mandays ${label}`}
                          value={item.mandays}
                          onChange={event => updateMandays(item.role_level, Number(event.target.value))}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-center text-base font-bold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-500">Cost Rate / MD</p>
                        <p className="mt-1 break-words text-xs font-semibold tabular-nums text-slate-700 sm:text-sm">{formatIDR(detail?.daily_cost_rate ?? 0)}</p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-[11px] font-medium text-slate-500">Subtotal</p>
                        <p className="mt-1 break-words text-sm font-extrabold tabular-nums text-slate-900">{formatIDR(detail?.subtotal ?? 0)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table: isolated from narrow screens to avoid four overlapping columns. */}
            <div className="hidden min-w-0 overflow-x-auto xl:block">
              <table className="w-full min-w-[600px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500">
                    <th scope="col" className="rounded-tl-lg px-3 py-3">Role Level</th>
                    <th scope="col" className="px-3 py-3 text-center">Mandays (MD)</th>
                    <th scope="col" className="px-3 py-3 text-right">Cost Rate / MD</th>
                    <th scope="col" className="rounded-tr-lg px-3 py-3 text-right">Subtotal Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffing.map((item, idx) => {
                    const detail = hrCostResult.details[idx];
                    const label = STAFFING_LABELS[item.role_level] || item.role_level.replace(/_/g, ' ');
                    return (
                      <tr key={item.role_level} className="hover:bg-slate-50/70">
                        <th scope="row" className="px-3 py-3 text-xs font-semibold text-slate-800">{label}</th>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="10000"
                            step="0.5"
                            aria-label={`Mandays ${label}`}
                            value={item.mandays}
                            onChange={event => updateMandays(item.role_level, Number(event.target.value))}
                            className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-2 text-center text-sm font-bold tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-600">{formatIDR(detail?.daily_cost_rate ?? 0)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-900">{formatIDR(detail?.subtotal ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Card 3: BoQ Komponen B, C, D, E */}
          <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="border-b border-slate-100 pb-3 text-base font-bold leading-snug text-slate-900">
              3. BoQ Komponen B, C, D & E
            </h2>
            <p className="text-xs text-slate-500">Biaya langsung non-SDM dan komisi dalam perhitungan total proyek.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Komponen B: Komisi Sales & Partner (%)
                </label>
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="number"
                    aria-label="Persentase komisi Sales dan Partner"
                    min="0"
                    max="20"
                    step="0.5"
                    value={compBCommissionPct}
                    onChange={e => setCompBCommissionPct(Math.max(0, Math.min(20, Number(e.target.value) || 0)))}
                    className="h-11 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-900 sm:w-28"
                  />
                  <span className="min-w-0 break-words rounded-lg bg-slate-50 px-3 py-2.5 text-xs font-semibold tabular-nums text-slate-700">
                    Biaya: {formatIDR(compBTotal)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Komponen C: Deliverables & Cetak Laporan (Default Rp 2 Juta)
                </label>
                <input
                  type="number"
                  value={compCDocuments}
                  onChange={e => setCompCDocuments(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Komponen D: Third Party Tools / License / Subcon
                </label>
                <input
                  type="number"
                  value={compDTools}
                  onChange={e => setCompDTools(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Komponen E: Akomodasi & Transportasi
                </label>
                <input
                  type="number"
                  value={compETravel}
                  onChange={e => setCompETravel(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold leading-relaxed text-slate-600">Total Direct Internal Cost (A + B + C + D + E)</span>
              <span className="break-words text-lg font-extrabold tabular-nums text-slate-900">{formatIDR(totalCost)}</span>
            </div>
          </section>
        </div>

        {/* Right Column: 3-Range Output & Commercial Summary */}
        <div className="min-w-0 space-y-5">
          {/* 3 Price Ranges Selector */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hasil 3-Range Penawaran Harga
            </h2>

            <div className="space-y-2.5">
              {/* Floor Price */}
              <div
                onClick={() => { setSelectedRange('floor'); setCustomPriceOverride(null); }}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedRange === 'floor'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">FLOOR PRICE (Min Margin 20%)</span>
                  {selectedRange === 'floor' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {formatIDR(ranges.floor_price)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Batas dasar harga terendah tanpa erosi margin modal.
                </div>
              </div>

              {/* Standard Price */}
              <div
                onClick={() => { setSelectedRange('standard'); setCustomPriceOverride(null); }}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedRange === 'standard'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-900">STANDARD PRICE</span>
                    <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded font-extrabold">REKOMENDASI</span>
                  </div>
                  {selectedRange === 'standard' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="text-xl font-black text-blue-900 mt-1">
                  {formatIDR(ranges.standard_price)}
                </div>
                <div className="text-[10px] text-blue-700 mt-0.5">
                  Base Selling &times; DAI &times; Multiplier Tier {clientTier}.
                </div>
              </div>

              {/* Premium Price */}
              <div
                onClick={() => { setSelectedRange('premium'); setCustomPriceOverride(null); }}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  selectedRange === 'premium'
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">PREMIUM PRICE (Standard &times; 1.25)</span>
                  {selectedRange === 'premium' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {formatIDR(ranges.premium_price)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Untuk rush delivery, high liability / SLA ketat 24x7.
                </div>
              </div>
            </div>

            {/* Discount Slider */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex justify-between items-center text-xs font-semibold mb-1">
                <span>Diskon Komersial:</span>
                <span className={`font-black ${discountPct > 15 ? 'text-rose-600' : discountPct > 5 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {discountPct.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="0.5"
                value={discountPct}
                onChange={e => setDiscountPct(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>0% (Standar)</span>
                <span>5% (Manager)</span>
                <span>15% (VP)</span>
                <span>25% (Direktur)</span>
              </div>
            </div>

            {/* Profitability & Margin Warning Indicator */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Quoted Price:</span>
                <span className="font-black text-slate-900">{formatIDR(finalQuotedPrice)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Gross Profit:</span>
                <span className="font-black text-emerald-700">{formatIDR(boq.gross_profit)}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-1.5">
                <span className="font-bold text-slate-700">Gross Margin:</span>
                <span className={`font-black text-sm ${boq.margin_warning ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {formatPercent(boq.gross_margin_pct)}
                </span>
              </div>

              {/* Alert Warning if Margin < 25% */}
              {boq.margin_warning && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-rose-800 text-[11px] flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">PERINGATAN MARGIN RENDAH (&lt; 25%): </span>
                    Margin proyek saat ini berada di bawah target 25%. Memerlukan eskalasi persetujuan Direktur sesuai DoA.
                  </div>
                </div>
              )}
            </div>

            {/* DoA Requirement Badge */}
            <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tingkat Otorisasi Diperlukan (DoA)
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-md font-bold text-xs capitalize ${
                  doa.requiredLevel === 'director'
                    ? 'bg-purple-100 text-purple-900 border border-purple-200'
                    : doa.requiredLevel === 'vp'
                    ? 'bg-blue-100 text-blue-900 border border-blue-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  Level Otorisasi: {doa.requiredLevel.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                {doa.reasons[0]}
              </p>
            </div>

            {/* AI Commercial Advisor Button */}
            <button
              type="button"
              onClick={handleGetAiPricingAdvice}
              disabled={aiAdvising}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/80 py-2.5 text-xs font-bold text-indigo-900 transition-all"
            >
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>{aiAdvising ? 'Mengkaji AI Commercial Intelligence...' : 'AI Pricing & Margin Advisor'}</span>
            </button>

            {/* AI Advisor Modal / Drawer */}
            {aiAdvice && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-indigo-950 font-bold border-b border-indigo-100 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Rekomendasi Strategi Komersial AI</span>
                  </span>
                  <button onClick={() => setAiAdvice(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">&times;</button>
                </div>
                <div className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-2.5 rounded-lg border border-indigo-100 max-h-48 overflow-y-auto">
                  {aiAdvice}
                </div>
              </div>
            )}

            {/* Submit to Quotation & Approval Button */}
            <button
              onClick={handleCreateQuotation}
              disabled={writerHasUnconfiguredRate}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Generate Quotation Resmi & Submit</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PricingEnginePage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-bold">Memuat Pricing Engine...</div>}>
      <PricingEngineContent />
    </React.Suspense>
  );
}
