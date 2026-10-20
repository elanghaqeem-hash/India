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

export default function ProposalsPage() {
  const store = appStore.getState();
  const [proposals, setProposals] = useState<Proposal[]>(store.proposals);
  const [selectedProp, setSelectedProp] = useState<Proposal>(proposals[0]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

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
- Total Nilai Komersial: ${formatIDR(selectedProp.grand_total)} (Termasuk PPN 11%)
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
                Penerbitan Surat Penawaran Harga resmi dengan klausul komersial POJK, PPN 11%, dan terms 30-50-20.
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
                  onClick={() => setSelectedProp(prop)}
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

          <div className="quotation-document min-w-0 w-full max-w-full overflow-hidden rounded-xl sm:rounded-2xl border border-slate-300 bg-white p-4 sm:p-7 lg:p-10 shadow-md print:overflow-visible print:border-none print:shadow-none print:p-0 text-slate-900 space-y-5 sm:space-y-6">
            {/* Letterhead */}
            <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-xl">
                  <Shield className="h-7 w-7 text-cyan-400" />
                </div>
                <div className="min-w-0 break-words">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                    PT DATA ENKRIPSI INFORMASI TEKNOLOGI
                  </h2>
                  <div className="text-[11px] text-slate-500 font-medium">
                    DefendIT360 Enterprise Cybersecurity Solutions &bull; Terdaftar LK SMPI BSSN
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Gedung Tower 01 Lt. 27, Jl. Jend. Sudirman Kav. 10, Jakarta Pusat 10220
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right text-xs">
                <div className="font-bold text-slate-900">SURAT PENAWARAN HARGA</div>
                <div className="font-mono text-xs font-bold text-blue-700">{selectedProp.quotation_number}</div>
                <div className="text-[11px] text-slate-500">Tanggal: {formatDate(selectedProp.created_at)}</div>
              </div>
            </div>

            {/* Client Destination & Subject */}
            <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block text-[11px] uppercase">Kepada Yth:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedProp.company_name}</div>
                <div className="text-slate-600">Up. Bagian Pengadaan / Information Security</div>
                <div className="text-slate-500">Klasifikasi Klien: Tier {selectedProp.client_tier}</div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[11px] uppercase">Perihal / Subject:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{selectedProp.opportunity_name}</div>
                <div className="text-slate-600">Masa Berlaku Penawaran: {selectedProp.valid_days} Hari Kalender</div>
                <div className="text-slate-500">Berlaku Hingga: {formatDate(selectedProp.valid_until)}</div>
              </div>
            </div>

            {/* A mobile readable screen view; preserve all original values in the A4 print table. */}
            <div className="min-w-0">
              <div className="quotation-mobile-list space-y-3 lg:hidden print:hidden" aria-label="Rincian layanan penawaran">
                {selectedProp.line_items.map(item => (
                  <article key={item.line_number} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/40 p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-extrabold text-blue-700">#{item.line_number}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-bold leading-5 text-slate-900">{item.description}</h3>
                        <p className="mt-1.5 break-words text-[11px] leading-relaxed text-slate-500">
                          Metodologi Grey-Box &bull; Reporting Standar OWASP / OJK &bull; Termasuk 1x Retest gratis dlm 30 hari
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                      <div className="min-w-0"><dt className="text-[11px] text-slate-500">Volume</dt><dd className="mt-0.5 break-words text-xs font-semibold text-slate-800">{item.quantity} {item.unit}</dd></div>
                      <div className="min-w-0"><dt className="text-[11px] text-slate-500">Harga satuan</dt><dd className="mt-0.5 break-words text-right text-xs font-semibold text-slate-800">{formatIDR(item.unit_price)}</dd></div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-3">
                      <span className="text-xs font-semibold text-slate-600">Total layanan</span>
                      <strong className="text-sm font-extrabold text-blue-900">{formatIDR(item.line_total)}</strong>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden min-w-0 max-w-full overflow-x-auto lg:block print:block print:overflow-visible">
                <table className="quotation-desktop-table w-full min-w-[720px] border-collapse text-left text-xs print:min-w-0">
                <thead>
                  <tr className="border-y-2 border-slate-900 text-slate-900 font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-2">No</th>
                    <th className="py-2.5 px-3">Uraian Ruang Lingkup Layanan</th>
                    <th className="py-2.5 px-3 text-center">Vol</th>
                    <th className="py-2.5 px-3 text-center">Satuan</th>
                    <th className="py-2.5 px-3 text-right">Harga Satuan (Rp)</th>
                    <th className="py-2.5 px-3 text-right">Total (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedProp.line_items.map(item => (
                    <tr key={item.line_number}>
                      <td className="py-3 px-2 font-bold">{item.line_number}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.description}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Metodologi Grey-Box &bull; Reporting Standar OWASP / OJK &bull; Termasuk 1x Retest gratis dlm 30 hari
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold">{item.quantity}</td>
                      <td className="py-3 px-3 text-center text-slate-600">{item.unit}</td>
                      <td className="py-3 px-3 text-right font-medium">{formatIDR(item.unit_price)}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">{formatIDR(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="border-t-2 border-slate-900 pt-3 flex justify-end">
                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-900">{formatIDR(selectedProp.subtotal)}</span>
                  </div>
                  {selectedProp.discount_pct > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Diskon ({selectedProp.discount_pct}%):</span>
                      <span>Sudah Termasuk</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>PPN (11%):</span>
                    <span className="font-bold text-slate-900">{formatIDR(selectedProp.vat_amount)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-300 pt-2 text-sm font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-base text-blue-900">{formatIDR(selectedProp.grand_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Commercial Terms & Conditions */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-2">
              <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Syarat & Ketentuan Komersial Resmi (PKS Baseline)
              </div>
              <ul className="list-decimal pl-4 space-y-1 text-slate-600 text-[11px]">
                <li>
                  <span className="font-semibold text-slate-800">Termin Pembayaran ({selectedProp.payment_terms}): </span>
                  Termin 1 (30%) uang muka setelah Kickoff Meeting; Termin 2 (50%) setelah penyerahan Laporan Pendahuluan; Termin 3 (20%) setelah BAST Final ditandatangani.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Klausul Denda Keterlambatan: </span>
                  Denda keterlambatan ditetapkan sebesar 1&permil; (satu permil / 0.1%) per hari kalender dengan batas akumulasi maksimum 5% dari total nilai kontrak.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Rekening Resmi Pembayaran: </span>
                  Bank Mandiri KC Jakarta Sudirman &bull; No. Rek: 122-00-1928374-5 &bull; A.n. PT Data Enkripsi Informasi Teknologi.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Retesting: </span>
                  Verifikasi perbaikan (Retest) diberikan gratis sebanyak 1 (satu) kali dalam jangka waktu maksimal 30 hari kalender setelah laporan awal diserahkan.
                </li>
              </ul>
            </div>

            {/* Signatures Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-6 sm:gap-8 pt-6 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Diterima & Disetujui Klien:</span>
                <div className="font-bold text-slate-800 mt-0.5">{selectedProp.company_name}</div>
                <div className="h-16 flex items-end">
                  <div className="w-48 border-b border-slate-400" />
                </div>
                <div className="text-slate-500 text-[11px] mt-1">Nama & Jabatan Pejabat Berwenang</div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-slate-400 font-medium block">Hormat Kami,</span>
                <div className="font-bold text-slate-800 mt-0.5">PT DATA ENKRIPSI INFORMASI TEKNOLOGI</div>
                <div className="h-16 flex items-end justify-end">
                  <div className="text-center">
                    <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-800 block mb-1">
                      DIGITALLY AUTHORIZED
                    </span>
                    <div className="w-48 border-b border-slate-400" />
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-[11px] mt-1">Reza Fahlevi / Direksi</div>
                <div className="text-slate-500 text-[10px]">Head of Sales & Commercial Operations</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
