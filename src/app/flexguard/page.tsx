'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Tx={id:string;kind:string;units:number;created_at:string;explanation:string};
type Wallet={id:string;customer_name:string;contract_id:string;opportunity_id:string;status:string;expires_at:string;entitlement_units:number;balance:{issued:number;available:number;reserved:number;consumed:number;expired:number};events?:Tx[]};
const input='block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-sm';
export default function FlexGuardPage(){
 const [wallets,setWallets]=useState<Wallet[]>([]),[role,setRole]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[selected,setSelected]=useState(''),[contract,setContract]=useState(''),[quota,setQuota]=useState('');
 const [action,setAction]=useState('RESERVE'),[units,setUnits]=useState(''),[invoice,setInvoice]=useState(''),[opp,setOpp]=useState(''),[source,setSource]=useState(''),[document,setDocument]=useState(''),[notes,setNotes]=useState(''),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setError('');
  void fetch('/api/sales/flexguard',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
   .then(async res=>{const j=await res.json();if(!res.ok||j.success!==true)throw Error(j.message||'Ledger D1 belum siap');if(!controller.signal.aborted){setWallets(j.wallets);setRole(j.role);setSelected(old=>j.wallets.some((w:Wallet)=>w.id===old)?old:j.wallets[0]?.id||'');}})
   .catch(e=>{if(!controller.signal.aborted){setWallets([]);setError(e instanceof Error?e.message:'Ledger D1 tidak tersedia');}});
  return ()=>controller.abort();
 },[refresh]);
 const active=wallets.find(w=>w.id===selected);
 const post=async(payload:Record<string,unknown>)=>{
  setBusy(true);setError('');setNotice('');
  try{const res=await fetch('/api/sales/flexguard',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok||data.success!==true)throw Error(data.message||'Transaksi ditolak');
   setNotice(data.message||'Transaksi tersimpan di D1');setRefresh(x=>x+1);setNotes('');setUnits('');
  }catch(e){setError(e instanceof Error?e.message:'Transaksi gagal');}finally{setBusy(false);}
 };
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header className="rounded-xl border bg-white p-5"><h1 className="text-xl font-bold">FlexGuard · D1 Immutable Token Ledger</h1>
   <p className="mt-2 text-sm text-slate-600">Kuota dan saldo dihitung dari event D1 immutable. Reservasi, konsumsi dan refund memerlukan saldo serta referensi sah. Semua transaksi ditolak bila migrasi 0030 belum diterapkan.</p>
   <Link href="/sales/renewals" className="mt-3 inline-block text-sm font-semibold text-indigo-700 underline">Kontrak & Renewal →</Link></header>
  {error&&<p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">BLOCKED — {error}</p>}
  {notice&&<p role="status" className="rounded-xl border border-emerald-200 p-3 text-sm">{notice}</p>}
  {(role==='admin'||role==='finance')&&<form className="space-y-3 rounded-xl border bg-white p-5" onSubmit={e=>{e.preventDefault();void post({action:'create_wallet',contract_id:contract,entitlement_units:Number(quota)});}}>
   <h2 className="font-bold">Registrasi entitlement dari kontrak FlexGuard approved</h2>
   <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs">Contract ID<input className={input} value={contract} onChange={e=>setContract(e.target.value)} required/></label>
    <label className="text-xs">Batas token kontrak<input type="number" min="1" step="1" className={input} value={quota} onChange={e=>setQuota(e.target.value)} required/></label></div>
   <button disabled={busy} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ajukan entitlement (maker)</button>
  </form>}
  {wallets.length===0&&!error&&<p role="status" className="rounded-xl border bg-white p-4 text-sm">Belum ada wallet FlexGuard yang berwenang ditampilkan.</p>}
  {wallets.length>0&&<section className="space-y-4 rounded-xl border bg-white p-5">
   <label className="block text-xs font-semibold">Pilih wallet<select className={input} value={selected} onChange={e=>{setSelected(e.target.value);}}>{wallets.map(w=><option key={w.id} value={w.id}>{w.customer_name} · {w.id}</option>)}</select></label>
   {active&&<>
    <p className="text-xs text-slate-600">Kontrak: {active.contract_id} · Status: {active.status} · Kadaluarsa: {active.expires_at} · Entitlement: {active.entitlement_units}</p>
    <div className="grid gap-3 sm:grid-cols-4">{Object.entries(active.balance).map(([label,val])=><div key={label} className="rounded-lg border bg-slate-50 p-3"><p className="text-xs capitalize text-slate-600">{label}</p><p className="text-xl font-bold">{val} MD</p></div>)}</div>
    {active.status==='draft'&&(role==='approver'||role==='admin')&&<button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white" onClick={()=>void post({action:'approve_wallet',wallet_id:active.id,notes:notes.trim()})}>Setujui entitlement independen (catatan min. 12 karakter)</button>}
    <form className="grid gap-3 border-t pt-4 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void post({action,wallet_id:active.id,units:Number(units),invoice_id:invoice||undefined,opportunity_id:opp||undefined,source_event_id:source||undefined,document_id:document||undefined,request_key:crypto.randomUUID(),explanation:notes});}}>
     <label className="text-xs">Jenis event<select className={input} value={action} onChange={e=>setAction(e.target.value)}>{['ISSUE','TOPUP','RESERVE','RELEASE','DEBIT','REFUND','EXPIRY'].map(v=><option key={v}>{v}</option>)}</select></label>
     <label className="text-xs">Jumlah token (integer)<input className={input} type="number" min="1" step="1" value={units} onChange={e=>setUnits(e.target.value)} required/></label>
     <label className="text-xs">Invoice ID (ISSUE/TOPUP)<input className={input} value={invoice} onChange={e=>setInvoice(e.target.value)}/></label>
     <label className="text-xs">Opportunity ID (RESERVE/RELEASE/DEBIT)<input className={input} value={opp} onChange={e=>setOpp(e.target.value)}/></label>
     <label className="text-xs">Event sumber (RELEASE/DEBIT/REFUND)<input className={input} value={source} onChange={e=>setSource(e.target.value)}/></label>
     <label className="text-xs">Original supporting Vault ID (DEBIT)<input className={input} value={document} onChange={e=>setDocument(e.target.value)}/></label>
     <label className="text-xs sm:col-span-2">Justifikasi minimal 12 karakter<textarea className={input} rows={2} value={notes} onChange={e=>setNotes(e.target.value)} required minLength={12}/></label>
     <button type="submit" className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy||active.status!=='active'}>Simpan event D1 (audit immutable)</button>
    </form>
    {active.events?.length?<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Event</th><th>Unit</th><th>Tanggal</th><th>Alasan</th></tr></thead><tbody>{active.events.map(e=><tr key={e.id} className="border-t"><td>{e.kind}</td><td>{e.units}</td><td>{e.created_at}</td><td>{e.explanation}</td></tr>)}</tbody></table></div>:null}
   </>}
  </section>}
 </main>;
}
