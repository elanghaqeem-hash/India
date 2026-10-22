import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {postalRegex,type PostalArea} from '@/lib/indonesia-postal';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
export async function GET(request:Request){
 const auth=await authorizeBoQ(request);
 if(!auth.ok)return auth.response;
 if(!['admin','marketing','sales','presales','finance','approver','legal'].includes(auth.identity.role))
  return reply({success:false,message:'Tidak memiliki izin membaca referensi wilayah.'},403);
 const postal=new URL(request.url).searchParams.get('postal')||'';
 if(!postalRegex.test(postal))return reply({success:false,message:'Kode pos harus terdiri dari 5 angka.'},422);
 try{
  const rows=await auth.identity.db.prepare(
   'SELECT region_code,postal_code,province_code,province_name,regency_code,regency_name,district_code,district_name,village_name,village_kind FROM india_postal_areas WHERE postal_code=? ORDER BY province_name,regency_name,district_name,village_name LIMIT 501'
  ).bind(postal).all<PostalArea>();
  if(rows.results.length>500)return reply({success:false,message:'Terlalu banyak wilayah pada kode pos ini; hubungi Administrator master data.'},409);
  if(rows.results.length===0){
   const populated=await auth.identity.db.prepare('SELECT 1 AS ready FROM india_postal_areas LIMIT 1').first<{ready:number}>();
   if(!populated)return reply({success:false,message:'Master wilayah nasional belum diimpor ke D1. Hubungi Administrator.'},503);
   return reply({success:true,areas:[],message:'Kode pos tidak ditemukan dalam referensi wilayah. Jangan menyimpan alamat yang belum diverifikasi.'});
  }
  return reply({success:true,areas:rows.results});
 }catch{
  return reply({success:false,message:'Master kode pos D1 belum tersedia. Administrator perlu menerapkan migrasi 0022 dan impor referensi wilayah.'},503);
 }
}
