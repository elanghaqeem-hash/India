import { NextResponse, type NextRequest } from 'next/server';
// Only strict JWT-authenticated D1 API families are reachable.
// Legacy demo endpoints remain blocked, even when their UI is visible.
export function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/api/boq'||path.startsWith('/api/boq/')||
    path==='/api/leads'||path.startsWith('/api/leads/')||
    path==='/api/sales'||path.startsWith('/api/sales/')||
    path==='/api/ai/config'||path==='/api/ai/generate'||path==='/api/scoping/upload')
   return NextResponse.next();
 return NextResponse.json({success:false,message:'API demo nonpersisten dinonaktifkan hingga migrasi otorisasi selesai.'},
  {status:503,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export const config={matcher:['/api/:path*']};
