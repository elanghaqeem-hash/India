import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { generateQuotationNumber } from '@/lib/formatters';

export async function GET() {
  return NextResponse.json({ success: true, proposals: appStore.getState().proposals });
}

export async function PATCH(req: Request) {
  try {
    const { id, action, status, rejection_reason } = await req.json();
    if (!id) return NextResponse.json({ success: false, message: 'ID proposal diperlukan' }, { status: 400 });

    const store = appStore.getState();
    const existing = store.proposals.find(p => p.id === id);
    if (!existing) return NextResponse.json({ success: false, message: 'Proposal tidak ditemukan' }, { status: 404 });

    if (action === 'create_revision') {
      const nextVersion = existing.version + 1;
      const baseNum = existing.quotation_number.split('/REV-')[0];
      const newNumber = `${baseNum}/REV-${nextVersion - 1}`;

      const revised = {
        ...existing,
        id: `prop-${Date.now()}`,
        quotation_number: newNumber,
        version: nextVersion,
        status: 'draft' as const,
        created_at: new Date().toISOString(),
        submitted_at: undefined,
        approved_at: undefined,
        approved_by: undefined,
      };
      appStore.addProposal(revised);
      return NextResponse.json({ success: true, proposal: revised });
    }

    if (status) {
      const updateData: any = {};
      if (status === 'sent') updateData.sent_at = new Date().toISOString();
      if (status === 'accepted') updateData.accepted_at = new Date().toISOString();
      if (status === 'rejected') updateData.rejection_reason = rejection_reason;

      const updated = appStore.updateProposalStatus(id, status, updateData);
      return NextResponse.json({ success: true, proposal: updated });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
