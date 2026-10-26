'use client';
import React,{useEffect,useMemo,useState} from 'react';
import {LEAD_SOURCES,PROCUREMENT_PROCESSES} from '@/lib/sales-workflow';

export type ManagedOptionGroup='lead_source'|'procurement_process';
type Item={value:string;label:string};
const defaults:Record<ManagedOptionGroup,readonly string[]>={
 lead_source:LEAD_SOURCES,
 procurement_process:PROCUREMENT_PROCESSES,
};

/** Merge active, authenticated Admin options with canonical choices.
 * Never mutate stored values; even retired/historical values remain visible.
 * The API is additive: an empty registry or transient API error leaves the
 * reviewed canonical 22/15 choices usable instead of blocking commercial entry.
 */
export function mergeManagedOptions(group:ManagedOptionGroup,remote:Item[],current:string):Item[]{
 const choices=new Map<string,string>();
 for(const value of defaults[group])choices.set(value,value);
 for(const item of remote){
  if(typeof item?.value==='string'&&item.value.length<=61&&
    typeof item.label==='string'&&item.label.length<=120&&item.value.trim())
   choices.set(item.value,item.label);
 }
 if(current&&!choices.has(current))choices.set(current,current+' (data sebelumnya)');
 return [...choices].map(([value,label])=>({value,label}));
}
type Props={group:ManagedOptionGroup;value:string;onChange:(value:string)=>void;
 label:string;disabled?:boolean;required?:boolean;className?:string};

/** Shared control used by Marketing Lead, Qualification and Sales Pipeline.
 * Reads the admin-managed D1 option registry; never reads private admin API.
 */
export function ManagedOptionSelect({group,value,onChange,label,disabled=false,required=false,className}:Props){
 const [remote,setRemote]=useState<Item[]>([]);
 const [warning,setWarning]=useState('');
 useEffect(()=>{
  let live=true;
  setRemote([]);setWarning('');
  void fetch('/api/reference/options?group='+encodeURIComponent(group),{credentials:'same-origin',cache:'no-store'})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok||!body.success||!Array.isArray(body.items))throw Error('Pilihan Admin belum bisa dimuat');
    if(live)setRemote(body.items);
   }).catch(()=>{if(live)setWarning('Pilihan Admin belum tersedia; pilihan standar tetap digunakan.');});
  return ()=>{live=false;};
 },[group]);
 const choices=useMemo(()=>mergeManagedOptions(group,remote,value),[group,remote,value]);
 return <>
  <select aria-label={label} value={value} disabled={disabled} required={required}
   title={warning||undefined}
   onChange={event=>onChange(event.target.value)}
   className={className||'mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100'}>
   <option value="">— Pilih —</option>
   {choices.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
  </select>
  {warning&&<span role="status" className="mt-1 block text-[11px] font-normal text-amber-700">{warning}</span>}
 </>;
}
