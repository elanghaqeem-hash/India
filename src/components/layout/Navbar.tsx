'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  RotateCcw,
  Zap,
  Menu,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { formatAIChatMessage } from '@/lib/ai-chat-format';
import { selectConversationHistory, activeChatTopic, type AIConversationTurn } from '@/lib/ai-conversation';

const WELCOME_MESSAGE = {
  sender: 'ai' as const,
  text: 'Halo! Saya Asisten AI ICOP CyberBusiness 360. Ada yang bisa saya bantu terkait scoping teknis, perhitungan harga BoQ, mitigasi risiko tender, atau status otorisasi DoA?',
  provider: 'Informasi awal (bukan hasil model AI)',
};

interface NavbarProps {
  role: string | null;
  email: string | null;
  pendingApprovalsCount?: number|null;
  desktopMenuOpen: boolean;
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  role,
  email,
  pendingApprovalsCount = null,
  desktopMenuOpen,
  mobileMenuOpen,
  onToggleMenu,
}) => {
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  // Chat content is ephemeral: only completed responses are passed as context.
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; provider?: string }>>([WELCOME_MESSAGE]);
  const [conversationTurns, setConversationTurns] = useState<AIConversationTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [visualViewport, setVisualViewport] = useState<{ height: number; top: number } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aiAssistantOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiLoading, aiAssistantOpen]);

  // Modal content uses a body portal to escape application stacking contexts.
  // Hide the mobile nav, lock the page and resize to the visible keyboard area.
  useEffect(() => {
    if (!aiAssistantOpen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('icop-ai-chat-open');

    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (viewport && window.innerWidth < 640) {
        setVisualViewport({ height: viewport.height, top: viewport.offsetTop });
      } else {
        setVisualViewport(null);
      }
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAiAssistantOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('keydown', onEscape);
      document.body.style.overflow = oldOverflow;
      document.body.classList.remove('icop-ai-chat-open');
      setVisualViewport(null);
    };
  }, [aiAssistantOpen]);

  const currentRoleInfo = {label: email||'Sesi belum terverifikasi',badge: role||'Cloudflare Access diperlukan'};
  const activeTopic = activeChatTopic(conversationTurns);
  const activeTopicLabels:Record<string,string>={
    vapt:'VAPT / penetration testing',boq:'BoQ / quotation',tender:'Tender / pengadaan',
    soc:'SOC / MDR',grc:'GRC',pricing:'Pricing',sales:'Sales / pipeline',
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isAiLoading) return;

    const userText = chatInput.trim();
    const history = selectConversationHistory(conversationTurns);
    setChatInput('');
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setIsAiLoading(true);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-india-ai-admin': '1' },
        body: JSON.stringify({ prompt: userText, history, topic_hint: activeChatTopic(conversationTurns) }),
      });
      const data = await res.json();
      if (data.success && typeof data.content === 'string' && data.content.trim()) {
        setConversationTurns(prev => [...prev, { role: 'user', content: userText }, { role: 'assistant', content: data.content }]);
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
          <div className="flex min-w-0 items-center gap-1.5">
            <Link href="/" className="flex min-w-0 items-center gap-1.5 transition-transform hover:scale-[1.01]">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-700 to-indigo-900 text-white shadow-md shadow-blue-500/20">
                <Shield className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-slate-900 text-base sm:text-lg">ICOP</span>
                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200/60">360</span>
                </div>
                <p className="hidden text-[10px] font-medium text-slate-500 sm:block -mt-1">
                  Technotama Enterprise OS
                </p>
              </div>
            </Link>
          </div>

          {/* Header Actions: AI Trigger, Settings, Approvals, Profile */}
          <div className="flex min-w-0 shrink items-center gap-1 sm:gap-3">
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
            {role==='admin'&&<Link
              href="/settings/ai"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-purple-600 transition-colors"
              title="Konfigurasi API Key & Prioritas AI"
            >
              <Key className="h-4 w-4" />
            </Link>}

            {/* Pending Approvals Notification Link */}
            <Link
              href="/approvals"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
              title={pendingApprovalsCount===null?'Status antrian approval D1 belum terverifikasi':'Approval tertunda: '+pendingApprovalsCount}
            >
              <Bell className="h-4 w-4" aria-label="Pusat approval" />
              {pendingApprovalsCount !== null && pendingApprovalsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {pendingApprovalsCount>99?'99+':pendingApprovalsCount}
                </span>
              )}
            </Link>

            {/* Right-side navigation is available even when the panel is collapsed. */}
            {role&&(
              <>
                <button type="button" onClick={onToggleMenu}
                  aria-controls="india-right-sidebar-desktop" aria-expanded={desktopMenuOpen}
                  aria-label={desktopMenuOpen?'Sembunyikan menu kanan INDIA':'Tampilkan menu kanan INDIA'}
                  title={desktopMenuOpen?'Sembunyikan menu kanan':'Tampilkan menu kanan'}
                  className="hidden h-9 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-bold text-indigo-800 transition hover:border-indigo-400 hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-500 lg:flex">
                  {desktopMenuOpen?<PanelRightClose className="h-4 w-4" aria-hidden="true"/>:<PanelRightOpen className="h-4 w-4" aria-hidden="true"/>}
                  <span>Menu</span>
                </button>
                <button type="button" onClick={onToggleMenu}
                  aria-controls="india-right-sidebar-mobile" aria-expanded={mobileMenuOpen}
                  aria-label={mobileMenuOpen?'Tutup menu kanan INDIA':'Buka menu kanan INDIA'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-500 lg:hidden">
                  {mobileMenuOpen?<X className="h-4 w-4" aria-hidden="true"/>:<Menu className="h-4 w-4" aria-hidden="true"/>}
                </button>
              </>
            )}

            {/* Read-only server-verified identity: no selectable demo roles. */}
            <div className="flex min-w-0 max-w-[110px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 sm:max-w-[260px]">
              <UserCheck className="h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true"/>
              <div className="min-w-0">
                <div className="truncate font-semibold" title={currentRoleInfo.label}>{currentRoleInfo.label}</div>
                <div className="truncate text-[10px] font-medium text-indigo-700">{currentRoleInfo.badge}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global AI Assistant Drawer / Modal */}
      {aiAssistantOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="icop-ai-chat-overlay fixed inset-0 z-[200] flex h-[100dvh] items-stretch justify-center bg-slate-900/40 p-0 backdrop-blur-xs sm:items-center sm:justify-end sm:p-4 animate-in fade-in"
          style={visualViewport ? { top: visualViewport.top + 'px', height: visualViewport.height + 'px', bottom: 'auto' } : undefined}
        >
          <div role="dialog" aria-modal="true" aria-label="ICOP AI Business Assistant"
            className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[85dvh] sm:max-h-[85dvh] sm:w-[440px] sm:rounded-2xl sm:border sm:border-slate-200">
            {/* Drawer Header */}
            <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-3 text-white sm:p-4">
              <div className="flex items-center gap-2.5">
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
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Mulai percakapan baru tanpa konteks sebelumnya"
                  title="Percakapan baru"
                  disabled={isAiLoading}
                  onClick={() => {
                    setChatMessages([WELCOME_MESSAGE]);
                    setConversationTurns([]);
                    setChatInput('');
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Tutup AI Business Assistant"
                  onClick={() => setAiAssistantOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
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

            {conversationTurns.length > 0 && (
              <p className="shrink-0 bg-indigo-50 px-3 py-1 text-[10px] font-medium text-indigo-700" role="status">
                Konteks aktif{activeTopic?' · '+activeTopicLabels[activeTopic]:''} · {selectConversationHistory(conversationTurns).length / 2} tanya-jawab terakhir. Pertanyaan lanjutan tetap terkait; gunakan Percakapan baru untuk mengganti sesi.
              </p>
            )}

            {/* Chat Messages */}
            <div ref={chatScrollRef} className="relative z-0 min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-4 text-xs">
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
                    {msg.sender === 'ai'
                      ? formatAIChatMessage(msg.text).map((segment, segmentIndex) =>
                          segment.format === 'bold' ? (
                            <strong key={segmentIndex} className="font-semibold">{segment.text}</strong>
                          ) : segment.format === 'italic' ? (
                            <em key={segmentIndex}>{segment.text}</em>
                          ) : (
                            <React.Fragment key={segmentIndex}>{segment.text}</React.Fragment>
                          ),
                        )
                      : msg.text}
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
            <form onSubmit={handleSendChat} className="relative z-20 flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:p-3">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Tanyakan analisis harga, scoping, tender..."
                aria-label="Pesan untuk AI Business Assistant"
                className="relative z-10 min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-xs"
              />
              <button
                type="submit"
                disabled={isAiLoading || !chatInput.trim()}
                aria-label="Kirim pesan ke AI"
                className="relative z-30 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
