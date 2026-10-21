'use client';
import React,{useEffect,useState,useCallback} from 'react';
import Link from 'next/link';
import { PRESALES_FIELDS } from '@/lib/sales-access';
import type {JourneyGate} from '@/lib/sales-journey';
import { SALES_STAGES, ACCOUNT_FIELDS, DEAL_FIELDS, SERVICE_FAMILIES, stageProbability,
 type SalesAccount,type SalesDeal,type SalesFields,type SalesStage } from '@/lib/sales-workflow';

type Detail={deal:SalesDeal;account:SalesAccount;boqs:{id:string;quotation_number:string;status:string;project_name:string}[];
 poCheck:{verified_by:string;verified_at:string}|null;checklist:{registration:string[];project:string[]};
 originLead:{lead_id:string;lead_number:string;source:string;campaign:string}|null;
 history:{action:string;from_stage:string|null;to_stage:string|null;actor_email:string;created_at:string}[];
 activities:{kind:string;subject:string;detail:string;created_at:string}[];journey:JourneyGate[];role:string;identityEmail:string};
const money=(v:number)=>'Rp '+Number(v||0).toLocaleString('id-ID');
const inputClass='mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500';
const areaKeys=new Set(['technical_scope','technical_specifications','deliverables','asset_profile','discovery_notes','client_need','procurement_process','negotiation_notes','scope_reconciliation','opportunity_notes','payment_milestones','lost_notes','hq_address','billing_address','project_site']);
const listSelect:Record<string,string[]>={
 service_family:[...SERVICE_FAMILIES],contract_model:['One-Time','Recurring','Subscription','Project-based'],
 employee_band:['<100','100-500','>500'],billing_same_as_hq:['ya','tidak'],
 delivery_model:['Remote','Onsite','Hybrid'],
 resourcing_model:['Belum dikonfirmasi','Shared','Dedicated','Hybrid'],
 customer_decision:['pending','approved','rejected'],
 payment_va:['BCA','OCBC NISP'],industry:['Banking','Asuransi','Multifinance','Sekuritas','Fintech','BUMN','Pemerintah','Healthcare','Retail','Manufaktur','Teknologi Informasi','Lainnya'],
};
const stageLabel=(s:string)=>SALES_STAGES.find(x=>x[0]===s)?.[1]||s;
const stages:SalesStage[]=SALES_STAGES.map(x=>x[0]);
function FormFields({fields,values,onUpdate,readOnly}:{
 fields:readonly (readonly [string,string])[];values:SalesFields;onUpdate:(k:string,v:string)=>void;readOnly?:(k:string)=>boolean;
}){
 return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
 {fields.map(([key,label])=><label key={key} className={'block min-w-0 text-xs font-semibold text-slate-700 '+(areaKeys.has(key)?'sm:col-span-2':'')}>
  {label}
  {listSelect[key]?<select aria-label={label} className={inputClass} disabled={readOnly?.(key)} value={values[key]||''} onChange={e=>onUpdate(key,e.target.value)}>
    <option value="">— Pilih —</option>{listSelect[key].map(v=><option key={v} value={v}>{v}</option>)}</select>:
  areaKeys.has(key)?<textarea rows={2} className={inputClass+' resize-y'} disabled={readOnly?.(key)} value={values[key]||''} onChange={e=>onUpdate(key,e.target.value)}/>:
  <input className={inputClass} disabled={readOnly?.(key)} type={key.endsWith('_date')||['expected_closing_date','next_action_at','quotation_sent_at','quotation_valid_until'].includes(key)?'date':key.endsWith('_email')?'email':key.includes('amount')||key==='quotation_valid_days'?'number':'text'} value={values[key]||''} onChange={e=>onUpdate(key,e.target.value)}/>}
 </label>)}
 </div>;
}
const SALES_FIELD_GROUPS: Array<{title:string;description:string;keys:readonly string[]}>= [
 {title:'01 · Pipeline & Qualification',description:'Sumber lead, owner, target closing, kebutuhan, budget, PIC keputusan dan procurement',
  keys:['lead_source','sales_owner','expected_closing_date','service_family','contract_model','client_need','budget_status','decision_maker','procurement_process','discovery_notes']},
 {title:'02 · Technical Scoping & Delivery',description:'Parameter teknis, aset, metodologi, SLA, resource, deliverables dan timeline',
  keys:['technical_scope','technical_specifications','scope_quantity','service_level','delivery_model','resourcing_model','deliverables','project_site','project_province','project_postal','project_pic_name','project_pic_phone','project_pic_email','implementation_timeline','contract_duration','license_or_sku','asset_profile','methodology','exclusions','team_composition']},
 {title:'03 · BoQ, Costing & Commercial',description:'Referensi BoQ approved, komersial, termin dan rekening VA',
  keys:['boq_id','costing_notes','payment_terms','payment_va','payment_milestones']},
 {title:'04 · Quotation & Dokumen',description:'Nomor surat, masa berlaku, penerima, penandatangan dan ketentuan',
  keys:['quotation_number','quotation_sent_at','quotation_valid_days','quotation_valid_until','quotation_terms','quotation_payment_notes','end_user','quotation_to_pic','quotation_sender_name','quotation_sender_title']},
 {title:'05 · Negotiation & Follow-up',description:'Perkembangan penawaran, keputusan pelanggan, rencana tindak lanjut',
  keys:['next_action','next_action_at','negotiation_notes','customer_decision']},
 {title:'06 · PO & Closing / Loss Analysis',description:'Nomor, tanggal, nilai dan bukti pemeriksaan PO atau alasan deal tidak dimenangkan',
  keys:['scope_reconciliation','po_number','po_date','po_reference','po_amount_before_vat','lost_reason','lost_notes','competitor','opportunity_notes']},
];
function DealFieldSections({values,onUpdate,readOnly}:{
 values:SalesFields;onUpdate:(key:string,value:string)=>void;readOnly?:(key:string)=>boolean;
}){
 const used=new Set(SALES_FIELD_GROUPS.flatMap(g=>g.keys));
 const groups=[...SALES_FIELD_GROUPS,{title:'Parameter Lain',description:'Field tambahan yang diperlukan oleh format dokumen',keys:DEAL_FIELDS.map(x=>x[0]).filter(k=>!used.has(k))}];
 return <div className="space-y-3">{groups.filter(g=>g.keys.length>0).map((g,i)=>{
  const fields=DEAL_FIELDS.filter(([key])=>g.keys.includes(key));
  const count=fields.filter(([k])=>!!values[k]?.trim()).length;
  return <details key={g.title} open={i===0?true:undefined} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
   <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left">
    <span><span className="block text-sm font-bold text-slate-900">{g.title}</span>
     <span className="mt-1 block text-xs font-normal text-slate-500">{g.description}</span></span>
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{count}/{fields.length}</span>
   </summary>
   <div className="mt-4 border-t pt-4"><FormFields fields={fields} values={values} readOnly={readOnly} onUpdate={onUpdate}/></div>
  </details>;
 })}</div>;
}
async function request(method:'GET'|'POST'|'PATCH',url:string,body?:Record<string,unknown>){
 const response=await fetch(url,{method,cache:'no-store',headers:{'Content-Type':'application/json'},
  credentials:'same-origin',...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();
 if(!response.ok||!result.success){
  const missing=(result.missing||[]) as string[];
  throw Error((result.message||'Transaksi gagal')+(missing.length?'\nParameter belum lengkap: '+missing.join(', '):''));
 }
 return result;
}
export default function SalesPipelinePage(){
 const [accounts,setAccounts]=useState<SalesAccount[]>([]);
 const [deals,setDeals]=useState<SalesDeal[]>([]);
 const [role,setRole]=useState('');
 const [tab,setTab]=useState<'pipeline'|'account'|'newdeal'|'details'>('pipeline');
 const [selectedId,setSelectedId]=useState('');
 const [detail,setDetail]=useState<Detail|null>(null);
 const [accountName,setAccountName]=useState('');
 const [accountFields,setAccountFields]=useState<SalesFields>({});
 const [customerId,setCustomerId]=useState('');
 const [dealTitle,setDealTitle]=useState('');
 const [amount,setAmount]=useState('');
 const [dealFields,setDealFields]=useState<SalesFields>({});
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [filter,setFilter]=useState('all');
 const [activitySubject,setActivitySubject]=useState('');
 const [activityDetail,setActivityDetail]=useState('');
 const [activityKind,setActivityKind]=useState('meeting');
 const [docKind,setDocKind]=useState('customer_registration');
 const [docRef,setDocRef]=useState('');
 const refresh=useCallback(async()=>{
  try{
   const [a,d]=await Promise.all([request('GET','/api/sales?entity=accounts'),request('GET','/api/sales?entity=deals')]);
   setAccounts(a.accounts||[]);setDeals(d.deals||[]);setRole(d.role||'');
  }catch(e){setMessage(String(e instanceof Error?e.message:e));}
 },[]);
 const loadDetail=useCallback(async(id:string)=>{
  if(!id)return;
  try{
   const v=await request('GET','/api/sales?entity=details&id='+encodeURIComponent(id));
   setDetail(v as Detail);setDealTitle(v.deal.title);setAmount(String(v.deal.estimated_value));
   setDealFields(v.deal.fields);setAccountName(v.account.legal_name);setAccountFields(v.account.fields);
   setSelectedId(id);setTab('details');
  }catch(e){setMessage(String(e));}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  const id=new URLSearchParams(window.location.search).get('opportunity_id');
  if(id)void loadDetail(id);
 },[loadDetail]);
 const run=async(job:()=>Promise<unknown>,done:string,selected?:string)=>{
  setBusy(true);setMessage('');
  try{const v=await job() as {id?:string};setMessage(done);await refresh();if(selected||v?.id)await loadDetail(selected||v?.id||'');}
  catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 };
 const newAccount=()=>{setAccountName('');setAccountFields({});setTab('account');};
 const newDeal=()=>{setCustomerId(accounts[0]?.id||'');setDealTitle('');setAmount('');setDealFields({});setTab('newdeal');};
 const saveAccount=()=>void run(()=>request('POST','/api/sales',{entity:'account',legal_name:accountName,fields:accountFields}),'Customer Account tersimpan di D1.');
 const saveDeal=()=>void run(()=>request('POST','/api/sales',{entity:'deal',company_id:customerId,title:dealTitle,estimated_value:Number(amount),fields:dealFields}),'Opportunity terdaftar pada pipeline.');
 const updateAccount=()=>detail&&void run(()=>request('PATCH','/api/sales',{entity:'account',id:detail.account.id,legal_name:accountName,fields:accountFields}),'Registrasi pelanggan diperbarui.',selectedId);
 const updateDeal=()=>{if(!detail)return;
  // Presales submits only modified technical fields; never quote/PO/commercial fields.
  const changes=Object.fromEntries(Object.entries(dealFields).filter(([k,v])=>v!==(detail.deal.fields[k]||'')));
  if(role==='presales'&&!Object.keys(changes).some(k=>PRESALES_FIELDS.has(k))){setMessage('Tidak ada perubahan teknis yang perlu disimpan.');return;}
  const payload=role==='presales'?{entity:'deal',id:selectedId,fields:Object.fromEntries(Object.entries(changes).filter(([k])=>PRESALES_FIELDS.has(k)))}:
    {entity:'deal',id:selectedId,title:dealTitle,estimated_value:Number(amount),fields:dealFields};
  void run(()=>request('PATCH','/api/sales',payload),'Detail opportunity diperbarui. Verifikasi PO lama dibatalkan jika ada.',selectedId);
 };
 const transition=(stage:SalesStage)=>void run(()=>request('PATCH','/api/sales',{entity:'transition',id:selectedId,stage}),'Tahap berubah menjadi '+stageLabel(stage),selectedId);
 const verify=()=>{if(!window.confirm('Konfirmasi Finance/Approver: Anda sudah memeriksa dokumen PO asli, nomor/tanggal, scope, nilai sebelum PPN, dan kesesuaian quotation final?'))return;
  void run(()=>request('POST','/api/sales',{entity:'verify_po',id:selectedId,confirmed_documents:true}),'Pemeriksaan PO terhadap BoQ approved dicatat beserta identitas pemeriksa.',selectedId);
 };
 const logActivity=()=>void run(()=>request('POST','/api/sales',{entity:'activity',opportunity_id:selectedId,kind:activityKind,subject:activitySubject,detail:activityDetail}),'Aktivitas Sales tercatat.',selectedId);
 const registerDoc=()=>void run(()=>request('POST','/api/sales',{entity:'document',opportunity_id:selectedId,document_kind:docKind,reference:docRef}),'Metadata dokumen dan checklist tersimpan.',selectedId);
 const pipeline=deals.filter(d=>d.stage!=='closed_won'&&d.stage!=='closed_lost');
 const value=pipeline.reduce((a,d)=>a+d.estimated_value,0),weighted=pipeline.reduce((a,d)=>a+d.estimated_value*stageProbability(d.stage)/100,0);
 const ordered=stages.filter(s=>!['closed_won','closed_lost'].includes(s));
 const idx=detail?ordered.indexOf(detail.deal.stage):-1;
 const isMaker=['sales','admin'].includes(role);
 // Admin can always move stage, Sales ownership is enforced by API and client-created list.
 const owner=detail&&detail.deal.created_by?.toLowerCase()===detail.identityEmail.toLowerCase();
 const mayMove=role==='admin'||(role==='sales'&&!!owner);
 const mayEditAccount=role==='admin'||(role==='sales'&&detail?.account.created_by?.toLowerCase()===detail?.identityEmail.toLowerCase());
 return <div className="min-w-0 space-y-5 pb-24">
 <header className="flex flex-wrap items-center justify-between gap-3">
  <div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">INDIA • DefendIT360</p>
   <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Sales Pipeline & Opportunity 360</h1>
   <p className="mt-1 max-w-3xl text-xs text-slate-500">Registrasi → Qualification → Scoping → BoQ → Approval → Quotation → Negotiation → Won / Lost. Setiap perubahan tersimpan di Cloudflare D1 dan dicatat audit trail.</p></div>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||!isMaker} onClick={newAccount} className="rounded-lg border px-3 py-2 text-xs font-bold">+ Customer</button>
   <button disabled={busy||!isMaker||!accounts.length} onClick={newDeal} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">+ Opportunity</button>
  </div>
 </header>
 {message&&<div role="status" className="whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{message}</div>}
 <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
 {([['Pipeline Aktif',money(value)],['Weighted Forecast',money(weighted)],['Open Deals',String(pipeline.length)],['Closed Won',String(deals.filter(x=>x.stage==='closed_won').length)] ] as const).map(([l,v])=>
  <div key={l} className="rounded-xl border bg-white p-3"><p className="text-[11px] text-slate-500">{l}</p><p className="mt-1 break-all text-lg font-bold tabular-nums">{v}</p></div>)}
 </div>
 <nav className="flex flex-wrap gap-2 border-b pb-3" aria-label="Sales workspace views">
 {([['pipeline','Pipeline'],['account','Registrasi Customer'],['newdeal','Opportunity Baru'],...(detail?[['details','Detail Opportunity']]:[])] as Array<[typeof tab,string]>).map(([k,l])=>
  <button key={k} onClick={()=>setTab(k)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(tab===k?'bg-slate-900 text-white':'border bg-white text-slate-700')}>{l}</button>)}
 </nav>
 {tab==='pipeline'&&<section className="space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="font-bold">Daftar Peluang Penjualan</h2>
   <select aria-label="Filter tahap" className={inputClass+' max-w-48'} value={filter} onChange={e=>setFilter(e.target.value)}>
   <option value="all">Semua Tahap</option>{stages.map(([id,l])=><option key={id} value={id}>{l}</option>)}</select>
  </div>
  {deals.filter(d=>filter==='all'||d.stage===filter).length===0?<p className="rounded-lg border bg-white p-5 text-sm text-slate-500">Belum ada transaksi D1 pada filter ini. Daftarkan Customer lalu buat Opportunity tanpa data dummy.</p>:
  <div className="grid gap-3 sm:grid-cols-2">{deals.filter(d=>filter==='all'||d.stage===filter).map(d=>
   <button key={d.id} type="button" onClick={()=>void loadDetail(d.id)} className="min-w-0 rounded-xl border bg-white p-4 text-left hover:border-blue-300">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">{stageLabel(d.stage)}</span><span className="text-xs font-bold tabular-nums">{money(d.estimated_value)}</span></div>
    <h3 className="mt-2 truncate text-sm font-bold">{d.title}</h3><p className="text-xs text-slate-600">{d.company_name}</p>
    <div className="mt-3 flex justify-between text-[11px] text-slate-500"><span>{d.fields.service_family||'Belum dipilih'}</span><span>Target {d.fields.expected_closing_date||'—'}</span></div>
   </button>)}</div>}
 </section>}
 {tab==='account'&&<section className="space-y-4 rounded-xl border bg-white p-4">
  <h2 className="font-bold">Customer Registration • Master Data</h2>
  <p className="text-xs text-slate-500">Customer ID diterbitkan otomatis. Field kosong harus dilengkapi sebelum tahap Qualified dan sebelum dokumen final.</p>
  <label className="block text-xs font-bold">Nama badan usaha resmi *<input className={inputClass} value={accountName} onChange={e=>setAccountName(e.target.value)}/></label>
  <FormFields fields={ACCOUNT_FIELDS} values={accountFields} onUpdate={(k,v)=>setAccountFields(f=>({...f,[k]:v}))}/>
  <button disabled={busy||!isMaker} onClick={saveAccount} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Simpan Customer Account</button>
 </section>}
 {tab==='newdeal'&&<section className="space-y-4 rounded-xl border bg-white p-4">
  <h2 className="font-bold">Opportunity Registration</h2>
  <label className="block text-xs font-bold">Pelanggan Terdaftar *<select className={inputClass} value={customerId} onChange={e=>setCustomerId(e.target.value)}>
   <option value="">Pilih pelanggan</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.legal_name} · {a.customer_number}</option>)}</select></label>
  <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Nama Proyek *<input className={inputClass} value={dealTitle} onChange={e=>setDealTitle(e.target.value)}/></label>
  <label className="text-xs font-bold">Estimasi Nilai (IDR) *<input type="number" min="1" className={inputClass} value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>
  <DealFieldSections values={dealFields} onUpdate={(k,v)=>setDealFields(f=>({...f,[k]:v}))}/>
  <button disabled={busy||!isMaker} onClick={saveDeal} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">Simpan ke Pipeline</button>
 </section>}
 {tab==='details'&&detail&&<div className="space-y-4">
  <section className="rounded-xl border bg-white p-4">
   <div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">Opportunity Detail • {stageLabel(detail.deal.stage)}</h2><span className="break-all text-[10px] text-slate-500">ID {detail.deal.id}</span></div>
   <p className="mt-2 text-sm text-slate-600">{detail.account.legal_name} · {detail.account.customer_number}</p>
   <div className="mt-3 flex flex-wrap gap-2">
    {mayMove&&detail.deal.stage!=='closed_won'&&detail.deal.stage!=='closed_lost'&&idx>=0&&idx<ordered.length-1&&
    <button disabled={busy} onClick={()=>transition(ordered[idx+1])} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Lanjut: {stageLabel(ordered[idx+1])}</button>}
    {detail.deal.stage==='pending_po'&&
    <>{['admin','finance','approver'].includes(role)&&<button disabled={busy} onClick={verify} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold">Verifikasi PO (Finance/Approver)</button>}{mayMove&&<button disabled={busy||!detail.poCheck} onClick={()=>transition('closed_won')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Closed Won</button>}</>}
    {mayMove&&detail.deal.stage!=='closed_won'&&detail.deal.stage!=='closed_lost'&&<button disabled={busy} onClick={()=>transition('closed_lost')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Closed Lost (isi alasan dahulu)</button>}
    {mayMove&&detail.deal.stage==='closed_lost'&&<button disabled={busy} onClick={()=>transition('prospecting')} className="rounded-lg border px-3 py-2 text-xs font-bold">Reopen → Prospecting</button>}
    <Link href={'/sales/procurement?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-800">Tender / RKS-KAK / Bid Decision →</Link>
    <Link href={'/boq?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Buat / Cek BoQ →</Link>
    <Link href={'/sales/submission?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800">Submission & Evidence →</Link>
    <Link href={'/sales/award?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-800">PO/SPK & Legal Review →</Link>
    {detail.boqs.some(b=>b.status==='approved'&&b.id===dealFields.boq_id)&&<a href={'/api/sales/quotation?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-bold text-indigo-800">Generate Quotation Word (BoQ approved)</a>}
    {detail.deal.stage==='closed_won'&&<Link href={'/post-po?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Isi Form Post-PO →</Link>}
    {detail.deal.stage==='closed_lost'&&<a href={'/api/sales/loss-report?opportunity_id='+encodeURIComponent(selectedId)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Unduh Lost Analysis (.docx)</a>}
   </div>
   {detail.originLead&&<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs">
    <span className="text-slate-600">Lead asal: <b>{detail.originLead.lead_number}</b> · {detail.originLead.source}{detail.originLead.campaign?' · '+detail.originLead.campaign:''}</span>
    <Link href={'/sales/leads?lead_id='+encodeURIComponent(detail.originLead.lead_id)} className="font-bold text-blue-700 hover:underline">Buka Lead Marketing →</Link>
   </div>}
   {detail.poCheck&&<p className="mt-2 text-xs text-emerald-700">PO diverifikasi oleh {detail.poCheck.verified_by} • {detail.poCheck.verified_at}</p>}
  </section>
  <section className="space-y-3 rounded-xl border bg-white p-4">
   <div><h3 className="text-sm font-bold">Journey 360 — Marketing hingga Closed Won</h3>
    <p className="mt-1 text-xs text-slate-500">Indikator bersumber dari D1 dan validasi dokumen. Biru = siap secara data, kuning = perlu review manual, merah = belum memenuhi gate.</p></div>
   <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {(detail.journey||[]).map(step=><details key={step.key} className="min-w-0 rounded-lg border border-slate-200 p-3">
     <summary className="cursor-pointer list-none">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">{step.label}</span>
       <span className={'rounded-full px-2 py-0.5 text-[10px] font-bold '+(step.state==='complete'?'bg-emerald-100 text-emerald-800':step.state==='manual_review'?'bg-amber-100 text-amber-900':step.state==='blocked'?'bg-red-100 text-red-800':'bg-slate-100 text-slate-700')}>
        {step.state==='complete'?'Data lengkap':step.state==='manual_review'?'Review manual':step.state==='blocked'?'Belum siap':'Menunggu'}</span></div>
      <p className="mt-1 text-[11px] text-slate-500">{step.owner}</p>
     </summary>
     <p className="mt-2 text-xs text-slate-600">{step.description}</p>
     {step.missing.length>0&&<ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-rose-800">{step.missing.slice(0,12).map((x,i)=><li key={i}>{x}</li>)}</ul>}
    </details>)}
   </div>
  </section>
  <section className="rounded-xl border bg-white p-4">
   <details><summary className="cursor-pointer text-sm font-bold">Data Customer • klik untuk memperbarui</summary>
    <div className="mt-3 space-y-4"><label className="block text-xs font-semibold">Legal Name<input className={inputClass} disabled={!mayEditAccount} value={accountName} onChange={e=>setAccountName(e.target.value)}/></label>
    <FormFields fields={ACCOUNT_FIELDS} values={accountFields} readOnly={()=>!mayEditAccount} onUpdate={(k,v)=>setAccountFields(f=>({...f,[k]:v}))}/>
    <button disabled={busy||!mayEditAccount} onClick={updateAccount} className="rounded-lg bg-blue-700 px-3 py-2 text-xs text-white">Simpan Customer</button></div>
   </details>
  </section>
  <section className="space-y-4 rounded-xl border bg-white p-4">
   <h3 className="text-sm font-bold">Sales Form • Discovery, Technical, Commercial, Negotiation & PO</h3>
   <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Nama proyek<input className={inputClass} disabled={!mayMove} value={dealTitle} onChange={e=>setDealTitle(e.target.value)}/></label>
   <label className="text-xs font-semibold">Nilai pipeline (IDR)<input type="number" className={inputClass} disabled={!mayMove} value={amount} onChange={e=>setAmount(e.target.value)}/></label></div>
   <DealFieldSections values={dealFields} readOnly={k=>!mayMove&&(role!=='presales'||!PRESALES_FIELDS.has(k))} onUpdate={(k,v)=>setDealFields(f=>({...f,[k]:v}))}/>
   <div className="flex flex-wrap items-center gap-3">
    <button disabled={busy||!['admin','sales','presales'].includes(role)||['closed_won','closed_lost'].includes(detail.deal.stage)} onClick={updateDeal} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">{role==='presales'?'Simpan Parameter Teknis':'Simpan Semua Perubahan'}</button>
    <p className="text-xs text-amber-700">Simpan perubahan sebelum pindah stage. Edit detail membatalkan verifikasi PO sebelumnya.</p>
   </div>
  </section>
  <div className="grid gap-4 lg:grid-cols-2">
   <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="text-sm font-bold">BoQ & Persetujuan Terkait</h3>
    {detail.boqs.length?detail.boqs.map(b=><button disabled={!mayMove} key={b.id} className={'block w-full rounded-lg border p-3 text-left text-xs '+(dealFields.boq_id===b.id?'border-blue-500 bg-blue-50':'')} onClick={()=>setDealFields(f=>({...f,boq_id:b.id,quotation_number:b.quotation_number}))}><b>{b.quotation_number}</b> · {b.status}<span className="mt-1 block text-slate-500">{b.project_name}</span><span className="text-blue-700">Pilih (lalu simpan form)</span></button>):
    <p className="text-xs text-slate-500">Belum ada BoQ D1 terhubung. Buat di menu BoQ dan cantumkan Opportunity ID.</p>}
   </section>
   <section className="space-y-2 rounded-xl border bg-white p-4"><h3 className="text-sm font-bold">Kelengkapan Form Post-PO</h3>
    <p className="text-xs text-slate-600">Registrasi: {detail.checklist.registration.length} gap · Project: {detail.checklist.project.length} gap</p>
    <details><summary className="cursor-pointer text-xs font-semibold text-blue-700">Lihat field Registrasi yang belum siap</summary><p className="mt-2 whitespace-pre-wrap text-xs">{detail.checklist.registration.join('\n')||'Tidak ada gap dari CRM.'}</p></details>
    <details><summary className="cursor-pointer text-xs font-semibold text-blue-700">Lihat field Project yang belum siap</summary><p className="mt-2 whitespace-pre-wrap text-xs">{detail.checklist.project.join('\n')||'Tidak ada gap dari CRM.'}</p></details>
   </section>
  </div>
  <section className="grid gap-4 lg:grid-cols-2">
   <div className="rounded-xl border bg-white p-4"><h3 className="text-sm font-bold">Sales Activities</h3>
    <div className="mt-3 grid gap-2"><select className={inputClass} value={activityKind} onChange={e=>setActivityKind(e.target.value)}>{['call','email','meeting','follow_up','tender','note'].map(x=><option key={x}>{x}</option>)}</select>
    <input className={inputClass} placeholder="Topik kegiatan" value={activitySubject} onChange={e=>setActivitySubject(e.target.value)}/>
    <textarea className={inputClass} placeholder="Notulen, tindak lanjut dan hasil" value={activityDetail} onChange={e=>setActivityDetail(e.target.value)}/>
    <button disabled={busy} onClick={logActivity} className="rounded-lg border px-3 py-2 text-xs font-bold">Catat Aktivitas</button></div>
    <div className="mt-3 space-y-2">{detail.activities.map((x,i)=><p key={i} className="border-t pt-2 text-xs"><b>{x.kind}: {x.subject}</b><span className="block text-slate-500">{x.created_at} · {x.detail}</span></p>)}</div>
   </div>
   <div className="rounded-xl border bg-white p-4"><h3 className="text-sm font-bold">Register Dokumen / Evidence</h3>
    <p className="mt-1 text-xs text-slate-500">Metadata dokumen saja. Nomor referensi bukan bukti bahwa file telah diunggah atau ditandatangani.</p>
    <div className="mt-3 grid gap-2"><select className={inputClass} value={docKind} onChange={e=>setDocKind(e.target.value)}>
     {['boq','quotation','customer_registration','project_form','sales_handover','loss_analysis'].map(x=><option key={x} value={x}>{x}</option>)}</select>
     <input className={inputClass} value={docRef} onChange={e=>setDocRef(e.target.value)} placeholder="Nomor dokumen / repository reference"/>
     <button disabled={busy} onClick={registerDoc} className="rounded-lg border px-3 py-2 text-xs font-bold">Catat Dokumen & Checklist</button></div>
    <h4 className="mt-4 text-xs font-bold">Audit trail</h4>
    <div className="mt-2 max-h-60 space-y-2 overflow-y-auto">{detail.history.map((x,i)=><p key={i} className="border-t pt-2 text-xs"><b>{x.action}</b> {x.to_stage&&'→ '+stageLabel(x.to_stage)}<span className="block text-slate-500">{x.created_at} · {x.actor_email}</span></p>)}</div>
   </div>
  </section>
 </div>}
 <footer className="text-xs leading-relaxed text-slate-500">Tidak ada default data transaksi. Tahap Won memerlukan BoQ approved yang terhubung, nomor PO, nilai sebelum PPN yang sesuai, dan verifikasi Finance/Approver. Berkas PO asli, KTP dan NPWP tetap wajib diverifikasi melalui proses dokumen resmi.</footer>
 </div>;
}
