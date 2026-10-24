'use client';
import {useEffect,useId,useState} from 'react';
import {businessTypeOptions,CUSTOMER_SEGMENTS} from '@/lib/customer-classification';

type Field='client_tier'|'business_type';
type Props={
 field:Field;label:string;value:string;industry?:string;disabled?:boolean;
 onChange:(value:string)=>void;
};
const OTHER='__custom_entry__';
const control='mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

/** Native mobile-friendly choice list with a safe editable fallback for real-world/legacy values. */
export function StandardCustomerChoice({field,label,value,industry='',disabled=false,onChange}:Props){
 const selectId=useId(),customId=useId();
 const [manual,setManual]=useState(false);
 const options:readonly string[]=field==='client_tier'?CUSTOMER_SEGMENTS:businessTypeOptions(industry);
 const known=options.includes(value);
 // Existing free-text values must be preserved and editable; never silently discard them.
 const custom=manual||Boolean(value&&!known);
 useEffect(()=>{if(value&&options.includes(value))setManual(false);},[value,industry]);
 const choose=(selection:string)=>{
  if(selection===OTHER){setManual(true);onChange('');}
  else{setManual(false);onChange(selection);}
 };
 return <div className="min-w-0 text-xs font-semibold text-slate-700">
  <label htmlFor={selectId}>{label}</label>
  <select id={selectId} aria-label={label} disabled={disabled} className={control}
   value={custom?OTHER:value} onChange={e=>choose(e.target.value)}>
   <option value="">— Pilih {field==='client_tier'?'segmentasi pelanggan':'bidang usaha'} —</option>
   {options.map(choice=><option key={choice} value={choice}>{choice}</option>)}
   <option value={OTHER}>Lainnya — isi manual</option>
  </select>
  {custom&&<div className="mt-2">
   <label htmlFor={customId} className="block text-[11px] text-slate-600">Tulis {field==='client_tier'?'segmentasi pelanggan':'bidang usaha'} yang sesuai</label>
   <input id={customId} type="text" maxLength={180} autoComplete="off" disabled={disabled}
    className={control} placeholder="Ketik nilai selain pilihan di atas"
    value={value} onChange={e=>onChange(e.target.value)}/>
  </div>}
  {field==='business_type'&&<p className="mt-1 text-[11px] font-normal leading-relaxed text-slate-500">
   {industry?'Pilihan disesuaikan dengan Sektor industri.':'Pilih Sektor industri untuk rekomendasi yang lebih spesifik.'}
   {' '}Jika tidak tersedia, gunakan “Lainnya”.
  </p>}
  {field==='client_tier'&&<p className="mt-1 text-[11px] font-normal text-slate-500">Opsional, dapat diperbarui setelah registrasi.</p>}
 </div>;
}
