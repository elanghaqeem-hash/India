'use client';
import {useEffect,useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import {POSTAL_FIELDS,type PostalArea,type PostalSuggestion,validPostalSearchQuery,fieldPatch} from '@/lib/indonesia-postal';

type Props={
 values:Record<string,string>;
 onChange:(patch:Record<string,string>)=>void;
 disabled?:boolean;
};
const input='mt-1 block w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 disabled:bg-slate-100';
const empty=()=>Object.fromEntries(POSTAL_FIELDS.map(k=>[k,''])) as Record<string,string>;
const unique=(rows:PostalArea[],key:'province_code'|'regency_code'|'district_code')=>
 [...new Map(rows.map(r=>[r[key],r])).values()];
export function PostalAddressFields({values,onChange,disabled=false}:Props){
 const postal=values.hq_postal||'';
 const [areas,setAreas]=useState<PostalArea[]>([]);
 const [status,setStatus]=useState<'idle'|'loading'|'ready'|'empty'|'error'>('idle');
 const [error,setError]=useState('');
 const [loadedPostal,setLoadedPostal]=useState('');
 const [lookup,setLookup]=useState('');
 const [suggestions,setSuggestions]=useState<PostalSuggestion[]>([]);
 const [lookupStatus,setLookupStatus]=useState<'idle'|'loading'|'ready'|'error'>('idle');
 const [lookupError,setLookupError]=useState('');
 useEffect(()=>{
  if(!validPostalSearchQuery(lookup)){setSuggestions([]);setLookupStatus('idle');setLookupError('');return;}
  const controller=new AbortController();
  setLookupStatus('loading');setLookupError('');
  const timer=setTimeout(()=>{
   fetch('/api/reference/postal?q='+encodeURIComponent(lookup.trim()),{
    credentials:'same-origin',cache:'no-store',signal:controller.signal
   }).then(async response=>{
    const data=await response.json();
    if(!response.ok||!data.success)throw Error(data.message||'Pencarian kode pos gagal.');
    if(!Array.isArray(data.suggestions))throw Error('Daftar kode pos tidak valid.');
    if(!controller.signal.aborted){setSuggestions(data.suggestions);setLookupStatus('ready');}
   }).catch(e=>{
    if(!controller.signal.aborted){
     setSuggestions([]);setLookupStatus('error');
     setLookupError(e instanceof Error?e.message:'Pencarian gagal.');
    }
   });
  },250);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[lookup]);
 useEffect(()=>{
  if(!/^[0-9]{5}$/.test(postal)){setAreas([]);setStatus('idle');setError('');setLoadedPostal('');return;}
  const controller=new AbortController();
  setStatus('loading');setError('');setAreas([]);
  fetch('/api/reference/postal?postal='+postal,{
   credentials:'same-origin',cache:'no-store',signal:controller.signal
  }).then(async response=>{
   const data=await response.json();
   if(!response.ok||!data.success)throw Error(data.message||'Gagal memuat referensi wilayah.');
   if(!Array.isArray(data.areas))throw Error('Respons referensi wilayah tidak valid.');
   if(!controller.signal.aborted){setAreas(data.areas);setLoadedPostal(postal);setStatus(data.areas.length?'ready':'empty');}
  }).catch(e=>{if(!controller.signal.aborted){setStatus('error');setError(e instanceof Error?e.message:'Pencarian kode pos gagal.');}});
  return ()=>controller.abort();
 },[postal]);
 const ready=status==='ready'&&loadedPostal===postal;
 const provinces=useMemo(()=>unique(areas,'province_code'),[areas]);
 const regencies=useMemo(()=>unique(areas.filter(a=>a.province_code===values.hq_province_code),'regency_code'),[areas,values.hq_province_code]);
 const districts=useMemo(()=>unique(areas.filter(a=>a.regency_code===values.hq_regency_code),'district_code'),[areas,values.hq_regency_code]);
 const villages=useMemo(()=>areas.filter(a=>a.district_code===values.hq_district_code),[areas,values.hq_district_code]);
 const reset=(patch:Record<string,string>,remove:readonly string[])=>{
  for(const field of remove)patch[field]='';onChange(patch);
 };
 const provinceSelect=(code:string)=>{
  const row=provinces.find(a=>a.province_code===code);
  reset({hq_province_code:code,hq_province:row?.province_name||''},['hq_regency','hq_regency_code','hq_district','hq_district_code','hq_village','hq_village_code','hq_village_kind']);
 };
 const regencySelect=(code:string)=>{
  const row=regencies.find(a=>a.regency_code===code);
  reset({hq_regency_code:code,hq_regency:row?.regency_name||''},['hq_district','hq_district_code','hq_village','hq_village_code','hq_village_kind']);
 };
 const districtSelect=(code:string)=>{
  const row=districts.find(a=>a.district_code===code);
  reset({hq_district_code:code,hq_district:row?.district_name||''},['hq_village','hq_village_code','hq_village_kind']);
 };
 const villageSelect=(code:string)=>{
  const row=villages.find(a=>a.region_code===code);
  if(row)onChange(fieldPatch(row));else onChange({hq_village:'',hq_village_code:'',hq_village_kind:''});
 };
 return <div className="min-w-0 space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 sm:col-span-2 sm:p-4">
  <div><h3 className="text-sm font-bold text-slate-900">Wilayah kantor pusat berdasarkan kode pos</h3>
   <p className="mt-1 text-xs text-slate-600">Cari dan pilih kode pos berdasarkan nomor atau nama wilayah. Provinsi, kabupaten/kota, kecamatan, dan desa/kelurahan diambil dari master nasional.</p></div>
  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
   <div className="min-w-0 sm:col-span-2">
    <label htmlFor="india-postal-search" className="block text-xs font-semibold text-slate-700">Pilih kode pos terstandar</label>
    <div className="relative mt-1">
     <input id="india-postal-search" className={input+' mt-0 pr-10'} type="search" autoComplete="off"
      aria-label="Cari kode pos atau nama wilayah" disabled={disabled} value={lookup}
      onChange={e=>setLookup(e.target.value)}
      placeholder="Cari kode pos, kelurahan, kecamatan, kota atau provinsi"/>
     <Search size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
    </div>
    <p role="status" aria-live="polite" className="mt-1.5 text-xs text-slate-600">
     {lookupStatus==='loading'?'Mencari pilihan dari database nasional…':
      lookupStatus==='error'?lookupError:
      lookupStatus==='ready'?(suggestions.length?'Pilih satu kode pos dari hasil pencarian.':'Tidak ditemukan. Coba nama wilayah lain.'):
      'Ketik minimal 2 digit kode pos atau 3 huruf nama wilayah.'}
    </p>
    {lookupStatus==='ready'&&suggestions.length>0&&<div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1" aria-label="Hasil pencarian kode pos">
     {suggestions.map(option=><button key={option.postal_code} type="button" disabled={disabled}
       className="flex w-full min-w-0 items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
       onClick={()=>{onChange({...empty(),hq_postal:option.postal_code});setLookup('');}}>
       <span className="shrink-0 rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-800">{option.postal_code}</span>
       <span className="min-w-0 break-words text-xs text-slate-700">{option.description}</span>
      </button>)}
    </div>}
   </div>
   <label className="min-w-0 text-xs font-semibold text-slate-700">Kode pos terpilih (atau masukkan 5 digit)
    <span className="relative block">
     <input className={input+' pr-10'} aria-label="Kode pos kantor pusat" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" placeholder="Masukkan 5 digit kode pos" disabled={disabled}
      value={postal} onChange={e=>onChange({...empty(),hq_postal:e.target.value.replace(/[^0-9]/g,'').slice(0,5)})}/>
     <Search size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
    </span>
   </label>
   <div className="self-end text-xs text-slate-600" aria-live="polite" role="status">
    {status==='loading'?'Mencari wilayah di database…':ready?areas.length+' desa/kelurahan cocok. Pilih alamat yang benar.':
     status==='empty'?'Kode pos belum ditemukan; periksa kembali atau minta pembaruan master data.':
     status==='error'?error:postal?'Masukkan 5 digit kode pos.':'Alamat wilayah belum dipilih.'}
   </div>
   <label className="min-w-0 text-xs font-semibold text-slate-700">Provinsi
    <select className={input} aria-label="Provinsi kantor pusat" disabled={disabled||!ready} value={provinces.some(a=>a.province_code===values.hq_province_code)?values.hq_province_code:''} onChange={e=>provinceSelect(e.target.value)}>
     <option value="">— Pilih provinsi —</option>{provinces.map(a=><option key={a.province_code} value={a.province_code}>{a.province_name}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-xs font-semibold text-slate-700">Kabupaten / Kota
    <select className={input} aria-label="Kabupaten atau kota kantor pusat" disabled={disabled||!values.hq_province_code||!ready} value={regencies.some(a=>a.regency_code===values.hq_regency_code)?values.hq_regency_code:''} onChange={e=>regencySelect(e.target.value)}>
     <option value="">— Pilih kabupaten/kota —</option>{regencies.map(a=><option key={a.regency_code} value={a.regency_code}>{a.regency_name}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-xs font-semibold text-slate-700">Kecamatan / Distrik
    <select className={input} aria-label="Kecamatan kantor pusat" disabled={disabled||!values.hq_regency_code||!ready} value={districts.some(a=>a.district_code===values.hq_district_code)?values.hq_district_code:''} onChange={e=>districtSelect(e.target.value)}>
     <option value="">— Pilih kecamatan —</option>{districts.map(a=><option key={a.district_code} value={a.district_code}>{a.district_name}</option>)}
    </select>
   </label>
   <label className="min-w-0 text-xs font-semibold text-slate-700">Desa / Kelurahan (unit terkecil)
    <select className={input} aria-label="Desa atau kelurahan kantor pusat" disabled={disabled||!values.hq_district_code||!ready} value={villages.some(a=>a.region_code===values.hq_village_code)?values.hq_village_code:''} onChange={e=>villageSelect(e.target.value)}>
     <option value="">— Pilih desa/kelurahan —</option>{villages.map(a=><option key={a.region_code} value={a.region_code}>{a.village_kind} {a.village_name}</option>)}
    </select>
   </label>
  </div>
  {values.hq_village_code&&ready&&villages.some(a=>a.region_code===values.hq_village_code)&&
   <p className="rounded-lg bg-white px-3 py-2 text-xs text-emerald-800">Wilayah terpilih: {values.hq_village}, {values.hq_district}, {values.hq_regency}, {values.hq_province} · {postal}</p>}
 </div>;
}
