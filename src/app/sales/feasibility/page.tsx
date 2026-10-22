'use client';
import React from 'react';
import Link from 'next/link';
import {CommercialHeader,EntryForm,useOpportunityWorkspace,type FormField} from '@/components/sales/CommercialUI';
import {serviceLines,costTypes} from '@/lib/solution-feasibility';
type Person={id:string;display_name:string;email:string;skills:string;capacity_pd_month:number;daily_cost_idr?:number;active:number};
type Allocation={id:string;person_id:string;display_name:string;work_role:string;allocation_month:string;person_days:number;total_pd_month:number;capacity_pd_month:number;status:string};
type Cost={id:string;cost_type:string;description:string;sku:string;unit:string;quantity:number;periods:number;unit_price_idr?:number;supplier_offer_id:string|null;vendor_name?:string};
type Plan={id:string;status:string;version:number;created_by:string;reviewed_by:string|null;review_notes:string|null;service_line:string;start_date:string;end_date:string;months:number;
 asset_count:number;pd_per_asset:number;retest_pct:number;coordination_pd:number;base_pd:number;coverage_hours:number;staffing:number;coverage_days:number;required_pd:number;target_margin_pct:number};
type Report={ready:boolean;approval_ready:boolean;sql_gate:boolean;required_pd:number;allocated_pd:number;internal_cost_idr:number|null;external_cost_idr:number|null;
 total_cost_idr:number|null;revenue_idr:number|null;margin_pct:number|null;gaps:string[]};
type Data={role:string;identityEmail:string;deal:{id:string;title:string;stage:string;flow_version:number};plan:Plan|null;people:Person[];allocations:Allocation[];costs:Cost[];
 offers:{id:string;vendor_name:string;scope:string;status:string;unit:string;unit_price_idr?:number;valid_until:string}[];report:Report};
const money=(n:number|null)=>n===null?'Terbatas untuk Finance':new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
function planFields(p:Plan|null):FormField[]{
 const n=(key:keyof Plan,label:string,fallback:number)=>({key,label,type:'number' as const,value:String(p?.[key]??fallback)});
 return [
  {key:'service_line',label:'Service / Solution',type:'select',value:p?.service_line,options:serviceLines.map(value=>({value,label:value}))},
  {key:'start_date',label:'Tanggal mulai delivery',type:'date',value:p?.start_date},
  {key:'end_date',label:'Tanggal akhir delivery',type:'date',value:p?.end_date},
  n('months','Jumlah bulan kalender (1–60)',1),
  n('asset_count','Jumlah aset / aplikasi (VAPT)',0),
  n('pd_per_asset','Person-days per aset (VAPT)',0),
  n('retest_pct','Cadangan retest % (VAPT)',0),
  n('base_pd','Baseline delivery PD (GRC / FortiSIEM)',0),
  n('coverage_hours','Jam coverage/hari SOC (8/12/24)',0),
  n('staffing','Engineer per shift SOC',0),
  n('coverage_days','Hari coverage/bulan SOC',0),
  n('coordination_pd','PM / QA / koordinasi PD',0),
  n('target_margin_pct','Target gross margin %',25)
 ];
}
export default function FeasibilityPage(){
 const w=useOpportunityWorkspace<Data>('/api/sales/feasibility'),d=w.data,p=d?.plan;
 const locked=w.busy||!d||!['prospecting','qualified','discovery','solution_design'].includes(d.deal.stage);
 const canPlan=!!d&&['admin','presales'].includes(d.role);
 const canResource=!!d&&['admin','finance'].includes(d.role);
 const canAllocate=!!d&&['admin','presales'].includes(d.role);
 const canReview=!!d&&['admin','finance','approver'].includes(d.role)&&!!p&&p.created_by.toLowerCase()!==d.identityEmail.toLowerCase();
 const canCost=canResource;
 const report=d?.report;
 const dates=new Set(d?.allocations.filter(x=>x.status==='active').map(x=>x.allocation_month)||[]);
 const selection=d?.people.filter(x=>x.active).map(x=>({value:x.id,label:x.display_name+' · '+x.skills.slice(0,48)+' · '+x.capacity_pd_month+' PD/bln'}))||[];
 return <main className="mx-auto max-w-7xl space-y-5 pb-24">
  <CommercialHeader title="Vendor, Resource & Solution Feasibility" description="Sizing person-days, alokasi engineer lintas Opportunity, struktur biaya lisensi dan jasa supplier, validitas penawaran serta persetujuan independen sebelum delivery commitment." workspace={w}/>
  {d&&<>
   <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Feasibility Assessment</p>
      <h2 className={'mt-1 text-xl font-extrabold '+(report?.ready?'text-emerald-700':'text-amber-800')}>{report?.ready?'APPROVED · FEASIBLE':'BELUM FEASIBLE'}</h2>
      <p className="mt-1 text-xs text-slate-600">Plan: {p?.status||'belum dibuat'} · SQL gate: {report?.sql_gate?'PASS':'BLOCK'} · Reviewer: {p?.reviewed_by||'-'}</p></div>
     <Link className="rounded-xl border border-blue-200 px-4 py-2 text-xs font-bold text-blue-800" href={'/sales/compliance?opportunity_id='+encodeURIComponent(w.id)}>Lihat quotation & validasi vendor</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
     {[['Estimasi kebutuhan',report?.required_pd??0,'PD'],['Alokasi tim',report?.allocated_pd??0,'PD'],['HPP total',money(report?.total_cost_idr??null),''],['Gross margin',report?.margin_pct===null?'Terbatas':String(report?.margin_pct??'-')+'%','']].map(([label,value,unit])=>
      <div key={label} className="rounded-xl border bg-slate-50 p-4"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 text-lg font-bold text-slate-900">{value} {unit}</p></div>)}
    </div>
    {d.role==='finance'||d.role==='admin'||d.role==='approver'?<p className="text-xs text-slate-600">Estimasi pendapatan: {money(report?.revenue_idr??null)} · HPP tim internal: {money(report?.internal_cost_idr??null)} · HPP supplier/lisensi/lainnya: {money(report?.external_cost_idr??null)}. Margin dihitung dari estimasi nilai Opportunity; Finance perlu merekonsiliasi BoQ final.</p>:<p className="text-xs text-slate-500">Detail HPP, tarif engineer, dan margin hanya dapat dilihat Finance, Approver dan Admin.</p>}
    {report?.gaps.length?<div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-900">Gap yang harus ditutup ({report.gaps.length})</p><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950">{report.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul></div>:<p className="text-sm font-semibold text-emerald-700">Tidak ada gap terdeteksi pada kalkulasi saat ini.</p>}
    <p className="text-xs text-slate-500">Formula VAPT: aset × PD/aset × (1 + retest%) + PM/QA. SOC/Managed: jam coverage ÷ 8 × engineer/shift × hari/bulan × bulan + koordinasi. FortiSIEM/GRC: baseline PD + koordinasi. Kapasitas lintas Opportunity diperiksa per engineer per bulan.</p>
   </section>
   {locked&&!w.busy&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">Paket yang sudah mencapai Commercial Review terkunci. Gunakan workflow revisi resmi untuk mengganti scope atau sumber daya.</p>}
   <section className="grid items-start gap-4 xl:grid-cols-2">
    <EntryForm key={'plan'+w.id+(p?.version||0)} title={p?'Revisi Feasibility Plan v'+p.version:'Buat Feasibility Plan'} fields={planFields(p)}
     disabled={locked||!canPlan} submit={p?'Simpan revisi plan (approval direset)':'Hitung PD & simpan plan'}
     onSubmit={x=>w.mutate({action:'plan',version:p?.version,...x})}/>
    <div className="space-y-4">
     <EntryForm key={'res'+w.id} title="Registrasi engineer / specialist" disabled={locked||!canResource} submit="Tambah resource" fields={[
      {key:'display_name',label:'Nama engineer'},{key:'email',label:'Email engineer',type:'email'},
      {key:'skills',label:'Skills dan sertifikasi (VAPT/SOC/FortiSIEM/GRC)',type:'textarea'},
      {key:'capacity_pd_month',label:'Kapasitas efektif PD per bulan',type:'number'},
      {key:'daily_cost_idr',label:'HPP per PD (IDR) · rahasia Finance',type:'number'}]}
      onSubmit={x=>w.mutate({action:'resource',...x})}/>
     <EntryForm key={'alloc'+w.id} title="Alokasi resource per bulan" disabled={locked||!canAllocate||!p} submit="Reservasi person-days" fields={[
      {key:'person_id',label:'Engineer / specialist',type:'select',options:selection},
      {key:'allocation_month',label:'Bulan alokasi (YYYY-MM)'},
      {key:'work_role',label:'Peran proyek (Pentester, SOC Analyst, GRC Consultant)'},
      {key:'person_days',label:'Jumlah person-days',type:'number'}]}
      onSubmit={x=>w.mutate({action:'allocate',...x})}/>
    </div>
   </section>
   <section className="space-y-3"><h2 className="text-base font-bold">Resource Capacity Calendar</h2>
    <p className="text-xs text-slate-500">Bulan teralokasi: {[...dates].sort().join(', ')||'belum ada'}. Kapasitas mencakup alokasi aktif dari Opportunity lain.</p>
    {!d.allocations.length&&<p className="rounded-xl border bg-white p-4 text-sm text-slate-500">Belum ada alokasi engineer.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{d.allocations.map(a=><article key={a.id} className="space-y-2 rounded-2xl border bg-white p-4">
     <div className="flex justify-between gap-3"><p className="text-sm font-bold">{a.display_name}</p><span className="text-xs font-semibold">{a.status}</span></div>
     <p className="text-xs text-slate-600">{a.allocation_month} · {a.work_role} · {a.person_days} PD</p>
     <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={'h-full rounded-full '+(a.total_pd_month>a.capacity_pd_month?'bg-rose-600':'bg-blue-600')} style={{width:Math.min(100,100*a.total_pd_month/a.capacity_pd_month)+'%'}}/></div>
     <p className="text-xs">Terpakai lintas proyek: {a.total_pd_month}/{a.capacity_pd_month} PD</p>
     {a.status==='active'&&canAllocate&&<button disabled={locked} onClick={()=>void w.mutate({action:'cancel_allocation',id:a.id})} className="rounded-lg border px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-40">Batalkan alokasi</button>}
    </article>)}</div>
   </section>
   <section className="grid items-start gap-4 xl:grid-cols-2">
    <EntryForm key={'cost'+w.id} title="Costing lisensi, supplier, platform & operasional" disabled={locked||!canCost||!p} submit="Tambahkan cost line" fields={[
     {key:'cost_type',label:'Kategori biaya',type:'select',options:costTypes.map(value=>({value,label:value}))},
     {key:'description',label:'Deskripsi komponen biaya'},
     {key:'sku',label:'SKU / nama lisensi (wajib untuk lisensi)',optional:true},
     {key:'unit',label:'Unit penagihan sesuai vendor (license, engineer-day, subscription)'},
     {key:'quantity',label:'Kuantitas',type:'number'},
     {key:'periods',label:'Periode biaya / bulan',type:'number',value:'1'},
     {key:'unit_price_idr',label:'HPP per unit per periode (IDR)',type:'number'},
     {key:'supplier_offer_id',label:'Quotation supplier tervalidasi (opsional)',type:'select',optional:true,
      options:d.offers.filter(o=>o.status==='validated').map(o=>({value:o.id,label:o.vendor_name+' · '+o.scope+' · '+o.valid_until}))}
    ]} onSubmit={x=>w.mutate({action:'cost',...x})}/>
    <div className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="font-bold">Cost Breakdown / Supplier Quotation</h2>
     {!d.costs.length&&<p className="text-sm text-slate-500">Belum ada biaya atau lisensi tercatat.</p>}
     {d.costs.map(c=><div key={c.id} className="rounded-xl border p-3"><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{c.description}</p><span className="text-xs text-slate-500">{c.cost_type}</span></div>
      <p className="mt-1 text-xs text-slate-600">{c.sku||'-'} · {c.quantity} {c.unit} × {c.periods} periode</p>
      {canCost&&<p className="text-xs">Unit HPP: {money(c.unit_price_idr??null)}</p>}
      <p className="text-xs">Supplier: {c.vendor_name||c.supplier_offer_id||'Internal / tanpa supplier offer'}</p>
      {canCost&&<button disabled={locked} onClick={()=>void w.mutate({action:'delete_cost',id:c.id})} className="mt-2 rounded-lg border px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-40">Hapus cost (audit)</button>}
     </div>)}
     <p className="text-xs text-slate-500">Penawaran asli, bukti SHA-256, revisi dan expiry dikelola di Tender Compliance & Document Vault. Cost line hanya dapat menautkan penawaran vendor tervalidasi.</p>
    </div>
   </section>
   {p&&p.status==='draft'&&canReview&&<EntryForm key={'review'+w.id+p.version} title="Independent Solution Feasibility Review" disabled={locked} submit="Simpan keputusan review" fields={[
    {key:'decision',label:'Keputusan',type:'select',options:[{value:'approved',label:'Approved'},{value:'rejected',label:'Rejected'}]},
    {key:'review_notes',label:'Hasil pengecekan engineer, supplier expiry, margin, dan delivery',type:'textarea'}
   ]} onSubmit={x=>w.mutate({action:'review',version:p.version,...x})}/>}
  </>}
 </main>;
}
