import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { FlexGuardTransaction } from '@/lib/types';

export async function GET() {
  return NextResponse.json({ success: true, wallets: appStore.getState().wallets });
}

export async function POST(req: Request) {
  try {
    const { walletId, tx_type, mandays, service_scope, executed_by } = await req.json();
    if (!walletId || !tx_type || !mandays) {
      return NextResponse.json({ success: false, message: 'Parameter tidak lengkap' }, { status: 400 });
    }

    const tx: FlexGuardTransaction = {
      id: `tx-${Date.now()}`,
      tx_type,
      mandays: Number(mandays),
      service_scope: service_scope || 'Service Request Execution',
      reference_code: `SR-2026-${Math.floor(Math.random() * 900 + 100)}`,
      executed_by: executed_by || 'Commercial System',
      created_at: new Date().toISOString(),
    };

    const result = appStore.addFlexGuardTransaction(walletId, tx);
    if (!result) {
      return NextResponse.json({ success: false, message: 'Wallet tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction: tx, wallet: appStore.getState().wallets.find(w => w.id === walletId) });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
