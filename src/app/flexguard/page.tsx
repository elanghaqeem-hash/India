'use client';

import React, { useState } from 'react';
import {
  Wallet,
  ShieldCheck,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  FileCheck2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatIDR, formatDate } from '@/lib/formatters';
import { FlexGuardWallet, TokenTxType } from '@/lib/types';

export default function FlexGuardPage() {
  const store = appStore.getState();
  const [wallets, setWallets] = useState<FlexGuardWallet[]>(store.wallets);
  const [selectedWallet, setSelectedWallet] = useState<FlexGuardWallet>(wallets[0]);

  // Reserve Modal State
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveMD, setReserveMD] = useState(10);
  const [reserveScope, setReserveScope] = useState('');

  const utilizationPct = selectedWallet
    ? Math.round(((selectedWallet.consumed_balance + selectedWallet.reserved_balance) / selectedWallet.purchased_mandays) * 100)
    : 0;

  const handleReserve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWallet) return;

    if (reserveMD > selectedWallet.available_balance) {
      alert('Saldo token tidak mencukupi untuk melakukan reservasi!');
      return;
    }

    const newTx = {
      id: `tx-${Date.now()}`,
      tx_type: 'RESERVE' as TokenTxType,
      mandays: reserveMD,
      service_scope: reserveScope || 'Security Assessment Sprint On-Demand',
      reference_code: `SR-2026-${Math.floor(Math.random() * 900 + 100)}`,
      executed_by: 'Pre-Sales (Hendri)',
      created_at: new Date().toISOString(),
    };

    selectedWallet.reserved_balance += reserveMD;
    selectedWallet.available_balance -= reserveMD;
    selectedWallet.transactions.unshift(newTx);

    setWallets([...appStore.getState().wallets]);
    setShowReserveModal(false);
    setReserveScope('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                FlexGuard Cybersecurity Token Wallet
              </h1>
              <p className="text-xs text-slate-500">
                On-Demand Professional Services Wallet &bull; Immutable Ledger: Issuance, Reserve, Release & Debit.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowReserveModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Service Request (Reserve MD)</span>
          </button>
        </div>
      </div>

      {selectedWallet && (
        <div className="space-y-6">
          {/* Main Balance Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                Saldo Tersedia (Available)
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {selectedWallet.available_balance} <span className="text-sm font-bold text-blue-600">MD</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Dari total {selectedWallet.purchased_mandays} MD dibeli
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Reserved (On-Going)
              </span>
              <div className="mt-2 text-3xl font-black text-amber-600">
                {selectedWallet.reserved_balance} <span className="text-sm font-bold text-slate-500">MD</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Dalam proses eksekusi sprint
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Debited (Consumed)
              </span>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {selectedWallet.consumed_balance} <span className="text-sm font-bold text-slate-500">MD</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Laporan disetujui & BAST rilis
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Nilai Kontrak Total
              </span>
              <div className="mt-2 text-xl font-black text-slate-900">
                {formatIDR(selectedWallet.total_contract_value)}
              </div>
              <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
                Rate Efektif: {formatIDR(selectedWallet.unit_rate)}/MD
              </div>
            </div>
          </div>

          {/* Utilization Progress Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800">Tingkat Utilisasi Kontrak Token ({utilizationPct}%)</span>
              <span className="text-slate-500">Masa Berlaku s.d. {formatDate(selectedWallet.expiry_date)}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div
                style={{ width: `${(selectedWallet.consumed_balance / selectedWallet.purchased_mandays) * 100}%` }}
                className="bg-slate-800 h-full"
                title="Consumed"
              />
              <div
                style={{ width: `${(selectedWallet.reserved_balance / selectedWallet.purchased_mandays) * 100}%` }}
                className="bg-amber-500 h-full"
                title="Reserved"
              />
            </div>
            <div className="flex gap-4 text-[11px] text-slate-500 pt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                <span>Consumed: {selectedWallet.consumed_balance} MD</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Reserved: {selectedWallet.reserved_balance} MD</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span>Available: {selectedWallet.available_balance} MD</span>
              </div>
            </div>
          </div>

          {/* Ledger Transaction History */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Immutable Token Ledger (Riwayat Transaksi Akuntansi)</h2>
              <span className="text-[11px] text-slate-400 font-mono">No Delete &bull; Audit Trail Active</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Tipe Aksi</th>
                    <th className="py-2.5 px-3">Mandays</th>
                    <th className="py-2.5 px-3">Deskripsi Scope & Referensi</th>
                    <th className="py-2.5 px-3">Eksekutor</th>
                    <th className="py-2.5 px-3">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedWallet.transactions.map(tx => {
                    const isPositive = tx.tx_type === 'ISSUANCE' || tx.tx_type === 'TOPUP';
                    const isDebit = tx.tx_type === 'DEBIT';
                    const isReserve = tx.tx_type === 'RESERVE';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isDebit
                              ? 'bg-slate-900 text-white'
                              : isReserve
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {tx.tx_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {isPositive ? `+${tx.mandays}` : `-${tx.mandays}`} MD
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{tx.service_scope}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Ref: {tx.reference_code}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{tx.executed_by}</td>
                        <td className="py-3 px-3 text-slate-500">{formatDate(tx.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reserve Token Modal */}
      {showReserveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Reservasi Token Layanan</h3>
              <button onClick={() => setShowReserveModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleReserve} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Jumlah Mandays di-reserve (Maks {selectedWallet?.available_balance} MD) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedWallet?.available_balance || 100}
                  required
                  value={reserveMD}
                  onChange={e => setReserveMD(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Deskripsi Ruang Lingkup Layanan *
                </label>
                <textarea
                  required
                  value={reserveScope}
                  onChange={e => setReserveScope(e.target.value)}
                  placeholder="Contoh: Pentest Microservice Payment Gateway Sprint Release Q4..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Eksekusi Reservasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
