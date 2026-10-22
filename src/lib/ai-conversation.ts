/**
 * Bounded, in-memory ICOP chat context. Only completed user/assistant pairs
 * are eligible; the browser does not persist conversation content to storage.
 * Long AI replies retain their opening topic and closing recommendations.
 */
export type AIConversationTurn = { role: 'user' | 'assistant'; content: string };
export type AIConversationRequest = {
  system: string;
  messages: AIConversationTurn[];
};

export const MAX_AI_HISTORY_TURNS = 12;
export const MAX_AI_HISTORY_CHARS = 18000;
export const MAX_AI_HISTORY_ITEM_CHARS = 4800;

function shorten(content: string): string {
  if (content.length <= MAX_AI_HISTORY_ITEM_CHARS) return content;
  const prefix = content.slice(0, 3000);
  const suffix = content.slice(-1400);
  return prefix + '\n[Bagian tengah jawaban terdahulu diringkas untuk batas konteks]\n' + suffix;
}

/** Keep the newest complete Q&A pairs, not orphaned or synthetic assistant messages. */
export function selectConversationHistory(turns: readonly AIConversationTurn[]): AIConversationTurn[] {
  const selected: AIConversationTurn[] = [];
  let remaining = MAX_AI_HISTORY_CHARS;

  for (let i = turns.length - 2; i >= 0 && selected.length < MAX_AI_HISTORY_TURNS; i -= 2) {
    const question = turns[i];
    const answer = turns[i + 1];
    if (question?.role !== 'user' || answer?.role !== 'assistant') break;
    if (!question.content.trim() || !answer.content.trim()) break;
    const user: AIConversationTurn = { role: 'user', content: shorten(question.content) };
    const assistant: AIConversationTurn = { role: 'assistant', content: shorten(answer.content) };
    const length = user.content.length + assistant.content.length;
    if (length > remaining) break;
    selected.unshift(user, assistant);
    remaining -= length;
  }
  return selected;
}

/** Strictly validate untrusted request history before passing it to a provider. */
export function parseConversationHistory(raw: unknown): AIConversationTurn[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_AI_HISTORY_TURNS || raw.length % 2 !== 0) return null;
  let totalChars = 0;
  const turns: AIConversationTurn[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
    const role = (item as Record<string, unknown>).role;
    const expectedRole: AIConversationTurn['role'] = i % 2 === 0 ? 'user' : 'assistant';
    const content = (item as Record<string, unknown>).content;
    if (role !== expectedRole ||
      typeof content !== 'string' || content.length < 1 ||
      content.length > MAX_AI_HISTORY_ITEM_CHARS || !content.trim()) return null;
    totalChars += content.length;
    if (totalChars > MAX_AI_HISTORY_CHARS) return null;
    turns.push({ role: expectedRole, content });
  }
  return turns;
}
