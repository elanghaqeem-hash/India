'use client';
import React,{useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import VaultPicker from '@/components/sales/VaultPicker';
import {vaultDownload} from '@/lib/document-vault-links';
import {ArrowLeft,CheckCircle2,Send,ShieldCheck} from 'lucide-react';
type Submission={id:string;quotation_number:string;boq_version:number;recipient_email:string;channel:string;
 status:string;created_by:string;verified_by:string|null;sent_at:string;evidence_reference:string;review_notes:string};
const cls='w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-600';
async function api(method:'GET'|'POST'|'PATCH',url:string,body?:Record<string,unknown>){
 const r=await fetch(url,{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();
 if(!r.ok||!j.success)throw Error(j.message||'Transaksi gagal');
 return j;
}
export default function SubmissionPage(){
 const [opp,setOpp]=useState('');
 const [role,setRole]=useState('');
 const [quote,setQuote]=useState('');
 const [items,setItems]=useState<Submission[]>([]);
 const [channel,setChannel]=useState('email');
 const [recipient,setRecipient]=useState('');
 const [date,setDate]=useState('');
 const [reference,setReference]=useState('');
 const [digest,setDigest]=useState('');
 const [review,setReview]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async(id:string)=>{
  try{const x=await api('GET','/api/sales/submission?opportunity_id='+encodeURIComponent(id));
   setItems(x.submissions||[]);setRole(x.role||'');setQuote(x.quotation_number||'');
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
 },[]);
 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('opportunity_id')||'';setOpp(id);
  const local=new Date();local.setMinutes(local.getMinutes()-local.getTimezoneOffset());setDate(local.toISOString().slice(0,19));
  if(id)void refresh(id);else setMessage('Halaman ini harus dibuka dari Opportunity INDIA.');},[refresh]);
 const run=async(job:()=>Promise<unknown>,done:string)=>{
  setBusy(true);setMessage('');
  try{await job();await refresh(opp);setMessage(done);}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const submit=()=>{if(!window.confirm('Anda menyatakan telah mengirim quotation final kepada penerima. Rekam sebagai Reported, bukan Verified?'))return;
  void run(()=>api('POST','/api/sales/submission',{
   opportunity_id:opp,channel,recipient_email:recipient,sent_at:new Date(date).toISOString(),
   evidence_reference:reference,evidence_sha256:digest}),
  'Pengiriman tercatat sebagai Reported. Finance/Approver harus mereview bukti.');
 };
 const decision=(submissionId:string,status:'verified'|'rejected')=>{
  if(!window.confirm('Pastikan Anda sudah memeriksa bukti asli dan Anda bukan pembuat submission. Lanjutkan?'))return;
  void run(()=>api('PATCH','/api/sales/submission',{submission_id:submissionId,action:status,review_notes:review[submissionId]||''}),
   'Hasil pemeriksaan bukti pengiriman sudah disimpan.');
 };
 return <main className="mx-auto max-w-5xl space-y-5 pb-24">
  <header className="rounded-xl border bg-white p-4 sm:p-5">
   <Link href={'/sales/pipeline?opportunity_id='+encodeURIComponent(opp)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><ArrowLeft size={15}/> Kembali ke Opportunity</Link>
   <h1 className="mt-3 flex items-center gap-2 text-xl font-extrabold"><Send size={20}/> Quotation Submission & Evidence</h1>
   <p className="mt-2 text-xs text-slate-500">Opportunity {opp} · Quotation {quote||'belum dicantumkan'}</p>
   <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
    Simpan bukti pengiriman asli di Document Vault, lalu ajukan pemeriksaan Finance/Approver. Setiap dokumen terhubung ke versi penawaran yang dikirim.</p>
  </header>
  {message&&<div role="status" className="whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">{message}</div>}
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Catat Pengiriman Final</h2>
    <label className="block text-xs font-semibold">Channel<select className={'mt-1 '+cls} value={channel} onChange={e=>setChannel(e.target.value)}>
     <option value="email">Email</option><option value="procurement_portal">Procurement Portal</option><option value="physical">Penyerahan Fisik</option></select></label>
    <label className="block text-xs font-semibold">Email penerima resmi<input className={'mt-1 '+cls} value={recipient} onChange={e=>setRecipient(e.target.value)} type="email"/></label>
    <label className="block text-xs font-semibold">Waktu pengiriman<input className={'mt-1 '+cls} type="datetime-local" step="1" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label className="block text-xs font-semibold">Referensi arsip bukti (email / portal receipt)
     <input className={'mt-1 '+cls} value={reference} readOnly placeholder="ID dokumen tersimpan, bukan sampel"/></label>
    <VaultPicker opportunityId={opp} kind="submission" disabled={busy} onSelect={(ref,sha)=>{setReference(ref);setDigest(sha);}}/>
    <label className="block text-xs font-semibold">SHA-256<input className={'mt-1 '+cls} value={digest} readOnly/></label>
    <button disabled={busy||!['sales','admin'].includes(role)||!recipient||!reference||!date||digest.length!==64} onClick={submit}
     className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Catat Submission (Reported)</button>
   </section>
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <h2 className="text-sm font-bold">Bukti dan Pemeriksaan Independen</h2>
    {items.length===0?<p className="text-xs text-slate-500">Belum ada bukti pengiriman untuk Opportunity ini.</p>:items.map(x=><article key={x.id} className="space-y-2 rounded-lg border p-3">
     <div className="flex items-center justify-between gap-2"><b className="text-xs">{x.quotation_number} v{x.boq_version}</b>
      <span className={'rounded-full px-2 py-1 text-[10px] font-bold '+(x.status==='verified'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}>{x.status.toUpperCase()}</span></div>
     <p className="break-words text-xs text-slate-600">Penerima: {x.recipient_email} · {x.channel}</p>
     <p className="break-all text-xs text-slate-600">{vaultDownload(x.evidence_reference)?<a href={vaultDownload(x.evidence_reference)!} className="font-semibold text-blue-700 underline">Unduh bukti asli</a>:x.evidence_reference}</p>
     <p className="text-[11px] text-slate-500">Dibuat: {x.created_by}{x.verified_by?' · Direview: '+x.verified_by:''}</p>
     {x.status==='verified'&&<p className="flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14}/> Review independen tercatat</p>}
     {x.status==='reported'&&['admin','finance','approver'].includes(role)&&<div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2 text-xs font-bold"><ShieldCheck size={15}/> Reviewer Finance/Approver</div>
      <textarea rows={2} className={cls} value={review[x.id]||''} onChange={e=>setReview(v=>({...v,[x.id]:e.target.value}))} placeholder="Catatan verifikasi bukti asli minimal 15 karakter"/>
      <div className="flex flex-wrap gap-2"><button disabled={busy||(review[x.id]||'').trim().length<15} onClick={()=>decision(x.id,'verified')}
       className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Verified</button>
       <button disabled={busy||(review[x.id]||'').trim().length<15} onClick={()=>decision(x.id,'rejected')}
       className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-50">Reject</button></div>
     </div>}
    </article>)}
   </section>
  </div>
 </main>;
}
