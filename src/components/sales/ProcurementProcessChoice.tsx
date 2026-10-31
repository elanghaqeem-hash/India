import {PROCUREMENT_PROCESSES} from '@/lib/sales-workflow';

type Props={label?:string;value:string;onChange:(value:string)=>void;disabled?:boolean};

/** Touch/keyboard-friendly standard choices; historical values are preserved until explicitly changed. */
export function ProcurementProcessChoice({label='Proses Pengadaan',value,onChange,disabled=false}:Props){
 const historical=Boolean(value&&!PROCUREMENT_PROCESSES.some(choice=>choice===value));
 return <label className="block min-w-0 text-xs font-semibold text-slate-700">
  {label}
  <select aria-label={label} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}
   className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100">
   <option value="">— Pilih proses pengadaan —</option>
   {historical&&<option value={value}>{value} (data sebelumnya)</option>}
   {PROCUREMENT_PROCESSES.map(choice=><option key={choice} value={choice}>{choice}</option>)}
  </select>
 </label>;
}
