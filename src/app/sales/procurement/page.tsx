'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,ClipboardCheck,FileSearch,ShieldCheck,UploadCloud} from 'lucide-react';
type Bid={channel:string;tender_number:string;tender_deadline:string;summary:string;bid_decision:string;decided_by:string|null;proposed_by:string;decision_reason:string};
type Requirement={id:string;kind:string;title:string;status:string;compliance_status:string;file_reference:string;source_content_hash:string;file_name:string;requirement_summary:string;reviewed_by:string|null;created_by:string};
const control='w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-500';
const initialBid=()=>({channel:'tender',tender_number:'',tender_deadline:'',summary:''});
const initialReq=()=>({kind:'rks',title:'',file_name:'',file_reference:'',source_content_hash:'',requirement_summary:''});
async function fetchJson(method:'GET'|'POST'|'PATCH',url:string,data?:Record<string,unknown>){
 const r=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
  ...(data?{body:JSON.stringify(data)}:{})});
 const j=await r.json();
 if(!r.ok||!j.success)throw Error(j.message+(j.missing?' • '+j.missing.join(', '):''));
 return j;
}
export default function SalesProcurement(){
 const [opp,setOpp]=useState('');
 const [title,setTitle]=useState('');
 const [role,setRole]=useState('');
 const [bid,setBid]=useState<Bid|null>(null);
 const [draftBid,setDraftBid]=useState(initialBid());
 const [decision,setDecision]=useState('go');
 const [decisionReason,setDecisionReason]=useState('');
 const [draftReq,setDraftReq]=useState(initialReq());
 const [requirements,setRequirements]=useState<Requirement[]>([]);
 const [reviewNotes,setReviewNotes]=useState<Record<string,string>>({});
 const [compliance,setCompliance]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [uploadBusy,setUploadBusy]=useState(false);
 const refresh=useCallback(async(id:string)=>{
  try{
   const [j,d]=await Promise.all([
    fetchJson('GET','/api/sales/procurement?opportunity_id='+encodeURIComponent(id)),
    fetchJson('GET','/api/sales?entity=details&id='+encodeURIComponent(id))
   ]);
   setBid(j.bid||null);setRequirements(j.requirements||[]);setRole(j.role||'');setTitle(d.deal.title);
   if(j.bid)setDraftBid({channel:j.bid.channel,tender_number:j.bid.tender_number,tender_deadline:j.bid.tender_deadline,summary:j.bid.summary});
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('opportunity_id')||'';setOpp(id);
  if(id)void refresh(id);else setMessage('Buka halaman dari detail Opportunity yang telah terdaftar.');},[refresh]);
 const run=async(job:()=>Promise<unknown>,success:string)=>{
  setBusy(true);setMessage('');
  try{await job();await refresh(opp);setMessage(success);}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const submitBid=()=>void run(()=>fetchJson('POST','/api/sales/procurement',{entity:'bid',opportunity_id:opp,...draftBid}), 'Bid Request tersimpan untuk keputusan Approver.');
 const decide=()=>{if(!window.confirm('Keputusan Bid/No-Bid ini tercatat sebagai keputusan independen dan tidak bisa diubah langsung. Lanjutkan?'))return;
  void run(()=>fetchJson('PATCH','/api/sales/procurement',{entity:'bid_decision',opportunity_id:opp,bid_decision:decision,decision_reason:decisionReason}),
   'Keputusan Bid/No-Bid telah tercatat.');
 };
 const submitReq=()=>void run(()=>fetchJson('POST','/api/sales/procurement',{entity:'requirement',opportunity_id:opp,...draftReq}),
  'Requirement disimpan berstatus Draft; reviewer independen tetap diperlukan.');
 const review=(x:Requirement)=>void run(()=>fetchJson('PATCH','/api/sales/procurement',{
  entity:'requirement_review',opportunity_id:opp,id:x.id,
  compliance_status:compliance[x.id]||'pending',review_notes:reviewNotes[x.id]||''}),
  'Requirement telah direview dengan audit trail.');
 const loadFile=async(file:File|null)=>{
  if(!file)return;
  if(file.size>8*1024*1024){setMessage('File maksimum 8 MB.');return;}
  setUploadBusy(true);setMessage('');
  try{
   const data=await file.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',data);
   const hash=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
   const form=new FormData();form.set('file',file);
   const response=await fetch('/api/scoping/upload',{method:'POST',credentials:'same-origin',headers:{'x-india-document-upload':'1'},body:form});
   const result=await response.json();
   if(!response.ok||!result.success)throw Error(result.message||'Gagal mengekstrak RKS/KAK');
   const extracted=String(result.text||result.extractedText||'').trim().slice(0,2000);
   setDraftReq(v=>({...v,file_name:file.name,source_content_hash:hash,title:v.title||file.name,
    requirement_summary:extracted||v.requirement_summary}));
   setMessage('File telah dibaca dan SHA-256 dihitung. Isi lokasi arsip sumber yang dapat diverifikasi, lalu tinjau ringkasan sebelum simpan. File asli tidak disimpan pada register ini.');
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setUploadBusy(false);}
 };
 const canWrite=['sales','presales','admin'].includes(role);
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="space-y-2 rounded-xl border bg-white p-4 sm:p-5">
   <Link href={'/sales/pipeline?opportunity_id='+encodeURIComponent(opp)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft size={14}/> Kembali ke Opportunity</Link>
   <div className="flex items-center gap-2 text-xs font-bold text-blue-700"><FileSearch size={16}/> INDIA · Procurement & Scoping</div>
   <Link href={'/sales/compliance?opportunity_id='+encodeURIComponent(opp)} className="inline-flex rounded-lg border px-3 py-2 text-xs font-bold text-blue-700">Matriks per Klausul & Vendor Management →</Link>
   <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Bid/No-Bid, RKS/KAK & Requirement Register</h1>
   <p className="text-xs text-slate-600">{title||'Opportunity belum dipilih'} · {opp}</p>
   <p className="text-xs text-amber-800">Unggah untuk ekstraksi dan hash saja; referensi arsip sumber harus menunjuk dokumen yang dikelola sesuai kebijakan perusahaan. Tidak ada dokumen yang otomatis dianggap sah.</p>
  </header>
  {message&&<div role="status" className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">{message}</div>}
  <div className="grid items-start gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <div className="flex items-center gap-2"><ClipboardCheck size={18}/><h2 className="font-bold">Bid/No-Bid Request</h2></div>
    {bid&&<p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Keputusan: <b>{bid.bid_decision.toUpperCase()}</b>{bid.decided_by?' · oleh '+bid.decided_by:''}. Pengusul: {bid.proposed_by}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
     <label className="text-xs font-semibold">Metode pengadaan<select value={draftBid.channel} onChange={e=>setDraftBid(v=>({...v,channel:e.target.value}))} className={'mt-1 '+control}>
      {[['direct','Direct'],['rfq','RFQ'],['rfp','RFP'],['tender','Tender']].map(([a,b])=><option value={a} key={a}>{b}</option>)}</select></label>
     <label className="text-xs font-semibold">Nomor tender/RFQ<input value={draftBid.tender_number} onChange={e=>setDraftBid(v=>({...v,tender_number:e.target.value}))} className={'mt-1 '+control}/></label>
     <label className="text-xs font-semibold">Batas submission<input type="date" value={draftBid.tender_deadline} onChange={e=>setDraftBid(v=>({...v,tender_deadline:e.target.value}))} className={'mt-1 '+control}/></label>
    </div>
    <label className="block text-xs font-semibold">Bid Summary / Kelayakan<textarea rows={3} value={draftBid.summary} onChange={e=>setDraftBid(v=>({...v,summary:e.target.value}))} className={'mt-1 '+control}/></label>
    <button disabled={busy||!['admin','sales'].includes(role)||bid?.bid_decision!=='pending'&&!!bid} onClick={submitBid}
     className="rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Simpan Bid Request</button>
    {bid?.bid_decision==='pending'&&['admin','approver'].includes(role)&&<div className="space-y-3 border-t pt-3">
     <h3 className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={16}/> Keputusan Approver Independen</h3>
     <select value={decision} onChange={e=>setDecision(e.target.value)} className={control}>
      <option value="go">GO</option><option value="conditional_go">Conditional GO</option><option value="no_go">NO-GO</option>
     </select>
     <textarea className={control} rows={3} value={decisionReason} onChange={e=>setDecisionReason(e.target.value)} placeholder="Alasan keputusan minimal 12 karakter"/>
     <button disabled={busy||decisionReason.trim().length<12} onClick={decide} className="rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Catat Keputusan</button>
    </div>}
   </section>
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <div className="flex items-center gap-2"><UploadCloud size={18}/><h2 className="font-bold">Register RKS / KAK / RFP</h2></div>
    <label className="block text-xs font-semibold">Jenis dokumen<select className={'mt-1 '+control} value={draftReq.kind} onChange={e=>setDraftReq(v=>({...v,kind:e.target.value}))}>
     {['rks','kak','rfp','rfq','nda','technical','commercial','vendor_quote','clarification'].map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}</select></label>
    <label className="block text-xs font-semibold">Pilih file sumber (opsional untuk ekstraksi)
     <input type="file" accept=".pdf,.docx,.txt" disabled={uploadBusy||!canWrite} onChange={e=>void loadFile(e.target.files?.[0]||null)}
      className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-xs"/></label>
    <label className="block text-xs font-semibold">Judul requirement<input className={'mt-1 '+control} value={draftReq.title} onChange={e=>setDraftReq(v=>({...v,title:e.target.value}))}/></label>
    <label className="block text-xs font-semibold">Lokasi arsip sumber / Document ID<input className={'mt-1 '+control} placeholder="Reference dokumen yang dapat diverifikasi (bukan placeholder)" value={draftReq.file_reference} onChange={e=>setDraftReq(v=>({...v,file_reference:e.target.value}))}/></label>
    <label className="block text-xs font-semibold">SHA-256 sumber<input className={'mt-1 '+control} value={draftReq.source_content_hash} onChange={e=>setDraftReq(v=>({...v,source_content_hash:e.target.value}))}/></label>
    <label className="block text-xs font-semibold">Ringkasan persyaratan yang ditinjau<textarea rows={4} className={'mt-1 '+control} value={draftReq.requirement_summary} onChange={e=>setDraftReq(v=>({...v,requirement_summary:e.target.value}))}/></label>
    <button disabled={busy||uploadBusy||!canWrite||draftReq.requirement_summary.trim().length<15} onClick={submitReq}
     className="rounded-lg bg-blue-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Daftarkan Requirement (Draft)</button>
   </section>
  </div>
  <section className="space-y-3 rounded-xl border bg-white p-4">
   <h2 className="text-sm font-bold">Requirement Matrix & Independent Review</h2>
   {requirements.length===0?<p className="text-xs text-slate-500">Belum ada requirement tercatat untuk Opportunity ini.</p>:
   <div className="grid gap-3 sm:grid-cols-2">{requirements.map(r=><article key={r.id} className="min-w-0 space-y-2 rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-xs">{r.kind.toUpperCase()} · {r.title}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px]">{r.status} · {r.compliance_status}</span></div>
    <p className="break-all text-[11px] text-slate-600">{r.file_name||'Nama file belum tersedia'} · {r.file_reference||'Belum ada lokasi arsip'}</p>
    <p className="text-xs text-slate-600">{r.requirement_summary}</p>
    {r.reviewed_by?<p className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={14}/> Reviewed: {r.reviewed_by}</p>:null}
    {r.status==='draft'&&['admin','presales','finance'].includes(role)&&<div className="space-y-2 border-t pt-2">
     <select aria-label={'Status '+r.title} className={control} value={compliance[r.id]||'pending'} onChange={e=>setCompliance(v=>({...v,[r.id]:e.target.value}))}>
      {['pending','compliant','partial','non_compliant','not_applicable'].map(s=><option key={s} value={s}>{s}</option>)}</select>
     <textarea aria-label={'Catatan '+r.title} rows={2} className={control} placeholder="Review independen minimal 8 karakter" value={reviewNotes[r.id]||''} onChange={e=>setReviewNotes(v=>({...v,[r.id]:e.target.value}))}/>
     <button disabled={busy||(reviewNotes[r.id]||'').trim().length<8} onClick={()=>review(r)} className="rounded-lg border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-40">Sahkan Review</button>
    </div>}
   </article>)}</div>}
  </section>
 </main>;
}
