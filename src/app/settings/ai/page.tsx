'use client';

import React,{useCallback,useEffect,useState} from 'react';
import { Bot, CheckCircle2, AlertTriangle, ShieldCheck, KeyRound, ArrowUp,
 ArrowDown, RefreshCcw, Trash2, Save, LoaderCircle, PlugZap, Send } from 'lucide-react';
import type { AIProviderPublic, ProviderId } from '@/lib/ai-provider-registry';

type ApiResponse={success:boolean;message?:string;configs?:AIProviderPublic[];
  content?:string;providerUsed?:string;modelUsed?:string;latencyMs?:number;isFallback?:boolean};
const secureHeaders={'Content-Type':'application/json','x-india-ai-admin':'1'};
const smallInput='w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100';

export default function AISettingsPage(){
 const [configs,setConfigs]=useState<AIProviderPublic[]>([]);
 const [loading,setLoading]=useState(true);
 const [blocked,setBlocked]=useState('');
 const [busy,setBusy]=useState('');
 const [notice,setNotice]=useState('');
 const [noticeError,setNoticeError]=useState(false);
 const [keys,setKeys]=useState<Record<string,string>>({});
 const [models,setModels]=useState<Record<string,string>>({});
 const [prompt,setPrompt]=useState('Jelaskan secara ringkas perbedaan VAPT dan Managed SOC dalam tiga kalimat.');
 const [result,setResult]=useState<ApiResponse|null>(null);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch('/api/ai/config',{cache:'no-store',credentials:'same-origin'});
   const data:ApiResponse=await response.json();
   if(!response.ok||!data.success){setBlocked(data.message||'Tidak bisa membuka pengaturan AI.');return;}
   setConfigs(data.configs||[]);
   setBlocked('');
  }catch{setBlocked('Koneksi ke backend INDIA gagal.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const action=async(name:string,payload:Record<string,unknown>,successMessage:string)=>{
  setBusy(name);setNotice('');setNoticeError(false);
  try{
   const response=await fetch('/api/ai/config',{method:'POST',headers:secureHeaders,
    credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload)});
   const data:ApiResponse=await response.json();
   setNotice(data.message||(data.success?successMessage:'Operasi gagal.'));
   setNoticeError(!response.ok||!data.success);
   if(response.ok&&data.success){
    if(data.configs)setConfigs(data.configs);
    if(payload.action==='save'&&typeof payload.id==='string')setKeys(prev=>({...prev,[payload.id as string]:''}));
   }
  }catch{setNotice('Permintaan gagal, pastikan koneksi dan sesi login masih aktif.');setNoticeError(true);}
  finally{setBusy('');}
 };
 const save=(p:AIProviderPublic,enabled=p.enabled)=>{
  const pending=keys[p.id]?.trim();
  const model=(models[p.id]??p.model).trim();
  void action('save-'+p.id,{action:'save',id:p.id,model,enabled,
   ...(pending?{apiKey:pending}:{})},'Pengaturan tersimpan.');
 };
 const order=(idx:number,dir:-1|1)=>{
  const next=idx+dir;if(next<0||next>=configs.length)return;
  const ids=configs.map(p=>p.id);[ids[idx],ids[next]]=[ids[next],ids[idx]];
  void action('priority',{action:'reorder',orderedIds:ids},'Prioritas diperbarui.');
 };
 const check=(id:ProviderId)=>void action('test-'+id,{action:'test',id},'Koneksi diuji.');
 const clear=(id:ProviderId)=>{
  if(!window.confirm('Hapus API key '+id+' dari D1? Koneksi akan dinonaktifkan.'))return;
  void action('delete-'+id,{action:'deleteKey',id},'API key dihapus.');
 };
 const runTest=async()=>{
  setBusy('playground');setResult(null);setNotice('');
  try{
   const response=await fetch('/api/ai/generate',{method:'POST',headers:secureHeaders,
    credentials:'same-origin',cache:'no-store',body:JSON.stringify({prompt})});
   const data:ApiResponse=await response.json();
   if(!response.ok||!data.success){setNoticeError(true);setNotice(data.message||'Pengujian gagal.');}
   else {setNoticeError(false);setResult(data);}
  }catch{setNoticeError(true);setNotice('Tidak dapat menghubungi API AI.');}
  finally{setBusy('');}
 };
 const connected=configs.filter(x=>x.hasKey).length;
 const active=configs.filter(x=>x.enabled&&x.hasKey).length;
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-2xl border border-violet-100 bg-gradient-to-r from-white to-violet-50 p-5 sm:p-6">
   <div className="flex items-center gap-3"><span className="rounded-xl bg-violet-800 p-3 text-white"><PlugZap className="h-5 w-5"/></span>
    <div className="min-w-0"><h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">AI Connections & API Keys</h1>
     <p className="mt-1 text-xs leading-relaxed text-slate-600">Kelola provider, model, API key terenkripsi, tes koneksi dan urutan AI pada sistem INDIA.</p>
    </div></div>
   <div className="mt-4 flex flex-wrap gap-2 text-xs">
    <span className="rounded-lg border border-violet-200 bg-white px-3 py-2 font-semibold text-violet-800">Providers: {configs.length}</span>
    <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">API key terpasang: {connected}</span>
    <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">Aktif: {active}</span>
   </div>
  </header>
  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700"/>
    <p><strong className="text-slate-900">Khusus Admin terverifikasi.</strong> API key dikirim hanya ke backend melalui HTTPS, dienkripsi AES-GCM di D1 dan tidak pernah ditampilkan ulang.
    Akun tanpa izin Admin akan ditolak oleh server. Penggunaan AI eksternal mengirimkan isi prompt ke penyedia yang dipilih; jangan memasukkan data rahasia klien tanpa otorisasi.</p>
  </div>
  {notice&&<div role="status" className={'rounded-lg border px-4 py-3 text-xs font-semibold '+(noticeError?
    'border-rose-200 bg-rose-50 text-rose-900':'border-emerald-200 bg-emerald-50 text-emerald-800')}>{notice}</div>}
  {loading&&<div className="flex items-center gap-2 rounded-lg bg-white p-5 text-sm text-slate-600">
    <LoaderCircle className="h-4 w-4 animate-spin"/> Memverifikasi sesi Administrator dan konfigurasi D1...</div>}
  {!loading&&blocked&&<div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
    <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4"/> Pengaturan AI belum dapat diakses</div>
    <p className="mt-2 text-xs leading-relaxed">{blocked}</p>
    <p className="mt-2 text-xs">Pastikan login Cloudflare Access, peran Admin pada INDIA, D1 migration dan konfigurasi Worker tersedia.</p>
    <button type="button" onClick={()=>{setLoading(true);void refresh();}} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold"><RefreshCcw className="h-3.5 w-3.5"/>Coba lagi</button>
  </div>}
  {!loading&&!blocked&&<>
   <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h2 className="text-sm font-extrabold text-slate-900">Daftar penyedia AI</h2>
     <p className="text-[11px] text-slate-500">Prioritas terkecil dipilih terlebih dahulu; provider gagal akan dilewati.</p>
    </div>
    {configs.map((p,idx)=><article key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
     <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex min-w-0 items-start gap-3">
       <div className="flex flex-col items-center gap-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-800">{p.priority}</span>
        <div className="flex">
         <button type="button" aria-label={'Naikkan prioritas '+p.name} disabled={!!busy||idx===0}
           onClick={()=>order(idx,-1)} className="p-1 text-slate-500 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5"/></button>
         <button type="button" aria-label={'Turunkan prioritas '+p.name} disabled={!!busy||idx===configs.length-1}
           onClick={()=>order(idx,1)} className="p-1 text-slate-500 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5"/></button>
        </div>
       </div>
       <div className="min-w-0"><h3 className="text-sm font-extrabold text-slate-900">{p.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
         <span className={'rounded-md px-2 py-0.5 font-semibold '+(p.hasKey?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-600')}>
          {p.hasKey?'Key tersimpan':'Belum dikonfigurasi'}</span>
         <span className={'rounded-md px-2 py-0.5 font-semibold '+(p.testedOk===true?'bg-emerald-50 text-emerald-700':p.testedOk===false?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-600')}>
          {p.testedOk===true?'Koneksi lulus':p.testedOk===false?'Tes gagal':'Belum diuji'}</span>
        </div>
       </div>
      </div>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800">
       <input type="checkbox" className="h-4 w-4 accent-violet-700" checked={p.enabled}
         disabled={!!busy||!p.hasKey}
         onChange={e=>save(p,e.target.checked)}/> Aktifkan
      </label>
     </div>
     <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block min-w-0 text-xs font-bold text-slate-700">Model AI
       <input list={'models-'+p.id} value={models[p.id]??p.model}
        onChange={e=>setModels(x=>({...x,[p.id]:e.target.value}))} className={'mt-1 '+smallInput}/>
       <datalist id={'models-'+p.id}>{p.availableModels.map(m=><option key={m} value={m}/>)}</datalist>
      </label>
      <label className="block min-w-0 text-xs font-bold text-slate-700">API Key (isi untuk menambah/rotasi)
       <input type="password" autoComplete="new-password" spellCheck={false}
        placeholder={p.hasKey?'Key telah disimpan aman - masukkan baru untuk mengganti':'Masukkan API key provider'}
        value={keys[p.id]||''} onChange={e=>setKeys(x=>({...x,[p.id]:e.target.value}))}
        className={'mt-1 '+smallInput}/>
      </label>
     </div>
     <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={!!busy} onClick={()=>save(p)} className="inline-flex items-center gap-2 rounded-lg bg-violet-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
       <Save className="h-3.5 w-3.5"/> Simpan model & key</button>
      <button type="button" disabled={!!busy||!p.hasKey} onClick={()=>check(p.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 disabled:opacity-40">
       <RefreshCcw className={'h-3.5 w-3.5 '+(busy==='test-'+p.id?'animate-spin':'')}/> Test koneksi</button>
      <button type="button" disabled={!!busy||!p.hasKey} onClick={()=>clear(p.id)} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">
       <Trash2 className="h-3.5 w-3.5"/> Hapus key</button>
     </div>
     {p.testedAt&&<p className="mt-2 text-[11px] text-slate-500">Pengujian terakhir: {new Date(p.testedAt+'Z').toLocaleString('id-ID')}</p>}
    </article>)}
   </section>
   <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-violet-700"/><h2 className="text-sm font-extrabold text-slate-900">AI Live Test Console</h2></div>
    <p className="mt-1 text-xs text-slate-500">Pengujian mengikuti provider yang diaktifkan, berdasarkan urutan prioritas. Hanya gunakan informasi nonrahasia.</p>
    <label className="mt-4 block text-xs font-bold text-slate-700">Prompt pengujian
     <textarea rows={3} maxLength={2000} value={prompt} onChange={e=>setPrompt(e.target.value)}
       className={'mt-1 '+smallInput} />
    </label>
    <button type="button" disabled={!!busy||prompt.trim().length<2} onClick={runTest}
       className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
       <Send className="h-3.5 w-3.5"/>{busy==='playground'?'Meminta respons...':'Jalankan tes AI'}</button>
    {result?.content&&<div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-800">
      <p className="mb-2 font-bold">Provider: {result.providerUsed} · {result.modelUsed} · {result.latencyMs} ms {result.isFallback?'(Failover)':''}</p>
      <p className="whitespace-pre-wrap">{result.content}</p>
    </div>}
   </section>
  </>}
 </main>;
}
