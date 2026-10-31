import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {TENANT} from '@/lib/sales-workflow';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const group=new URL(req.url).searchParams.get('group')||'';
 if(!/^[a-z][a-z0-9_-]{1,60}$/.test(group))return Response.json({success:false,message:'Grup opsi diperlukan'},{status:422,headers:privateHeaders});
 try{
  const r=await a.identity.db.prepare('SELECT option_value AS value,option_label AS label FROM india_admin_options WHERE tenant_id=? AND group_key=? AND active=1 ORDER BY sort_order,option_label LIMIT 200').bind(TENANT,group).all();
  return Response.json({success:true,items:r.results},{headers:privateHeaders});
 }catch{return Response.json({success:false,message:'Referensi opsi belum siap. Migrasi 0031 diperlukan.'},{status:503,headers:privateHeaders});}
}
