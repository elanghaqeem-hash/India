'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,FileCheck2,ShieldCheck} from 'lucide-react';
type Award={id:string;document_kind:string;document_number:string;file_name:string;archive_reference:string;original_sha256:string;
 created_by:string;finance_reviewed_by:string|null;legal_reviewed_by:string|null;finance_review_notes?:string;legal_review_notes?:string};
const field='w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs';
async function api(method:'GET'|'POST'|'PATCH',url:string,body?:Record<string,unknown>){
 const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
 ...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Transaksi gagal');return j;
}
export default function AwardDesk(){
 const [opp,setOpp]=useState(''),[role,setRole]=useState(''),[po,setPo]=useState('');
 const [docs,setDocs]=useState<Award[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [form,setForm]=useState({document_kind:'po',document_number:'',file_name:'',archive_reference:'',original_sha256:''});
 const [notes,setNotes]=useState<Record<string,string>>({});
 const refresh=useCallback(async(id:string)=>{
  try{
   const j=await api('GET','/api/sales/award?opportunity_id='+encodeURIComponent(id));
   setDocs(j.documents||[]);setReady(!!j.hasDualVerifiedPO);setRole(j.role||'');setPo(j.po_number||'');
   setForm(p=>({...p,document_number:p.document_number||j.po_number||''}));
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('opportunity_id')||'';setOpp(id);
  if(id)void refresh(id);else setMessage('Pilih Opportunity dari Sales Pipeline untuk melanjutkan.');},[refresh]);
 const run=async(fn:()=>Promise<unknown>,done:string)=>{
  setBusy(true);setMessage('');
  try{await fn();await refresh(opp);setMessage(done);}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const hashFile=async(file:File|null)=>{
  if(!file)return;if(file.size>8*1024*1024){setMessage('Maksimal 8 MB untuk hashing lokal.');return;}
  try{const arr=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',arr);
   setForm(v=>({...v,file_name:file.name,original_sha256:Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('')}));
   setMessage('SHA256 dihitung lokal. Unggah file asli ke DMS organisasi dan cantumkan referensi arsip yang benar.');
  }catch{setMessage('Checksum gagal dihitung');}
 };
 const add=()=>void run(()=>api('POST','/api/sales/award',{opportunity_id:opp,...form}),
   'Metadata dokumen dicatat. Finance dan Legal wajib melakukan review independen.');
 const review=(id:string,kind:'finance'|'legal')=>{
  if(!window.confirm('Sudah memeriksa dokumen asli di repository perusahaan, referensi dan checksum? Pemeriksa harus independen dari pembuat.'))return;
  void run(()=>api('PATCH','/api/sales/award',{document_id:id,review_kind:kind,review_notes:notes[id+'-'+kind]||''}),
   'Hasil review '+kind+' berhasil tercatat.');
 };
 return <main className="mx-auto max-w-5xl space-y-5 pb-24">
  <header className="rounded-xl border bg-white p-4 sm:p-5">
   <Link href={'/sales/pipeline?opportunity_id='+encodeURIComponent(opp)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14}/> Kembali ke Sales Opportunity</Link>
   <h1 className="mt-3 flex items-center gap-2 text-xl font-bold"><FileCheck2 size={20}/> Award, PO/SPK & Legal Review</h1>
   <p className="mt-2 text-xs text-slate-500">Opportunity: {opp} · Nomor PO Sales: {po||'belum tersedia'}</p>
   <div className={'mt-3 rounded-lg border p-3 text-xs '+(ready?'border-emerald-200 bg-emerald-50 text-emerald-950':'border-amber-200 bg-amber-50 text-amber-950')}>
    {ready?'Pemeriksaan ganda tercatat untuk PO/SPK ini; tahapan Won masih memerlukan seluruh gate lain.':
     'Gate Won belum lengkap: diperlukan PO/SPK dengan referensi arsip, SHA-256, review Finance, dan review Legal terpisah.'}
   </div>
   <p className="mt-2 text-xs text-slate-500">Register ini tidak menyimpan byte dokumen. Dokumen asli harus berada dalam arsip aman dan tersedia bagi reviewer yang diberi izin.</p>
  </header>
  {message&&<p role="status" className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">{message}</p>}
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Registrasi Dokumen Award / PO</h2>
    <label className="block text-xs font-semibold">Jenis Dokumen<select className={'mt-1 '+field} value={form.document_kind} onChange={e=>setForm(p=>({...p,document_kind:e.target.value}))}>
     {['po','spk','contract','award_letter'].map(x=><option value={x} key={x}>{x.toUpperCase()}</option>)}</select></label>
    <label className="block text-xs font-semibold">Nomor Dokumen<input className={'mt-1 '+field} value={form.document_number} onChange={e=>setForm(p=>({...p,document_number:e.target.value}))}/></label>
    <label className="block text-xs font-semibold">Referensi Arsip DMS asli<input className={'mt-1 '+field} value={form.archive_reference} onChange={e=>setForm(p=>({...p,archive_reference:e.target.value}))} placeholder="Lokasi dokumen asli terverifikasi"/></label>
    <label className="block text-xs font-semibold">Pilih dokumen untuk SHA256 lokal
     <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" className="mt-1 block w-full rounded-lg border p-2 text-xs" onChange={e=>void hashFile(e.target.files?.[0]||null)}/></label>
    <label className="block text-xs font-semibold">SHA-256<input className={'mt-1 '+field} value={form.original_sha256} onChange={e=>setForm(p=>({...p,original_sha256:e.target.value}))}/></label>
    <button disabled={busy||!['admin','sales'].includes(role)||form.original_sha256.length!==64||!form.archive_reference.trim()} onClick={add}
     className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Register Dokumen (Pending Review)</button>
   </section>
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16}/> Dual Verification</h2>
    {docs.length===0?<p className="text-xs text-slate-500">Belum ada dokumen award/PO untuk Opportunity ini.</p>:docs.map(x=><article key={x.id} className="space-y-2 rounded-lg border p-3">
     <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs">{x.document_kind.toUpperCase()} {x.document_number}</strong>
      <span className={'rounded-full px-2 py-1 text-[10px] '+(x.finance_reviewed_by&&x.legal_reviewed_by?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}>
       {x.finance_reviewed_by&&x.legal_reviewed_by?'Dual Reviewed':'Pending Review'}</span></div>
     <p className="break-words text-[11px] text-slate-500">{x.archive_reference}</p>
     <p className="text-xs">Finance: {x.finance_reviewed_by||'Belum diverifikasi'} · Legal: {x.legal_reviewed_by||'Belum diverifikasi'}</p>
     <p className="text-[11px] text-slate-500">Didaftarkan oleh {x.created_by}</p>
     {((role==='finance'||role==='approver')&&!x.finance_reviewed_by||role==='legal'&&!x.legal_reviewed_by)&&<div className="space-y-2 border-t pt-2">
      <label className="block text-xs font-semibold">Catatan pemeriksaan asli<textarea rows={2} className={'mt-1 '+field} value={notes[x.id+'-'+(role==='legal'?'legal':'finance')]||''}
       onChange={e=>setNotes(v=>({...v,[x.id+'-'+(role==='legal'?'legal':'finance')]:e.target.value}))}/></label>
      <button disabled={busy||(notes[x.id+'-'+(role==='legal'?'legal':'finance')]||'').trim().length<15}
       onClick={()=>review(x.id,role==='legal'?'legal':'finance')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
       Verifikasi sebagai {role==='legal'?'Legal':'Finance'}</button>
     </div>}
    </article>)}
   </section>
  </div>
 </main>;
}
