'use client';
import React,{useCallback,useEffect,useState} from 'react';
import AdminNavigation from './AdminNavigation';
import {commercialAPI,EntryForm,inputStyle,buttonStyle,type FormField} from '@/components/sales/CommercialUI';
type Setting={id:string;kind:string;setting_key:string;title:string;data_json:string;status:string;version:number;created_by:string};
type Data={role:string;identityEmail:string;settings:Setting[];effective:Setting[];catalog:Record<string,unknown>[];numbers:{id:string;number:string;actor_email:string}[]};
type HealthData={database:{ok:boolean;latency_ms:number};checked_at:string;manifest:{path:string}[];release_readiness:{schema:{status:'reconciled'|'incomplete';latest_applied_version:number|null;required_through_version:number;missing_versions:number[];missing_manifest_paths:string[];conflicting_manifest_paths:string[];manifest_without_ledger:string[];evidence_scope:string};production_gate:'HOLD';master_gates:{id:string;label:string;status:string;reason:string}[];required_evidence:string[];note:string}};
const categories=[['organization','Organisasi'],['approval','Approval Matrix'],['access','Access Policy'],['numbering','Numbering'],['template','Templates'],['integration','API Integrations'],['catalog','Service Catalog'],['audit','Audit Logs'],['health','Monitoring & Backup']] as const;
const organizationLevels=[['institution','Institusi'],['directorate','Direktorat'],['division','Divisi'],['unit','Unit kerja'],['branch','Cabang']] as const;
function OrganizationDraftForm({data,disabled,status,onSubmit}:{data:Data;disabled:boolean;status:string;onSubmit:(p:Record<string,unknown>)=>Promise<boolean>}){
 const [level,setLevel]=useState<string>('institution'),[error,setError]=useState('');
 const parents=data.effective.filter(s=>s.kind==='organization');
 const submit=async(e:React.FormEvent<HTMLFormElement>)=>{
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form);
  const setting_key=String(fd.get('setting_key')||'').trim().toLowerCase(),title=String(fd.get('title')||'').trim();
  const parent_key=level==='institution'?'':String(fd.get('parent_key')||'');
  setError('');
  if(!/^[a-z0-9][a-z0-9_-]{0,60}$/.test(setting_key)){setError('Kode pengaturan wajib 1–61 karakter: huruf kecil, angka, _ atau -.');return;}
  if(title.length<3){setError('Nama pengaturan minimal 3 karakter.');return;}
  if(level!=='institution'&&!parent_key){setError('Pilih parent organisasi yang sudah disetujui.');return;}
  const version=Math.max(0,...data.settings.filter(x=>x.kind==='organization'&&x.setting_key===setting_key).map(x=>x.version));
  const saved=await onSubmit({action:'setting',kind:'organization',setting_key,title,level,parent_key,version});
  if(saved){form.reset();setLevel('institution');}else setError('Draft belum tersimpan. Lihat pesan error dan periksa data, lalu coba lagi.');
 };
 return <form className="space-y-4 rounded-2xl border bg-white p-4 sm:p-5" onSubmit={submit}>
  <h2 className="font-bold text-slate-900">Tambah / revisi pengaturan</h2>
  <fieldset disabled={disabled} className="grid gap-4 disabled:opacity-50 sm:grid-cols-2">
   <label className="block min-w-0 text-xs font-semibold text-slate-700">Kode pengaturan
    <input className={inputStyle} name="setting_key" aria-label="Kode pengaturan" required maxLength={61} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Contoh: 1 atau rti" />
    <span className="mt-1 block text-[11px] font-normal text-slate-500">1–61 karakter; huruf kecil, angka, _ atau -.</span>
   </label>
   <label className="block min-w-0 text-xs font-semibold text-slate-700">Nama pengaturan
    <input className={inputStyle} name="title" aria-label="Nama pengaturan" required minLength={3} maxLength={240} placeholder="Contoh: RTI"/>
   </label>
   <label className="block min-w-0 text-xs font-semibold text-slate-700">Tingkat organisasi
    <select name="level" aria-label="Tingkat organisasi" className={inputStyle} value={level} onChange={e=>{setLevel(e.target.value);setError('');}} required>
     {organizationLevels.map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
   </label>
   {level==='institution'
    ?<p className="self-end rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Institusi adalah organisasi tingkat tertinggi, sehingga tidak memerlukan parent.</p>
    :<label className="block min-w-0 text-xs font-semibold text-slate-700">Parent organisasi aktif
      <select className={inputStyle} name="parent_key" aria-label="Parent organisasi aktif" defaultValue="" required>
       <option value="">Pilih parent yang sudah disetujui</option>
       {parents.map(p=><option key={p.id} value={p.setting_key}>{p.title} ({p.setting_key})</option>)}
      </select>
      {parents.length===0&&<span className="mt-1 block text-[11px] font-normal text-amber-700">Belum ada organisasi aktif. Buat institusi dahulu dan minta Admin kedua menyetujuinya.</span>}
     </label>}
  </fieldset>
  {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
  {status&&<p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">{status}</p>}
  <button type="submit" disabled={disabled} className={buttonStyle}>{disabled?'Menyimpan...':'Simpan draft'}</button>
 </form>;
}
export default function SystemSettings({mode='parameters'}:{mode?:'parameters'|'options'}){
 const visibleCategories=categories.filter(([key])=>mode==='options'?['catalog','access','template'].includes(key):!['catalog','access','template'].includes(key));
 const [tab,setTab]=useState(mode==='options'?'catalog':'organization'),[data,setData]=useState<Data|null>(null),[health,setHealth]=useState<HealthData|null>(null),[audit,setAudit]=useState<{items:Record<string,unknown>[];sales:Record<string,unknown>[];next_page:number|null}|null>(null),[page,setPage]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async()=>{if(tab==='health')setHealth(await commercialAPI('/api/admin/system?section=health'));else if(tab==='audit')setAudit(await commercialAPI('/api/admin/system?section=audit&page='+page));else setData(await commercialAPI('/api/admin/system'));},[tab,page]);
 useEffect(()=>{let active=true;setMessage('');const endpoint=tab==='health'?'/api/admin/system?section=health':tab==='audit'?'/api/admin/system?section=audit&page='+page:'/api/admin/system';void commercialAPI(endpoint).then(x=>{if(!active)return;if(tab==='health')setHealth(x);else if(tab==='audit')setAudit(x);else setData(x);}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[tab,page]);
 const mutate=async(p:Record<string,unknown>)=>{setBusy(true);setMessage('');try{const x=await commercialAPI('/api/admin/system',p);const savedMessage=x.number?'Nomor dialokasikan: '+x.number:'Draft dan audit berhasil tersimpan. Admin reviewer yang berbeda harus menyetujui draft agar aktif.';setMessage(savedMessage);try{await load();}catch{setMessage(savedMessage+' Daftar belum dapat dimuat ulang; muat ulang halaman untuk memastikan versi terbaru.');}return true;}catch(e){setMessage(e instanceof Error?e.message:'Transaksi gagal');return false;}finally{setBusy(false);}};
 const fields:FormField[]=[{key:'setting_key',label:'Kode pengaturan'},{key:'title',label:'Nama pengaturan'}];
 if(tab==='approval'){fields[0]={key:'setting_key',label:'Proses approval',type:'select',options:[{value:'boq',label:'BoQ'}]};fields.push({key:'min_margin_pct',label:'Batas minimum margin (%)',type:'number',min:25,max:100},{key:'approver_limit_idr',label:'Batas nilai Approver (IDR), di atasnya Admin',type:'number'});}
 if(tab==='numbering'){fields[0]={key:'setting_key',label:'Jenis dokumen',type:'select',options:['quotation','proposal','purchase'].map(value=>({value,label:value}))};fields.push({key:'prefix',label:'Prefix nomor (huruf besar / angka / tanda -)'});}
 if(tab==='template'){fields[0]={key:'setting_key',label:'Jenis template teks',type:'select',options:['follow_up','partner_notice','internal_memo'].map(value=>({value,label:value}))};fields.push({key:'body',label:'Isi template teks (tanpa HTML)',type:'textarea'});}
 if(tab==='access'){fields[0]={key:'setting_key',label:'Resource',type:'select',options:['partners','reports','sales','marketing','boq','ai'].map(value=>({value,label:value}))};fields.push({key:'denied_roles',label:'Role yang dibatasi, pisahkan koma; kosong = baseline',optional:true});}
 if(tab==='integration')fields.push({key:'endpoint',label:'Endpoint HTTPS (tanpa credential/query)'},{key:'secret_binding',label:'Nama secret binding, tanpa nilai API key'},{key:'purpose',label:'Tujuan integrasi',type:'textarea'});
 return <main className="mx-auto max-w-6xl space-y-5 pb-20"><header className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-blue-700">INDIA · 15</p><h1 className="text-2xl font-bold">{mode==='options'?'Opsi Sistem':'Parameter & Administrasi Sistem'}</h1><p className="mt-2 text-sm text-slate-600">{mode==='options'?'Kelola katalog layanan, template teks, dan kebijakan akses. Khusus Admin.':'Kelola organisasi, approval, penomoran, integrasi, audit, dan kesehatan sistem. Khusus Admin.'}</p><div className="mt-4"><AdminNavigation/></div></header>
 <nav aria-label="Pengaturan sistem" className="flex flex-wrap gap-2">{visibleCategories.map(([key,label])=><button key={key} className={'min-h-11 rounded-xl border px-3 text-xs font-bold '+(tab===key?'bg-blue-800 text-white':'bg-white')} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>{message&&<p role="status" className="rounded-xl border bg-blue-50 p-4 text-sm">{message}</p>}
 {data&&!['catalog','audit','health'].includes(tab)&&<><p className="rounded-xl border bg-white p-4 text-sm text-slate-600">{tab==='access'?'Policy menambah pembatasan pada role yang sudah ada. Hak dasar dan pemisahan tugas tetap berlaku; Admin memelihara akses pemulihan.':tab==='integration'?'Register ini mencatat endpoint dan referensi secret. Aktivasi sinkronisasi memerlukan adapter dan pengujian transport; status terdaftar belum berarti koneksi aktif.':tab==='template'?'Template teks untuk tindak lanjut, pemberitahuan partner dan memo internal. Format resmi Quotation tetap mengikuti template dokumen yang tersedia.':tab==='organization'?'Hierarki organisasi dan unit kerja pengguna tercatat di sini. Pembatasan transaksi Sales mengikuti kepemilikan Opportunity dan Access Policy.':'Draft baru berlaku setelah disetujui oleh Admin lain. Isi kode yang sama untuk membuat versi berikutnya.'}</p>
 {tab==='organization'?<OrganizationDraftForm data={data} disabled={busy} status={message} onSubmit={p=>mutate(p)}/>:<EntryForm key={tab} title="Tambah / revisi pengaturan" fields={fields} submit="Simpan draft" disabled={busy} onSubmit={p=>mutate({...p,action:'setting',kind:tab,version:Math.max(0,...data.settings.filter(x=>x.kind===tab&&x.setting_key===p.setting_key).map(x=>x.version))})}/>}
 {tab==='numbering'&&<EntryForm title="Alokasikan nomor dokumen" fields={[{key:'kind',label:'Jenis dokumen',type:'select',options:['quotation','proposal','purchase'].map(value=>({value,label:value}))}]} submit="Alokasikan nomor" disabled={busy} onSubmit={p=>mutate({...p,action:'reserve_number'})}/>}
 <section className="grid gap-4 lg:grid-cols-2">{data.settings.filter(x=>x.kind===tab).map(s=><article key={s.id} className="min-w-0 space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">{s.title}</h2><p className="text-xs text-blue-800">{s.setting_key} · v{s.version} · {s.status}{data.effective.some(e=>e.id===s.id)?' · Efektif':''}</p><dl className="space-y-2 text-sm">{Object.entries(JSON.parse(s.data_json)).map(([k,v])=><div key={k}><dt className="text-xs text-slate-500">{k.replaceAll('_',' ')}</dt><dd className="break-words whitespace-pre-wrap">{Array.isArray(v)?v.join(', '):String(v??'—')}</dd></div>)}</dl>
 {s.kind==='template'&&data.effective.some(e=>e.id===s.id)&&<button className="rounded border px-3 py-2 text-xs" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.parse(s.data_json).body],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='INDIA_'+s.setting_key+'.txt';a.click();URL.revokeObjectURL(url);}}>Export template TXT</button>}
 {s.status==='draft'&&s.created_by!==data.identityEmail&&<EntryForm title="Review independen" fields={[{key:'action',label:'Keputusan',type:'select',options:[{value:'approve',label:'Setujui'},{value:'reject',label:'Tolak'}]},{key:'notes',label:'Catatan review',type:'textarea'}]} submit="Simpan keputusan" disabled={busy} onSubmit={p=>mutate({...p,id:s.id})}/>}</article>)}</section>
 {tab==='numbering'&&data.numbers.map(n=><p className="rounded-xl border bg-white p-3 text-sm" key={n.id}>{n.number} · {n.actor_email}</p>)}</>}
 {tab==='catalog'&&data&&<><EntryForm title="Tambah / perbarui service catalog" fields={[{key:'sku',label:'SKU / kode layanan'},{key:'category',label:'Kategori'},{key:'description',label:'Deskripsi layanan',type:'textarea'},{key:'unit',label:'Satuan'},{key:'vendor',label:'Vendor / OEM',optional:true},{key:'license_status',label:'Status verifikasi lisensi',type:'select',options:['verification_required','verified','not_applicable'].map(value=>({value,label:value}))},{key:'active',label:'Aktif untuk BoQ',type:'checkbox'}]} submit="Simpan katalog" disabled={busy} onSubmit={p=>mutate({...p,action:'catalog'})}/>{data.catalog.map(x=><article className="rounded-xl border bg-white p-4 text-sm" key={String(x.sku)}><b>{String(x.sku)}</b> · {String(x.description)}<p className="mt-1 text-xs">{String(x.category)} · {String(x.unit)} · {x.active?'Aktif':'Nonaktif'}</p></article>)}</>}
 {tab==='audit'&&audit&&<section className="space-y-3"><a href={'/api/admin/system?section=audit&format=csv&page='+page} className={buttonStyle}>Export Audit CSV · halaman {page+1}</a><p className="pt-3 text-xs text-slate-500">Audit pengaturan/partner/laporan dan transaksi Sales, masing-masing maksimal 100 per halaman.</p>{[...audit.items,...audit.sales].map(x=><article key={String(x.id)} className="break-words rounded-xl border bg-white p-4 text-sm"><b>{String(x.action)}</b> · {String(x.actor_email)}<p className="mt-1 text-xs text-slate-500">{String(x.created_at)} · {String(x.area||'Sales')} · {String(x.entity_id||x.summary||'')}</p></article>)}<div className="flex gap-2"><button disabled={page===0} onClick={()=>setPage(p=>p-1)} className={buttonStyle}>Sebelumnya</button><button disabled={audit.next_page===null} onClick={()=>setPage(p=>p+1)} className={buttonStyle}>Berikutnya</button></div></section>}
 {tab==='health'&&health&&<section aria-label="Release readiness dan kesehatan sistem" className="space-y-4">
  <div className="grid gap-3 sm:grid-cols-3">
   <article className="rounded-xl border bg-white p-5"><h2 className="text-xs font-bold text-slate-500">Database</h2><p className="mt-2 text-sm font-bold">{health.database.ok?'Terhubung':'Gagal'}</p><p className="mt-1 text-xs text-slate-500">Latency {health.database.latency_ms} ms</p></article>
   <article className="rounded-xl border bg-white p-5"><h2 className="text-xs font-bold text-slate-500">Migrasi kanonis sampai 0031</h2><p className="mt-2 text-sm font-bold">{health.release_readiness.schema.status==='reconciled'?'Ledger & manifest sesuai':'Belum lengkap / tidak selaras'}</p><p className="mt-1 text-xs text-slate-500">Terpasang: {health.release_readiness.schema.latest_applied_version??'tidak diketahui'}</p></article>
   <article className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="text-xs font-bold text-amber-800">Backup & Restore</h2><p className="mt-2 text-sm font-bold text-amber-900">Memerlukan bukti Cloudflare</p><p className="mt-1 text-xs font-semibold text-amber-900">Gate produksi: {health.release_readiness.production_gate}</p><p className="mt-1 text-xs text-amber-900">{health.checked_at}</p></article>
  </div>
  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{health.release_readiness.note} Koneksi database bukan bukti backup, UAT pengguna nyata atau kesiapan deploy.</p>
  <section className="space-y-2 rounded-xl border bg-white p-4" aria-label="Kesenjangan migrasi">
   <h2 className="font-bold">Selisih skema yang harus diselesaikan</h2>
   <p className="text-xs text-slate-600">{health.release_readiness.schema.evidence_scope}</p>
   <p className="text-sm">Versi ledger belum diterapkan: <strong>{health.release_readiness.schema.missing_versions.join(', ')||'Tidak ada pada rentang wajib 0013–0030'}</strong></p>
   {[['Manifest belum terdaftar',health.release_readiness.schema.missing_manifest_paths],['Manifest konflik dengan versi kanonis',health.release_readiness.schema.conflicting_manifest_paths],['Manifest tanpa ledger',health.release_readiness.schema.manifest_without_ledger]].map(([label,values])=><div key={label as string} className="text-xs"><strong>{label as string}:</strong> {(values as string[]).length?<ul className="mt-1 list-disc space-y-1 pl-5">{(values as string[]).map(p=><li key={p} className="break-all">{p}</li>)}</ul>:<span> tidak ada</span>}</div>)}
  </section>
  <section className="overflow-x-auto rounded-xl border bg-white p-4" aria-label="Master release gate">
   <h2 className="mb-3 font-bold">Master release gate — environment yang diperiksa</h2>
   <table className="w-full text-left text-xs"><thead><tr><th className="p-2">Gate</th><th className="p-2">Status</th><th className="p-2">Evidence</th></tr></thead>
    <tbody>{health.release_readiness.master_gates.map(g=><tr key={g.id} className="border-t"><td className="p-2 font-semibold">{g.label}</td><td className="p-2 text-amber-900">{g.status}</td><td className="min-w-48 p-2 text-slate-600">{g.reason}</td></tr>)}</tbody></table>
  </section>
  <section className="space-y-2 rounded-xl border bg-white p-4" aria-label="Bukti yang diperlukan sebelum produksi">
   <h2 className="font-bold">Release gate — bukti eksternal yang belum diverifikasi</h2>
   <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">{health.release_readiness.required_evidence.map(g=><li key={g}>{g}</li>)}</ul>
   <p className="text-xs text-slate-500">Tidak tersedia tombol lewati gate atau klaim PASS otomatis.</p>
  </section>
  <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer text-sm font-bold">Lihat manifest database ({health.manifest.length})</summary><ul className="mt-3 space-y-2">{health.manifest.map(x=><li className="break-all rounded border bg-slate-50 p-3 text-xs" key={x.path}>{x.path}</li>)}</ul></details>
  <button className={buttonStyle} onClick={()=>void load()}>Periksa ulang</button>
 </section>}
 </main>;
}
