import {roles,type BoQRole} from './boq-domain';

/**
 * Admin-only, temporary role downscoping. This cookie is NOT authentication.
 * authorizeBoQ must validate a real Access JWT + active D1 *admin* membership
 * before using it. A non-admin's cookie can never grant another role.
 */
export const ROLE_PREVIEW_COOKIE='rticore_role_preview';
export const ROLE_PREVIEW_TTL_SECONDS=3600;

export function encodeRolePreview(email:string,role:BoQRole,now=Date.now()):string{
  return encodeURIComponent(email.trim().toLowerCase())+'~'+role+'~'+String(now+ROLE_PREVIEW_TTL_SECONDS*1000);
}

export function rolePreviewFromCookie(cookieHeader:string|null,email:string,assignedRole:BoQRole,now=Date.now()):BoQRole|null{
  if(assignedRole!=='admin'||!cookieHeader)return null;
  const raw=cookieHeader.split(';').map(s=>s.trim()).find(s=>s.startsWith(ROLE_PREVIEW_COOKIE+'='));
  if(!raw)return null;
  try{
    const [owner,role,until,...extra]=decodeURIComponent(raw.slice(ROLE_PREVIEW_COOKIE.length+1)).split('~');
    const expiry=Number(until);
    if(extra.length||decodeURIComponent(owner)!==email.trim().toLowerCase()||role==='admin'
       ||!roles.includes(role as BoQRole)||!Number.isSafeInteger(expiry)
       ||expiry<=now||expiry>now+ROLE_PREVIEW_TTL_SECONDS*1000)return null;
    return role as BoQRole;
  }catch{return null;}
}
