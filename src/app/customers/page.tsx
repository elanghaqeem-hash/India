'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  Shield,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Users,
  Briefcase,
  Wallet,
} from 'lucide-react';
import { appStore } from '@/lib/store';
import { formatDate } from '@/lib/formatters';
import { auditExistingSalesCustomer } from '@/lib/post-po-documents';
import { Company, ClientTier, IndustryType } from '@/lib/types';

export default function CustomersPage() {
  const [companies, setCompanies] = useState<Company[]>(appStore.getState().companies);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Company Form State
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [industry, setIndustry] = useState<IndustryType>('Banking');
  const [clientTier, setClientTier] = useState<ClientTier>('A');
  const [npwp, setNpwp] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCompany = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `comp-${Date.now()}`;
    const seq = companies.length + 1;
    const customerId = `DEIT-2026-${String(seq).padStart(3, '0')}`;

    const newCompany: Company = {
      id: newId,
      name,
      legal_name: legalName || name,
      customer_id: customerId,
      npwp: npwp || '00.000.000.0-000.000',
      industry,
      client_tier: clientTier,
      contacts: contactName ? [
        { id: `c-${Date.now()}`, name: contactName, email: contactEmail, role_title: 'PIC Utama', is_primary: true }
      ] : [],
      created_at: new Date().toISOString(),
    };

    appStore.addCompany(newCompany);
    setCompanies([...appStore.getState().companies]);
    setShowAddModal(false);
    setName('');
    setLegalName('');
    setNpwp('');
    setContactName('');
    setContactEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Customer Master & 360</h1>
              <p className="text-xs text-slate-500">
                Data master pelanggan terpadu, tiering (S-E), pemetaan stakeholder & profil risiko pembayaran.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah Pelanggan Baru</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Cari berdasarkan nama PT, Customer ID, atau industri..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
        />
      </div>

      {/* Companies Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCompanies.map(comp => {
          const activeOpps = appStore.getState().opportunities.filter(o => o.company_id === comp.id);
          const wallet = appStore.getState().wallets.find(w => w.company_id === comp.id);
          const salesAudit = auditExistingSalesCustomer(comp);

          return (
            <div
              key={comp.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {comp.customer_id}
                    </span>
                    <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 border border-indigo-200/50">
                      Tier {comp.client_tier}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-1.5">{comp.name}</h3>
                  <div className="text-[11px] text-slate-400 mt-0.5">{comp.legal_name || comp.name}</div>
                </div>

                <div className="text-right">
                  <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700">
                    {comp.industry}
                  </span>
                </div>
              </div>

              {/* Contacts & Info */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="font-medium text-[11px]">NPWP:</span>
                  <span className="font-mono text-slate-800 font-semibold">{comp.npwp || '-'}</span>
                </div>

                {comp.contacts.length > 0 && (
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      PIC Utama:
                    </span>
                    {comp.contacts.map(c => (
                      <div key={c.id} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800">{c.name} ({c.role_title})</span>
                        <span className="text-blue-600 font-medium">{c.email}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                  <div className="font-semibold text-amber-900">Form Administrasi: {salesAudit.missing.length ? salesAudit.missing.length+' isian belum terpenuhi' : 'data master terisi'}</div>
                  <Link href="/post-po" className="font-bold text-violet-700 underline underline-offset-2">Audit & Lengkapi</Link>
                </div>

                {/* Status Badges */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                      <span>{activeOpps.length} Deals Aktif</span>
                    </div>
                    {wallet && (
                      <div className="flex items-center gap-1 text-blue-700 font-bold">
                        <Wallet className="h-3.5 w-3.5 text-blue-600" />
                        <span>{wallet.available_balance} MD Token</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Sejak {formatDate(comp.created_at)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Registrasi Pelanggan Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Perusahaan / Brand *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: PT Bank Mega Pratama"
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Industri / Sektor *</label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value as IndustryType)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    {['Banking', 'Asuransi', 'Multifinance', 'Fintech', 'BUMN', 'Pemerintah', 'Healthcare', 'Retail', 'Manufaktur', 'Lainnya'].map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Client Tier *</label>
                  <select
                    value={clientTier}
                    onChange={e => setClientTier(e.target.value as ClientTier)}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  >
                    <option value="S">Tier S (BUMN Holding / Tier-1 Bank)</option>
                    <option value="A">Tier A (Enterprise Tbk / Large Bank)</option>
                    <option value="B">Tier B (Mid Enterprise)</option>
                    <option value="C">Tier C (High-Growth Fintech)</option>
                    <option value="D">Tier D (Government / Regulated Pagu)</option>
                    <option value="E">Tier E (BPR / SMB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">NPWP Badan Usaha</label>
                <input
                  type="text"
                  value={npwp}
                  onChange={e => setNpwp(e.target.value)}
                  placeholder="XX.XXX.XXX.X-XXX.XXX"
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono"
                />
              </div>

              <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Nama PIC</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Nama PIC"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email PIC</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)}
                    placeholder="email@perusahaan.com"
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
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
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
