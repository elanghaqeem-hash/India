'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, X } from 'lucide-react';
import { buildStageFilterOptions, type StageFilterValue } from '@/lib/sales-stage-filter';
import type { SalesDeal } from '@/lib/sales-workflow';

export function StageFilter({
  deals, value, onChange,
}: {
  deals: readonly SalesDeal[];
  value: StageFilterValue;
  onChange: (next: StageFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const options = buildStageFilterOptions(deals);
  const selected = options.find(option => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const choose = (next: StageFilterValue) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div ref={rootRef} className="relative w-full sm:w-auto" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
  }}>
    <button ref={triggerRef} type="button" aria-label={'Filter tahap: ' + selected.label}
      aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(current => !current)}
      className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:min-w-52">
      <span className="flex min-w-0 items-center gap-2">
        <Filter size={16} className="shrink-0 text-blue-700" aria-hidden="true"/>
        <span className="truncate">{selected.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs tabular-nums text-blue-800">{selected.count}</span>
        <ChevronDown size={16} className={open ? 'rotate-180 text-slate-500' : 'text-slate-500'} aria-hidden="true"/>
      </span>
    </button>
    {open && <div id={panelId} role="group" aria-label="Pilihan tahap opportunity"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex w-auto max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] sm:max-h-none">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-slate-900">Filter Tahap Penjualan</div>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
            aria-label="Tutup pilihan tahap" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><X size={18} aria-hidden="true"/></button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Pilih satu tahap untuk menyaring daftar Opportunity.</p>
      </div>
      <div className="min-h-0 flex-1 max-h-[min(55vh,27rem)] space-y-1 overflow-y-auto overscroll-contain p-2">
        {options.map(option => <button key={option.id} type="button" aria-pressed={value === option.id}
          onClick={() => choose(option.id)}
          className={'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ' +
            (value === option.id ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50')}>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-semibold">{option.label}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{option.description}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">{option.count}</span>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
            {value === option.id && <Check size={17} className="text-blue-700" aria-hidden="true"/>}
          </span>
        </button>)}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3">
        <span className="text-[11px] text-slate-500">Jumlah berasal dari data pipeline D1.</span>
        <button type="button" onClick={() => choose('all')}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Reset Filter</button>
      </div>
    </div>}
  </div>;
}
