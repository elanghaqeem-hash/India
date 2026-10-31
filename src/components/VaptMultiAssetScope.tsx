'use client';

import React from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  calculateVaptAssetMandays,
  VAPT_ASSET_TYPES,
  createVaptAsset,
  type VaptAsset,
} from '@/lib/vapt-multi-asset';
import type { BoxMethod, VaptType } from '@/lib/types';

type Props = {
  assets: VaptAsset[];
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onChange: (id: string, patch: Partial<VaptAsset>) => void;
};

const fieldClass = 'mt-1.5 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';
const labelClass = 'block min-w-0 text-xs font-semibold text-slate-700';

export default function VaptMultiAssetScope({assets, onAdd, onDuplicate, onRemove, onChange}: Props) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Scoping VAPT multi aset">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Parameter Teknis VAPT <span className="ml-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-700">Multi-Asset</span></h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Tambahkan aplikasi, API, mobile, infrastruktur atau scope lainnya dalam satu assessment.
            Setiap baris memiliki parameter dan estimasi MD yang terpisah.
          </p>
        </div>
        <button type="button" onClick={onAdd} disabled={assets.length >= 30}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40">
          <Plus className="h-4 w-4" /> Tambah Aset
        </button>
      </div>
      {assets.map((asset, index) => {
        const patch = (change: Partial<VaptAsset>) => onChange(asset.id, change);
        const nonnegative = (value: string) => value === '' ? 0 : Number(value);
        return (
          <article key={asset.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60" aria-label={'Aset VAPT ' + (index + 1)}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900">Aset {index + 1} · {asset.name || 'Tanpa nama'}</p>
                <p className="mt-1 text-[11px] text-slate-500">{calculateVaptAssetMandays(asset)} MD · {asset.asset_count} aset sejenis</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onDuplicate(asset.id)} disabled={assets.length >= 30} aria-label={'Duplikasi aset ' + (index + 1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-blue-50 disabled:opacity-40">
                  <Copy className="h-3.5 w-3.5" /> Duplikasi
                </button>
                <button type="button" onClick={() => onRemove(asset.id)} disabled={assets.length === 1} aria-label={'Hapus aset ' + (index + 1)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2 sm:p-4">
              <label className={labelClass}>Nama / Identitas Aset *
                <input className={fieldClass} maxLength={120} value={asset.name}
                  placeholder="Contoh: Internet Banking, Mobile Banking"
                  onChange={e => patch({name: e.target.value})}/>
              </label>
              <label className={labelClass}>Pilar / Kategori Asset
                <select className={fieldClass} value={asset.vapt_type}
                  onChange={e => {
                    const nextType = e.target.value as VaptType;
                    const defaults = createVaptAsset(asset.id, nextType);
                    const formerLabel = VAPT_ASSET_TYPES.find(x => x.id === asset.vapt_type)?.label;
                    patch({...defaults, name: asset.name === formerLabel ? defaults.name : asset.name,
                      asset_count: asset.asset_count, box_method: asset.box_method, is_financial_compliance: asset.is_financial_compliance});
                  }}>
                  {VAPT_ASSET_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>Jumlah Aset dengan Profil yang Sama
                <input className={fieldClass} type="number" min={1} max={100} step={1} value={asset.asset_count}
                  onChange={e => patch({asset_count: nonnegative(e.target.value)})}/>
                <span className="mt-1 block text-[11px] font-normal text-slate-500">Untuk sistem berbeda, gunakan Tambah Aset agar parameternya independen.</span>
              </label>
              <label className={labelClass}>Metodologi Uji
                <select className={fieldClass} value={asset.box_method}
                  onChange={e => patch({box_method: e.target.value as BoxMethod})}>
                  <option value="black_box">Black-Box (0.9x)</option>
                  <option value="grey_box">Grey-Box (1.0x)</option>
                  <option value="white_box">White-Box (1.3x)</option>
                </select>
              </label>
              <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-slate-700 sm:col-span-2">
                <input className="h-4 w-4 rounded border-slate-300" type="checkbox"
                  checked={asset.is_financial_compliance} onChange={e => patch({is_financial_compliance: e.target.checked})}/>
                Kepatuhan sektor keuangan (POJK / SEOJK / PCI-DSS, +2 MD per aset)
              </label>

              {asset.vapt_type === 'web_app' && <>
                <label className={labelClass}>Kompleksitas Aplikasi
                  <select className={fieldClass} value={asset.web_complexity}
                    onChange={e => patch({web_complexity: e.target.value as VaptAsset['web_complexity']})}>
                    <option value="simple">Simple (3 MD)</option>
                    <option value="medium">Medium (5 MD)</option>
                    <option value="complex">Complex (8 MD)</option>
                    <option value="critical">Critical / Core Banking (12 MD)</option>
                  </select>
                </label>
                <label className={labelClass}>Jumlah API Endpoint dalam Aplikasi
                  <input className={fieldClass} type="number" min={0} max={100000} value={asset.web_n_api_endpoints}
                    onChange={e => patch({web_n_api_endpoints: nonnegative(e.target.value)})}/>
                </label>
                <label className={labelClass}>Jumlah Role Hak Akses
                  <input className={fieldClass} type="number" min={1} max={100000} value={asset.web_n_roles}
                    onChange={e => patch({web_n_roles: nonnegative(e.target.value)})}/>
                </label>
              </>}
              {asset.vapt_type === 'api' && <>
                <label className={labelClass}>Jumlah API Endpoint
                  <input className={fieldClass} type="number" min={1} max={100000} value={asset.api_n_endpoints}
                    onChange={e => patch({api_n_endpoints: nonnegative(e.target.value)})}/>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-slate-700">
                  <input className="h-4 w-4" type="checkbox" checked={!!asset.api_has_docs}
                    onChange={e => patch({api_has_docs: e.target.checked})}/>
                  Swagger / OpenAPI / Postman tersedia
                </label>
              </>}
              {asset.vapt_type === 'mobile_app' && <>
                <label className={labelClass}>Platform
                  <select className={fieldClass} value={asset.mobile_platform}
                    onChange={e => patch({mobile_platform: e.target.value as VaptAsset['mobile_platform']})}>
                    <option value="android">Android</option><option value="ios">iOS</option><option value="both">Android dan iOS</option>
                  </select>
                </label>
                <label className={labelClass}>Kompleksitas Mobile
                  <select className={fieldClass} value={asset.mobile_complexity}
                    onChange={e => patch({mobile_complexity: e.target.value as VaptAsset['mobile_complexity']})}>
                    <option value="simple">Simple</option><option value="medium">Medium</option><option value="complex">Complex</option>
                  </select>
                </label>
                <label className={labelClass}>Jumlah Screens
                  <input className={fieldClass} type="number" min={1} max={100000} value={asset.mobile_n_screens}
                    onChange={e => patch({mobile_n_screens: nonnegative(e.target.value)})}/>
                </label>
              </>}
              {asset.vapt_type === 'network_infra' && <>
                <label className={labelClass}>Jumlah Internal Host / IP
                  <input className={fieldClass} type="number" min={0} max={100000} value={asset.net_n_internal_host}
                    onChange={e => patch({net_n_internal_host: nonnegative(e.target.value)})}/>
                </label>
                <label className={labelClass}>Jumlah External IP
                  <input className={fieldClass} type="number" min={0} max={100000} value={asset.net_n_external_ip}
                    onChange={e => patch({net_n_external_ip: nonnegative(e.target.value)})}/>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-slate-700">
                  <input className="h-4 w-4" type="checkbox" checked={!!asset.net_has_ad}
                    onChange={e => patch({net_has_ad: e.target.checked})}/>
                  Active Directory termasuk scope
                </label>
              </>}
              {asset.vapt_type === 'red_team' &&
                <label className={labelClass}>Skenario Red Team
                  <select className={fieldClass} value={asset.redteam_scope}
                    onChange={e => patch({redteam_scope: e.target.value as VaptAsset['redteam_scope']})}>
                    <option value="assumed_breach">Assumed Breach (15 MD)</option>
                    <option value="limited">Limited Simulation (20 MD)</option>
                    <option value="standard">Standard Simulation (30 MD)</option>
                    <option value="full_apt">Full APT (45 MD)</option>
                  </select>
                </label>}
              {asset.vapt_type === 'source_code' &&
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:col-span-2">
                  Baseline review source code 7 MD per aset (sebelum faktor metodologi/regulasi).
                  Presales wajib memverifikasi volume codebase sebelum quotation.
                </p>}
            </div>
          </article>
        );
      })}
      <button type="button" onClick={onAdd} disabled={assets.length >= 30}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40">
        <Plus className="h-4 w-4"/> Tambah Aset VAPT Lainnya
      </button>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Estimasi tiap aset dijumlahkan tanpa diskon atau deduplikasi effort bersama. Periksa overlap web/API dan common testing saat review Presales; harga final hanya dibuat melalui BoQ.
      </p>
    </section>
  );
}
