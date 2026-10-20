import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { runPriorityChain } from '@/lib/ai-credential-vault';

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:privateHeaders});
export async function POST(req:Request){
 const auth=await authorizeBoQ(req);
 if(!auth.ok)return auth.response;
 // Until AI data-sharing policy and customer consent controls exist, restrict external AI prompts to Admin.
 if(auth.identity.role!=='admin')return json({success:false,message:'Konsol AI saat ini khusus Admin.'},403);
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)return json({success:false,message:'Origin tidak diizinkan.'},403);
 if(req.headers.get('x-india-ai-admin')!=='1')return json({success:false,message:'Permintaan AI tidak valid.'},403);
 let body:unknown;
 try{body=await req.json();}catch{return json({success:false,message:'Format permintaan tidak valid.'},400);}
 const prompt=(body as {prompt?:unknown})?.prompt;
 if(typeof prompt!=='string'||prompt.trim().length<2||prompt.length>2000)
  return json({success:false,message:'Prompt harus 2 sampai 2000 karakter.'},400);
 try{
  const result=await runPriorityChain(auth.identity.db,prompt);
  return json({success:true,...result});
 }catch{
  return json({success:false,message:'Belum ada provider AI yang bisa digunakan atau semua koneksi gagal.'},503);
 }
}
