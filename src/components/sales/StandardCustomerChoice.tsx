'use client';
import {useEffect,useId,useState} from 'react';
import {ALL_BUSINESS_TYPES,businessTypeOptions,CUSTOMER_INDUSTRIES,CUSTOMER_SEGMENTS} from '@/lib/customer-classification';

type Field='client_tier'|'industry'|'business_type';
type Props={
 field:Field;label:string;value:string;industry?:string;disabled?:boolean;
 onChange:(value:string)=>void;
};
const OTHER='__custom_entry__';
const control='mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

/**
 * Native mobile-friendly dropdown with cross-sector search and an explicit manual fallback.
 * The selected display text remains the saved CRM field; no migrations or silent rewrites.
 */
export function StandardCustomerChoice({field,label,value,industry='',disabled=false,onChange}:Props){
 const selectId=useId(),customId=useId(),searchId=useId();
 const [manual,setManual]=useState(false);
 const [search,setSearch]=useState('');
 const [showAll,setShowAll]=useState(false);
 const isBusiness=field==='business_type';
 const recommended:readonly string[]=field==='client_tier'?CUSTOMER_SEGMENTS:field==='industry'?CUSTOMER_INDUSTRIES:businessTypeOptions(industry);
 const known=(isBusiness?ALL_BUSINESS_TYPES:recommended).includes(value);
 // Existing free-text values must stay editable, including after changing industry.
 const custom=manual||Boolean(value&&!known);
 const keyword=isBusiness?search.trim().toLocaleLowerCase('id-ID'):'';
 const catalog:readonly string[]=isBusiness&&(showAll||keyword)?ALL_BUSINESS_TYPES:recommended;
 const filtered=catalog.filter(choice=>!keyword||choice.toLocaleLowerCase('id-ID').includes(keyword));
 // Pin an existing cross-industry choice even if it is outside the current sector/search.
 const options=[...new Set([...filtered,...(value&&known?[value]:[])])];
 useEffect(()=>{if(value&&known)setManual(false);},[value,known]);
 const choose=(selection:string)=>{
  if(selection===OTHER){setManual(true);setSearch('');onChange('');}
  else{setManual(false);setSearch('');onChange(selection);}
 };
 return <div className="min-w-0 text-xs font-semibold text-slate-700">
  <label htmlFor={selectId}>{label}</label>
  {isBusiness&&<div className="mt-2">
   <label htmlFor={searchId} className="block text-[11px] font-medium text-slate-600">Cari bidang usaha terstandar</label>
   <input id={searchId} type="search" autoComplete="off" maxLength={90}
    aria-label="Cari bidang usaha" disabled={disabled} className={control}
    placeholder="Contoh: Bank, Asuransi, Teknologi, Konstruksi..."
    value={search} onChange={e=>setSearch(e.target.value)}/>
  </div>}
  <select id={selectId} aria-label={label} disabled={disabled} className={control}
   value={custom?OTHER:value} onChange={e=>choose(e.target.value)}>
   <option value="">— Pilih {field==='client_tier'?'segmentasi pelanggan':field==='industry'?'sektor industri':'bidang usaha'} —</option>
   {options.map(choice=><option key={choice} value={choice}>{choice}</option>)}
   <option value={OTHER}>Lainnya — isi manual</option>
  </select>
  {isBusiness&&<div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-normal text-slate-500">
   <span>{keyword?filtered.length+' hasil pencarian':showAll?'Semua bidang usaha':'Rekomendasi sesuai sektor'} · {options.length} pilihan</span>
   <button type="button" disabled={disabled} className="min-h-9 font-semibold text-blue-700 underline underline-offset-2 disabled:opacity-50"
    onClick={()=>{setShowAll(old=>!old);setSearch('');}}>
    {showAll?'Tampilkan rekomendasi sektor':'Lihat semua bidang usaha'}
   </button>
  </div>}
  {custom&&<div className="mt-2">
   <label htmlFor={customId} className="block text-[11px] text-slate-600">Tulis {field==='client_tier'?'segmentasi pelanggan':field==='industry'?'sektor industri':'bidang usaha'} yang sesuai</label>
   <input id={customId} type="text" maxLength={180} autoComplete="off" disabled={disabled}
    className={control} placeholder="Ketik nilai selain pilihan di atas"
    value={value} onChange={e=>onChange(e.target.value)}/>
  </div>}
  {isBusiness&&<p className="mt-1 text-[11px] font-normal leading-relaxed text-slate-500">
   {industry?'Pilihan utama disesuaikan dengan Sektor industri.':'Pilih Sektor industri untuk rekomendasi yang lebih spesifik.'}
   {' '}Gunakan pencarian atau “Lihat semua bidang usaha” untuk memilih lintas sektor.
   Jika tidak tersedia, pilih “Lainnya — isi manual”.
  </p>}
  {field==='industry'&&<p className="mt-1 text-[11px] font-normal text-slate-500">Pilih sektor utama pelanggan untuk rekomendasi bidang usaha.</p>}
  {field==='client_tier'&&<p className="mt-1 text-[11px] font-normal text-slate-500">Opsional, dapat diperbarui setelah registrasi.</p>}
 </div>;
}
