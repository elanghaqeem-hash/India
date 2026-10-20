import { NextResponse } from 'next/server';
import { appStore } from '@/lib/store';
import { testAIProviderConnection } from '@/lib/ai-engine';
import type { AIProviderConfig } from '@/lib/types';

// Never echo provider key material (including prefixes/suffixes) to clients.
const redact = (items: AIProviderConfig[]) => items.map(({ apiKey, ...publicConfig }) => ({
  ...publicConfig,
  apiKeyMasked: apiKey ? '••••••••' : '',
}));

export async function GET() {
  const configs = appStore.getAIConfigs();
  return NextResponse.json({ success: true, configs: redact(configs) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, id, apiKey, model, isEnabled, priority, orderedIds } = body;

    if (action === 'reorder' && Array.isArray(orderedIds)) {
      appStore.setAIPriorities(orderedIds);
      return NextResponse.json({ success: true, configs: redact(appStore.getAIConfigs()) });
    }

    if (action === 'test' && id) {
      const config = appStore.getAIConfigs().find(c => c.id === id);
      if (!config) return NextResponse.json({ success: false, message: 'Provider tidak ditemukan' }, { status: 404 });
      
      const testConfig = { ...config, apiKey: apiKey !== undefined ? apiKey : config.apiKey };
      const testResult = await testAIProviderConnection(testConfig);
      
      appStore.updateAIConfig(id, {
        status: testResult.success ? 'active' : 'error',
        lastTestedAt: new Date().toISOString(),
        statusMessage: testResult.message,
      });

      return NextResponse.json({
        success: testResult.success,
        message: testResult.message,
        latencyMs: testResult.latencyMs,
      });
    }

    if (id) {
      const updateData: any = {};
      if (apiKey !== undefined) {
        updateData.apiKey = apiKey;
        updateData.status = apiKey.trim().length > 0 ? 'standby' : 'unconfigured';
      }
      if (model !== undefined) updateData.model = model;
      if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
      if (priority !== undefined) updateData.priority = priority;

      const updated = appStore.updateAIConfig(id, updateData);
      return NextResponse.json({ success: true, config: updated ? redact([updated])[0] : null });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
