/** Provider IDs/metadata are fixed: clients cannot supply arbitrary outbound URLs. */
export const AI_PROVIDERS = [
  { id:'openai', name:'OpenAI', model:'gpt-4o-mini', models:['gpt-4o-mini','gpt-4o','gpt-5-mini'] },
  { id:'gemini', name:'Google Gemini', model:'gemini-2.5-flash', models:['gemini-2.5-flash','gemini-2.5-pro'] },
  { id:'anthropic', name:'Anthropic Claude', model:'claude-sonnet-4-5', models:['claude-sonnet-4-5','claude-haiku-4-5'] },
  { id:'groq', name:'Groq', model:'llama-3.3-70b-versatile', models:['llama-3.3-70b-versatile'] },
  { id:'openrouter', name:'OpenRouter', model:'openai/gpt-4o-mini', models:['openai/gpt-4o-mini','anthropic/claude-sonnet-4.5','google/gemini-2.5-flash'] },
  { id:'deepseek', name:'DeepSeek', model:'deepseek-chat', models:['deepseek-chat','deepseek-reasoner'] },
] as const;

export type ProviderId = (typeof AI_PROVIDERS)[number]['id'];
export const isProviderId=(id:unknown): id is ProviderId =>
  typeof id === 'string' && AI_PROVIDERS.some(x=>x.id===id);

export interface AIProviderPublic {
 id: ProviderId; name: string; model:string; defaultModel:string; availableModels: readonly string[];
 priority:number; enabled:boolean; hasKey:boolean; testedAt:string|null; testedOk:boolean|null; updatedAt:string|null;
}
export interface AIProviderRow {
 provider_id: ProviderId; model:string; priority:number; enabled:number;
 key_iv:string|null; key_ciphertext:string|null;
 tested_at:string|null; tested_ok:number|null; updated_at:string|null;
}
export function safeModel(model:unknown):model is string {
 return typeof model==='string' && model.length>0 && model.length<=96 && /^[a-zA-Z0-9._:/+-]+$/.test(model);
}
export function publicProvider(row:AIProviderRow|null, id:ProviderId):AIProviderPublic {
 const provider=AI_PROVIDERS.find(x=>x.id===id)!;
 return {id, name:provider.name, model:row?.model||provider.model, defaultModel:provider.model,
  availableModels:provider.models, priority:row?.priority??(AI_PROVIDERS.findIndex(x=>x.id===id)+1),
  enabled:row?.enabled===1, hasKey:!!row?.key_ciphertext, testedAt:row?.tested_at??null,
  testedOk:row?.tested_ok===null||row?.tested_ok===undefined?null:row.tested_ok===1,
  updatedAt:row?.updated_at??null};
}
