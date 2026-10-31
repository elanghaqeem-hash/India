import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
import {postalRegex,findPostalAreasByCode,validPostalSearchQuery,searchPostalSuggestions} from '@/lib/indonesia-postal';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:privateHeaders});
export async function GET(request:Request){
 const auth=await authorizeBoQ(request);
 if(!auth.ok)return auth.response;
 if(!['admin','marketing','sales','presales','finance','approver','legal'].includes(auth.identity.role))
  return reply({success:false,message:'Tidak memiliki izin membaca referensi wilayah.'},403);
 const params=new URL(request.url).searchParams;
 if(params.has('q')){
  const q=params.get('q')||'';
  if(!validPostalSearchQuery(q))return reply({success:false,message:'Pencarian minimal 2 angka atau 3 huruf wilayah, maksimal 50 karakter.'},422);
  try{return reply({success:true,suggestions:await searchPostalSuggestions(auth.identity.db,q)});}
  catch{return reply({success:false,message:'Master kode pos D1 belum tersedia atau belum tervalidasi. Hubungi Administrator.'},503);}
 }
 const postal=params.get('postal')||'';
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
