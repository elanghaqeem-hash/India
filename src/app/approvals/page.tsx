'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Stamp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  MessageSquare,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatPercent, formatDate } from '@/lib/formatters';
import { ApprovalRequest } from '@/lib/types';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(appStore.getState().approvals);
  const [selectedItem, setSelectedItem] = useState<ApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision' | null>(null);
  const [comments, setComments] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const pastApprovals = approvals.filter(a => a.status !== 'pending');

  const handleAction = (id: string, status: 'approved' | 'rejected' | 'revision_requested') => {
    const approverName = 'Reza Fahlevi (Head Sales / Otorisator)';
    const updated = appStore.updateApproval(id, status, approverName, comments);
    setApprovals([...appStore.getState().approvals]);
    setSelectedItem(null);
    setActionType(null);
    setComments('');
    setNotification(`Berhasil memproses transaksi #${id}: Status diubah menjadi ${status.toUpperCase()}`);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Stamp className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Decision & Otorisasi DoA Center
              </h1>
              <p className="text-xs text-slate-500">
                Pusat persetujuan Delegation of Authority: Otorisasi Nilai Transaksi, Diskon Komersial, dan Pengecualian Margin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-800">
              {pendingApprovals.length} Menunggu Tindakan
            </span>
          </div>
        </div>
      </div>

      {notification && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{notification}</span>
        </div>
      )}

      {/* Pending Approvals Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <span>Daftar Pengajuan Pending Otorisasi</span>
          <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-extrabold">
            {pendingApprovals.length}
          </span>
        </h2>

        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <div className="font-bold text-slate-800 text-sm">Semua Otorisasi Selesai</div>
            <p className="text-xs text-slate-500 mt-1">Tidak ada quotation atau transaksi yang membutuhkan persetujuan Anda saat ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingApprovals.map(appr => (
              <div
                key={appr.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-sm">{appr.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        appr.required_level === 'director'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : appr.required_level === 'vp'
                          ? 'bg-blue-100 text-blue-900 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      }`}>
                        Level: {appr.required_level}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Diajukan oleh: <span className="font-semibold text-slate-700">{appr.requestor_name}</span> ({appr.requestor_role}) &bull; {formatDate(appr.created_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedItem(appr); setActionType('approve'); }}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Otorisasi (Approve)</span>
                    </button>
                    <button
                      onClick={() => { setSelectedItem(appr); setActionType('revision'); }}
                      className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                      Minta Revisi
                    </button>
                    <button
                      onClick={() => { setSelectedItem(appr); setActionType('reject'); }}
                      className="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 text-xs font-bold transition-colors"
                    >
                      Tolak
                    </button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 rounded-xl p-3 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block text-[11px]">Nilai Transaksi:</span>
                    <span className="font-black text-slate-900 text-sm">{formatIDR(appr.transaction_value)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[11px]">Diskon Diajukan:</span>
                    <span className={`font-black text-sm ${appr.discount_pct > 15 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatPercent(appr.discount_pct)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[11px]">Gross Margin:</span>
                    <span className={`font-black text-sm ${appr.gross_margin_pct < 25 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatPercent(appr.gross_margin_pct)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[11px]">Kepatuhan DoA:</span>
                    <span className="font-bold text-slate-800">
                      Otorisasi {appr.required_level.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Reason Explanation */}
                {appr.reason && (
                  <div className="text-xs text-slate-600 flex items-start gap-1.5 bg-amber-50/60 border border-amber-200/60 p-2.5 rounded-lg">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900">Alasan Pemicu Otorisasi: </span>
                      <span>{appr.reason}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {selectedItem && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {actionType === 'approve' && 'Konfirmasi Otorisasi (Approve)'}
                {actionType === 'revision' && 'Minta Revisi Proposal'}
                {actionType === 'reject' && 'Tolak Pengajuan Proposal'}
              </h3>
              <button
                onClick={() => { setSelectedItem(null); setActionType(null); }}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                Anda akan memproses transaksi <span className="font-bold text-slate-900">{selectedItem.title}</span> senilai <span className="font-bold text-slate-900">{formatIDR(selectedItem.transaction_value)}</span>.
              </p>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Catatan / Komentar Otorisator:</label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="Masukkan alasan atau persetujuan klausul komersial..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => { setSelectedItem(null); setActionType(null); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const statusMap = {
                    approve: 'approved' as const,
                    revision: 'revision_requested' as const,
                    reject: 'rejected' as const,
                  };
                  handleAction(selectedItem.id, statusMap[actionType]);
                }}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold text-white transition-colors ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : actionType === 'revision'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Konfirmasi Eksekusi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History / Audit Log of Past Approvals */}
      {pastApprovals.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Riwayat Otorisasi & Audit Trail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[11px]">
                  <th className="py-2 px-3">Transaksi</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Otorisator</th>
                  <th className="py-2 px-3">Tanggal</th>
                  <th className="py-2 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastApprovals.map(a => (
                  <tr key={a.id} className="text-slate-700">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{a.title}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium">{a.approved_by || '-'}</td>
                    <td className="py-2.5 px-3">{formatDate(a.approved_at)}</td>
                    <td className="py-2.5 px-3 text-slate-500 italic">{a.comments || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
