import {PROCUREMENT_PROCESSES} from '@/lib/sales-workflow';
import {CompactSelect} from '@/components/ui/CompactSelect';

type Props={label?:string;value:string;onChange:(value:string)=>void;disabled?:boolean};

/** Touch/keyboard-friendly standard choices; historical values are preserved until explicitly changed. */
export function ProcurementProcessChoice({label='Proses Pengadaan',value,onChange,disabled=false}:Props){
 const historical=Boolean(value&&!PROCUREMENT_PROCESSES.some(choice=>choice===value));
 return <label className="block min-w-0 text-xs font-semibold text-slate-700">
  {label}
  <CompactSelect label={label} disabled={disabled} value={value}
   onChange={onChange} className="mt-1"
   options={[{value:'',label:'— Pilih proses pengadaan —'},
    ...(historical?[{value,label:value+' (data sebelumnya)'}]:[]),
    ...PROCUREMENT_PROCESSES.map(choice=>({value:choice,label:choice}))]} searchable/>
 </label>;
}
