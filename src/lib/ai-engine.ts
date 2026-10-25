// ICOP CyberBusiness 360 Multi-Source AI Engine
// Supports Google Gemini, OpenAI, Anthropic Claude, Groq/DeepSeek, and Local Fallback Engine.
// Enforces Admin Priority Ordering with automatic cascade failover.

import { AIProviderConfig, AIServiceResponse } from './types';

// Default AI Provider Configurations
export const DEFAULT_AI_CONFIGS: AIProviderConfig[] = [
  {
    id: 'prov-gemini',
    provider: 'gemini',
    name: 'Google Gemini AI',
    apiKey: process.env.GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
    priority: 1, // Highest priority
    isEnabled: true,
    status: process.env.GEMINI_API_KEY ? 'active' : 'unconfigured',
  },
  {
    id: 'prov-openai',
    provider: 'openai',
    name: 'OpenAI (GPT-4o)',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    priority: 2,
    isEnabled: true,
    status: process.env.OPENAI_API_KEY ? 'standby' : 'unconfigured',
  },
  {
    id: 'prov-claude',
    provider: 'anthropic',
    name: 'Anthropic Claude',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: 'claude-3-5-sonnet-20241022',
    priority: 3,
    isEnabled: false,
    status: 'unconfigured',
  },
  {
    id: 'prov-groq',
    provider: 'groq',
    name: 'Groq / DeepSeek R1',
    apiKey: process.env.GROQ_API_KEY || '',
    model: 'deepseek-r1-distill-llama-70b',
    priority: 4,
    isEnabled: false,
    status: 'unconfigured',
  },
  {
    id: 'prov-local',
    provider: 'local',
    name: 'Built-in ICOP Cybersecurity Expert System (Local Fallback)',
    apiKey: 'INTERNAL_BUILTIN',
    model: 'defendit360-expert-v2',
    priority: 5, // Fallback
    isEnabled: true,
    status: 'active',
  },
];

// Test connection to an AI provider
export async function testAIProviderConnection(config: AIProviderConfig): Promise<{ success: boolean; message: string; latencyMs: number }> {
  const startTime = Date.now();
  if (config.provider === 'local') {
    return { success: true, message: 'Built-in expert system siap digunakan tanpa API Key.', latencyMs: 2 };
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    return { success: false, message: 'API Key belum diisi oleh Administrator.', latencyMs: 0 };
  }

  try {
    if (config.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with "PONG"' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, message: `Koneksi Google Gemini sukses (${latencyMs}ms). Model siap merespons.`, latencyMs };
    }

    if (config.provider === 'openai' || config.provider === 'groq') {
      const endpoint = config.provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model || (config.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10,
        }),
      });
      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, message: `Koneksi ${config.name} sukses (${latencyMs}ms).`, latencyMs };
    }

    if (config.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say OK' }],
        }),
      });
      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }
      return { success: true, message: `Koneksi Claude sukses (${latencyMs}ms).`, latencyMs };
    }

    return { success: false, message: 'Provider tidak didukung.', latencyMs: 0 };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return { success: false, message: `Gagal terhubung (${latencyMs}ms): ${err.message}`, latencyMs };
  }
}

// Call an individual remote provider
async function callRemoteProvider(
  config: AIProviderConfig,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (config.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-1.5-flash'}:generateContent?key=${config.apiKey}`;
    const payload: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };
    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (config.provider === 'openai' || config.provider === 'groq') {
    const endpoint = config.provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `${config.name} HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic HTTP ${res.status}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text || '';
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

// Built-in Expert Offline AI Engine (Guaranteed zero-failure domain fallback)
function generateLocalExpertResponse(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('scoping') || lower.includes('rks') || lower.includes('vapt') || lower.includes('tor')) {
    return `### Analisis Scoping Teknis Berbasis ICOP Expert Rules:
1. **Identifikasi Ruang Lingkup**:
   - Berdasarkan parameter kebutuhan yang dianalisis, disarankan pengujian **Grey-Box** untuk memaksimalkan efisiensi penemuan celah keamanan autentikasi & logika bisnis.
   - Sektor Finansial / Kepatuhan: Direkomendasikan menerapkan standar pengujian **OWASP ASVS Level 2 & SEOJK Keamanan Siber**.
2. **Estimasi Kebutuhan Man-Days**:
   - Komponen Web Banking / Core: 7-9 MD.
   - Komponen API Microservice: 3-4 MD.
   - Buffer Reporting & Retest (30 Hari): 2 MD.
3. **Rekomendasi Alokasi Tim**:
   - 1 PM (2 MD), 1 Pentest Lead (4 MD), 1 Senior Analyst (6 MD), 1 Junior Analyst (4 MD).
4. **Catatan Pre-Sales**:
   - Tidak ada kredensial yang boleh disimpan sebelum penandatanganan NDA. Jadwal pengujian wajib berada pada maintenance window resmi klien.`;
  }

  if (lower.includes('pricing') || lower.includes('margin') || lower.includes('harga') || lower.includes('diskon')) {
    return `### Rekomendasi Komersial & Pricing Advisory:
1. **Analisis Profitabilitas**:
   - Target Gross Margin minimum: **25.0%**. Floor price wajib melindungi modal langsung (Komponen A-E) dengan formula $\\frac{\\text{Direct Cost}}{0.80}$.
2. **Dynamic Adjustment Index (DAI)**:
   - Nilai DAI saat ini merefleksikan indeks pasar kompetitif. Untuk klien Tier S/A, gunakan **Standard Price** untuk menjaga daya tawar nilai tambah (SLA 24x7, sertifikasi Lead OSCP/CISA).
3. **Mitigasi Diskon & DoA**:
   - Jika klien meminta diskon > 5%, eskalasikan ke VP/Head Sales. Diskon di atas 15% atau margin di bawah 25% wajib memperoleh otorisasi tertulis Direktur.`;
  }

  if (lower.includes('tender') || lower.includes('bid') || lower.includes('hps') || lower.includes('lpse')) {
    return `### Rekomendasi Evaluasi Tender & Kepatuhan:
1. **Bid / No-Bid Decision Scorecard**:
   - Kesesuaian Portofolio: Sangat Tinggi (Sesuai pilar Security Check-Up & Treatment Technotama).
   - Kepatuhan Legalitas: Terdaftar LK SMPI BSSN, sertifikasi ISO 27001 aktif.
   - Rekomendasi: **GO (Lanjutkan Pengajuan Penawaran)**.
2. **Persyaratan Wajib (Mandatory Checklist)**:
   - Surat Pernyataan Kebenaran Dokumen & Pakta Integritas bermaterai Rp 10.000.
   - CV Tenaga Ahli (Lead Pentester memiliki sertifikasi CEH/OSCP/OSWE).
   - BoQ terpisah dari dokumen teknis jika pengadaan 2 sampul.`;
  }

  return `### Ringkasan Asisten Bisnis ICOP CyberBusiness 360:
- **Analisis Permintaan**: Sistem memproses konteks transaksi komersial secara terpadu.
- **Rekomendasi**: Seluruh transaksi komersial harus memenuhi rantai persetujuan DoA (Manager, VP, Direktur) dan tercatat dalam buku besar audit trail.
- **Kepatuhan Data**: Sesuai UU PDP dan standar ISO 27001, data sensitif, margin internal, dan rincian BoQ Komponen A-E tidak boleh dibagikan kepada pihak eksternal.`;
}

// Master AI Invocation with Priority Cascade
export async function executeAIPrompt(
  prompt: string,
  configs: AIProviderConfig[],
  context?: { systemPrompt?: string }
): Promise<AIServiceResponse> {
  const startTime = Date.now();

  // Sort enabled providers by priority (ascending: 1 first)
  const activeChain = configs
    .filter(c => c.isEnabled)
    .sort((a, b) => a.priority - b.priority);

  const sysPrompt = context?.systemPrompt ||
    'You are the enterprise AI Solution Architect & Cybersecurity Commercial Advisor for ICOP CyberBusiness 360 (Technotama / Technotama). Provide rigorous, executive-grade responses in Indonesian with professional accuracy, structured tables, and actionable next steps.';

  // Attempt each provider in priority order
  for (const provider of activeChain) {
    if (provider.provider === 'local') {
      const content = generateLocalExpertResponse(prompt);
      return {
        providerUsed: provider.name,
        modelUsed: provider.model,
        content,
        latencyMs: Date.now() - startTime,
        tokensEstimate: Math.round(content.length / 4),
        isFallback: activeChain[0].id !== provider.id,
      };
    }

    if (provider.apiKey && provider.apiKey.trim().length > 0) {
      try {
        const content = await callRemoteProvider(provider, prompt, sysPrompt);
        if (content && content.trim().length > 0) {
          return {
            providerUsed: provider.name,
            modelUsed: provider.model,
            content,
            latencyMs: Date.now() - startTime,
            tokensEstimate: Math.round((prompt.length + content.length) / 4),
            isFallback: activeChain[0].id !== provider.id,
          };
        }
      } catch (err: any) {
        console.warn(`[AI Chain Failover] ${provider.name} failed: ${err.message}. Cascading to next priority provider...`);
        // Continue to next provider in chain
      }
    }
  }

  // Final fallback to local expert engine
  const fallbackContent = generateLocalExpertResponse(prompt);
  return {
    providerUsed: 'Built-in ICOP Cybersecurity Expert System (Local Fallback)',
    modelUsed: 'defendit360-expert-v2',
    content: fallbackContent,
    latencyMs: Date.now() - startTime,
    tokensEstimate: Math.round(fallbackContent.length / 4),
    isFallback: true,
  };
}
