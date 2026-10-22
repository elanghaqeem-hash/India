import { NextResponse, type NextRequest } from 'next/server';
// All legacy demo APIs are kept disabled until migrated to authenticated DB.
// Only explicitly authorized D1 APIs are routed; BoQ, Sales and AI each verify Access JWTs and roles server-side.
export function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/api/boq'||path.startsWith('/api/boq/')||path==='/api/ai/config'||path==='/api/ai/generate'||path==='/api/ai/assist'||path==='/api/scoping/upload'||(path==='/api/marketing/leads'||path==='/api/marketing/campaigns')||path==='/api/sales'||path.startsWith('/api/sales/'))return NextResponse.next();
 return NextResponse.json({success:false,message:'API demo nonpersisten dinonaktifkan hingga migrasi otorisasi selesai.'},
 {status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export const config={matcher:['/api/:path*']};
