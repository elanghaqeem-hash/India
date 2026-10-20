import { NextResponse, type NextRequest } from 'next/server';

// P0 security gate: the public site remains demo-only.
// /api/health is read-only and performs its own D1 connectivity check.
// No business CRUD, transactions or AI configuration is reachable until
// identity verification, tenant-aware RBAC and durable repository layer pass UAT.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/api/health' && request.method === 'GET') {
    return NextResponse.next();
  }

  return NextResponse.json(
    { success: false, message: 'API bisnis belum diaktifkan. Diperlukan autentikasi, RBAC dan verifikasi database.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    }
  );
}

export const config = { matcher: ['/api/:path*'] };
