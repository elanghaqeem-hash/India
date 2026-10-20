import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type MinimalD1 = {
  prepare(sql: string): {
    first<T = Record<string, unknown>>(): Promise<T | null>;
  };
};

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const database = (env as unknown as { DB?: MinimalD1 }).DB;
    if (!database) {
      return NextResponse.json(
        { status: 'unavailable', checks: { database: 'unbound' } },
        { status: 503, headers }
      );
    }

    const migration = await database.prepare(
      "SELECT version FROM schema_migrations WHERE version = '0001_init'"
    ).first<{ version: string }>();

    if (!migration) {
      return NextResponse.json(
        { status: 'unavailable', checks: { database: 'schema_missing' } },
        { status: 503, headers }
      );
    }

    // Health endpoint reports only connectivity, never table rows or secrets.
    return NextResponse.json(
      { status: 'ok', checks: { database: 'ready' } },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable', checks: { database: 'error' } },
      { status: 503, headers }
    );
  }
}
