import { NextResponse } from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {roles} from '@/lib/boq-domain';
export const dynamic='force-dynamic';
const out=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:privateHeaders});
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const i=a.identity;
 if(i.role!=='admin')return out({success:false,message:'Admin diperlukan'},403);
 const users=await i.db.prepare('SELECT email,role,active,created_at FROM india_members ORDER BY email').all();
 return out({success:true,users:users.results});
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const i=a.identity;
 if(i.role!=='admin')return out({success:false,message:'Admin diperlukan'},403);
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)return out({success:false,message:'Origin ditolak'},403);
 try{
  const p=await req.json(),email=String(p.email||'').toLowerCase().trim(),role=String(p.role||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.includes(role as any))
   return out({success:false,message:'Email atau role tidak valid'},400);
  if(p.active===false&&email===i.email)return out({success:false,message:'Admin tidak boleh menonaktifkan akunnya sendiri'},409);
  const active=p.active===false?0:1;
  await i.db.prepare('INSERT INTO india_members(email,role,active,created_by) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET role=excluded.role,active=excluded.active')
   .bind(email,role,active,i.email).run();
  await i.db.prepare('INSERT INTO india_audit_log(id,tenant_id,action,actor_email,summary) VALUES(?,?,?,?,?)')
   .bind(crypto.randomUUID(),'defendit360','MEMBER_UPDATE',i.email,email+':'+role+':'+active).run();
  return out({success:true});
 }catch{return out({success:false,message:'Gagal menyimpan pengguna'},400);}
}
