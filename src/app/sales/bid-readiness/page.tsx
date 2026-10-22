'use client';
import React from 'react';
import Link from 'next/link';
import {CommercialHeader,EntryForm,evidenceFields,useOpportunityWorkspace,type FormField} from '@/components/sales/CommercialUI';
import type {Bid,Requirement,Clause,Checklist,Deadline,Report} from '@/lib/bid-readiness';
type Data={role:string;identityEmail:string;deal:{id:string;title:string;stage:string;flow_version:number};
 bid:Bid;requirements:Requirement[];clauses:Clause[];checklist:Checklist[];deadlines:Deadline[];report:Report};
const categories=[{value:'administrative',label:'Administratif'},{value:'technical',label:'Teknis'},{value:'commercial',label:'Komersial'}];
const milestones=[
 {value:'clarification',label:'Klarifikasi'}, {value:'aanwijzing',label:'Aanwijzing'},
 {value:'administrative',label:'Pengumpulan dokumen administrasi'}, {value:'technical',label:'Finalisasi proposal teknis'},
 {value:'commercial',label:'Finalisasi penawaran komersial'}, {value:'submission',label:'Batas akhir submission'}
];
const updateFields=(c:Checklist,clauses:Clause[]):FormField[]=>[
 {key:'item_code',label:'Kode dokumen',value:c.item_code},
 {key:'category',label:'Kategori dokumen',type:'select',value:c.category,options:categories},
 {key:'label',label:'Persyaratan RKS/KAK',value:c.label},
 {key:'mandatory',label:'Mandatory',type:'checkbox',value:c.mandatory?'true':'false'},
 {key:'document_name',label:'Nama file asli',optional:true,value:c.document_name},
 ...evidenceFields.map(f=>({...f,optional:true,value:f.key==='evidence_reference'?c.evidence_reference:c.evidence_sha256})),
 {key:'source_clause_id',label:'Klausul RKS/KAK terkait',type:'select',optional:true,value:c.source_clause_id||'',options:clauses.map(x=>({value:x.id,label:x.clause_reference+' · '+x.category+' · '+x.requirement_text.slice(0,80)}))},
 {key:'due_at',label:'Batas dokumen ISO + zona waktu',optional:true,value:c.due_at||''}
];
const notes:FormField[]=[
 {key:'approve',label:'Keputusan review',type:'select',options:[{value:'yes',label:'Setujui / Ready'},{value:'no',label:'Tolak'}]},
 {key:'review_notes',label:'Catatan pemeriksaan bukti (min. 12 karakter)',type:'textarea'}
];
export default function BidReadinessPage(){
 const w=useOpportunityWorkspace<Data>('/api/sales/bid-readiness'),d=w.data;
 const edit=!d||w.busy||!['prospecting','qualified','discovery','solution_design'].includes(d.deal.stage);
 const canWrite=!!d&&['admin','sales','presales'].includes(d.role);
 const url=(output:string)=>'/api/sales/bid-readiness?opportunity_id='+encodeURIComponent(w.id)+'&output='+output;
 const reviewer=(action:string,id:string,version:number,p:Record<string,unknown>)=>w.mutate({action,id,version,approve:p.approve==='yes',review_notes:p.review_notes});
 return <main className="mx-auto max-w-7xl space-y-5 pb-24">
  <CommercialHeader title="Tender Compliance & Bid Readiness" description="Periksa kewajiban klausul RKS/KAK, bukti dokumen, milestone tender dan persetujuan independen. Status Ready dihitung oleh server D1, bukan simulasi." workspace={w}/>
  {d&&<>
   <section className="rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bid Readiness Report</p>
      <p className={'mt-1 text-2xl font-extrabold '+(d.report.ready?'text-emerald-700':'text-rose-700')}>{d.report.ready?'READY · Lulus gerbang':'NOT READY · Belum boleh diserahkan'}</p>
      <p className="mt-1 text-xs text-slate-600">Skor kemajuan indikatif: {d.report.score}% · GO: {d.bid?.bid_decision||'belum tercatat'}</p></div>
     <div className="flex flex-wrap gap-2">{[['matrix','Compliance Matrix'],['checklist','Tender Checklist'],['report','Bid Readiness Report']].map(([type,label])=>
      <a key={type} href={url(type)} download className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">{label} · CSV</a>)}</div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-4">{[
     ['Klausul compliant',d.report.clause_compliant+'/'+d.report.clause_total],
     ['RKS/KAK compliant',d.report.matrix_compliant+'/'+d.report.matrix_total],
     ['Dokumen wajib ready',d.report.mandatory_ready+'/'+d.report.mandatory_total],
     ['Deadline submission',d.report.deadline_status]
    ].map(([a,b])=><div key={a} className="rounded-xl border bg-slate-50 p-3"><p className="text-xs text-slate-500">{a}</p><p className="mt-1 font-bold text-slate-900">{b}</p></div>)}</div>
    {d.report.deadline_at&&<p className="mt-3 text-xs">Submission: <strong>{d.report.deadline_at}</strong>{d.report.hours_remaining!==null?' · '+d.report.hours_remaining+' jam tersisa':''}</p>}
    {d.report.gaps.length>0&&<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
     <h2 className="text-sm font-bold text-amber-900">Open gaps ({d.report.gaps.length})</h2>
     <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950">{d.report.gaps.map((g,i)=><li key={i}>{g}</li>)}</ul>
    </div>}
    <p className="mt-3 text-xs text-slate-500">READY hanya berlaku jika evidence mandatory cocok dengan file asli terenkripsi Document Vault dan reviewer independen menyetujuinya.</p>
    <Link className="mt-3 inline-flex rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800" href={'/sales/documents?opportunity_id='+encodeURIComponent(w.id)}>Buka Document Vault untuk unggah RKS/KAK dan bukti tender asli</Link>
   </section>
   {edit&&!w.busy&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold">Perubahan paket dibatasi sampai Solution Design. Revisi resmi setelah tahap tersebut harus mengikuti workflow pengembalian stage yang diaudit.</p>}
   <div className="grid items-start gap-4 xl:grid-cols-2">
    <EntryForm key={w.id+'deadline'} title="Tambahkan milestone / deadline tender" disabled={edit||!canWrite} submit="Simpan draft deadline"
     fields={[{key:'milestone',label:'Jenis milestone',type:'select',options:milestones},
      {key:'due_at',label:'Tenggat ISO 8601 dengan zona waktu (contoh: 2026-11-30T15:00:00+07:00)'},
      {key:'notes',label:'Sumber jadwal / addendum / konfirmasi',type:'textarea'}]}
     onSubmit={p=>w.mutate({action:'deadline',...p})}/>
    <EntryForm key={w.id+'item'} title="Tambah dokumen checklist penawaran" disabled={edit||!canWrite} submit="Simpan draft checklist"
     fields={[{key:'item_code',label:'Kode unik (mis. ADM-01)'},{key:'category',label:'Kategori',type:'select',options:categories},
      {key:'label',label:'Nama persyaratan dokumen RKS/KAK'},
      {key:'mandatory',label:'Wajib / mandatory',type:'checkbox',value:'true'},
      {key:'document_name',label:'Nama dokumen / file',optional:true},...evidenceFields.map(x=>({...x,optional:true})),
      {key:'source_clause_id',label:'Klausul Compliance Matrix (opsional)',type:'select',optional:true,options:d.clauses.map(x=>({value:x.id,label:x.clause_reference+' · '+x.category+' · '+x.requirement_text.slice(0,80)}))},
      {key:'due_at',label:'Deadline khusus dokumen ISO + zona waktu',optional:true}]}
     onSubmit={p=>w.mutate({action:'item',...p})}/>
   </div>
   <section className="space-y-3"><h2 className="font-bold text-slate-900">Deadline Tender ({d.deadlines.length})</h2>
    {!d.deadlines.length&&<p className="rounded-xl border bg-white p-4 text-sm text-slate-500">Belum ada milestone, termasuk deadline submission. Paket belum Ready.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{d.deadlines.map(t=><article key={t.id} className="space-y-3 rounded-2xl border bg-white p-4">
     <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{t.milestone}</h3><span className="text-xs font-bold">{t.status}</span></div>
     <p className="break-all text-sm">{t.due_at}</p><p className="text-xs text-slate-500">{t.notes}</p>
     {t.reviewed_by&&<p className="text-xs text-slate-500">Disahkan: {t.reviewed_by}</p>}
     {canWrite&&<details><summary className="cursor-pointer text-xs font-bold text-blue-800">Revisi deadline (persetujuan akan direset)</summary>
      <EntryForm title="Revisi deadline" disabled={edit} submit="Ajukan revisi" onSubmit={p=>w.mutate({action:'revise_deadline',id:t.id,version:t.version,...p})}
       fields={[{key:'milestone',label:'Milestone',type:'select',value:t.milestone,options:milestones},{key:'due_at',label:'ISO 8601 + zona waktu',value:t.due_at},{key:'notes',label:'Alasan / referensi addendum',type:'textarea',value:t.notes}]}/></details>}
     {t.status==='draft'&&t.created_by.toLowerCase()!==d.identityEmail.toLowerCase()&&['admin','approver'].includes(d.role)&&
      <EntryForm title="Review deadline independen" fields={notes} disabled={edit} submit="Simpan keputusan" onSubmit={p=>reviewer('review_deadline',t.id,t.version,p)}/>}
    </article>)}</div>
   </section>
   <section className="space-y-3"><h2 className="font-bold text-slate-900">Tender Checklist & Pemeriksaan Dokumen ({d.checklist.length})</h2>
    <div className="grid gap-3 lg:grid-cols-2">{d.checklist.map(c=><article key={c.id} className="space-y-3 rounded-2xl border bg-white p-4">
     <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{c.item_code} · {c.label}</h3><span className={'rounded-lg px-2 py-1 text-xs font-bold '+(c.status==='ready'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}>{c.status}</span></div>
     <p className="text-xs text-slate-600">{c.category} · {c.mandatory?'Mandatory':'Optional'} · {c.document_name||'Dokumen belum terlampir'}</p>
     {c.source_clause_id&&<p className="text-xs">Mapping klausul: {c.source_clause_id}</p>}
     <p className="break-all text-xs text-slate-500">Evidence: {c.evidence_reference||'Belum ada'} · SHA-256: {c.evidence_sha256||'Belum ada'}</p>
     {c.checked_by&&<p className="text-xs text-slate-600">Reviewer: {c.checked_by} · {c.review_notes||''}</p>}
     {canWrite&&<details><summary className="cursor-pointer text-xs font-bold text-blue-800">Revisi / lengkapi bukti (reset review)</summary>
      <EntryForm title="Lengkapi dokumen" fields={updateFields(c,d.clauses)} disabled={edit} submit="Simpan revisi" onSubmit={p=>w.mutate({action:'revise_item',id:c.id,version:c.version,...p})}/></details>}
     {c.status==='draft'&&c.created_by.toLowerCase()!==d.identityEmail.toLowerCase()&&(
       d.role==='admin'||(c.category==='technical'?d.role==='presales':['finance','approver'].includes(d.role)))&&
      <EntryForm title="Pemeriksaan dokumen independen" disabled={edit} fields={notes} submit="Simpan pemeriksaan" onSubmit={p=>reviewer('review_item',c.id,c.version,p)}/>}
    </article>)}</div>
   </section>
   <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Compliance Matrix · Requirement-by-Requirement</h2>
    <p className="mt-1 text-xs text-slate-500">Klausul lengkap dengan evidence dan hasil reviewer dikelola di modul Compliance; status berikut langsung dari D1.</p>
    <Link className="mt-3 inline-block text-xs font-bold text-blue-800 underline" href={'/sales/compliance?opportunity_id='+encodeURIComponent(w.id)}>Buka pengelolaan klausul dan vendor</Link>
    <div className="mt-3 overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="bg-slate-100">{['RKS/KAK','Pasal','Kategori','Mandatory','Compliance','Evidence','Gap'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead>
     <tbody>{d.clauses.map(c=><tr key={c.id} className="border-t"><td className="p-3">{d.requirements.find(x=>x.id===c.requirement_id)?.title||c.requirement_id}</td>
      <td className="p-3">{c.clause_reference}</td><td className="p-3">{c.category}</td><td className="p-3">{c.mandatory?'Ya':'Tidak'}</td>
      <td className="p-3">{c.compliance_status} · {c.status}</td><td className="max-w-44 break-all p-3">{c.evidence_reference}</td><td className="p-3">{c.is_gap?'OPEN':'OK'}</td></tr>)}</tbody></table></div>
   </section>
  </>}
 </main>;
}