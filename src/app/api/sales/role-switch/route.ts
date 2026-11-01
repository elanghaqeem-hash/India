import {NextResponse} from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {roles,type BoQRole} from '@/lib/boq-domain';
import {firstAccessibleHref} from '@/lib/enterprise-navigation';
import {ROLE_PREVIEW_COOKIE,ROLE_PREVIEW_TTL_SECONDS,encodeRolePreview,rolePreviewFromCookie} from '@/lib/role-preview';
import {TENANT} from '@/lib/sales-workflow';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';

export const dynamic='force-dynamic';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});

/**
 * Admin-only role simulation. The selected role is enforced on EVERY API via
 * authorizeBoQ, not merely used to render the sidebar. The real actor/email
 * is retained in all writes and audit records; this never impersonates a user.
 */
export async function POST(req:Request){
  const auth=await authorizeBoQ(req,{ignoreRolePreview:true});
  if(!auth.ok)return auth.response;
  const actor=auth.identity;
  if(actor.role!=='admin')return reply({success:false,message:'Hanya Admin aktif yang dapat menggunakan mode uji role.'},403);
  const origin=req.headers.get('origin');
  if(!origin||origin!==new URL(req.url).origin||!['same-origin','none'].includes(req.headers.get('sec-fetch-site')||'same-origin'))
    return reply({success:false,message:'Permintaan harus berasal dari aplikasi yang sama.'},403);

  let body:Record<string,unknown>;
  try{body=await readBoundedJSON(req,1000);}
  catch(error){return reply({success:false,message:error instanceof Error?error.message:'Payload tidak valid'},error instanceof RequestBodyError?error.status:400);}
  if(typeof body.role!=='string'||!roles.includes(body.role as BoQRole))
    return reply({success:false,message:'Role tidak tersedia.'},422);

  const role=body.role as BoQRole;
  const previous=rolePreviewFromCookie(req.headers.get('cookie'),actor.email,'admin')||'admin';
  try{
    // Auditable role transition; refuse to change mode if audit cannot persist.
    await actor.db.prepare('INSERT INTO india_audit_log(id,tenant_id,action,actor_email,summary) VALUES(?,?,?,?,?)')
      .bind(crypto.randomUUID(),TENANT,'ROLE_PREVIEW_SWITCH',actor.email,previous+' -> '+role).run();
  }catch{
    return reply({success:false,message:'Audit perubahan role gagal disimpan. Mode uji tidak diubah.'},503);
  }

  const response=reply({
    success:true,
    identity:{email:actor.email,role,assignedRole:'admin',rolePreview:role!=='admin'},
    href:firstAccessibleHref(role)||'/',
  });
  response.cookies.set(ROLE_PREVIEW_COOKIE,role==='admin'?'':encodeRolePreview(actor.email,role),{
    httpOnly:true,sameSite:'strict',secure:new URL(req.url).protocol==='https:',
    path:'/',maxAge:role==='admin'?0:ROLE_PREVIEW_TTL_SECONDS,
  });
  return response;
}
