import { NextResponse, type NextRequest } from 'next/server';

// Default-deny public preview: there is no verified authentication,
// role authorization, or durable database yet.
export function middleware(_request: NextRequest) {
  return NextResponse.json(
    { success: false, message: 'Pratinjau DEMO: API belum tersedia. Akses memerlukan autentikasi dan database persisten.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
export const config = { matcher: ['/api/:path*'] };
