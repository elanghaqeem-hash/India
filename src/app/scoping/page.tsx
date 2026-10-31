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
import { calculateSocSizing } from '@/lib/scoping-calculator';
import type { VaptType } from '@/lib/types';
import VaptMultiAssetScope from '@/components/VaptMultiAssetScope';
import { createVaptAsset, calculateVaptPortfolio, validateVaptAssets, vaptAssetBoqLines, type VaptAsset } from '@/lib/vapt-multi-asset';
import {SCOPING_SERVICE_TYPES, SCOPING_DEFINITIONS,validateServiceScope,summarizeServiceScope,type ScopingService} from '@/lib/scoping-service-options';
import { formatIDR } from '@/lib/formatters';
import { isSupportedScopingFileName } from '@/lib/scoping-file-types';

export default function SmartScopingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ScopingService>('VAPT');
  const [scopeInputs,setScopeInputs] = useState<Partial<Record<ScopingService,Record<string,string>>>>({});
  const serviceValues=scopeInputs[activeTab] || {};
  const missingScope=validateServiceScope(activeTab,serviceValues);
  const changeScope=(key:string,value:string)=>setScopeInputs(p=>({...p,[activeTab]:{...p[activeTab],[key]:value}}));

  // Each VAPT row owns its category, methodology, parameters and MD estimate.
  const [vaptAssets, setVaptAssets] = useState<VaptAsset[]>([createVaptAsset('initial-vapt')]);
  const updateVaptAsset = (id: string, patch: Partial<VaptAsset>) =>
    setVaptAssets(current => current.map(asset => asset.id === id ? {...asset, ...patch} : asset));
  const addVaptAsset = () => setVaptAssets(current =>
    current.length >= 30 ? current : [...current, createVaptAsset('vapt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9))]);
  const duplicateVaptAsset = (id: string) => setVaptAssets(current => {
    if (current.length >= 30) return current;
    const original = current.find(asset => asset.id === id);
    if (!original) return current;
    const copy = {...original, id: 'vapt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9), name: original.name.slice(0, 108) + ' (salinan)'};
    const pos = current.findIndex(asset => asset.id === id);
    return [...current.slice(0, pos + 1), copy, ...current.slice(pos + 1)];
  });
  const removeVaptAsset = (id: string) => setVaptAssets(current =>
    current.length <= 1 ? current : current.filter(asset => asset.id !== id));
  const patchPrimaryVapt = (patch: Partial<VaptAsset>) =>
    setVaptAssets(current => current.map((asset, index) => index === 0 ? {...asset, ...patch} : asset));

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
  const [sessionDraftMessage,setSessionDraftMessage]=useState('');

  // The portfolio is calculated from the same single-asset VAPT rule engine.
  const vaptPortfolio = calculateVaptPortfolio(vaptAssets);
  const vaptIssues = validateVaptAssets(vaptAssets);

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

  // Deliberate, session-only draft recovery. Never save document bytes,
  // extracted RKS/TOR content, provider responses, or AI consent to storage.
  const scopingSessionKey='india_scoping_form_draft_v1';
  const saveSessionDraft=()=>{
    try{
      const draft={version:1,at:Date.now(),activeTab,scopeInputs,vaptAssets,
        soc:{nServers,nNetwork,nEndpoints,nCloud,hasAD,trafficIntensity,serviceLevel,hasThreatHunting,hasIR}};
      const raw=JSON.stringify(draft);
      if(raw.length>70000)throw Error('Draft terlalu besar untuk sesi browser.');
      sessionStorage.setItem(scopingSessionKey,raw);
      setSessionDraftMessage('Draft scoping tersimpan di tab browser ini selama maksimal 30 menit. Belum tersimpan ke D1.');
    }catch(e){setSessionDraftMessage(e instanceof Error?e.message:'Penyimpanan draft sesi gagal.');}
  };
  const restoreSessionDraft=()=>{
    try{
      const raw=sessionStorage.getItem(scopingSessionKey);
      if(!raw||raw.length>70000)throw Error('Draft sesi tidak tersedia atau terlalu besar.');
      const d=JSON.parse(raw) as {version?:number;at?:number;activeTab?:string;
        scopeInputs?:Partial<Record<ScopingService,Record<string,string>>>;vaptAssets?:VaptAsset[];
        soc?:{nServers:number;nNetwork:number;nEndpoints:number;nCloud:number;hasAD:boolean;
        trafficIntensity:'low'|'medium'|'high';serviceLevel:'8x5'|'12x5'|'24x7';hasThreatHunting:boolean;hasIR:boolean}};
      if(d.version!==1||!Number.isFinite(d.at)||!d.at||d.at>Date.now()+60000||
         Date.now()-d.at>30*60*1000||!SCOPING_SERVICE_TYPES.includes(d.activeTab as ScopingService))
        throw Error('Draft sesi tidak valid atau lebih dari 30 menit.');
      if(!Array.isArray(d.vaptAssets)||d.vaptAssets.length<1||d.vaptAssets.length>30||
        d.vaptAssets.some(a=>!a||typeof a.id!=='string'||a.id.length>120||typeof a.name!=='string'||a.name.length>200))
        throw Error('Daftar aset draft tidak valid.');
      if(!d.scopeInputs||typeof d.scopeInputs!=='object'||Array.isArray(d.scopeInputs)||
        Object.entries(d.scopeInputs).some(([k,v])=>!SCOPING_SERVICE_TYPES.includes(k as ScopingService)||
         !v||typeof v!=='object'||Array.isArray(v)||Object.entries(v).some(([field,value])=>field.length>100||typeof value!=='string'||value.length>2000)))
        throw Error('Parameter draft tidak valid.');
      const soc=d.soc;
      if(!soc||![soc.nServers,soc.nNetwork,soc.nEndpoints,soc.nCloud].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)||
        !['low','medium','high'].includes(soc.trafficIntensity)||!['8x5','12x5','24x7'].includes(soc.serviceLevel)||
        [soc.hasAD,soc.hasThreatHunting,soc.hasIR].some(x=>typeof x!=='boolean'))
        throw Error('Parameter SOC pada draft tidak valid.');
      setActiveTab(d.activeTab as ScopingService);setScopeInputs(d.scopeInputs);
      setVaptAssets(d.vaptAssets);setNServers(soc.nServers);setNNetwork(soc.nNetwork);
      setNEndpoints(soc.nEndpoints);setNCloud(soc.nCloud);setHasAD(soc.hasAD);
      setTrafficIntensity(soc.trafficIntensity);setServiceLevel(soc.serviceLevel);
      setHasThreatHunting(soc.hasThreatHunting);setHasIR(soc.hasIR);
      setSessionDraftMessage('Draft scoping dipulihkan. Tinjau semua parameter sebelum transfer ke BoQ; belum tersimpan ke D1.');
    }catch(e){setSessionDraftMessage(e instanceof Error?e.message:'Pemulihan draft sesi gagal.');}
  };
  const discardSessionDraft=()=>{
    try{sessionStorage.removeItem(scopingSessionKey);setSessionDraftMessage('Draft sesi telah dihapus.');}
    catch{setSessionDraftMessage('Sesi browser tidak mendukung penghapusan draft.');}
  };

  const handleProceedToPricing = () => {
    // Transfer remains an unsaved draft. BoQ enforces all D1, role and approval rules.
    if (missingScope.length || (activeTab === 'VAPT' && vaptIssues.length)) return;
    const description = activeTab === 'SOC'
      ? 'SOC/MDR: ' + socResult.calculated_eps + ' EPS; SLA ' + serviceLevel +
        '; servers ' + nServers + '; network ' + nNetwork +
        '; endpoints ' + nEndpoints + '; cloud ' + nCloud
      : summarizeServiceScope(activeTab, serviceValues);
    const draft = activeTab === 'VAPT'
      ? {version: 2, createdAt: Date.now(), service_type: 'VAPT', items: vaptAssetBoqLines(vaptAssets)}
      : {version: 1, createdAt: Date.now(), service_type: activeTab,
          description: description.slice(0, 900), quantity: 1,
          unit: activeTab === 'SOC' ? 'Bulan' : SCOPING_DEFINITIONS[activeTab].outputUnit};
    try {
      sessionStorage.setItem('india_scoping_boq_draft_v1', JSON.stringify(draft));
      router.push('/boq?from=scoping');
    } catch {
      alert('Penyimpanan draft sesi tidak tersedia. Aktifkan session storage browser untuk melanjutkan ke BoQ.');
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
    if (!isSupportedScopingFileName(file.name)) {
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
1. Rekomendasi kategori layanan dari VAPT, SOC/MDR, CTI, ISO, PDP, Hardening, IR, GRC, DFIR, Technology, Training atau Lainnya.
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

      } else {
        setAiExtractionResult('Gagal menganalisis dokumen: ' + (data.message || 'Error'));
      }
    } catch (e: any) {
      setAiExtractionResult('Koneksi AI gagal: ' + e.message);
    } finally {
      setAiExtracting(false);
    }
  };


  const handleApplyAiScoping = () => {
        // Heuristic auto-adjust
        const lower = aiDocText.toLowerCase();
        if (/\b(dpia|ropa|pdp|privacy|perlindungan data pribadi|dpo)\b/.test(lower)) {
          setActiveTab('PDP');
        } else if (/\b(iso ?27001|iso ?27701|iso ?22301|sertifikasi)\b/.test(lower)) {
          setActiveTab('ISO');
        } else if (/\b(digital forensic|forensik|dfir|chain of custody)\b/.test(lower)) {
          setActiveTab('DFIR');
        } else if (/\b(cti|threat intelligence|dark web|brand monitoring)\b/.test(lower)) {
          setActiveTab('CTI');
        } else if (/\b(grc|rcsa|risk assessment|business continuity|cobit|governance)\b/.test(lower)) {
          setActiveTab('GRC');
        } else if (/\b(hardening|cis benchmark|secure configuration)\b/.test(lower)) {
          setActiveTab('Hardening');
        } else if (/\b(incident response|ir retainer|response readiness)\b/.test(lower)) {
          setActiveTab('IR');
        } else if (/\b(training|pelatihan|workshop|awareness|tabletop)\b/.test(lower)) {
          setActiveTab('TRAINING');
        } else if (/\b(pam|edr|xdr|waf|iam|firewall license|security technology)\b/.test(lower)) {
          setActiveTab('TECHNOLOGY');
        } else if (lower.includes('mobile') || lower.includes('android') || lower.includes('ios')) {
          patchPrimaryVapt({vapt_type:'mobile_app'});
          setActiveTab('VAPT');
        } else if (lower.includes('api') || lower.includes('microservice')) {
          patchPrimaryVapt({vapt_type:'api'});
          setActiveTab('VAPT');
        } else if (lower.includes('soc') || lower.includes('siem') || lower.includes('monitoring') || lower.includes('mdr')) {
          setActiveTab('SOC');
        } else if (lower.includes('network') || lower.includes('firewall') || lower.includes('server')) {
          patchPrimaryVapt({vapt_type:'network_infra'});
          setActiveTab('VAPT');
        } else if (lower.includes('red team') || lower.includes('apt')) {
          patchPrimaryVapt({vapt_type:'red_team'});
          setActiveTab('VAPT');
        }

        if (lower.includes('white box') || lower.includes('whitebox')) setVaptAssets(items=>items.map(asset=>({...asset,box_method:'white_box'})));
        else if (lower.includes('black box') || lower.includes('blackbox')) setVaptAssets(items=>items.map(asset=>({...asset,box_method:'black_box'})));
        else setVaptAssets(items=>items.map(asset=>({...asset,box_method:'grey_box'})));

        if (lower.includes('bank') || lower.includes('ojk') || lower.includes('fintech') || lower.includes('keuangan')) {
          setVaptAssets(items=>items.map(asset=>({...asset,is_financial_compliance:true})));
        }
    // Only counts explicitly identified in source text are transferred to the form.
    const numberFrom = (...patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = aiDocText.match(pattern);
        if (match) {
          const count = Number(match[1]);
          if (Number.isSafeInteger(count) && count > 0 && count <= 100000) return count;
        }
      }
      return null;
    };
    const api = numberFrom(/(\d+)\s*api[ -]?endpoints?/i, /api[ -]?endpoints?\s*[:=]?\s*(\d+)/i);
    const hosts = numberFrom(/(\d+)\s*hosts?/i, /hosts?\s*[:=]?\s*(\d+)/i);
    const servers = numberFrom(/(\d+)\s*servers?/i, /servers?\s*[:=]?\s*(\d+)/i);
    const screens = numberFrom(/(\d+)\s*(?:layar|screens?)/i, /(?:layar|screens?)\s*[:=]?\s*(\d+)/i);
    const roles = numberFrom(/(\d+)\s*(?:user[ -]?roles?|hak akses)/i, /(?:user[ -]?roles?|hak akses)\s*[:=]?\s*(\d+)/i);
    if (api !== null) setVaptAssets(items=>items.map(asset=>({...asset,...(asset.vapt_type==='api'?{api_n_endpoints:api}:asset.vapt_type==='web_app'?{web_n_api_endpoints:api}:{})})));
    if (hosts !== null) setVaptAssets(items=>items.map(asset=>asset.vapt_type==='network_infra'?{...asset,net_n_internal_host:hosts}:asset));
    if (servers !== null) setNServers(servers);
    if (screens !== null) setVaptAssets(items=>items.map(asset=>asset.vapt_type==='mobile_app'?{...asset,mobile_n_screens:screens}:asset));
    if (roles !== null) setVaptAssets(items=>items.map(asset=>asset.vapt_type==='web_app'?{...asset,web_n_roles:roles}:asset));
    // Explicitly identified multiple VAPT categories become independent asset rows.
    // The user can rename each asset and verify overlaps before quotation.
    const categories: VaptType[] = [];
    if (/\b(web app|website|web application|portal)\b/i.test(aiDocText)) categories.push('web_app');
    if (/\b(mobile|android|ios)\b/i.test(aiDocText)) categories.push('mobile_app');
    if (/\b(api|microservice|endpoint)\b/i.test(aiDocText)) categories.push('api');
    if (/\b(network|firewall|server|host)\b/i.test(aiDocText)) categories.push('network_infra');
    if (/\b(red team|adversary|apt)\b/i.test(aiDocText)) categories.push('red_team');
    if (/\b(source code review|secure code review|sast)\b/i.test(aiDocText)) categories.push('source_code');
    if (categories.length > 1) {
      setActiveTab('VAPT');
      setVaptAssets(current => {
        const next = [...current];
        for (const type of categories) {
          if (next.length >= 30) break;
          if (!next.some(asset => asset.vapt_type === type)) {
            const asset = createVaptAsset('from-rks-' + type + '-' + Date.now(), type);
            if (api !== null && type === 'api') asset.api_n_endpoints = api;
            if (api !== null && type === 'web_app') asset.web_n_api_endpoints = api;
            if (screens !== null && type === 'mobile_app') asset.mobile_n_screens = screens;
            if (hosts !== null && type === 'network_infra') asset.net_n_internal_host = hosts;
            if (roles !== null && type === 'web_app') asset.web_n_roles = roles;
            next.push(asset);
          }
        }
        return next;
      });
    }
    setShowAiModal(false);
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
                Formulir kalkulasi scoping teknis adaptif sesuai standar BRD Bab 3 & FRS Technotama.
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
                    onClick={handleApplyAiScoping}
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

      {/* All service categories come from the same type set accepted by BoQ. */}
      <section aria-label="Pilih jenis layanan" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 px-1">
          <h2 className="text-sm font-bold text-slate-900">Pilih Jenis Layanan untuk Scoping</h2>
          <p className="text-xs text-slate-500">Parameter, satuan dan output otomatis menyesuaikan kategori layanan Technotama.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {SCOPING_SERVICE_TYPES.map(service=><button key={service} type="button" onClick={()=>setActiveTab(service)}
            aria-pressed={activeTab===service}
            className={`flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-semibold transition-colors ${activeTab===service?'border-blue-700 bg-blue-600 text-white shadow-sm':'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}>
            {service==='VAPT'?<Layers className="h-4 w-4 shrink-0"/>:service==='SOC'?<Server className="h-4 w-4 shrink-0"/>:<FileSearch className="h-4 w-4 shrink-0"/>}
            <span className="min-w-0 break-words">{SCOPING_DEFINITIONS[service].label}</span>
          </button>)}
        </div>
      </section>

      <section aria-label="Draft scoping sesi" className="rounded-xl border border-blue-200 bg-blue-50 p-4">
       <h2 className="text-sm font-bold text-blue-950">Pemulihan draft Scoping</h2>
       <p className="mt-1 text-xs text-blue-900">Simpan manual untuk pemulihan di tab ini (maksimal 30 menit). Tidak menyimpan file RKS/TOR, teks AI, atau API key. Draft sesi bukan transaksi D1 dan tidak melompati persetujuan BoQ.</p>
       <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={saveSessionDraft} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Simpan Draft Sesi</button>
        <button type="button" onClick={restoreSessionDraft} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-900">Pulihkan Draft Sesi</button>
        <button type="button" onClick={discardSessionDraft} className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800">Hapus Draft Sesi</button>
       </div>
       {sessionDraftMessage&&<p role="status" className="mt-2 text-xs font-medium text-blue-950">{sessionDraftMessage}</p>}
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Input Form (Col 2) */}
        <div className="lg:col-span-2 space-y-5">
          {activeTab === 'VAPT' ? (
            <VaptMultiAssetScope assets={vaptAssets}
              onAdd={addVaptAsset}
              onDuplicate={duplicateVaptAsset}
              onRemove={removeVaptAsset}
              onChange={updateVaptAsset}/>
          ) : activeTab === 'SOC' ? (
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
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input type="checkbox" checked={hasAD} onChange={e=>setHasAD(e.target.checked)} className="h-4 w-4"/>
                  Active Directory sebagai log source
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input type="checkbox" checked={hasIR} onChange={e=>setHasIR(e.target.checked)} className="h-4 w-4"/>
                  IR Retainer
                </label>
              </div>
            </div>
          ) : (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Parameter Teknis {SCOPING_DEFINITIONS[activeTab].label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{SCOPING_DEFINITIONS[activeTab].subtitle}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {SCOPING_DEFINITIONS[activeTab].fields.map(field=><label key={field.key} className="block min-w-0 text-xs font-semibold text-slate-700">
                  <span>{field.label}{field.required?' (wajib)':''}</span>
                  {field.kind==='select'
                    ?<select className="mt-1.5 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
                      value={serviceValues[field.key]||''} onChange={e=>changeScope(field.key,e.target.value)}>
                      <option value="">Pilih {field.label}</option>
                      {field.options?.map(option=><option key={option} value={option}>{option}</option>)}
                    </select>
                    :<input type={field.kind==='number'?'number':'text'} min={field.kind==='number'?1:undefined}
                      max={field.kind==='number'?100000:undefined} step={field.kind==='number'?1:undefined}
                      maxLength={field.kind==='text'?350:undefined}
                      className="mt-1.5 w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-xs"
                      placeholder={field.kind==='number'?`Jumlah (${field.unit||'unit'})`:'Isi sesuai kebutuhan pelanggan'}
                      value={serviceValues[field.key]||''} onChange={e=>changeScope(field.key,e.target.value)}/>}
                  {field.help&&<span className="mt-1 block font-normal text-slate-500">{field.help}</span>}
                </label>)}
              </div>
              <p className="border-t pt-4 text-xs text-slate-500">Lengkapi parameter dari discovery / RKS. Kebutuhan delivery, effort dan harga final ditentukan Presales dan Finance melalui BoQ approval.</p>
            </section>
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
                  <div className="text-xs font-medium text-slate-500">Total Estimasi Engineering Effort</div>
                  <div className="mt-1 text-3xl font-black text-slate-900">{vaptPortfolio.total_md}
                    <span className="ml-1 text-sm font-bold text-blue-700">MD</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {vaptAssets.length} baris scope · {vaptAssets.reduce((sum, asset) => sum + (Number.isInteger(asset.asset_count) ? asset.asset_count : 0), 0)} aset
                  </p>
                </div>
                <div className="space-y-2 border-t border-blue-100 pt-3">
                  {vaptPortfolio.rows.map((row, index) => (
                    <div key={row.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="min-w-0 break-words text-slate-600">{index + 1}. {row.name} ({row.asset_count} aset)</span>
                      <strong className="shrink-0 tabular-nums text-slate-900">{row.md} MD</strong>
                    </div>
                  ))}
                </div>
                {vaptIssues.length > 0 && (
                  <div role="alert" className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-bold">Lengkapi scope sebelum transfer:</p>
                    {vaptIssues.map(issue => <p key={issue}>{issue}</p>)}
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Estimasi per aset sudah termasuk metodologi dan regulasi tiap baris.
                  Nilai quotation dan pembagian resource menunggu review Presales / Finance.
                </p>
              </div>
            ) : activeTab === 'SOC' ? (
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
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-900">{SCOPING_DEFINITIONS[activeTab].label}</p>
                <div className="border-t border-blue-100 pt-3 text-xs text-slate-600">
                  {SCOPING_DEFINITIONS[activeTab].fields.map(field=><div key={field.key} className="mb-2">
                    <span className="text-slate-500">{field.label}: </span>
                    <span className="break-words font-semibold text-slate-800">{serviceValues[field.key]||'Belum diisi'}{serviceValues[field.key]&&field.unit?' '+field.unit:''}</span>
                  </div>)}
                </div>
                {missingScope.length?<p role="status" className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-800">
                  Lengkapi {missingScope.length} parameter wajib sebelum transfer ke BoQ.
                </p>:<p className="rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                  Parameter lengkap; siap direview Presales di BoQ.
                </p>}
                <p className="text-[11px] text-slate-500">Belum ada estimasi mandays atau harga otomatis untuk kategori ini.</p>
              </div>
            )}

            {/* Transfer to Pricing Button */}
            <button
              onClick={handleProceedToPricing}
              disabled={missingScope.length>0 || (activeTab==='VAPT' && vaptIssues.length>0)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 transition-all mt-4"
            >
              <span>Transfer Draft Scoping ke BoQ</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Info className="h-4 w-4 text-slate-400" />
              <span>Ketentuan Kalkulasi</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Untuk VAPT dan SOC, hasil estimasi mengikuti kalkulator yang tersedia. Kategori lain menggunakan parameter standar tanpa harga/effort otomatis. Transfer ke BoQ tidak menyimpan transaksi ke D1: Presales harus melengkapi penawaran, Finance memeriksa costing, dan approval tetap berlaku.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
