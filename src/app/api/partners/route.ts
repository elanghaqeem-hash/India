import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt,positive,integer,jakartaDate,csvText} from '@/lib/operations';
import {validISODate} from '@/lib/lead-intelligence';
import {openDocument,type VaultDoc} from '@/lib/document-vault';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const allowed=['admin','finance','presales','legal','approver'];
type RecordRow={id:string;kind:string;vendor_id:string;opportunity_id:string|null;offer_id:string|null;document_id:string|null;title:string;status:string;version:number;created_by:string;data_json:string};
type Offer={id:string;version:number;quantity:number;capacity_confirmed:number;unit:string;unit_price_idr:number;valid_until:string;vendor_version:number;vendor_valid_until:string;capacity_units:number;capacity_unit:string};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 if(!allowed.includes(role))return fail('Workspace partner hanya Admin/Finance/Presales/Legal/Approver',403);
 const u=new URL(req.url),vendor=u.searchParams.get('vendor_id')||'';
 if(vendor&&!safeID(vendor))return fail('Vendor ID tidak valid');
 try{
  const vendors=await db.prepare('SELECT id,legal_name,status,valid_until,capacity_units,capacity_unit FROM india_vendors WHERE tenant_id=? ORDER BY legal_name').bind(TENANT).all();
  const sensitive=['admin','finance'].includes(role);
  const records=await db.prepare("SELECT * FROM india_partner_records WHERE tenant_id=? AND (?='' OR vendor_id=?)"+(sensitive?'':" AND kind NOT IN ('purchase','evaluation')")+' ORDER BY updated_at DESC LIMIT 500').bind(TENANT,vendor,vendor).all<RecordRow>();
  const items=records.results.map(x=>({...x,data:JSON.parse(x.data_json),data_json:undefined}));
  const offers=sensitive?await db.prepare("SELECT o.id,o.opportunity_id,o.vendor_id,o.scope,o.quantity,o.unit,o.unit_price_idr,o.valid_until,o.status FROM india_vendor_offers o WHERE o.tenant_id=? AND (?='' OR o.vendor_id=?) ORDER BY o.created_at DESC LIMIT 500").bind(TENANT,vendor,vendor).all():{results:[]};
  const performance=sensitive?await db.prepare("SELECT vendor_id,count(*) AS evaluations,round(avg(json_extract(data_json,'$.score')),2) AS average_score FROM india_partner_records WHERE tenant_id=? AND kind='evaluation' AND status='approved' GROUP BY vendor_id").bind(TENANT).all():{results:[]};
  if(u.searchParams.get('format')==='csv')return new Response(csvText(['ID','Vendor','Kind','Title','Status','Version'],items.map(x=>[x.id,x.vendor_id,x.kind,x.title,x.status,x.version])),{headers:{...privateHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="INDIA_Partners.csv"'}});
  return reply({success:true,role,identityEmail:email,vendors:vendors.results,items,offers:offers.results,performance:performance.results,limit:500});
 }catch{return fail('Workspace partner belum siap. Periksa migrasi 0026.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,role,email}=a.identity;
 if(!allowed.includes(role))return fail('Akses partner ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,12000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 try{
  const action=txt(p.action,30);
  if(action==='create'){
   const kind=txt(p.kind,30),title=txt(p.title,240);
   if(!safeID(p.vendor_id)||title.length<3||!['profile','agreement','license','purchase','evaluation'].includes(kind))return fail('Vendor, kategori dan judul wajib valid');
   if((kind==='purchase'||kind==='evaluation')&&!['admin','finance'].includes(role))return fail('Pembelian/evaluasi hanya Finance/Admin',403);
   if(kind==='agreement'&&!['admin','legal'].includes(role))return fail('Perjanjian hanya Legal/Admin',403);
   if(kind==='license'&&!['admin','finance','presales'].includes(role))return fail('Lisensi hanya Finance/Presales/Admin',403);
   if(kind==='profile'&&!['admin','finance','presales'].includes(role))return fail('Profil hanya Finance/Presales/Admin',403);
   const vendor=await db.prepare("SELECT id,version FROM india_vendors WHERE tenant_id=? AND id=? AND status='validated' AND valid_until>=?").bind(TENANT,p.vendor_id as string,jakartaDate()).first<{id:string;version:number}>();
   if(!vendor)return fail('Gunakan vendor tervalidasi yang masih berlaku',409);
   let data:Record<string,unknown>={},offer:Offer|null=null,document:VaultDoc|null=null;
   const opportunity=safeID(p.opportunity_id)?p.opportunity_id as string:null;
   if(opportunity&&!await db.prepare('SELECT id FROM india_sales_opportunities WHERE id=? AND tenant_id=?').bind(opportunity,TENANT).first())return fail('Opportunity tidak ditemukan',404);
   if(kind==='profile'){
    if(!['oem','distributor','reseller','referral','alliance','supplier'].includes(txt(p.partner_type,30))||txt(p.products,1500).length<3)return fail('Jenis partner dan lini produk wajib');
    data={partner_type:p.partner_type,products:txt(p.products,1500),territory:txt(p.territory,240)};
   }
   if(kind==='agreement'||kind==='license'){
    if(!opportunity||!safeID(p.document_id)||!validISODate(p.start_date)||!validISODate(p.end_date)||p.start_date>p.end_date)return fail('Opportunity, dokumen asli Vault dan periode wajib valid');
    document=await db.prepare("SELECT *,'' AS release_id FROM india_document_library WHERE tenant_id=? AND id=? AND opportunity_id=? AND kind='supporting' AND (retention_until IS NULL OR retention_until>=? OR legal_hold=1)").bind(TENANT,p.document_id as string,opportunity,jakartaDate()).first<VaultDoc>();
    if(!document)return fail('Unggah supporting original pada Vault Opportunity yang sama',409);
    await openDocument(db,document,'library');
    data={start_date:p.start_date,end_date:p.end_date,document_sha256:document.sha256};
    if(kind==='agreement'){
     if(!txt(p.agreement_number,100)||txt(p.terms,1800).length<12)return fail('Nomor perjanjian dan ketentuan wajib');
     data={...data,agreement_number:txt(p.agreement_number,100),terms:txt(p.terms,1800)};
    }else{
     if(!txt(p.sku,100)||!integer(p.seats,1e9)||!['subscription','perpetual','consumption'].includes(txt(p.license_model,30)))return fail('SKU, kuantitas dan model lisensi wajib');
     data={...data,sku:txt(p.sku,100),seats:p.seats,license_model:p.license_model,renewal_notice_days:90};
    }
   }
   if(kind==='purchase'){
    if(!opportunity||!safeID(p.offer_id)||!positive(p.quantity,1e9)||!validISODate(p.expected_date)||p.expected_date<jakartaDate()||!txt(p.purchase_number,100))return fail('Opportunity, penawaran, jumlah, nomor PO vendor dan jadwal wajib valid');
    offer=await db.prepare("SELECT o.*,v.version AS vendor_version,v.valid_until AS vendor_valid_until,v.capacity_units,v.capacity_unit FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id WHERE o.tenant_id=? AND o.id=? AND o.vendor_id=? AND o.opportunity_id=? AND o.status='validated' AND v.status='validated'").bind(TENANT,p.offer_id as string,vendor.id,opportunity).first<Offer>();
    if(!offer||offer.valid_until<jakartaDate()||offer.vendor_valid_until<jakartaDate()||offer.quantity<Number(p.quantity)||offer.unit!==offer.capacity_unit||offer.capacity_units<offer.capacity_confirmed||!positive(Number(p.quantity)*offer.unit_price_idr))return fail('Penawaran, harga, kapasitas atau masa berlaku tidak memenuhi pembelian',409);
    data={quantity:p.quantity,unit:offer.unit,unit_price_idr:offer.unit_price_idr,amount_idr:Math.round(Number(p.quantity)*offer.unit_price_idr*100)/100,expected_date:p.expected_date,purchase_number:txt(p.purchase_number,100),received_quantity:0,offer_version:offer.version};
   }
   if(kind==='evaluation'){
    if(!integer(p.score,101)||!validISODate(p.evaluation_date)||p.evaluation_date>jakartaDate()||txt(p.notes,1800).length<12||!['quality','delivery','support','commercial','overall'].includes(txt(p.dimension,30)))return fail('Skor 1–100, tanggal, dimensi dan alasan evaluasi wajib');
    data={score:p.score,evaluation_date:p.evaluation_date,dimension:p.dimension,notes:txt(p.notes,1800)};
   }
   const id=crypto.randomUUID();
   let guard="EXISTS(SELECT 1 FROM india_vendors WHERE tenant_id=? AND id=? AND version=? AND status='validated' AND valid_until>=?)";
   const args:(string|number|null)[]=[TENANT,vendor.id,vendor.version,jakartaDate()];
   if(offer){guard+=" AND EXISTS(SELECT 1 FROM india_vendor_offers WHERE id=? AND version=? AND status='validated')";args.push(offer.id,offer.version);}
   await atomicSales(db,guard,args,[db.prepare('INSERT INTO india_partner_records(id,tenant_id,vendor_id,kind,opportunity_id,offer_id,document_id,title,data_json,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,TENANT,vendor.id,kind,opportunity,offer?.id||null,document?.id||null,title,JSON.stringify(data),email),operationEvent(db,'partner',id,'CREATE',email,{kind,title,vendor_id:vendor.id,...data})]);
   return reply({success:true,id},201);
  }
  if(!safeID(p.id)||!Number.isSafeInteger(p.version)||txt(p.notes,1800).length<12)return fail('ID, versi dan alasan minimal 12 karakter wajib');
  const row=await db.prepare('SELECT * FROM india_partner_records WHERE tenant_id=? AND id=?').bind(TENANT,p.id as string).first<RecordRow>();
  if(!row)return fail('Record tidak ditemukan',404);
  if((row.kind==='purchase'||row.kind==='evaluation')&&!['admin','finance'].includes(role))return fail('Akses biaya/evaluasi ditolak',403);
  if(row.version!==p.version)return fail('Data berubah; muat ulang',409);
  const data=JSON.parse(row.data_json) as Record<string,unknown>;
  let status='',reviewer:string|null=null;
  if(action==='approve'||action==='reject'){
   const permitted=row.kind==='agreement'?['admin','legal']:row.kind==='license'?['admin','finance','presales']:['admin','finance'];
   if(!permitted.includes(role)||row.created_by.toLowerCase()===email)return fail('Review independen sesuai kewenangan diperlukan',403);
   if(row.status!=='draft')return fail('Review hanya untuk draft',409);
   if(action==='approve'&&['agreement','license'].includes(row.kind)){
    if(String(data.end_date)<jakartaDate())return fail('Dokumen telah kedaluwarsa',409);
    const doc=await db.prepare("SELECT *,'' AS release_id FROM india_document_library WHERE id=? AND tenant_id=? AND opportunity_id=? AND (retention_until IS NULL OR retention_until>=? OR legal_hold=1)").bind(row.document_id,TENANT,row.opportunity_id,jakartaDate()).first<VaultDoc>();
    if(!doc||doc.sha256!==data.document_sha256)return fail('Original Vault tidak cocok',409);await openDocument(db,doc,'library');
   }
   status=action==='approve'?'approved':'rejected';reviewer=email;
  }else if(action==='order'||action==='receive'||action==='cancel'){
   if(row.kind!=='purchase'||!['admin','finance'].includes(role))return fail('Tindakan hanya untuk Finance/Admin pembelian',403);
   if(action==='order'&&row.status==='approved')status='ordered';
   if(action==='receive'&&row.status==='ordered'){
    if(!positive(p.received_quantity,1e9)||Number(p.received_quantity)>Number(data.quantity)||Number(p.received_quantity)<=Number(data.received_quantity)||!validISODate(p.received_date)||p.received_date>jakartaDate())return fail('Jumlah kumulatif penerimaan dan tanggal tidak valid');
    data.received_quantity=p.received_quantity;data.received_date=p.received_date;status=Number(p.received_quantity)===Number(data.quantity)?'received':'ordered';
   }
   if(action==='cancel'&&['draft','approved','ordered'].includes(row.status)&&!Number(data.received_quantity))status='cancelled';
   if(!status)return fail('Transisi pembelian tidak diizinkan',409);
  }else return fail('Tindakan tidak tersedia');
  let guard='EXISTS(SELECT 1 FROM india_partner_records WHERE tenant_id=? AND id=? AND version=? AND status=?)';
  const args:(string|number|null)[]=[TENANT,row.id,row.version,row.status];
  if((action==='approve'||action==='order')&&row.kind==='purchase'){
   // Revalidate original supplier version, expiry, global vendor capacity and cumulative reserved quantity atomically.
   guard+=" AND EXISTS(SELECT 1 FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id WHERE o.tenant_id=? AND o.id=? AND o.status='validated' AND v.status='validated' AND o.version=? AND o.unit_price_idr=? AND o.valid_until>=? AND v.valid_until>=? AND o.unit=v.capacity_unit AND v.capacity_units>=o.capacity_confirmed AND v.capacity_units>=?+(SELECT coalesce(sum(json_extract(z.data_json,'$.quantity')-coalesce(json_extract(z.data_json,'$.received_quantity'),0)),0) FROM india_partner_records z WHERE z.tenant_id=v.tenant_id AND z.vendor_id=v.id AND z.kind='purchase' AND z.id!=? AND z.status IN ('approved','ordered') AND json_extract(z.data_json,'$.unit')=o.unit) AND o.quantity>=?+(SELECT coalesce(sum(json_extract(x.data_json,'$.quantity')),0) FROM india_partner_records x WHERE x.tenant_id=o.tenant_id AND x.offer_id=o.id AND x.id!=? AND x.status IN ('approved','ordered','received')))";
   args.push(TENANT,row.offer_id,Number(data.offer_version),Number(data.unit_price_idr),jakartaDate(),jakartaDate(),Number(data.quantity),row.id,Number(data.quantity),row.id);
  }
  await atomicSales(db,guard,args,[db.prepare('UPDATE india_partner_records SET status=?,version=version+1,data_json=?,reviewed_by=coalesce(?,reviewed_by),review_notes=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(status,JSON.stringify(data),reviewer,txt(p.notes,1800),TENANT,row.id),operationEvent(db,'partner',row.id,action.toUpperCase(),email,{status,version:row.version+1,notes:txt(p.notes,1800),data})]);
  return reply({success:true,status,version:row.version+1});
 }catch(e){return fail(/constraint|CONFLICT/.test(String(e))?'Status, kapasitas atau versi vendor berubah; muat ulang.':'Transaksi partner gagal; periksa migrasi dan integritas original Vault.',/constraint|CONFLICT/.test(String(e))?409:503);}
}
