import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt,jakartaDate,csvText} from '@/lib/operations';
import {effectiveSetting,validateSetting} from '@/lib/system-settings';
import {evaluateSchemaReadiness} from '@/lib/release-readiness';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;if(role!=='admin')return fail('Admin diperlukan',403);
 const u=new URL(req.url),section=u.searchParams.get('section')||'settings';
 try{
  if(section==='health'){
   const start=Date.now();const ping=await db.prepare('SELECT 1 AS ok').first<{ok:number}>();
   const [migrations,manifest,members,guard,events]=await Promise.all([
    db.prepare('SELECT version,applied_at FROM india_schema_migrations ORDER BY version').all<{version:number|string}>(),
    db.prepare('SELECT path,source_branch FROM india_schema_file_manifest ORDER BY path').all<{path:string}>(),
    db.prepare('SELECT role,count(*) AS active_users FROM india_members WHERE active=1 GROUP BY role').all(),
    db.prepare('SELECT count(*) AS pending FROM india_sales_tx_guards').first(),
    db.prepare("SELECT area,action,created_at FROM india_operations_events WHERE tenant_id=? ORDER BY created_at DESC LIMIT 10").bind(TENANT).all()
   ]);
   const schema=evaluateSchemaReadiness(migrations.results,manifest.results);
   return reply({success:true,role,identityEmail:email,checked_at:new Date().toISOString(),
    database:{ok:ping?.ok===1,latency_ms:Date.now()-start},
    migrations:migrations.results,manifest:manifest.results,members:members.results,transaction_guards:guard,latest_events:events.results,
    release_readiness:{schema,production_gate:'HOLD',
     required_evidence:[
      'Backup dan restore mandiri + checksum sumber asli',
      'Rekonsiliasi checksum SQL, objek dan data migrasi',
      'Uji rollback terisolasi tanpa perubahan data lain',
      'Kontinuitas kunci enkripsi dokumen asli dan Vault',
      'Bukti UAT Access asli lintas role + pengujian akses ditolak',
      'Transaksi Won–Delivery–BAST–Invoice–Payment–Renewal',
      'UAT Android nyata, review keamanan/Finance dan persetujuan rilis',
     ],
     note:'Rekonsiliasi ledger/manifest tidak membuktikan uji asli; status HOLD tidak dapat diubah oleh halaman ini.'},
    backup:{status:'external_verification_required',runbook:'docs/INDIA_SPRINT0_ADR_MIGRATION_RELEASE_20261024.md',note:'Snapshot/restore D1 harus dibuktikan melalui Cloudflare. Pemeriksaan koneksi bukan bukti backup atau restore.'}});
  }
  if(section==='audit'){
   const limit=100,page=Math.max(0,Number(u.searchParams.get('page')||0));if(!Number.isSafeInteger(page)||page>10000)return fail('Halaman tidak valid');
   const result=await db.prepare('SELECT * FROM india_operations_events WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(TENANT,limit,page*limit).all();
   const sales=await db.prepare('SELECT id,action,actor_email,summary,created_at FROM india_sales_audit WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?').bind(TENANT,limit,page*limit).all();
   if(u.searchParams.get('format')==='csv')return new Response(csvText(['ID','Area','Entity','Action','Actor','At'],result.results.map((r:Record<string,unknown>)=>[r.id,r.area,r.entity_id,r.action,r.actor_email,r.created_at])),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="INDIA_System_Audit.csv"'}});
   return reply({success:true,role,items:result.results,sales:sales.results,page,next_page:result.results.length===limit||sales.results.length===limit?page+1:null});
  }
  const [settings,effective,catalog,numbers]=await Promise.all([
   db.prepare('SELECT * FROM india_setting_versions WHERE tenant_id=? ORDER BY created_at DESC,version DESC LIMIT 500').bind(TENANT).all(),
   db.prepare('SELECT * FROM india_effective_settings WHERE tenant_id=? ORDER BY kind,setting_key').bind(TENANT).all(),
   db.prepare('SELECT * FROM india_catalog ORDER BY category,sku LIMIT 500').all(),
   db.prepare('SELECT * FROM india_number_reservations WHERE tenant_id=? ORDER BY created_at DESC,sequence DESC LIMIT 100').bind(TENANT).all()
  ]);
  return reply({success:true,role,identityEmail:email,settings:settings.results,effective:effective.results,catalog:catalog.results,numbers:numbers.results,approval_baseline:{maker_checker:true,minimum_margin_pct:25,cost_roles:['admin','finance'],approval_roles:['admin','approver']}});
 }catch{return fail('Administrasi belum siap. Verifikasi migrasi 0026.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;if(role!=='admin')return fail('Admin diperlukan',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,12000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 try{
  if(p.action==='setting'){
   const kind=txt(p.kind,30),key=txt(p.setting_key,61),title=txt(p.title,240);if(title.length<3||!Number.isSafeInteger(p.version)||Number(p.version)<0)return fail('Judul dan versi wajib');
   let data:Record<string,unknown>;try{data=validateSetting(kind,key,p);}catch(e){return fail(e instanceof Error?e.message:'Data pengaturan tidak valid');}
   const old=await db.prepare('SELECT max(version) AS version FROM india_setting_versions WHERE tenant_id=? AND kind=? AND setting_key=?').bind(TENANT,kind,key).first<{version:number|null}>();
   if(Number(old?.version||0)!==p.version)return fail('Versi pengaturan berubah',409);
   const id=crypto.randomUUID(),version=Number(p.version)+1;
   await atomicSales(db,'(SELECT coalesce(max(version),0) FROM india_setting_versions WHERE tenant_id=? AND kind=? AND setting_key=?)=?',[TENANT,kind,key,Number(p.version)],[db.prepare('INSERT INTO india_setting_versions(id,tenant_id,kind,setting_key,title,data_json,version,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,TENANT,kind,key,title,JSON.stringify(data),version,email),operationEvent(db,'setting',id,'DRAFT',email,{kind,key,title,data,version})]);
   return reply({success:true,id,version,status:'draft'},201);
  }
  if(p.action==='approve'||p.action==='reject'){
   if(!safeID(p.id)||txt(p.notes,1000).length<12)return fail('ID dan catatan review wajib');
   const row=await db.prepare('SELECT * FROM india_setting_versions WHERE tenant_id=? AND id=?').bind(TENANT,p.id as string).first<{id:string;kind:string;setting_key:string;status:string;data_json:string;version:number;created_by:string}>();
   if(!row)return fail('Pengaturan tidak ditemukan',404);if(row.created_by.toLowerCase()===email)return fail('Admin pembuat tidak boleh mereview pengaturannya sendiri',403);if(row.status!=='draft')return fail('Pengaturan bukan draft',409);
   let extra='';const args:(string|number|null)[]=[TENANT,row.id,row.version];
   if(p.action==='approve'&&row.kind==='organization'){
    const all=await db.prepare("SELECT setting_key,data_json,version FROM india_effective_settings WHERE tenant_id=? AND kind='organization'").bind(TENANT).all<{setting_key:string;data_json:string;version:number}>();
    const parents=new Map(all.results.map(x=>[x.setting_key,JSON.parse(x.data_json).parent_key as string|null]));
    const data=JSON.parse(row.data_json);if(data.parent_key&&!parents.has(data.parent_key))return fail('Parent organisasi aktif diperlukan',409);parents.set(row.setting_key,data.parent_key);
    for(const start of parents.keys()){const seen=new Set<string>();let cursor:string|null=start;while(cursor){if(seen.has(cursor))return fail('Siklus hierarki organisasi ditolak',409);seen.add(cursor);cursor=parents.get(cursor)||null;}}
    // Serialize organizational activations against the complete approved organization version set.
    extra=" AND (SELECT coalesce(sum(version),0) FROM india_effective_settings WHERE tenant_id=? AND kind='organization')=?";
    args.push(TENANT,all.results.reduce((n,x)=>n+x.version,0));
   }
   await atomicSales(db,"EXISTS(SELECT 1 FROM india_setting_versions WHERE tenant_id=? AND id=? AND version=? AND status='draft')"+extra,args,[db.prepare('UPDATE india_setting_versions SET status=?,reviewed_by=? WHERE tenant_id=? AND id=?').bind(p.action==='approve'?'approved':'rejected',email,TENANT,row.id),operationEvent(db,'setting',row.id,String(p.action).toUpperCase(),email,{notes:txt(p.notes,1000),kind:row.kind,key:row.setting_key,version:row.version})]);return reply({success:true});
  }
  if(p.action==='catalog'){
   if(!/^[A-Za-z0-9_-]{2,80}$/.test(txt(p.sku,80))||!txt(p.category,80)||txt(p.description,900).length<3||!txt(p.unit,60)||!['verification_required','verified','not_applicable'].includes(String(p.license_status))||typeof p.active!=='boolean')return fail('SKU, kategori, deskripsi, unit, status lisensi dan active wajib');
   await atomicSales(db,'1=1',[],[db.prepare('INSERT INTO india_catalog(sku,category,description,unit,vendor,license_status,active) VALUES(?,?,?,?,?,?,?) ON CONFLICT(sku) DO UPDATE SET category=excluded.category,description=excluded.description,unit=excluded.unit,vendor=excluded.vendor,license_status=excluded.license_status,active=excluded.active').bind(txt(p.sku,80),txt(p.category,80),txt(p.description,900),txt(p.unit,60),txt(p.vendor,240)||null,String(p.license_status),p.active?1:0),operationEvent(db,'catalog',String(p.sku),'UPSERT',email,{...p,action:undefined})]);return reply({success:true});
  }
  if(p.action==='reserve_number'){
   const kind=txt(p.kind,30),period=jakartaDate().slice(0,7);if(!['quotation','proposal','purchase'].includes(kind))return fail('Jenis nomor tidak valid');
   const policy=await effectiveSetting(db,'numbering',kind);if(!policy)return fail('Numbering policy yang disetujui belum tersedia',409);
   const last=await db.prepare('SELECT coalesce(max(sequence),0) AS n FROM india_number_reservations WHERE tenant_id=? AND kind=? AND period=?').bind(TENANT,kind,period).first<{n:number}>();
   const seq=Number(last?.n||0)+1,number=String(policy.prefix)+'/'+period.replace('-','')+'/'+String(seq).padStart(5,'0'),id=crypto.randomUUID();
   await atomicSales(db,'(SELECT coalesce(max(sequence),0) FROM india_number_reservations WHERE tenant_id=? AND kind=? AND period=?)=?',[TENANT,kind,period,seq-1],[db.prepare('INSERT INTO india_number_reservations(id,tenant_id,number,kind,period,sequence,actor_email) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,number,kind,period,seq,email),operationEvent(db,'numbering',id,'RESERVE',email,{kind,number,sequence:seq})]);return reply({success:true,number},201);
  }
  return fail('Tindakan administrasi tidak tersedia');
 }catch(e){return fail(/constraint|CONFLICT/.test(String(e))?'Versi berubah atau constraint dilanggar; muat ulang.':'Perubahan tidak tersimpan; periksa migrasi 0026.',/constraint|CONFLICT/.test(String(e))?409:503);}
}
