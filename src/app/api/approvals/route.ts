import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';

export async function GET() {
  return NextResponse.json({
    success: true,
    approvals: appStore.getState().approvals,
  });
}

export async function POST(req: Request) {
  try {
    const { id, status, approver_name, comments } = await req.json();
    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: 'ID transaksi dan status otorisasi wajib disertakan' },
        { status: 400 }
      );
    }

    const updated = appStore.updateApproval(
      id,
      status,
      approver_name || 'System Admin / Otorisator',
      comments || ''
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'Item approval tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      approval: updated,
      message: Approval # berhasil diupdate ke status ,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
