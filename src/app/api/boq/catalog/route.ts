import {NextResponse} from 'next/server';
import {authorizeBoQ,privateHeaders} from '@/lib/boq-auth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 try{
 const result=await auth.identity.db.prepare('SELECT sku,category,description,unit,license_status FROM india_catalog WHERE active=1 ORDER BY category,description').all();
 return NextResponse.json({success:true,items:result.results},{headers:privateHeaders});
 }catch{return NextResponse.json({success:false,message:'Katalog D1 tidak tersedia'},{status:500,headers:privateHeaders});}
}
