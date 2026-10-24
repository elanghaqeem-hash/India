import { NextResponse, type NextRequest } from 'next/server';

// This is a route availability gate, NOT an authorization bypass.
// Every permitted D1 handler independently validates Cloudflare Access JWT,
// membership, role, object ownership and transaction permissions server-side.
// Legacy demo APIs remain disabled until explicitly migrated and reviewed.
const D1_ROUTES = new Set([
  '/api/boq',
  '/api/ai/config',
  '/api/ai/generate',
  '/api/ai/assist',
  '/api/scoping/upload',
  '/api/marketing/leads',
  '/api/marketing/campaigns',
  '/api/marketing/lead-intelligence',
  '/api/sales',
  // Enterprise modules introduced with canonical migration 0026.
  // Previously unreachable due to an outdated middleware allowlist.
  '/api/partners',
  '/api/reports',
  '/api/admin/system',
]);

export function isEnabledD1ApiRoute(path: string): boolean {
  return D1_ROUTES.has(path) || path.startsWith('/api/boq/') || path.startsWith('/api/sales/');
}

export function middleware(request: NextRequest) {
  if (isEnabledD1ApiRoute(request.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.json(
    { success: false, message: 'API demo nonpersisten dinonaktifkan hingga migrasi otorisasi selesai.' },
    { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  );
}

export const config = { matcher: ['/api/:path*'] };
