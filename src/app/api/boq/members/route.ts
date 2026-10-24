import {NextResponse} from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {roles} from '@/lib/boq-domain';
import {atomicSales} from '@/lib/sales-transactions';
import {operationEvent,txt} from '@/lib/operations';
import {TENANT} from '@/lib/sales-workflow';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
export const dynamic='force-dynamic';
const out=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:privateHeaders});
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const i=a.identity;if(i.role!=='admin')return out({success:false,message:'Admin diperlukan'},403);
 try{const users=await i.db.prepare('SELECT m.email,m.role,m.active,m.created_at,o.unit_key FROM india_members m LEFT JOIN india_member_orgs o ON o.email=m.email ORDER BY m.email').all();const units=await i.db.prepare("SELECT setting_key,title FROM india_effective_settings WHERE tenant_id=? AND kind='organization' ORDER BY title").bind(TENANT).all();return out({success:true,users:users.results,units:units.results});}catch{return out({success:false,message:'Pengguna belum tersedia; verifikasi migrasi 0026'},503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const i=a.identity;if(i.role!=='admin')return out({success:false,message:'Admin diperlukan'},403);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return out({success:false,message:'Origin ditolak'},403);
 let p:Record<string,unknown>;try{p=await readBoundedJSON(req,4000);}catch(e){return out({success:false,message:e instanceof Error?e.message:'JSON tidak valid'},e instanceof RequestBodyError?e.status:400);}
 try{
  const email=txt(p.email,254).toLowerCase(),role=txt(p.role,30);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role as typeof roles[number])||typeof p.active!=='boolean')return out({success:false,message:'Email, role dan status active wajib valid'},422);
  const active=p.active?1:0;
  if(email===i.email&&(role!=='admin'||!active))return out({success:false,message:'Admin tidak boleh menonaktifkan atau menurunkan perannya sendiri'},409);
  let guard="EXISTS(SELECT 1 FROM india_members WHERE email=? AND role='admin' AND active=1)",args:(string|number|null)[]=[i.email];
  if(role!=='admin'||!active){guard+=" AND (NOT EXISTS(SELECT 1 FROM india_members WHERE email=? AND role='admin' AND active=1) OR EXISTS(SELECT 1 FROM india_members WHERE email!=? AND role='admin' AND active=1))";args.push(email,email);}
  const unit=txt(p.unit_key,61),writes=[i.db.prepare('INSERT INTO india_members(email,role,active,created_by) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active').bind(email,role,active,i.email)];
  if(unit){guard+=" AND EXISTS(SELECT 1 FROM india_effective_settings WHERE tenant_id=? AND kind='organization' AND setting_key=?)";args.push(TENANT,unit);writes.push(i.db.prepare('INSERT INTO india_member_orgs(email,unit_key,updated_by) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET unit_key=excluded.unit_key,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind(email,unit,i.email));}
  else if(p.unit_key==='')writes.push(i.db.prepare('DELETE FROM india_member_orgs WHERE email=?').bind(email));
  writes.push(i.db.prepare('INSERT INTO india_audit_log(id,tenant_id,action,actor_email,summary) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,'MEMBER_UPDATE',i.email,email+':'+role+':'+active),operationEvent(i.db,'member',email,'UPDATE',i.email,{email,role,active,unit_key:p.unit_key===undefined?'unchanged':unit||null}));
  await atomicSales(i.db,guard,args,writes);return out({success:true});
 }catch(e){return out({success:false,message:/constraint/.test(String(e))?'Perubahan pengguna atau organisasi konflik; muat ulang':'Pengguna dan audit tidak tersimpan'},/constraint/.test(String(e))?409:503);}
}
