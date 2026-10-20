import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { Tender } from '@/lib/types';

export async function GET() {
  return NextResponse.json({ success: true, tenders: appStore.getState().tenders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const newTender: Tender = {
      id: `tnd-${Date.now()}`,
      code: `TND-${body.source || 'LPSE'}-2026-${Math.floor(Math.random() * 900 + 100)}`,
      title: body.title,
      source: body.source || 'LPSE',
      agency_name: body.agency_name,
      pagu_budget: Number(body.pagu_budget) || 0,
      hps_budget: Number(body.hps_budget) || Number(body.pagu_budget) || 0,
      service_type: body.service_type || 'VAPT',
      deadline_submission: body.deadline_submission || new Date(Date.now() + 20 * 86400000).toISOString(),
      eligibility_status: body.eligibility_status || 'qualified',
      bid_decision: body.bid_decision || 'pending',
      bid_score: body.bid_score || 80,
      summary: body.summary || '',
      created_at: new Date().toISOString(),
    };

    appStore.addTender(newTender);
    return NextResponse.json({ success: true, tender: newTender });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...partial } = await req.json();
    if (!id) return NextResponse.json({ success: false, message: 'ID tender diperlukan' }, { status: 400 });
    const updated = appStore.updateTender(id, partial);
    return NextResponse.json({ success: true, tender: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
