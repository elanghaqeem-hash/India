import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
export const dynamic='force-dynamic';

/**
 * Read-only, same-origin identity for UX navigation.
 * Reuses the exact Cloudflare Access JWT and active membership checks that
 * protect every transactional API. No client-controlled role selection.
 */
export async function GET(req:Request){
  const auth=await authorizeBoQ(req);
  if(!auth.ok)return auth.response;
  return Response.json({
    success:true,
    identity:{email:auth.identity.email,role:auth.identity.role},
  },{headers:{...privateHeaders,'Vary':'Cookie'}});
}
