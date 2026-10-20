'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/formatters';
import { Tender, BidDecision, TenderSource } from '@/lib/types';

export default function TenderManagementPage() {
  const [tenders, setTenders] = useState<Tender[]>(appStore.getState().tenders);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiScorecard, setAiScorecard] = useState<{ id: string; content: string } | null>(null);

  // New Tender Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<TenderSource>('LPSE');
  const [agencyName, setAgencyName] = useState('');
  const [paguBudget, setPaguBudget] = useState<number>(500000000);
  const [summary, setSummary] = useState('');

  const filteredTenders = tenders.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.agency_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSource = selectedSource === 'all' || t.source === selectedSource;
    return matchSearch && matchSource;
  });

  const handleRunAIScorecard = async (tender: Tender) => {
    setAnalyzingId(tender.id);
    setAiScorecard(null);
    try {
      const prompt = `Lakukan evaluasi Bid/No-Bid Decision Scorecard untuk pengadaan berikut:
Nama Pengadaan: ${tender.title}
Instansi: ${tender.agency_name}
Sumber: ${tender.source}
Pagu: Rp ${tender.pagu_budget.toLocaleString('id-ID')}
Layanan: ${tender.service_type}
Ringkasan: ${tender.summary || 'Tidak ada keterangan tambahan'}

Profil Perusahaan: PT Data Enkripsi Informasi Teknologi (DefendIT360) terdaftar LK SMPI BSSN, sertifikasi ISO 27001, pengalaman pengujian perbankan & BUMN.
Berikan rekomendasi keputusan (GO / CONDITIONAL GO / NO-GO), skor kelayakan (0-100), analisis kualifikasi, gap persyaratan, dan rencana mitigasi risiko.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setAiScorecard({ id: tender.id, content: data.content });
      } else {
        alert(`Gagal: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Error AI: ${e.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleUpdateBidDecision = (id: string, decision: BidDecision) => {
    const updated = appStore.updateTender(id, { bid_decision: decision });
    if (updated) {
      setTenders([...appStore.getState().tenders]);
    }
  };

  const handleAddTender = (e: React.FormEvent) => {
    e.preventDefault();
    const newTender: Tender = {
      id: `tnd-${Date.now()}`,
      code: `TND-${source}-2026-${Math.floor(Math.random() * 900 + 100)}`,
      title,
      source,
      agency_name: agencyName,
      pagu_budget: paguBudget,
      hps_budget: Math.round(paguBudget * 0.95),
      service_type: 'VAPT',
      deadline_submission: new Date(Date.now() + 21 * 86400000).toISOString(),
      eligibility_status: 'qualified',
      bid_decision: 'pending',
      bid_score: 85,
      summary,
      created_at: new Date().toISOString(),
    };
    appStore.addTender(newTender);
    setTenders([...appStore.getState().tenders]);
    setShowAddModal(false);
    setTitle('');
    setAgencyName('');
    setSummary('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Tender Intelligence & Management Center
              </h1>
              <p className="text-xs text-slate-500">
                Pusat pengadaan pemerintah (SiRUP, LPSE, SPSE), vendor BUMN & tender swasta terintegrasi AI Bid/No-Bid Decision.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Daftarkan Tender Baru</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama paket, instansi, atau nomor tender..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
          {['all', 'LPSE', 'BUMN', 'Swasta', 'SiRUP'].map(src => (
            <button
              key={src}
              onClick={() => setSelectedSource(src)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                selectedSource === src
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {src === 'all' ? 'Semua Sumber' : src}
            </button>
          ))}
        </div>
      </div>

      {/* Tender Cards */}
      <div className="space-y-4">
        {filteredTenders.map(tnd => {
          const isAnalyzing = analyzingId === tnd.id;
          const hasScorecard = aiScorecard?.id === tnd.id;

          return (
            <div
              key={tnd.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 hover:shadow-xs transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {tnd.code}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {tnd.source}
                    </span>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/50">
                      {tnd.service_type}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">{tnd.title}</h3>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>{tnd.agency_name}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pagu Anggaran</div>
                  <div className="text-base font-black text-slate-900">{formatIDR(tnd.pagu_budget)}</div>
                  <div className="text-[11px] text-slate-500">HPS: {formatIDR(tnd.hps_budget)}</div>
                </div>
              </div>

              {/* Status and Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 text-slate-600">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Batas Akhir: <strong>{formatDate(tnd.deadline_submission)}</strong></span>
                  </div>

                  {/* Decision Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Keputusan Bid:</span>
                    <select
                      value={tnd.bid_decision}
                      onChange={e => handleUpdateBidDecision(tnd.id, e.target.value as BidDecision)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold border ${
                        tnd.bid_decision === 'go'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : tnd.bid_decision === 'conditional_go'
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : tnd.bid_decision === 'no_go'
                          ? 'border-rose-300 bg-rose-50 text-rose-800'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      <option value="pending">PENDING (Menunggu Review)</option>
                      <option value="go">GO (Ikuti Tender)</option>
                      <option value="conditional_go">CONDITIONAL GO (Butuh Mitra/Sertifikasi)</option>
                      <option value="no_go">NO-GO (Batalkan)</option>
                    </select>
                  </div>
                </div>

                <button
                  disabled={isAnalyzing}
                  onClick={() => handleRunAIScorecard(tnd)}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-3 py-1.5 text-xs shadow-xs transition-all"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>{isAnalyzing ? 'Menganalisis RKS via AI...' : 'AI Bid/No-Bid Scorecard'}</span>
                </button>
              </div>

              {/* AI Scorecard Result Drawer */}
              {hasScorecard && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                    <div className="flex items-center gap-2 font-bold text-purple-900">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span>Hasil Analisis AI Bid/No-Bid Decision Scorecard</span>
                    </div>
                    <button
                      onClick={() => setAiScorecard(null)}
                      className="text-purple-600 hover:text-purple-900 font-bold"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="whitespace-pre-line leading-relaxed text-slate-800 bg-white p-3 rounded-lg border border-purple-100">
                    {aiScorecard.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Tender Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Daftarkan Paket Tender Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddTender} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Paket Pengadaan *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Pengadaan Asesmen Keamanan Siber & VAPT 2026..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Sumber Pengadaan *</label>
                  <select
                    value={source}
                    onChange={e => setSource(e.target.value as TenderSource)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="LPSE">LPSE / SPSE</option>
                    <option value="SiRUP">SiRUP LKPP</option>
                    <option value="BUMN">Portal Pengadaan BUMN</option>
                    <option value="Swasta">Tender Swasta</option>
                    <option value="Undangan Langsung">Undangan Langsung</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama Instansi / BUMN *</label>
                  <input
                    type="text"
                    required
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    placeholder="Contoh: Kementerian / BUMN..."
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Pagu Anggaran (Rp) *</label>
                <input
                  type="number"
                  required
                  value={paguBudget}
                  onChange={e => setPaguBudget(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Ringkasan Syarat & KAK</label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  placeholder="Persyaratan izin, sertifikasi tim ahli, lingkup aset..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 text-xs shadow-xs"
                >
                  Simpan Tender
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
