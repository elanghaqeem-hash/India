import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt} from '@/lib/operations';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
const fail=(message:string,status=422)=>reply({success:false,message},status);
const keyOK=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_-]{1,60}$/.test(v);
type VersionRow={id:string;version:number;active:number};
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role}=a.identity;if(role!=='admin')return fail('Hanya Admin dapat mengelola opsi',403);
 try {
  const group=new URL(req.url).searchParams.get('group');
  if(group&&!keyOK(group))return fail('Grup opsi tidak valid');
  const rows=group?
   await db.prepare('SELECT id,group_key,option_value,option_label,description,sort_order,active,version,updated_by,updated_at FROM india_admin_options WHERE tenant_id=? AND group_key=? ORDER BY sort_order,option_label LIMIT 500').bind(TENANT,group).all():
   await db.prepare('SELECT id,group_key,option_value,option_label,description,sort_order,active,version,updated_by,updated_at FROM india_admin_options WHERE tenant_id=? ORDER BY group_key,sort_order,option_label LIMIT 500').bind(TENANT).all();
  return reply({success:true,items:rows.results});
 }catch{return fail('Registrasi opsi belum siap. Terapkan migrasi 0031 pada D1.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(role!=='admin')return fail('Hanya Admin dapat mengubah opsi',403);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{p=await readBoundedJSON(req,5000);}catch(e){return fail(e instanceof Error?e.message:'JSON tidak valid',e instanceof RequestBodyError?e.status:400);}
 if(p.action!=='save')return fail('Aksi tidak didukung');
 const group=p.group_key,value=p.option_value,label=txt(p.option_label,120),description=txt(p.description,500);
 const order=p.sort_order,active=p.active,version=p.version;
 if(!keyOK(group)||!keyOK(value)||label.length<2||label.length>120||
    typeof p.description!=='string'||p.description.length>500||
    typeof order!=='number'||!Number.isSafeInteger(order)||order<0||order>9999||
    typeof active!=='boolean'||typeof version!=='number'||!Number.isSafeInteger(version)||version<0)
  return fail('Isi grup, kode, nama, deskripsi, urutan, status, dan versi dengan benar');
 try {
  const existing=await db.prepare('SELECT id,version,active FROM india_admin_options WHERE tenant_id=? AND group_key=? AND option_value=?').bind(TENANT,group,value).first<VersionRow>();
  if((existing?.version||0)!==version)return fail('Opsi sudah berubah. Muat ulang sebelum menyimpan.',409);
  const id=existing?.id||crypto.randomUUID();
  const guard=version===0?
   'NOT EXISTS(SELECT 1 FROM india_admin_options WHERE tenant_id=? AND group_key=? AND option_value=?)':
   'EXISTS(SELECT 1 FROM india_admin_options WHERE tenant_id=? AND group_key=? AND option_value=? AND version=?)';
  const args:(string|number|null)[]=version===0?[TENANT,group,value]:[TENANT,group,value,version];
  const row=version===0?
   db.prepare('INSERT INTO india_admin_options(id,tenant_id,group_key,option_value,option_label,description,sort_order,active,updated_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,TENANT,group,value,label,description,order,active?1:0,email):
   db.prepare('UPDATE india_admin_options SET option_label=?,description=?,sort_order=?,active=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND group_key=? AND option_value=? AND version=?').bind(label,description,order,active?1:0,email,TENANT,group,value,version);
  await atomicSales(db,guard,args,[row,operationEvent(db,'admin_options',id,existing?'UPDATE':'CREATE',email,{group_key:group,option_value:value,option_label:label,active,sort_order:order,version:version+1})]);
  return reply({success:true,id,version:version+1},existing?200:201);
 }catch(e){
  return fail(/constraint|CONFLICT|OPTION_/i.test(String(e))?'Data berubah atau kode opsi sudah ada. Muat ulang.':'Gagal menyimpan opsi dan audit. Periksa migrasi 0031.',/constraint|CONFLICT|OPTION_/i.test(String(e))?409:503);
 }
}
