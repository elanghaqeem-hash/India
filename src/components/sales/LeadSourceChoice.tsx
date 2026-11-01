import {LEAD_SOURCES} from '@/lib/sales-workflow';
import {CompactSelect} from '@/components/ui/CompactSelect';

type Props={label?:string;value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean};

/** Native select supports touch/keyboard and keeps historical attribution visible until explicitly changed. */
export function LeadSourceChoice({label='Sumber Lead',value,onChange,disabled=false,required=false}:Props){
 const historical=Boolean(value&&!LEAD_SOURCES.some(source=>source===value));
 return <label className="block min-w-0 text-xs font-semibold text-slate-700">
  {label}
  <CompactSelect label={label} required={required} disabled={disabled} value={value}
   onChange={onChange} className="mt-1"
   options={[{value:'',label:'— Pilih sumber lead —'},
    ...(historical?[{value,label:value+' (data sebelumnya)'}]:[]),
    ...LEAD_SOURCES.map(source=>({value:source,label:source}))]} searchable/>
 </label>;
}
