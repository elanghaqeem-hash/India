import {LEAD_SOURCES} from '@/lib/sales-workflow';

type Props={label?:string;value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean};

/** Native select supports touch/keyboard and keeps historical attribution visible until explicitly changed. */
export function LeadSourceChoice({label='Sumber Lead',value,onChange,disabled=false,required=false}:Props){
 const historical=Boolean(value&&!LEAD_SOURCES.some(source=>source===value));
 return <label className="block min-w-0 text-xs font-semibold text-slate-700">
  {label}
  <select aria-label={label} required={required} disabled={disabled} value={value}
   onChange={event=>onChange(event.target.value)}
   className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100">
   <option value="">— Pilih sumber lead —</option>
   {historical&&<option value={value}>{value} (data sebelumnya)</option>}
   {LEAD_SOURCES.map(source=><option key={source} value={source}>{source}</option>)}
  </select>
 </label>;
}
