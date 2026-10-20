'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSearch,
  ShieldAlert,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Info,
  UploadCloud,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { calculateVaptMandays, calculateSocSizing } from '@/lib/scoping-calculator';
import { VaptType, BoxMethod, ServiceType } from '@/lib/types';
import { formatIDR } from '@/lib/formatters';

export default function SmartScopingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'VAPT' | 'SOC'>('VAPT');

  // VAPT Form State
  const [vaptType, setVaptType] = useState<VaptType>('web_app');
  const [boxMethod, setBoxMethod] = useState<BoxMethod>('grey_box');
  const [isFinancial, setIsFinancial] = useState<boolean>(true);
  const [webComplexity, setWebComplexity] = useState<'simple' | 'medium' | 'complex' | 'critical'>('medium');
  const [apiEndpoints, setApiEndpoints] = useState<number>(15);
  const [userRoles, setUserRoles] = useState<number>(4);
  const [mobilePlatform, setMobilePlatform] = useState<'android' | 'ios' | 'both'>('both');
  const [mobileScreens, setMobileScreens] = useState<number>(18);
  const [infraHosts, setInfraHosts] = useState<number>(20);
  const [redteamScope, setRedteamScope] = useState<'assumed_breach' | 'limited' | 'standard' | 'full_apt'>('standard');

  // SOC Form State
  const [nServers, setNServers] = useState<number>(25);
  const [nNetwork, setNNetwork] = useState<number>(10);
  const [nEndpoints, setNEndpoints] = useState<number>(150);
  const [nCloud, setNCloud] = useState<number>(4);
  const [hasAD, setHasAD] = useState<boolean>(true);
  const [trafficIntensity, setTrafficIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [serviceLevel, setServiceLevel] = useState<'8x5' | '12x5' | '24x7'>('24x7');
  const [hasThreatHunting, setHasThreatHunting] = useState<boolean>(true);
  const [hasIR, setHasIR] = useState<boolean>(false);

  // Live Calculations
  const calculatedMD = calculateVaptMandays({
    vapt_type: vaptType,
    box_method: boxMethod,
    is_financial_compliance: isFinancial,
    web_complexity: webComplexity,
    web_n_api_endpoints: apiEndpoints,
    web_n_roles: userRoles,
    mobile_platform: mobilePlatform,
    mobile_n_screens: mobileScreens,
    net_n_internal_host: infraHosts,
    redteam_scope: redteamScope,
  });

  const socResult = calculateSocSizing({
    n_servers: nServers,
    n_network_devices: nNetwork,
    n_endpoints: nEndpoints,
    n_cloud_services: nCloud,
    has_active_directory: hasAD,
    traffic_intensity: trafficIntensity,
    service_level: serviceLevel,
    has_threat_hunting: hasThreatHunting,
    has_ir_retainer: hasIR,
  });

  const handleProceedToPricing = () => {
    if (activeTab === 'VAPT') {
      router.push(`/pricing?service=VAPT&md=${calculatedMD}&type=${vaptType}`);
    } else {
      router.push(`/pricing?service=SOC&eps=${socResult.calculated_eps}&mrc=${socResult.recommended_mrc}`);
    }
  };

  // AI Extraction State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDocText, setAiDocText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiExtractionResult, setAiExtractionResult] = useState<string | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<{ name: string; format: string; chars: number; truncated: boolean } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [aiAnalysisSucceeded, setAiAnalysisSucceeded] = useState(false);


  const handleDocumentUpload = async (file?: File) => {
    if (!file) return;
    setAiExtractionResult(null);
    setAiAnalysisSucceeded(false);
    setAiConsent(false);
    setUploadError('');
    setUploadedDocument(null);
    setAiDocText('');
    if (!/\\.(pdf|docx|txt)$/i.test(file.name)) {
      setUploadError('Format tidak didukung. Pilih PDF, DOCX, atau TXT.');
      return;
    }
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      setUploadError('File harus berisi data dan berukuran maksimal 8 MB.');
      return;
    }
    setUploadingDocument(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/scoping/upload', {
        method: 'POST',
        headers: { 'x-india-document-upload': '1' },
        body: form,
      });
      // The public demo can read documents locally without sending the file to a backend.
      // A 503 indicates D1/Access is not yet configured; other auth failures stay blocked.
      const data = res.status === 503
        ? await (async () => {
            const { extractScopingDocument } = await import('@/lib/scoping-upload');
            const result = await extractScopingDocument(file);
            return { success: true, filename: file.name, ...result };
          })()
        : await res.json();
      if (!data.success || (!res.ok && res.status !== 503)) throw new Error(data.message || 'File gagal diproses.');
      setAiDocText(data.text);
      setUploadedDocument({ name: data.filename, format: data.format, chars: data.text.length, truncated: !!data.truncated });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Dokumen tidak dapat dibaca.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleAiExtract = async () => {
    if (!aiDocText.trim() || uploadingDocument || !aiConsent) return;
    setAiExtracting(true);
    setAiExtractionResult(null);
    setAiAnalysisSucceeded(false);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-india-ai-admin': '1' },
        body: JSON.stringify({
          task_type: 'scoping_analysis',
          prompt: `Ekstrak spesifikasi teknis dan parameter scoping dari dokumen RKS/TOR/RFP berikut:\n\n${aiDocText.slice(0, 11000)}\n\nTentukan:
1. Rekomendasi Service (VAPT Web, Mobile, API, Network, atau SOC MDR).
2. Metodologi (Black Box / Grey Box / White Box).
3. Estimasi kompleksitas, jumlah endpoint/host/servers.
4. Kebutuhan kepatuhan (POJK/BSSN/ISO27001).
5. Ringkasan singkat alasan rekomendasi.`
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiExtractionResult(data.content);
        setAiAnalysisSucceeded(true);
        // Heuristic auto-adjust
        const lower = aiDocText.toLowerCase();
        if (lower.includes('mobile') || lower.includes('android') || lower.includes('ios')) {
          setVaptType('mobile_app');
          setActiveTab('VAPT');
        } else if (lower.includes('api') || lower.includes('microservice')) {
          setVaptType('api');
          setActiveTab('VAPT');
        } else if (lower.includes('soc') || lower.includes('siem') || lower.includes('monitoring') || lower.includes('mdr')) {
          setActiveTab('SOC');
        } else if (lower.includes('network') || lower.includes('firewall') || lower.includes('server')) {
          setVaptType('network_infra');
          setActiveTab('VAPT');
        } else if (lower.includes('red team') || lower.includes('apt')) {
          setVaptType('red_team');
          setActiveTab('VAPT');
        }

        if (lower.includes('white box') || lower.includes('whitebox')) setBoxMethod('white_box');
        else if (lower.includes('black box') || lower.includes('blackbox')) setBoxMethod('black_box');
        else setBoxMethod('grey_box');

        if (lower.includes('bank') || lower.includes('ojk') || lower.includes('fintech') || lower.includes('keuangan')) {
          setIsFinancial(true);
        }
      } else {
        setAiExtractionResult('Gagal menganalisis dokumen: ' + (data.message || 'Error'));
      }
    } catch (e: any) {
      setAiExtractionResult('Koneksi AI gagal: ' + e.message);
    } finally {
      setAiExtracting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <FileSearch className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Smart Scoping Assessment Engine</h1>
              <p className="text-xs text-slate-500">
                Formulir kalkulasi scoping teknis adaptif sesuai standar BRD Bab 3 & FRS DefendIT360.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAiModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all self-start sm:self-auto"
          >
            <Sparkles className="h-4 w-4 text-cyan-200" />
            <span>AI Auto-Extract RKS / TOR</span>
          </button>
        </div>
      </div>

      {/* AI Extraction Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-900">AI Auto-Extract Scoping dari Dokumen RKS / TOR</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Unggah file RKS, KAK, atau TOR untuk membaca teks, atau tempelkan isi dokumen secara manual. Periksa teks sebelum mengirimkannya ke AI yang dikonfigurasi di India.
            </p>

            <div className="space-y-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/40 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <UploadCloud className="h-5 w-5 text-indigo-600" />
                Upload Dokumen RKS / KAK
              </div>
              <label className={`flex min-h-[64px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-3 text-center text-xs font-bold text-indigo-700 transition-colors hover:bg-indigo-50 ${uploadingDocument ? 'pointer-events-none opacity-60' : ''}`}>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  disabled={uploadingDocument || aiExtracting}
                  onChange={e => { void handleDocumentUpload(e.target.files?.[0]); e.target.value = ''; }}
                  className="sr-only"
                  aria-label="Pilih dokumen RKS atau KAK dari perangkat"
                />
                <span>{uploadingDocument ? 'Membaca dokumen...' : 'Pilih file dari HP / komputer'}</span>
                <span className="font-normal text-slate-500">PDF, DOCX, TXT • maksimal 8 MB</span>
              </label>
              {uploadedDocument && (
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-200 bg-white p-3 text-xs" aria-live="polite">
                  <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800" title={uploadedDocument.name}>{uploadedDocument.name}</p>
                    <p className="text-slate-500">{uploadedDocument.format} • {uploadedDocument.chars.toLocaleString('id-ID')} karakter terbaca</p>
                    {uploadedDocument.truncated && <p className="mt-1 text-amber-700">Teks dipotong pada 60.000 karakter. Periksa kelengkapan isinya.</p>}
                  </div>
                  <button type="button" aria-label="Hapus dokumen yang dipilih" title="Hapus dokumen" className="rounded p-1 text-slate-500 hover:text-rose-600" onClick={() => { setUploadedDocument(null); setAiDocText(''); setAiExtractionResult(null); setAiAnalysisSucceeded(false); }}>
                    &times;
                  </button>
                </div>
              )}
              {uploadError && <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-rose-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{uploadError}</p>}
              <p className="text-[11px] leading-relaxed text-slate-500">File hanya dibaca untuk mengekstrak teks, tidak disimpan sebagai lampiran. PDF hasil scan tanpa teks memerlukan OCR terlebih dahulu.</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Teks Ruang Lingkup Dokumen Klien:
              </label>
              <textarea
                value={aiDocText}
                onChange={e => { setAiDocText(e.target.value); setAiExtractionResult(null); setAiAnalysisSucceeded(false); }}
                placeholder="Contoh: Dibutuhkan uji penetrasi keamanan Web Application Core Banking dan Mobile Banking iOS & Android dengan metodologi Grey-Box sesuai POJK No. 11/POJK.03/2022, mencakup 30 API endpoint dan 25 halaman layar..."
                rows={6}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {aiDocText.length > 11000 && (
              <p className="text-[11px] text-amber-700">Analisis AI hanya menggunakan 11.000 karakter pertama. Ringkas atau edit teks untuk memastikan seluruh parameter penting tercakup.</p>
            )}
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-600">
              <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)} />
              <span>Saya berwenang mengirimkan teks ini ke provider AI sesuai urutan konfigurasi India dan telah memastikan izin penggunaan data klien. Analisis AI saat ini memerlukan hak akses Admin.</span>
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                disabled={aiExtracting || uploadingDocument || !aiDocText.trim() || !aiConsent}
                onClick={handleAiExtract}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
              >
                {aiExtracting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Menganalisis Multi-Source AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Ekstrak Parameter Teknis</span>
                  </>
                )}
              </button>
            </div>

            {aiExtractionResult && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs space-y-2 mt-4 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-indigo-950">
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                  <span>{aiAnalysisSucceeded ? "Hasil Analisis AI & Rekomendasi Parameter:" : "Analisis belum berhasil:"}</span>
                </div>
                <div className="prose prose-xs text-slate-800 whitespace-pre-wrap leading-relaxed text-[11px] bg-white p-3 rounded-lg border border-indigo-100 max-h-56 overflow-y-auto">
                  {aiExtractionResult}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    disabled={!aiAnalysisSucceeded}
                    onClick={() => setShowAiModal(false)}
                    className="disabled:opacity-50 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                  >
                    Terapkan Nilai ke Formulir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Type Selection Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs max-w-md">
        <button
          onClick={() => setActiveTab('VAPT')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'VAPT'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>VAPT / Pentest Scoping</span>
        </button>
        <button
          onClick={() => setActiveTab('SOC')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SOC'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          <span>SOC / MDR Sizing</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Form (Col 2) */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'VAPT' ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Parameter Teknis VAPT</span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                  Rule-based Estimation
                </span>
              </h2>

              {/* VAPT Type Grid */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">Pilar / Kategori Asset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'web_app', label: 'Web Application' },
                    { id: 'mobile_app', label: 'Mobile App (Android/iOS)' },
                    { id: 'api', label: 'API / Microservices' },
                    { id: 'network_infra', label: 'Network & Infra' },
                    { id: 'red_team', label: 'Red Team Simulation' },
                    { id: 'source_code', label: 'Source Code Review' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setVaptType(t.id as VaptType)}
                      className={`p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                        vaptType === t.id
                          ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold ring-1 ring-blue-600'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Box Methodology & Financial Trigger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Metodologi Uji</label>
                  <select
                    value={boxMethod}
                    onChange={e => setBoxMethod(e.target.value as BoxMethod)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="black_box">Black-Box (Faktor 0.9x)</option>
                    <option value="grey_box">Grey-Box (Standard 1.0x)</option>
                    <option value="white_box">White-Box / Source Code (Faktor 1.3x)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Sektor Keuangan / Regulasi</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFinancial}
                        onChange={e => setIsFinancial(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Pemenuhan POJK / SEOJK / PCI-DSS (+2 MD)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Conditional Dynamic Inputs per Asset */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                {vaptType === 'web_app' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Kompleksitas Aplikasi</label>
                        <select
                          value={webComplexity}
                          onChange={e => setWebComplexity(e.target.value as any)}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        >
                          <option value="simple">Simple (3 MD base)</option>
                          <option value="medium">Medium (5 MD base)</option>
                          <option value="complex">Complex (8 MD base)</option>
                          <option value="critical">Critical / Core Banking (12 MD base)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Endpoint API</label>
                        <input
                          type="number"
                          value={apiEndpoints}
                          onChange={e => setApiEndpoints(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Role Hak Akses</label>
                        <input
                          type="number"
                          value={userRoles}
                          onChange={e => setUserRoles(Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {vaptType === 'mobile_app' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Platform</label>
                      <select
                        value={mobilePlatform}
                        onChange={e => setMobilePlatform(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      >
                        <option value="android">Android Only (1.0x)</option>
                        <option value="ios">iOS Only (1.0x)</option>
                        <option value="both">Both Android & iOS (1.7x)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Estimasi Jumlah Layar (Screens)</label>
                      <input
                        type="number"
                        value={mobileScreens}
                        onChange={e => setMobileScreens(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                {vaptType === 'network_infra' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Jumlah Internal Host / IP</label>
                      <input
                        type="number"
                        value={infraHosts}
                        onChange={e => setInfraHosts(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                      />
                    </div>
                  </div>
                )}

                {vaptType === 'red_team' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">Skenario Simulasi Red Team</label>
                    <select
                      value={redteamScope}
                      onChange={e => setRedteamScope(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                    >
                      <option value="assumed_breach">Assumed Breach (15 MD)</option>
                      <option value="limited">Limited Adversary Simulation (20 MD)</option>
                      <option value="standard">Standard Adversary Attack Simulation (30 MD)</option>
                      <option value="full_apt">Full-Scope Advanced Persistent Threat (45 MD)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* SOC Sizing Form */
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Infrastruktur & Log Source SOC/MDR</span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 font-semibold">
                  EPS Sizing Engine
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Servers (35 EPS/unit)</label>
                  <input
                    type="number"
                    value={nServers}
                    onChange={e => setNServers(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Network Devices (25 EPS)</label>
                  <input
                    type="number"
                    value={nNetwork}
                    onChange={e => setNNetwork(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Endpoints/Workstations</label>
                  <input
                    type="number"
                    value={nEndpoints}
                    onChange={e => setNEndpoints(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Cloud Accounts</label>
                  <input
                    type="number"
                    value={nCloud}
                    onChange={e => setNCloud(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Intensitas Trafik</label>
                  <select
                    value={trafficIntensity}
                    onChange={e => setTrafficIntensity(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="low">Low (0.7x)</option>
                    <option value="medium">Medium (1.0x)</option>
                    <option value="high">High / Burst (1.5x)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">SLA Jam Operasional</label>
                  <select
                    value={serviceLevel}
                    onChange={e => setServiceLevel(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="8x5">8x5 Hari Kerja</option>
                    <option value="12x5">12x5 Hari Kerja</option>
                    <option value="24x7">24x7 Non-Stop Monitoring (1.5x)</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasThreatHunting}
                      onChange={e => setHasThreatHunting(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Proactive Threat Hunting</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Output Summary Card (Col 1) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-blue-100 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Hasil Kalkulasi Scope</span>
              <Sparkles className="h-4 w-4 text-blue-600" />
            </div>

            {activeTab === 'VAPT' ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Estimasi Engineering Effort:</div>
                  <div className="text-3xl font-black text-slate-900 mt-0.5">
                    {calculatedMD} <span className="text-sm font-bold text-blue-700">Man-Days (MD)</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-blue-100 pt-3">
                  <div className="flex justify-between">
                    <span>Metodologi:</span>
                    <span className="font-semibold text-slate-900 capitalize">{boxMethod.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kepatuhan Finansial:</span>
                    <span className="font-semibold text-slate-900">{isFinancial ? '+2 MD' : 'Standard'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Baseline Alokasi Tim:</span>
                    <span className="font-semibold text-slate-900">Lead + Senior + Junior</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500 font-medium">Estimasi Kapasitas EPS:</div>
                  <div className="text-3xl font-black text-slate-900 mt-0.5">
                    {socResult.calculated_eps.toLocaleString('id-ID')} <span className="text-sm font-bold text-blue-700">EPS</span>
                  </div>
                  <div className="mt-1 inline-block rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                    Tier: {socResult.eps_tier.toUpperCase()}
                  </div>
                </div>

                <div className="border-t border-blue-100 pt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>SLA:</span>
                    <span className="font-semibold text-slate-900">{serviceLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rekomendasi MRC:</span>
                    <span className="font-bold text-emerald-700">{formatIDR(socResult.recommended_mrc)}/bln</span>
                  </div>
                </div>
              </div>
            )}

            {/* Transfer to Pricing Button */}
            <button
              onClick={handleProceedToPricing}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all mt-4"
            >
              <span>Transfer ke Dynamic Pricing</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Info className="h-4 w-4 text-slate-400" />
              <span>Ketentuan Kalkulasi</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Hasil kalkulasi scoping ini menjadi dasar pembentukan BoQ Komponen A (HR Staffing). Estimasi final tetap dapat disesuaikan oleh Pre-Sales Engineer sebelum diajukan ke otorisasi DoA.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
