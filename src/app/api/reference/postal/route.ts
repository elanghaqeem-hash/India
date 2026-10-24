import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {postalRegex,findPostalAreasByCode} from '@/lib/indonesia-postal';
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
  const areas=await findPostalAreasByCode(auth.identity.db,postal);
  if(areas.length>500)return reply({success:false,message:'Terlalu banyak wilayah pada kode pos ini; hubungi Administrator master data.'},409);
  if(areas.length===0)return reply({success:true,areas:[],message:'Kode pos tidak ditemukan dalam referensi wilayah. Periksa kembali nomor yang dimasukkan.'});
  return reply({success:true,areas});
 }catch{
  return reply({success:false,message:'Master kode pos D1 belum tersedia atau belum tervalidasi. Hubungi Administrator.'},503);
 }
}
