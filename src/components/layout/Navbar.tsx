'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Bell,
  UserCheck,
  Search,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  Key,
  X,
  Send,
  Bot,
  Zap,
} from 'lucide-react';
import { SystemRole } from '@/lib/types';

interface NavbarProps {
  currentRole: SystemRole;
  onRoleChange: (role: SystemRole) => void;
  pendingApprovalsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  pendingApprovalsCount = 1,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  // Chatbot State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; provider?: string }>>([
    {
      sender: 'ai',
      text: 'Halo! Saya Asisten AI ICOP CyberBusiness 360. Ada yang bisa saya bantu terkait scoping teknis, perhitungan harga BoQ, mitigasi risiko tender, atau status otorisasi DoA?',
      provider: 'Informasi awal (bukan hasil model AI)',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [visibleViewport, setVisibleViewport] = useState<{ height: number; top: number } | null>(null);

  // The assistant is a modal on mobile: prevent page scroll and support Escape.
  useEffect(() => {
    if (!aiAssistantOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAiAssistantOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [aiAssistantOpen]);

  // Android's virtual keyboard can resize the *visual* viewport without
  // resizing 100dvh. Keep the composer inside the actually visible area.
  useEffect(() => {
    if (!aiAssistantOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const syncViewport = () => setVisibleViewport({
      height: viewport.height,
      top: viewport.offsetTop,
    });
    syncViewport();
    viewport.addEventListener('resize', syncViewport);
    viewport.addEventListener('scroll', syncViewport);
    return () => {
      viewport.removeEventListener('resize', syncViewport);
      viewport.removeEventListener('scroll', syncViewport);
      setVisibleViewport(null);
    };
  }, [aiAssistantOpen]);

  const roles: Array<{ role: SystemRole; label: string; badge: string }> = [
    { role: 'sales', label: 'M. Nadhil (Sales / AM)', badge: 'Maker' },
    { role: 'pre_sales', label: 'Hendri (Pre-Sales Eng)', badge: 'Solution & Pricing' },
    { role: 'head_sales', label: 'Reza Fahlevi (Head Sales)', badge: 'VP / Approver' },
    { role: 'management', label: 'Direktur Utama (Management)', badge: 'Director / Final' },
    { role: 'project_manager', label: 'Bambang (Project Manager)', badge: 'Delivery' },
    { role: 'client_maker', label: 'Budi Santoso (Klien Maker)', badge: 'Portal Klien' },
  ];

  const currentRoleInfo = roles.find(r => r.role === currentRole) || roles[0];

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiLoading) return;

    const userText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-india-ai-admin': '1' },
        body: JSON.stringify({ prompt: userText }),
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages(prev => [
          ...prev,
          { sender: 'ai', text: data.content, provider: data.providerUsed },
        ]);
      } else {
        setChatMessages(prev => [
          ...prev,
          { sender: 'ai', text: `Maaf, terjadi kesalahan: ${data.message}` },
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: 'ai', text: `Gagal memanggil AI: ${err.message}` },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <>
      <header className="no-print sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="flex h-16 min-w-0 items-center justify-between gap-2 px-3 sm:px-6">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.01]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 text-white shadow-md shadow-blue-500/20">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-slate-900 text-base sm:text-lg">ICOP</span>
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60">360</span>
                </div>
                <p className="hidden text-[10px] font-medium text-slate-500 sm:block -mt-1">
                  DefendIT360 Enterprise OS
                </p>
              </div>
            </Link>
          </div>

          {/* Global Quick Search (Desktop) */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari Customer, Opportunity, Quotation, Tender..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs font-normal text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          {/* Header Actions: AI Trigger, Settings, Approvals, Profile */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            {/* AI Assistant Quick Trigger */}
            <button
              onClick={() => setAiAssistantOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:from-purple-700 hover:to-indigo-700 transition-all"
              title="Buka AI Business Assistant"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
              <span className="hidden sm:inline">AI Assistant</span>
            </button>

            {/* AI API Settings Shortcut */}
            <Link
              href="/settings/ai"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-purple-600 transition-colors"
              title="Konfigurasi API Key & Prioritas AI"
            >
              <Key className="h-4 w-4" />
            </Link>

            {/* Pending Approvals Notification Link */}
            <Link
              href="/approvals"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              title="Pusat Otorisasi & Keputusan"
            >
              <Bell className="h-4 w-4" />
              {pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {pendingApprovalsCount}
                </span>
              )}
            </Link>

            {/* Interactive Role Selector */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 sm:gap-2 rounded-lg border border-slate-200 bg-white py-1.5 px-2 sm:px-3 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors focus:outline-none"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                  <UserCheck className="h-3.5 w-3.5" />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-semibold text-slate-900 leading-tight">{currentRoleInfo.label}</div>
                  <div className="text-[10px] text-blue-600 font-medium">{currentRoleInfo.badge}</div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    Pilih Profil & Role (RBAC Simulation)
                  </div>
                  <Link href="/settings/ai" onClick={() => setDropdownOpen(false)} className="mb-1 block rounded-lg px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 sm:hidden">Pengaturan AI & API Key</Link>
                  {roles.map(r => (
                    <button
                      key={r.role}
                      onClick={() => {
                        onRoleChange(r.role);
                        setDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors ${
                        currentRole === r.role
                          ? 'bg-blue-50 text-blue-800 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div>{r.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{r.badge}</div>
                      </div>
                      {currentRole === r.role && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global AI Assistant Drawer / Modal */}
      {aiAssistantOpen && (
        <div
          className="fixed inset-0 z-[100] flex h-[100dvh] items-stretch justify-center bg-slate-900/40 backdrop-blur-xs p-0 sm:items-center sm:justify-end sm:p-4 animate-in fade-in"
          style={visibleViewport ? { height: visibleViewport.height + 'px', top: visibleViewport.top + 'px', bottom: 'auto' } : undefined}
        >
          <div role="dialog" aria-modal="true" aria-label="ICOP AI Business Assistant" className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[85dvh] sm:max-h-[85dvh] sm:w-[440px] sm:rounded-2xl sm:border sm:border-slate-200">
            {/* Drawer Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-3 text-white sm:p-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-cyan-300">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">ICOP AI Business Assistant</h3>
                  <div className="text-[10px] text-slate-300 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Koneksi AI Admin: hasil sesuai provider aktif</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiAssistantOpen(false)}
                type="button"
                aria-label="Tutup AI Business Assistant"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Context Chips */}
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
              {[
                'Analisis Margin BoQ VAPT',
                'Syarat Tender LPSE Bank',
                'Status Otorisasi DoA',
                'Skenario Saldo FlexGuard',
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => setChatInput(chip)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-400 text-slate-700 font-medium transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4 text-xs">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 leading-relaxed whitespace-pre-line ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-100 text-slate-900 border border-slate-200/80 rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.provider && (
                    <span className="text-[9px] text-slate-400 mt-1 font-mono">
                      Via: {msg.provider}
                    </span>
                  )}
                </div>
              ))}
              {isAiLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 italic p-2">
                  <Sparkles className="h-4 w-4 text-purple-600 animate-spin" />
                  <span>AI sedang menganalisis dokumen dan aturan bisnis...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-3">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Tanyakan analisis harga, scoping, tender..."
                aria-label="Pesan untuk AI Business Assistant"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-xs"
              />
              <button
                type="submit"
                disabled={isAiLoading || !chatInput.trim()}
                aria-label="Kirim pesan ke AI"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
