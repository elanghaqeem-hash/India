import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { executeAIPrompt } from '@/lib/ai-engine';

export async function POST(req: Request) {
  try {
    const { prompt, systemPrompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ success: false, message: 'Prompt wajib diisi' }, { status: 400 });
    }

    const configs = appStore.getAIConfigs();
    const result = await executeAIPrompt(prompt, configs, { systemPrompt });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Gagal mengeksekusi AI',
    }, { status: 500 });
  }
}
