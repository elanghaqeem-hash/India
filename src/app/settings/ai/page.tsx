'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Cpu,
  Layers,
  Send,
  Zap,
  Info,
} from 'lucide-react';
import { AIProviderConfig, AIServiceResponse } from '@/lib/types';

export default function AISettingsPage() {
  const [configs, setConfigs] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Playground state
  const [testPrompt, setTestPrompt] = useState('Analisis kebutuhan VAPT aplikasi perbankan dengan 20 API endpoints dan 4 roles');
  const [testResult, setTestResult] = useState<AIServiceResponse | null>(null);
  const [generating, setGenerating] = useState(false);

  // Edit Key states
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      if (data.success) {
        setConfigs(data.configs.sort((a: any, b: any) => a.priority - b.priority));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const apiKey = editingKeys[id];
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', id, apiKey }),
      });
      const data = await res.json();
      setSaveNotification(data.message);
      fetchConfigs();
    } catch (err: any) {
      setSaveNotification(`Gagal: ${err.message}`);
    } finally {
      setTestingId(null);
      setTimeout(() => setSaveNotification(null), 5000);
    }
  };

  const handleSaveConfig = async (id: string) => {
    const apiKey = editingKeys[id];
    const target = configs.find(c => c.id === id);
    if (!target) return;

    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          apiKey: apiKey !== undefined ? apiKey : target.apiKey,
          model: target.model,
          isEnabled: target.isEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveNotification(`Berhasil memperbarui konfigurasi ${target.name}!`);
        fetchConfigs();
      }
    } catch (e: any) {
      setSaveNotification(`Gagal menyimpan: ${e.message}`);
    }
    setTimeout(() => setSaveNotification(null), 4000);
  };

  const handleToggleEnable = async (id: string, current: boolean) => {
    try {
      await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isEnabled: !current }),
      });
      fetchConfigs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMovePriority = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= configs.length) return;

    const reordered = [...configs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIdx, 0, moved);

    const orderedIds = reordered.map(c => c.id);
    try {
      await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', orderedIds }),
      });
      fetchConfigs();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunPlayground = async () => {
    if (!testPrompt.trim()) return;
    setGenerating(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data);
      } else {
        alert(`AI Error: ${data.message}`);
      }
    } catch (e: any) {
      alert(`Gagal memanggil AI: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-md shadow-purple-500/20">
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                AI Engine & Multi-Source API Key Settings
              </h1>
              <p className="text-xs text-slate-500">
                Pusat konfigurasi multi-provider AI (Google Gemini, OpenAI, Claude, Groq) dengan rantai prioritas bertahap dan auto-failover.
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveNotification && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-900 flex items-center gap-2 animate-in fade-in">
          <Info className="h-4 w-4 text-blue-600" />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Priority Cascade Explanation */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-blue-50/40 p-4 text-xs text-slate-700 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-indigo-950">
          <Layers className="h-4 w-4 text-indigo-600" />
          <span>Mekanisme Cascading Failover AI (Prioritas Admin)</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          Ketika fitur cerdas (Smart Scoping, Pricing Advisor, RKS Extraction, Chatbot) dipanggil, sistem akan mengeksekusi provider dengan <strong>Prioritas 1</strong> terlebih dahulu. Jika kuota habis, terjadi rate limit (HTTP 429), atau offline, sistem otomatis beralih ke <strong>Prioritas 2</strong>, dan seterusnya, hingga <strong>Built-in Offline Engine</strong> sehingga operasional bisnis dijamin <strong>100% tidak pernah gagal</strong>.
        </p>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Daftar Sumber AI Terdaftar</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
              {configs.length} Providers
            </span>
          </h2>
          <span className="text-[11px] text-slate-400">Gunakan panah naik/turun untuk mengatur prioritas eksekusi</span>
        </div>

        <div className="space-y-3">
          {configs.map((config, index) => {
            const isLocal = config.provider === 'local';
            const isTesting = testingId === config.id;

            return (
              <div
                key={config.id}
                className={`rounded-xl border bg-white p-4 shadow-2xs transition-all ${
                  config.isEnabled
                    ? 'border-slate-200 hover:border-slate-300'
                    : 'border-slate-200/60 bg-slate-50/50 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    {/* Priority Badge & Move Buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                      <span className="h-6 w-6 flex items-center justify-center rounded bg-slate-900 text-white font-extrabold text-xs">
                        #{config.priority}
                      </span>
                      <button
                        disabled={index === 0}
                        onClick={() => handleMovePriority(index, 'up')}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500"
                        title="Naikkan Prioritas"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={index === configs.length - 1}
                        onClick={() => handleMovePriority(index, 'down')}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-500"
                        title="Turunkan Prioritas"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-sm">{config.name}</span>
                        {isLocal && (
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.2 rounded border border-emerald-200">
                            Offline Guaranteed
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded ${
                          config.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : config.status === 'standby'
                            ? 'bg-amber-100 text-amber-800'
                            : config.status === 'error'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {config.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Model: <span className="font-mono text-slate-600 font-semibold">{config.model}</span>
                        {config.statusMessage && (
                          <span className="ml-2 text-slate-500 italic">&bull; {config.statusMessage}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleEnable(config.id, config.isEnabled)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                        config.isEnabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {config.isEnabled ? 'Aktif' : 'Nonaktif'}
                    </button>
                    {!isLocal && (
                      <button
                        disabled={isTesting}
                        onClick={() => handleTestConnection(config.id)}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
                      >
                        <RefreshCw className={`h-3 w-3 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                        <span>{isTesting ? 'Testing...' : 'Tes Koneksi'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* API Key Input Row (if not local) */}
                {!isLocal && (
                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        API Key ({config.name}):
                      </label>
                      <div className="relative">
                        <input
                          type={showKey[config.id] ? 'text' : 'password'}
                          placeholder={config.apiKey ? '••••••••••••••••' : 'Masukkan API Key resmi...'}
                          value={editingKeys[config.id] !== undefined ? editingKeys[config.id] : config.apiKey}
                          onChange={e => setEditingKeys({ ...editingKeys, [config.id]: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-16"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey({ ...showKey, [config.id]: !showKey[config.id] })}
                          className="absolute right-2 top-2 text-[10px] text-slate-400 hover:text-slate-600 font-semibold"
                        >
                          {showKey[config.id] ? 'Sembunyikan' : 'Lihat'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-end h-full">
                      <button
                        onClick={() => handleSaveConfig(config.id)}
                        className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-3 transition-colors text-xs"
                      >
                        Simpan Key & Model
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive AI Playground & Testing Console */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900">Uji Coba Eksekusi Rantai AI (Live Test Console)</h2>
          </div>
          <span className="text-[10px] text-slate-400">Verifikasi respons failover cascade</span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Prompt Pengujian:
            </label>
            <textarea
              rows={2}
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            disabled={generating}
            onClick={handleRunPlayground}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs transition-colors shadow-xs"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{generating ? 'Mengeksekusi Rantai AI...' : 'Kirim Uji Coba'}</span>
          </button>
        </div>

        {/* AI Result Box */}
        {testResult && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Provider Digunakan:</span>
                <span className="rounded bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5">
                  {testResult.providerUsed}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">({testResult.modelUsed})</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>Latensi: <strong>{testResult.latencyMs}ms</strong></span>
                <span>Estimasi Token: <strong>~{testResult.tokensEstimate}</strong></span>
                {testResult.isFallback && (
                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                    Fallback Chain
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans bg-white p-3 rounded-lg border border-slate-200/80">
              {testResult.content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
