'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  Shield,
  Building,
  Calendar,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/formatters';
import { Proposal } from '@/lib/types';
import { downloadProposalBoQ, BoQExportFormat } from '@/lib/boq-xlsx';
import QuotationDocument from '@/components/quotation/QuotationDocument';
import { downloadQuotationDocx, QuotationDetails, QuotationFormat, resolveQuotationFormat } from '@/lib/quotation-docx';

export default function ProposalsPage() {
  const store = appStore.getState();
  const [proposals, setProposals] = useState<Proposal[]>(store.proposals);
  const [selectedProp, setSelectedProp] = useState<Proposal>(proposals[0]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [docFormat, setDocFormat] = useState<QuotationFormat>('auto');
  const [docDetails, setDocDetails] = useState<QuotationDetails>({});
  const editDetail = (name: keyof QuotationDetails, value: string) => {
    setDocDetails(prev => ({ ...prev, [name]: value }));
  };
  const handleExportWord = () => {
    try {
      downloadQuotationDocx(selectedProp, docFormat, docDetails);
      setActionMsg('Draft Quotation Word dibuat dari proposal terpilih. Tinjau lingkup, klausul, pajak, dan approval sebelum dikirim.');
    } catch (err) {
      setActionMsg('Gagal membuat Word: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportBoQ = (format: BoQExportFormat) => {
    try {
      // SECURITY: do not pass internal pricing data until finance/presales RBAC
      // has been implemented and enforced server-side. Cost cells remain blank.
      downloadProposalBoQ(selectedProp, format);
      if (format !== 'customer') {
        setActionMsg('BoQ internal draft diunduh. HPP harus dilengkapi/diotorisasi oleh Finance; belum diekspor dari pricing.');
      }
    } catch (err) {
      setActionMsg('Ekspor BoQ gagal: ' + (err instanceof Error ? err.message : 'Kesalahan tidak diketahui'));
    }
  };

  const reloadProposals = async () => {
    try {
      const res = await fetch('/api/proposals');
      const data = await res.json();
      if (data.success && data.proposals.length > 0) {
        setProposals(data.proposals);
        const curr = data.proposals.find((p: Proposal) => p.id === selectedProp.id) || data.proposals[0];
        setSelectedProp(curr);
      }
    } catch (e) {
      // fallback to store
      setProposals([...appStore.getState().proposals]);
    }
  };

  const handleUpdateStatus = async (status: 'sent' | 'accepted' | 'rejected') => {
    try {
      const res = await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProp.id, status })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(`Status proposal berhasil diubah menjadi ${status.toUpperCase()}`);
        await reloadProposals();
        setTimeout(() => setActionMsg(null), 3000);
      }
    } catch (e: any) {
      alert('Gagal update status: ' + e.message);
    }
  };

  const handleCreateRevision = async () => {
    try {
      const res = await fetch('/api/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedProp.id, action: 'create_revision' })
      });
      const data = await res.json();
      if (data.success) {
        setActionMsg(`Berhasil menerbitkan versi revisi baru: ${data.proposal.quotation_number}`);
        await reloadProposals();
        setSelectedProp(data.proposal);
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (e: any) {
      alert('Gagal membuat revisi: ' + e.message);
    }
  };

  const handleGenerateAiSummary = async () => {
    setAiLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: 'proposal_drafting',
          prompt: `Susunkan Executive Summary & Commercial Cover Letter resmi berbahasa Indonesia untuk dokumen penawaran harga ini:
- Nomor Quotation: ${selectedProp.quotation_number}
- Perusahaan Klien: ${selectedProp.company_name} (Tier ${selectedProp.client_tier})
- Nama Proyek: ${selectedProp.opportunity_name}
- Total Nilai Komersial: ${formatIDR(selectedProp.grand_total)} (Termasuk PPN sesuai data quotation)
- Termin Pembayaran: ${selectedProp.payment_terms}
- Masa Berlaku: ${selectedProp.valid_days} Hari Kalender

Tuliskan dalam gaya konsultan keamanan siber eksekutif terpercaya (Big 4 cybersecurity consulting tone), berfokus pada value proposition mitigasi risiko dan kepatuhan regulasi.`
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiSummary(data.content);
      } else {
        setAiSummary('Gagal menyusun ringkasan: ' + (data.message || 'Error'));
      }
    } catch (e: any) {
      setAiSummary('Koneksi AI gagal: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="quotation-page min-w-0 max-w-full space-y-4 sm:space-y-6">
      {/* Header (Hidden when printing) */}
      <div className="no-print border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Quotation & Commercial Offer Generator
              </h1>
              <p className="text-xs text-slate-500">
                Susun draft penawaran terstruktur berdasarkan data quotation aktual, Scope of Work, dan persetujuan komersial.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateAiSummary}
              disabled={aiLoading}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 px-3 py-2 text-xs font-bold transition-all"
            >
              <Shield className="h-3.5 w-3.5 text-indigo-600" />
              <span>{aiLoading ? 'AI Menyusun...' : 'AI Executive Summary'}</span>
            </button>
            <button
              onClick={handleCreateRevision}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-bold transition-all shadow-2xs"
            >
              <span>+ Buat Revisi (REV-N)</span>
            </button>
            <div className="flex flex-wrap items-center gap-2" aria-label="Ekspor BoQ Excel DefendIT360">
              <button type="button" onClick={() => handleExportBoQ('standard')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100">BoQ Internal (.xlsx)</button>
              <button type="button" onClick={() => handleExportBoQ('onsite')} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100">BoQ Onsite (.xlsx)</button>
              <button type="button" onClick={() => handleExportBoQ('customer')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">BoQ Customer (.xlsx)</button>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Ekspor Quotation Word">
              <select
                aria-label="Pilih format dokumen Quotation"
                value={docFormat}
                onChange={e => setDocFormat(e.target.value as QuotationFormat)}
                className="max-w-full rounded-lg border border-violet-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
              >
                <option value="auto">Word: Otomatis</option>
                <option value="mobile">Word: Mobile Pentest</option>
                <option value="vapt">Word: VAPT / Multi-Layanan</option>
                <option value="soc">Word: Managed SOC</option>
              </select>
              <button type="button" onClick={handleExportWord}
                className="flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-800">
                <Download className="h-3.5 w-3.5" /> Unduh Quotation (.docx)
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
          </div>
        </div>

        {/* Action Status Message */}
        {actionMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* AI Summary Banner */}
        {aiSummary && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-indigo-950 font-bold border-b border-indigo-100 pb-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>AI Executive Summary & Proposal Cover Letter Draft:</span>
              </span>
              <button onClick={() => setAiSummary(null)} className="text-slate-400 hover:text-slate-600 text-base font-bold">&times;</button>
            </div>
            <div className="text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-indigo-100 max-h-52 overflow-y-auto">
              {aiSummary}
            </div>
          </div>
        )}
      </div>

      <div className="grid min-w-0 grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6 print:block">
        {/* Left Column: Quotation List Selector (Hidden when printing) */}
        <div className="no-print min-w-0 lg:col-span-1 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Daftar Penawaran Harga
          </div>
          <div className="space-y-2">
            {proposals.map(prop => {
              const isSelected = selectedProp.id === prop.id;
              return (
                <div
                  key={prop.id}
                  onClick={() => { setSelectedProp(prop); setDocDetails({}); setDocFormat('auto'); }}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-extrabold text-slate-900">{prop.quotation_number}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      prop.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {prop.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-800 mt-1 truncate">{prop.company_name}</div>
                  <div className="text-slate-500 text-[11px] mt-0.5 truncate">{prop.opportunity_name}</div>
                  <div className="mt-2 text-xs font-black text-slate-900">
                    {formatIDR(prop.grand_total)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Professional Formal Document Preview */}
        <div className="min-w-0 lg:col-span-3 space-y-4 print:block">
          {/* Action Ribbon (Hidden when printing) */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Status Proposal:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                selectedProp.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' :
                selectedProp.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                selectedProp.status === 'approved' ? 'bg-indigo-100 text-indigo-800' :
                selectedProp.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {selectedProp.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleUpdateStatus('sent')}
                disabled={selectedProp.status === 'sent' || selectedProp.status === 'accepted'}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Kirim ke Klien (Sent)
              </button>
              <button
                onClick={() => handleUpdateStatus('accepted')}
                disabled={selectedProp.status === 'accepted'}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Tandatangani Klien (Accepted)
              </button>
              <button
                onClick={() => handleUpdateStatus('rejected')}
                disabled={selectedProp.status === 'rejected' || selectedProp.status === 'accepted'}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 text-rose-700 text-xs font-bold transition-colors"
              >
                Klien Tolak (Lost)
              </button>
            </div>
          </div>

          <details className="no-print rounded-xl border border-violet-200 bg-violet-50/40 p-3.5 text-xs">
            <summary className="cursor-pointer font-bold text-violet-900">
              Lengkapi Data Quotation Word ({resolveQuotationFormat(selectedProp, docFormat).toUpperCase()}) - opsional, tidak tersimpan ke database
            </summary>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              Data pada contoh Dana Kini, LPS, dan Mitsubishi hanya dijadikan pola dokumen.
              Isi SOW, aset, SLA, tim, ketentuan, serta lisensi sesuai proyek yang benar.
              Field kosong akan ditandai memerlukan konfirmasi pada DOCX.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ['endUser', 'End User'],
                ['methodology', 'Metode dan standar pengujian'],
                ['technicalPlatform', 'Platform teknologi / SIEM / lisensi'],
                ['scope', 'Scope of Work'],
                ['assets', 'Daftar aset / target / endpoint'],
                ['logSources', 'Daftar log source, EPS, dan retensi'],
                ['serviceLevels', 'SLA / SLO / jam layanan'],
                ['rules', 'Rules of Engagement'],
                ['team', 'Struktur tim dan Technical Writer'],
                ['deliverables', 'Deliverables dan re-test'],
                ['terms', 'General Terms & Conditions'],
                ['paymentNotes', 'Milestone pembayaran / TOP'],
                ['exclusions', 'Exclusions dan asumsi'],
              ] as Array<[keyof QuotationDetails, string]>).map(([key, label]) => (
                <label key={key} className="min-w-0 space-y-1">
                  <span className="block font-semibold text-slate-700">{label}</span>
                  <textarea rows={key === 'scope' || key === 'terms' ? 3 : 2}
                    className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
                    placeholder="Isi sesuai dokumen SOW, quotation, atau kesepakatan"
                    value={docDetails[key] || ''}
                    onChange={e => editDetail(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </details>

          <QuotationDocument proposal={selectedProp} format={docFormat} details={docDetails}/>
        </div>
      </div>
    </div>
  );
}
