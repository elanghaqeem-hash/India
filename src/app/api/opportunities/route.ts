import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { Opportunity } from '@/lib/types';

export async function GET() {
  return NextResponse.json({ success: true, opportunities: appStore.getState().opportunities });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company_id, company_name, name, service_type, estimated_value, probability, expected_closing_date, account_manager, notes } = body;

    if (!name || !company_name || !service_type) {
      return NextResponse.json({ success: false, message: 'Data opportunity belum lengkap' }, { status: 400 });
    }

    const newOpp: Opportunity = {
      id: `opp-${Date.now()}`,
      company_id: company_id || 'comp-01',
      company_name,
      name,
      stage: 'prospecting',
      service_type,
      estimated_value: Number(estimated_value) || 0,
      probability: Number(probability) || 10,
      expected_closing_date: expected_closing_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      account_manager: account_manager || 'M. Nadhil',
      notes,
      created_at: new Date().toISOString(),
    };

    appStore.addOpportunity(newOpp);
    return NextResponse.json({ success: true, opportunity: newOpp });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...partial } = await req.json();
    if (!id) return NextResponse.json({ success: false, message: 'ID diperlukan' }, { status: 400 });
    const updated = appStore.updateOpportunity(id, partial);
    return NextResponse.json({ success: true, opportunity: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
