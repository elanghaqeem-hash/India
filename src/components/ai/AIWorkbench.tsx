'use client';
import React,{useEffect,useState} from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles,X,Copy,LoaderCircle } from 'lucide-react';
type Provider={id:string;name:string;model:string;priority:number};
const purposes:Record<string,{name:string;purpose:string;starter:string}>={
 '/sales/pipeline':{name:'Sales Pipeline',purpose:'sales',starter:'Analisis risiko sales pipeline dan susun next action berdasarkan ringkasan anonim berikut: '},
 '/scoping':{name:'Technical Scoping',purpose:'scoping',starter:'Tinjau scope dan identifikasi parameter teknis yang belum lengkap untuk layanan DefendIT360 berikut: '},
 '/pricing':{name:'Pricing',purpose:'pricing',starter:'Tinjau asumsi komersial dan kelengkapan pricing tanpa mengarang harga, HPP, atau margin berikut: '},
 '/boq':{name:'BoQ',purpose:'boq',starter:'Tinjau konsistensi deskripsi, quantity, unit, SLA dan deliverables untuk BoQ berikut: '},
 '/proposals':{name:'Quotation & Proposal',purpose:'quotation',starter:'Susun draft narasi quotation profesional dari scope anonim berikut; tandai bagian yang belum didukung data: '},
 '/post-po':{name:'Post-PO Forms',purpose:'post_po',starter:'Periksa kelengkapan field registrasi dan project berdasarkan PO/SOW anonim berikut: '},
 '/tender':{name:'Tender',purpose:'tender',starter:'Analisis peluang tender, gap administrasi dan rekomendasi bid/no-bid dari data anonim berikut: '},
};
export function AIWorkbench(){
 const pathname=usePathname();
 const mode=purposes[pathname]||{name:'INDIA Workspace',purpose:'analysis',starter:'Analisis permintaan kerja DefendIT360 berikut: '};
 const [open,setOpen]=useState(false),[providers,setProviders]=useState<Provider[]>([]);
 const [provider,setProvider]=useState('auto'),[prompt,setPrompt]=useState('');
 const [approved,setApproved]=useState(false),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[output,setOutput]=useState(''),[model,setModel]=useState('');
 useEffect(()=>{
  if(!open)return;
  fetch('/api/ai/assist',{cache:'no-store'}).then(r=>r.json()).then(j=>{
   if(!j.success)throw Error(j.message);
   setProviders(j.providers||[]);setError('');
  }).catch(e=>setError(e instanceof Error?e.message:'Daftar AI belum siap.'));
 },[open]);
 useEffect(()=>{setPrompt(mode.starter);setOutput('');setApproved(false);},[pathname]);
 useEffect(()=>{const receive=(event:Event)=>{const detail=(event as CustomEvent<{prompt:string}>).detail;if(typeof detail?.prompt==='string'){setPrompt(detail.prompt.slice(0,4800));setApproved(false);setOutput('');setOpen(true);}};window.addEventListener('india-ai-context',receive);return()=>window.removeEventListener('india-ai-context',receive);},[]);
 const run=async()=>{
  if(!approved||!providers.length||busy)return;
  setBusy(true);setError('');setOutput('');
  try{
   const r=await fetch('/api/ai/assist',{method:'POST',headers:{'Content-Type':'application/json'},
    credentials:'same-origin',cache:'no-store',
    body:JSON.stringify({provider,purpose:mode.purpose,prompt,confirmed:true})});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'AI gagal');
   setOutput(j.content);setModel(j.providerUsed+' · '+j.modelUsed);
  }catch(e){setError(e instanceof Error?e.message:'AI tidak tersedia');}
  finally{setBusy(false);}
 };
 return <div className="no-print">
  <button type="button" onClick={()=>setOpen(true)} className="fixed bottom-20 right-3 z-40 flex items-center gap-2 rounded-full border border-indigo-200 bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl hover:bg-indigo-900 lg:bottom-6 lg:right-6" aria-label="Buka opsi AI untuk drafting dan analisis">
   <Sparkles className="h-4 w-4"/> AI Draft / Analisis
  </button>
  {open&&<div className="fixed inset-0 z-[90] flex items-end justify-end bg-slate-950/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="AI drafting assistant">
   <div className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b p-4">
     <div><p className="text-xs font-bold text-indigo-700">INDIA • Connected AI</p><h2 className="text-base font-bold">AI untuk {mode.name}</h2></div>
     <button onClick={()=>setOpen(false)} aria-label="Tutup AI" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button>
    </header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
     <p className="text-xs leading-relaxed text-slate-600">AI bersifat <b>opsional</b>. Pilih model yang telah diaktifkan dan diuji Admin. Isi prompt anonim; jangan sertakan KTP, NPWP, email, telepon atau rahasia komersial. Hasil AI adalah draft, tidak otomatis mengubah BoQ, dokumen, status atau persetujuan.</p>
     <label className="block text-xs font-bold text-slate-700">Pilih provider AI yang terdaftar
      <select className="mt-1 w-full rounded-lg border p-3 text-sm" value={provider} onChange={e=>setProvider(e.target.value)} disabled={!providers.length}>
       <option value="auto">Otomatis sesuai prioritas Admin (fallback)</option>
       {providers.map(p=><option key={p.id} value={p.id}>{p.name} — {p.model}</option>)}
      </select></label>
     {!providers.length&&<p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Belum tersedia AI yang aktif dan lulus uji. Admin dapat mengelolanya di <a className="underline" href="/settings/ai">AI Connections</a>.</p>}
     <label className="block text-xs font-bold text-slate-700">Instruksi AI / Ringkasan data anonim
      <textarea rows={5} maxLength={4800} value={prompt} onChange={e=>setPrompt(e.target.value)} className="mt-1 w-full resize-y rounded-lg border p-3 text-sm"/></label>
     <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
      <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-1"/>
      Saya memahami data prompt akan dikirim ke provider AI eksternal yang dipilih, tidak menyertakan data pribadi/rahasia, dan hasil wajib direview sebelum digunakan.
     </label>
     {error&&<p role="alert" className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
     {output&&<section className="space-y-2 rounded-xl border bg-slate-50 p-3">
      <div className="flex justify-between gap-2"><div><h3 className="text-sm font-bold">Usulan AI — Review Required</h3><p className="text-[11px] text-slate-500">{model}</p></div>
       <button onClick={()=>navigator.clipboard.writeText(output)} className="flex items-center gap-1 text-xs text-blue-700"><Copy className="h-3.5 w-3.5"/>Salin</button>
      </div>
      <textarea rows={10} value={output} onChange={e=>setOutput(e.target.value)} className="w-full resize-y rounded-lg border bg-white p-3 text-sm" aria-label="Edit draft hasil AI"/>
     </section>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
     <span className="text-xs text-slate-500">Manual review & approval wajib.</span>
     <button disabled={busy||!providers.length||!approved||prompt.trim().length<15} onClick={()=>void run()} className="flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">
      {busy&&<LoaderCircle className="h-4 w-4 animate-spin"/>} Jalankan AI
     </button>
    </footer>
   </div>
  </div>}
 </div>;
}
