'use client';
import {useCallback,useEffect,useState} from 'react';
import VaultPicker from '@/components/sales/VaultPicker';
type Deal={id:string;title:string;company_name:string;stage:string};
type Doc={id:string;source:'release'|'library';release_id?:string;kind:string;file_name:string;version:number;sha256:string;byte_length:number;retention_until:string|null;legal_hold:number;created_at:string;created_by:string};
type Audit={document_id:string;source:string;action:string;actor_email:string;actor_role:string;event_at:string};
const categories:[string,string][]=[['nda','NDA'],['rks','RKS'],['kak','KAK'],['quotation','Quotation'],['supporting','Supporting Document'],['proposal','Proposal'],['submission','Bukti Submission'],['negotiation','Keputusan Pelanggan'],['po','PO'],['spk','SPK'],['contract','Kontrak'],['award_letter','Surat Penunjukan']];
const label=(s:string)=>categories.find(c=>c[0]===s)?.[1]||s;
const library=new Set(['nda','rks','kak','quotation','supporting']);
const input='w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
export default function DocumentVaultPage(){
 const [deals,setDeals]=useState<Deal[]>([]),[opp,setOpp]=useState(''),[role,setRole]=useState('');
 const [kind,setKind]=useState('nda'),[documents,setDocuments]=useState<Doc[]>([]),[audits,setAudits]=useState<Audit[]>([]);
 const [uploading,setUploading]=useState(false),[notice,setNotice]=useState(''),[auditOpen,setAuditOpen]=useState(false);
 const [retention,setRetention]=useState<Record<string,string>>({}),[reasons,setReasons]=useState<Record<string,string>>({});
 const [key,setKey]=useState(0);
 useEffect(()=>{
  const abort=new AbortController();
  void fetch('/api/sales?entity=deals',{cache:'no-store',signal:abort.signal}).then(r=>r.json()).then(j=>{
   if(!j.success)throw Error(j.message||'Daftar Opportunity tidak tersedia');
   setDeals(j.deals||[]);setRole(j.role||'');
   const fromUrl=new URLSearchParams(window.location.search).get('opportunity_id');
   setOpp(current=>current||(j.deals||[]).find((d:Deal)=>d.id===fromUrl)?.id||(j.deals||[])[0]?.id||'');
  }).catch(e=>{if(!abort.signal.aborted)setNotice(String(e.message||e));});
  return()=>abort.abort();
 },[]);
 const refresh=useCallback(async()=>{
  if(!opp){setDocuments([]);setAudits([]);return;}
  const q='opportunity_id='+encodeURIComponent(opp);
  try{
   const [a,b]=await Promise.all([
    fetch('/api/sales/document-vault?'+q,{cache:'no-store'}).then(r=>r.json()),
    ['admin','legal'].includes(role)&&auditOpen?fetch('/api/sales/document-vault?'+q+'&audit=1',{cache:'no-store'}).then(r=>r.json()):Promise.resolve({success:true,events:[]})
   ]);
   if(!a.success)throw Error(a.message||'Dokumen tidak tersedia');
   setDocuments(a.documents||[]);if(b.success)setAudits(b.events||[]);
  }catch(e){setNotice(e instanceof Error?e.message:String(e));}
 },[opp,role,auditOpen]);
 useEffect(()=>{void refresh();},[refresh,key]);
 async function upload(file:File|null){
  if(!file||!opp)return;
  if(!file.size||file.size>8*1024*1024){setNotice('Ukuran file harus antara 1 byte dan 8 MB');return;}
  setUploading(true);setNotice('');
  try{
   const q=new URLSearchParams({opportunity_id:opp,kind,filename:file.name});
   const r=await fetch('/api/sales/document-vault?'+q,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Unggah gagal');
   setNotice('Tersimpan: '+file.name+' — versi '+j.version+'; SHA-256 '+j.sha256.slice(0,12)+'…');setKey(n=>n+1);
  }catch(e){setNotice(e instanceof Error?e.message:String(e));}finally{setUploading(false);}
 }
 async function change(doc:Doc,action:'retention'|'hold',hold?:boolean){
  const k=doc.source+':'+doc.id,reason=(reasons[k]||'').trim();
  if(reason.length<15){setNotice('Isi alasan audit minimal 15 karakter sebelum mengubah kebijakan.');return;}
  try{
   const r=await fetch('/api/sales/document-vault',{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({opportunity_id:opp,id:doc.id,source:doc.source,action,hold,until:retention[k],reason})});
   const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||'Gagal memperbarui kebijakan');
   setNotice('Kebijakan tersimpan dan tercatat pada audit.');setKey(n=>n+1);
  }catch(e){setNotice(e instanceof Error?e.message:String(e));}
 }
 const allowedUpload=(role==='finance'&&kind==='supporting')||['admin','sales'].includes(role)||(role==='presales'&&['rks','kak','supporting'].includes(kind));
 return <main className="mx-auto w-full max-w-7xl min-w-0 space-y-5 px-3 py-5 pb-24 sm:px-6">
  <header className="rounded-2xl bg-slate-900 p-5 text-white">
   <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">India · Secure Document Management</p>
   <h1 className="mt-1 text-2xl font-bold">Document Vault</h1>
   <p className="mt-2 max-w-3xl text-sm text-slate-200">Arsip asli terenkripsi, riwayat versi, SHA-256, akses berbasis role, kebijakan retensi dan audit unduhan. File historis tidak ditimpa saat revisi.</p>
  </header>
  <section className="rounded-2xl border bg-white p-4 shadow-sm">
   <label className="block text-xs font-semibold text-slate-700">Customer / Opportunity
    <select className={'mt-2 '+input} value={opp} onChange={e=>setOpp(e.target.value)}>
     <option value="">Pilih Opportunity</option>
     {deals.map(d=><option value={d.id} key={d.id}>{d.company_name} — {d.title} ({d.stage})</option>)}
    </select>
   </label>
   <p className="mt-2 text-xs text-slate-500">Data tampil sesuai akses Cloudflare Access dan kepemilikan Opportunity. Role aktif: {role||'—'}.</p>
  </section>
  {opp&&<section className="rounded-2xl border bg-white p-4 shadow-sm">
   <h2 className="font-bold text-slate-900">Simpan Dokumen Asli</h2>
   <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-semibold text-slate-700">Jenis dokumen
     <select className={'mt-2 '+input} value={kind} onChange={e=>setKind(e.target.value)}>{categories.map(([id,text])=><option value={id} key={id}>{text}</option>)}</select>
    </label>
    {library.has(kind)&&<label className="text-xs font-semibold text-slate-700">File asli · maks. 8 MB
      <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.eml" disabled={!allowedUpload||uploading} className={'mt-2 '+input} onChange={e=>{void upload(e.target.files?.[0]||null);e.target.value='';}}/>
    </label>}
   </div>
   {!library.has(kind)&&<div className="mt-3"><VaultPicker opportunityId={opp} kind={kind} onSelect={()=>setKey(n=>n+1)}/></div>}
   <p className="mt-2 text-xs text-slate-500">Dokumen NDA/RKS/KAK/Quotation dapat diunggah sejak Opportunity dibuat. Dokumen terkait persetujuan penawaran mengikuti release yang aktif.</p>
  </section>}
  {notice&&<p role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 break-words">{notice}</p>}
  {opp&&<section className="rounded-2xl border bg-white p-4 shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">Riwayat Dokumen ({documents.length})</h2><button type="button" onClick={()=>void refresh()} className="rounded-lg border px-3 py-2 text-xs font-bold">Refresh</button></div>
   <div className="mt-3 space-y-3">
   {documents.length===0&&<p className="text-sm text-slate-500">Belum ada dokumen asli pada Opportunity ini.</p>}
   {documents.map(doc=>{
    const k=doc.source+':'+doc.id;
    return <article key={k} className="min-w-0 rounded-xl border border-slate-200 p-3">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
       <p className="text-xs font-bold text-blue-700">{label(doc.kind)} · Versi {doc.version} · {doc.source==='release'?'Paket Penawaran':'Arsip Pra/Pendukung'}</p>
       <a className="mt-1 block break-all text-sm font-semibold text-slate-900 underline" href={'/api/sales/document-vault?opportunity_id='+encodeURIComponent(opp)+'&source='+doc.source+'&id='+encodeURIComponent(doc.id)}>{doc.file_name}</a>
       <p className="mt-1 text-xs text-slate-500">{doc.created_by} · {doc.created_at} · {Math.ceil(doc.byte_length/1024)} KB</p>
       <p className="mt-1 break-all font-mono text-[10px] text-slate-500">SHA-256: {doc.sha256}</p>
      </div>
      <div className="text-right text-xs">
       <span className={'inline-block rounded-md px-2 py-1 font-bold '+(doc.legal_hold?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700')}>{doc.legal_hold?'Legal Hold':'No Hold'}</span>
       <p className="mt-1 text-slate-500">Retensi: {doc.retention_until||'Perlu ditetapkan'}</p>
      </div>
     </div>
     {['admin','legal'].includes(role)&&<div className="mt-3 space-y-2 border-t pt-3">
      <input className={input} placeholder="Alasan perubahan (minimal 15 karakter)" aria-label={'Alasan untuk '+doc.file_name} value={reasons[k]||''} onChange={e=>setReasons(x=>({...x,[k]:e.target.value}))}/>
      <div className="flex flex-wrap gap-2">
       {role==='admin'&&<><input type="date" className="rounded-lg border px-2 py-1 text-xs" aria-label="Retensi sampai" value={retention[k]||''} onChange={e=>setRetention(x=>({...x,[k]:e.target.value}))}/><button type="button" onClick={()=>void change(doc,'retention')} className="rounded-lg border px-3 py-1 text-xs font-semibold">Simpan retensi</button></>}
       {!doc.legal_hold&&<button type="button" className="rounded-lg border border-amber-300 px-3 py-1 text-xs font-semibold" onClick={()=>void change(doc,'hold',true)}>Aktifkan Legal Hold</button>}
       {!!doc.legal_hold&&role==='legal'&&<button type="button" className="rounded-lg border px-3 py-1 text-xs font-semibold" onClick={()=>void change(doc,'hold',false)}>Lepas Legal Hold</button>}
      </div>
     </div>}
    </article>;
   })}
   </div>
  </section>}
  {opp&&['admin','legal'].includes(role)&&<section className="rounded-2xl border bg-white p-4 shadow-sm">
   <button className="text-sm font-bold underline" type="button" onClick={()=>setAuditOpen(x=>!x)}>{auditOpen?'Sembunyikan':'Tampilkan'} Audit Akses Dokumen</button>
   {auditOpen&&<div className="mt-3 space-y-2">{audits.map((x,i)=><p key={i} className="break-words rounded-lg bg-slate-50 p-2 text-xs">{x.event_at} · {x.action} · {x.source} · {x.actor_role} / {x.actor_email} · {x.document_id}</p>)}{audits.length===0&&<p className="text-sm text-slate-500">Tidak ada event audit terbaru.</p>}</div>}
  </section>}
  <p className="text-xs text-slate-500">Retensi belum ditentukan sampai Admin menetapkan tanggalnya. Legal Hold mempertahankan dokumen; penghapusan fisik masih memerlukan kebijakan dan persetujuan terpisah. Tidak ada file yang disajikan melalui URL publik.</p>
 </main>;
}
