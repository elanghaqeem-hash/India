import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
export const dynamic='force-dynamic';

/**
 * Read-only, same-origin identity for UX navigation.
 * Uses the Cloudflare Access JWT and active D1 membership checks protecting
 * all transactional APIs. Admin role previews are enforced server-side.
 */
export async function GET(req:Request){
  const auth=await authorizeBoQ(req);
  if(!auth.ok)return auth.response;
  return Response.json({
    success:true,
    identity:{email:auth.identity.email,role:auth.identity.role,
      assignedRole:auth.identity.assignedRole,rolePreview:auth.identity.rolePreview},
  },{headers:{...privateHeaders,'Vary':'Cookie'}});
}
