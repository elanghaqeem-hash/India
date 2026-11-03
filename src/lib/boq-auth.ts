import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {accessRestricted} from './system-settings';
import type { BoQRole } from './boq-domain';
import {rolePreviewFromCookie} from './role-preview';

export interface D1Prepared {
 bind(...args:(string|number|null)[]):D1Prepared;
 all<T=Record<string,unknown>>():Promise<{results:T[];success:boolean}>;
 first<T=Record<string,unknown>>():Promise<T|null>;
 run():Promise<{success:boolean}>;
}
export interface D1DB {
 prepare(query:string):D1Prepared;
 batch(statements:D1Prepared[]):Promise<unknown[]>;
}
type CloudEnv={INDIA_DB?:D1DB;INDIA_ACCESS_AUD?:string;INDIA_ACCESS_TEAM_DOMAIN?:string};
export type BoQIdentity={email:string;role:BoQRole;assignedRole:BoQRole;rolePreview:boolean;db:D1DB};
type Result={ok:true;identity:BoQIdentity}|{ok:false;response:NextResponse};
const deny=(status:number,message:string):Result=>({ok:false,response:NextResponse.json({success:false,message},{status,headers:{'Cache-Control':'no-store'}})});
const cache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authorizeBoQ(request:Request,options:{ignoreRolePreview?:boolean}={}):Promise<Result>{
 let env:CloudEnv;
 try {env=(await getCloudflareContext({async:true})).env as CloudEnv;}catch{return deny(503,'D1 runtime tidak tersedia');}
 const db=env.INDIA_DB, domain=env.INDIA_ACCESS_TEAM_DOMAIN, aud=env.INDIA_ACCESS_AUD;
 if(!db||!domain||!aud||!domain.endsWith('.cloudflareaccess.com')||aud.length<30)
  return deny(503,'Database atau autentikasi RTICORE belum dikonfigurasi.');
 const token=request.headers.get('cf-access-jwt-assertion');
 if(!token)return deny(401,'Login Cloudflare Access diperlukan.');
 try{
   let keys=cache.get(domain);
   if(!keys){keys=createRemoteJWKSet(new URL('https://'+domain+'/cdn-cgi/access/certs'));cache.set(domain,keys);}
   const verified=await jwtVerify(token,keys,{issuer:'https://'+domain,audience:aud,algorithms:['RS256'],clockTolerance:30});
   const email=String(verified.payload.email||'').trim().toLowerCase();
   if(!email.includes('@'))return deny(403,'Identitas email tidak valid.');
   const member=await db.prepare('SELECT role,active FROM india_members WHERE email=?').bind(email).first<{role:BoQRole;active:number}>();
   if(!member||member.active!==1||!['admin','marketing','finance','presales','sales','approver','legal','viewer'].includes(member.role))
    return deny(403,'Akun belum diberi akses sesuai peran.');
   // Only a verified active Admin may voluntarily downscope to a different role.
   // Untrusted cookies from non-Admins are always ignored (no role elevation).
   const role=options.ignoreRolePreview?member.role:
     rolePreviewFromCookie(request.headers.get('cookie'),email,member.role)||member.role;
   // Identity must remain readable to an authenticated member even when an
   // institution policy denies the preview role access to other Sales APIs.
   const path=new URL(request.url).pathname;
   try{if(path!=='/api/sales/identity'&&await accessRestricted(db,path,role))return deny(403,'Resource dibatasi oleh Access Policy institusi.');}catch{return deny(503,'Access Policy belum siap; verifikasi migrasi administrasi.');}
   return {ok:true,identity:{email,role,assignedRole:member.role,rolePreview:role!==member.role,db}};
 }catch{return deny(401,'Token login Access tidak valid atau kedaluwarsa.');}
}
export const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'} as const;
