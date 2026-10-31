'use client';
import {useState} from 'react';
type Desk='organization'|'ledger'|'procurement'|'cyber-operations'|'treasury'|'hr'|'security-integrations';
type Field={name:string;label:string;kind?:'number'|'decision'|'text';placeholder?:string};
type Action={id:string;label:string;fields:Field[]};
const CHOICES:Record<string,string[]>={org_kind:['legal_entity','division','department','team','cost_center'],cyber_kind:['vapt_finding','soc_incident','dfir_incident'],capability:['finance_gl','finance_ap','procurement','cyber_ops','resource','hr','audit'],category:['asset','liability','equity','revenue','expense'],source_type:['manual','ar','ap','expense','reversal'],severity:['critical','high','medium','low','informational'],classification:['restricted','confidential'],policy_role:['admin','marketing','sales','presales','finance','approver','legal','viewer'],employment_type:['permanent','contract','intern','external'],leave_type:['annual','sick','unpaid','special'],level:['foundation','intermediate','advanced','expert'],asset_category:['laptop','mobile','security_token','equipment','license'],security_kind:['siem','edr']};
const f=(name:string,label:string,kind?:Field['kind']):Field=>({name,label,kind});
const configs:Record<Desk,{title:string;description:string;query?:string;groups:string[];actions:Action[]}>={
 organization:{title:'Struktur Organisasi & Approval',description:'Buat hierarki, ajukan grant dan review legal entity secara independen.',groups:['units','staff','grants','projects','opportunities','matrix','changes','policy_changes'],actions:[
 {id:'create_unit',label:'Tambah Unit',fields:[f('code','Kode'),f('label','Nama Unit'),f('kind','Tipe: legal_entity/division/department/team/cost_center'),f('parent_id','Parent ID (kosong untuk legal entity)')]},
 {id:'assign_staff',label:'Ajukan Penempatan Personel',fields:[f('email','Email staff aktif'),f('unit_id','Unit ID'),f('position_title','Jabatan')]},
 {id:'review_staff',label:'Review Penempatan Personel',fields:[f('email','Email staff'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'request_grant',label:'Ajukan Capability',fields:[f('email','Email user aktif'),f('unit_id','Unit ID'),f('capability','Capability: finance_gl/finance_ap/procurement/cyber_ops/resource/hr/audit')]},
 {id:'review_grant',label:'Review Capability',fields:[f('id','Grant ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan approval')]},
 {id:'request_revoke',label:'Ajukan Cabut Akses',fields:[f('grant_id','Grant ID'),f('reason','Alasan pencabutan')]},
 {id:'review_revoke',label:'Review Cabut Akses',fields:[f('id','Request ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'request_policy_change',label:'Usulkan Matriks Role',fields:[f('policy_role','Role'),f('capability','Capability'),f('allowed','Allow atau Deny','decision'),f('reason','Alasan perubahan')]},
 {id:'review_policy_change',label:'Review Matriks Role',fields:[f('id','Request ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'request_project_scope',label:'Ajukan Scope Project',fields:[f('project_id','Project ID'),f('legal_entity_id','Legal Entity ID')]},
 {id:'review_project_scope',label:'Review Scope Project',fields:[f('project_id','Project ID'),f('version','Versi','number'),f('approve','Keputusan','decision')]},
 {id:'request_opportunity_scope',label:'Ajukan Scope Opportunity',fields:[f('opportunity_id','Opportunity ID'),f('legal_entity_id','Legal Entity ID')]},
 {id:'review_opportunity_scope',label:'Review Scope Opportunity',fields:[f('opportunity_id','Opportunity ID'),f('version','Versi','number'),f('approve','Keputusan','decision')]}
 ]},
 ledger:{title:'General Ledger & Journal',description:'Akun dan jurnal IDR (nominal dalam sen). Posting manual hanya setelah persetujuan independen.',query:'legal_entity_id',groups:['accounts','periods','journals'],actions:[
 {id:'account',label:'Buat Chart of Account',fields:[f('legal_entity_id','Legal Entity ID'),f('code','Kode Akun'),f('name','Nama Akun'),f('category','Kategori: asset/liability/equity/revenue/expense')]},
 {id:'period',label:'Buka Periode',fields:[f('legal_entity_id','Legal Entity ID'),f('period','Periode YYYY-MM')]},
 {id:'journal',label:'Jurnal Dua Baris',fields:[f('legal_entity_id','Legal Entity ID'),f('period_id','Period ID'),f('source_type','Sumber: manual/ar/ap/expense/reversal'),f('source_key','Referensi unik'),f('memo','Uraian'),f('debit_account','Akun debit ID'),f('credit_account','Akun kredit ID'),f('amount_cents','Nominal sen IDR','number')]},
 {id:'review',label:'Review Jurnal',fields:[f('id','Journal ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan review')]},
 {id:'post',label:'Posting Jurnal Approved',fields:[f('id','Journal ID'),f('version','Versi','number')]},
 {id:'reverse',label:'Buat Jurnal Reversal',fields:[f('original_journal_id','Original Posted Journal ID'),f('period_id','Open Period ID'),f('memo','Penjelasan reversal')]},
 {id:'request_close',label:'Ajukan Financial Close',fields:[f('period_id','Period ID'),f('notes','Alasan dan rekonsiliasi')]},
 {id:'review_close',label:'Approve Financial Close',fields:[f('id','Close ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]}
 ]},
 procurement:{title:'Procurement & Accounts Payable',description:'Gunakan vendor offer tervalidasi, Vault asli dan three-way match sebelum persetujuan AP.',query:'opportunity_id',groups:['orders','receipts','invoices'],actions:[
 {id:'budget',label:'Buat Budget Procurement',fields:[f('legal_entity_id','Legal Entity ID'),f('period','Periode YYYY-MM'),f('code','Kode Budget'),f('limit_cents','Limit sen IDR','number')]},
 {id:'approve_budget',label:'Approve Budget',fields:[f('id','Budget ID')]},
 {id:'requisition',label:'Ajukan Purchase Requisition',fields:[f('opportunity_id','Opportunity ID'),f('budget_id','Budget ID'),f('request_number','Nomor Requisition'),f('title','Kebutuhan'),f('qty','Jumlah','number'),f('ceiling_cents','Batas Anggaran','number')]},
 {id:'approve_requisition',label:'Approve Requisition',fields:[f('id','Requisition ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'create_po',label:'Buat PO',fields:[f('offer_id','Validated Vendor Offer ID'),f('po_number','Nomor PO'),f('qty','Kuantitas','number'),f('requisition_id','Approved Requisition ID (opsional)')]},
 {id:'review_po',label:'Approve/Reject PO',fields:[f('po_id','PO ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'receipt',label:'Terima Barang/Jasa',fields:[f('po_id','PO ID'),f('qty','Qty diterima','number'),f('document_id','ID Dokumen Original Vault')]},
 {id:'supplier_invoice',label:'Input Supplier Invoice',fields:[f('po_id','PO ID'),f('supplier_invoice_number','Nomor Invoice Supplier'),f('qty','Qty ditagih','number'),f('due_date','Jatuh tempo YYYY-MM-DD'),f('document_id','ID Dokumen Original Vault')]},
 {id:'review_invoice',label:'Approve/Reject AP',fields:[f('id','Supplier Invoice ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]}
 ]},

 treasury:{title:'Treasury & Bank Reconciliation',description:'Payment instruction tidak otomatis mentransfer dana. Reconciliation memerlukan bank evidence dan role berbeda.',query:'legal_entity_id',groups:['accounts','payments'],actions:[
 {id:'register_bank',label:'Daftar Bank Account',fields:[f('legal_entity_id','Legal Entity ID'),f('gl_account_id','GL Bank Account ID'),f('bank_name','Bank'),f('masked_number','Mask rekening (mis. ****1234)')]},
 {id:'request_payment',label:'Ajukan Pembayaran AP',fields:[f('invoice_id','Approved Supplier Invoice ID'),f('bank_account_id','Bank Account ID'),f('amount_cents','Nominal sen IDR','number')]},
 {id:'approve_payment',label:'Review Instruksi Pembayaran',fields:[f('id','Payment ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'record_bank_evidence',label:'Catat Bukti Bank',fields:[f('id','Payment ID'),f('version','Versi','number'),f('bank_reference','Referensi Bank'),f('document_id','Original Vault Document ID')]},
 {id:'confirm_settlement',label:'Konfirmasi Settlement',fields:[f('id','Payment ID'),f('version','Versi','number')]}
 ]},
 hr:{title:'HR & Workforce',description:'Kelola status karyawan, cuti, kompetensi dan aset. Data gaji/identitas nasional tidak disimpan tanpa desain enkripsi yang disahkan.',query:'legal_entity_id',groups:['people','policies','leave','skills','assets'],actions:[
 {id:'onboard',label:'Onboarding',fields:[f('email','Email member aktif'),f('employment_type','Jenis hubungan kerja'),f('start_date','Tanggal YYYY-MM-DD')]},
 {id:'activate',label:'Aktivasi Karyawan',fields:[f('email','Email karyawan'),f('version','Versi','number'),f('reason','Alasan')]},
 {id:'offboard',label:'Offboarding',fields:[f('email','Email karyawan'),f('version','Versi','number'),f('end_date','Tanggal akhir YYYY-MM-DD'),f('reason','Alasan')]},
 {id:'leave_policy',label:'Kebijakan Cuti',fields:[f('legal_entity_id','Legal Entity ID'),f('leave_type','Jenis cuti'),f('calendar_year','Tahun','number'),f('days_entitlement','Hari hak cuti','number')]},
 {id:'approve_policy',label:'Approve Policy Cuti',fields:[f('id','Policy ID')]},
 {id:'leave_request',label:'Ajukan Cuti Pribadi',fields:[f('policy_id','Policy ID'),f('from_date','Awal YYYY-MM-DD'),f('to_date','Akhir YYYY-MM-DD'),f('notes','Catatan')]},
 {id:'review_leave',label:'Approve Cuti',fields:[f('id','Leave ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan')]},
 {id:'skill',label:'Catat Kompetensi',fields:[f('email','Email'),f('skill','Nama kompetensi'),f('level','Level'),f('expires_at','Berlaku sampai YYYY-MM-DD')]},
 {id:'asset_register',label:'Registrasi Aset',fields:[f('legal_entity_id','Legal Entity ID'),f('tag','Tag'),f('category','Kategori aset'),f('model','Model')]},
 {id:'asset_assign',label:'Serah Terima Aset',fields:[f('id','Asset ID'),f('email','Email penerima')]},
 {id:'asset_return',label:'Kembalikan Aset',fields:[f('id','Asset ID')]},
 {id:'asset_retire',label:'Pensiunkan Aset',fields:[f('id','Asset ID')]}
 ]},
 'security-integrations':{title:'SIEM / EDR Connectors',description:'Outbound HTTPS allowlist, Secrets Cloudflare, audit retry dan Idempotency-Key. Perlu endpoint/token nyata sebelum koneksi aktif.',query:'legal_entity_id',groups:['connectors','dispatches'],actions:[
 {id:'register',label:'Registrasi SIEM/EDR',fields:[f('legal_entity_id','Legal Entity ID'),f('name','Nama Integrasi'),f('kind','Jenis siem / edr'),f('endpoint','HTTPS Endpoint allowlisted')]},
 {id:'enable',label:'Approve Connector',fields:[f('id','Connector ID'),f('version','Versi','number'),f('notes','Alasan')]},
 {id:'queue',label:'Antrekan Cyber Case',fields:[f('connector_id','Connector ID'),f('case_id','Approved Cyber Case ID')]},
 {id:'send',label:'Kirim Outbound',fields:[f('id','Dispatch ID')]}
 ]},
 'cyber-operations':{title:'Cybersecurity Operations',description:'Metadata VAPT, SOC dan DFIR. Evidence asli wajib; bukan pengganti engine SIEM/EDR.',query:'project_id',groups:['cases'],actions:[
 {id:'open',label:'Buka Case',fields:[f('project_id','Project ID'),f('external_ref','Referensi case unik'),f('kind','Jenis: vapt_finding/soc_incident/dfir_incident'),f('title','Judul'),f('severity','Severity: critical/high/medium/low/informational'),f('classification','Klasifikasi: restricted/confidential')]},
 {id:'review',label:'Review Evidence/QA',fields:[f('id','Case ID'),f('version','Versi','number'),f('approve','Keputusan','decision'),f('notes','Alasan dan temuan QA'),f('document_id','Original Vault Supporting Document ID')]},
 {id:'close',label:'Tutup Case Reviewed',fields:[f('id','Case ID'),f('version','Versi','number')]}
 ]}
};
export default function ERPDesk({desk}:{desk:Desk}){
 const cfg=configs[desk],api='/api/erp/'+(desk==='ledger'?'ledger':desk);
 const [key,setKey]=useState(''),[action,setAction]=useState(cfg.actions[0].id),[form,setForm]=useState<Record<string,string>>({}),[data,setData]=useState<Record<string,unknown>|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const current=cfg.actions.find(a=>a.id===action)!;
 const optionsFor=(name:string)=>CHOICES[name==='kind'?(desk==='organization'?'org_kind':desk==='security-integrations'?'security_kind':'cyber_kind'):name==='category'&&desk==='hr'?'asset_category':name]||[];
 async function load(){
  setBusy(true);try{
   const url=api+(cfg.query?'?'+cfg.query+'='+encodeURIComponent(key):'');
   const r=await fetch(url,{cache:'no-store'});const json=await r.json() as Record<string,unknown>;
   if(!r.ok)throw Error(String(json.message||'Gagal memuat data'));
   setData(json);setMessage('Data telah dibaca ulang dari database.');
  }catch(e){setMessage(String(e));}finally{setBusy(false);}
 }
 async function submit(){
  setBusy(true);setMessage('');
  try{
   const payload:Record<string,unknown>={action};
   for(const field of current.fields){const value=(form[field.name]||'').trim();if(!value)continue;payload[field.name]=field.kind==='number'?Number(value):field.kind==='decision'?value==='true':value;}
   if(['create_unit','request_grant','request_revoke','request_policy_change'].includes(action))payload.id=crypto.randomUUID();
   if(action==='create_unit'&&!payload.parent_id)payload.parent_id=null;
   if(action==='journal'){
    const amount=Number(payload.amount_cents);
    payload.lines=[{account_id:payload.debit_account,debit_cents:amount,credit_cents:0},{account_id:payload.credit_account,debit_cents:0,credit_cents:amount}];
    delete payload.amount_cents;delete payload.debit_account;delete payload.credit_account;
   }
   const r=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const json=await r.json() as Record<string,unknown>;if(!r.ok)throw Error(String(json.message||'Transaksi ditolak'));
   setMessage('Transaksi tersimpan. Referensi: '+String(json.id||'perubahan status berhasil')+'. Muat ulang untuk verifikasi.');
   setForm({});
  }catch(e){setMessage(String(e));}finally{setBusy(false);}
 }
 return <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
  <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">Technotama · INDIA ERP</p><h1 className="text-2xl font-bold text-slate-900">{cfg.title}</h1><p className="text-sm text-slate-600">{cfg.description}</p></header>
  <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Data operasional</h2><div className="mt-3 flex flex-wrap gap-2">{cfg.query&&<input aria-label={cfg.query} className="min-w-52 flex-1 rounded-lg border p-3" placeholder={cfg.query+' dari transaksi canonical'} value={key} onChange={e=>setKey(e.target.value)}/>}<button disabled={busy||!!cfg.query&&!key} onClick={()=>void load()} className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Muat Ulang Database</button></div>
  {data&&cfg.groups.map(group=>{const rows=Array.isArray(data[group])?data[group] as Record<string,unknown>[]:[];const cols=rows[0]?Object.keys(rows[0]).slice(0,6):[];return <div key={group} className="mt-5"><h3 className="mb-2 text-sm font-bold capitalize">{group} ({rows.length})</h3><div className="overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-xs"><thead className="bg-slate-100"><tr>{cols.map(c=><th className="p-2" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-t">{cols.map(c=><td className="max-w-52 truncate p-2" title={String(r[c]??'')} key={c}>{String(r[c]??'')}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="p-3 text-sm text-slate-500">Belum ada record.</p>}</div></div>})}
  </section>
  <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-3 font-semibold">Transaksi dan approval</h2><label htmlFor="erp-action" className="block text-sm text-slate-600">Aksi</label><select id="erp-action" className="mt-1 w-full rounded-lg border p-3" value={action} onChange={e=>{setAction(e.target.value);setForm({});setMessage('');}}>{cfg.actions.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">{current.fields.map(field=><label className="text-sm" key={field.name}><span className="mb-1 block text-slate-700">{field.label}</span>{field.kind==='decision'?<select className="w-full rounded-lg border p-3" value={form[field.name]||''} onChange={e=>setForm({...form,[field.name]:e.target.value})}><option value="">Pilih</option><option value="true">Setujui</option><option value="false">Tolak</option></select>:optionsFor(field.name).length?<select className="w-full rounded-lg border p-3" value={form[field.name]||''} onChange={e=>setForm({...form,[field.name]:e.target.value})}><option value="">Pilih {field.label}</option>{optionsFor(field.name).map(v=><option key={v} value={v}>{v}</option>)}</select>:<input className="w-full rounded-lg border p-3" type={field.kind==='number'?'number':'text'} value={form[field.name]||''} onChange={e=>setForm({...form,[field.name]:e.target.value})} placeholder={field.placeholder||field.name}/>}</label>)}</div><button disabled={busy} onClick={()=>void submit()} className="mt-4 rounded-lg bg-cyan-800 px-5 py-3 font-bold text-white disabled:opacity-40">{busy?'Memproses...':'Simpan / Ajukan Keputusan'}</button><p role="status" className="mt-3 text-sm text-slate-700">{message}</p></section>
 </main>;
}
