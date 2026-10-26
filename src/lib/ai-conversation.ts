/**
 * Bounded, in-memory INDIA chat context. Only completed user/assistant pairs
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

/**
 * A language preference is a persistent conversational instruction, not a new
 * subject matter question. Keep follow-up topic context intact.
 */
export function isIndonesianLanguagePreference(message: string): boolean {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
  return /^(?:(?:tolong|mohon)\s+)?(?:(?:gunakan|pakai|gunakanlah|jawab(?:lah)?(?:\s+saja)?\s+(?:dengan|dalam)|berbahasa)\s+)?bahasa indonesia(?:\s+saja|\s+ya|\s+terus|\s+untuk\s+seterusnya)?$/.test(normalized) ||
    /^(?:(?:tolong|mohon)\s+)?(?:gunakan|pakai|jawab\s+(?:dengan|dalam))\s+bahasa indonesia\s+(?:saja|ya|untuk\s+seterusnya)$/.test(normalized);
}

/** A deterministic acknowledgment avoids resetting the topic to an empty chat. */
export function languagePreferenceAcknowledgment(history: readonly AIConversationTurn[]): string {
  const lastSubject = [...history].reverse().find((turn) =>
    turn.role === 'user' && !isIndonesianLanguagePreference(turn.content));
  if (!lastSubject) {
    return 'Baik, saya akan menggunakan Bahasa Indonesia untuk seluruh percakapan ini.';
  }
  const topic = lastSubject.content.replace(/\s+/g, ' ').trim().slice(0, 140);
  return `Baik, mulai sekarang saya akan menjawab dalam Bahasa Indonesia. Pembahasan sebelumnya tetap berlanjut: “${topic}”. Pertanyaan berikutnya tetap saya hubungkan dengan topik tersebut.`;
}


/**
 * Context hints are made only from an allowlisted topic taxonomy, never from
 * history text as system instructions. The model still receives original turns.
 * This guards short, misspelled follow-ups without rewriting the user's words.
 */
export type AIChatTopic = 'vapt'|'boq'|'tender'|'soc'|'grc'|'pricing'|'sales';
export type AIConversationAnchor = {
 topic: AIChatTopic;
 label: string;
 comparison: boolean;
 methods: readonly string[];
 guidance: string;
};

const chatTopics: readonly {id:AIChatTopic;label:string;pattern:RegExp}[] = [
 {id:'vapt',label:'VAPT / penetration testing',
  pattern:/\b(?:vapt|pen(?:etration)?[\s-]?test(?:ing)?|pentest(?:ing)?|vulnerability assessment|black[\s-]?box|gr[ae]y[\s-]?box|white[\s-]?box|burp suite|owasp zap)\b/i},
 {id:'boq',label:'Bill of Quantities (BoQ)',pattern:/\b(?:boq|bill of quantities|bill of quantity|hpps?|quotation)\b/i},
 {id:'tender',label:'Tender / pengadaan',pattern:/\b(?:tender|lpse|pengadaan|rks|kak|bid.no.bid)\b/i},
 {id:'soc',label:'SOC / MDR',pattern:/\b(?:soc|mdr|siem|security operations center|monitoring insiden)\b/i},
 {id:'grc',label:'Governance, Risk & Compliance',pattern:/\b(?:grc|iso 27001|kepatuhan|manajemen risiko|pdp)\b/i},
 {id:'pricing',label:'Harga / costing',pattern:/\b(?:pricing|costing|gross margin|margin penjualan)\b/i},
 {id:'sales',label:'Sales / opportunity',pattern:/\b(?:pipeline|opportunity|lead management|sales forecast)\b/i},
];
const unrelatedSubject = /\b(?:baju|pakaian|sepatu|kendaraan|mobil|motor|parfum|restoran|resep|hotel|penerbangan)\b/i;
const comparisonWords = /\b(?:lebih murah|murahan|lebih hemat|paling hemat|mana.{0,28}murah|harga|biaya|mahal|cost|estimasi)\b/i;
const followUpWords = /\b(?:mana|mans|yg|yang|itu|tadi|tersebut|mereka|keduanya|lebih|berapa|bagaimana|caranya|perbedaannya|alternatif|bandingkan|bandingannya|pilih|dipakai|biayanya|harganya|murah|hemat)\b/i;

/** The displayed topic is inferred from prior user messages first, not the model output. */
export function activeChatTopic(history:readonly AIConversationTurn[]):AIChatTopic|null {
 const meaningful=history.filter(t=>t.role==='user'&&!isIndonesianLanguagePreference(t.content)).reverse();
 for(const turn of [...meaningful,...history.filter(t=>t.role==='assistant').reverse()]){
  const found=chatTopics.find(item=>item.pattern.test(turn.content));
  if(found)return found.id;
 }
 return null;
}

/**
 * The browser retains all successful chat turns in memory while the wire format
 * includes only six recent pairs. A bounded taxonomy hint from the full session
 * can recover an older topic after the original subject scrolls out of context.
 * No arbitrary user-provided instructions or old transcript text are accepted.
 */
export function parseConversationTopicHint(raw:unknown):AIChatTopic|null {
 return typeof raw==='string'&&chatTopics.some(entry=>entry.id===raw)?raw as AIChatTopic:null;
}

/** Explicitly unrelated new subjects must not be forced back into old VAPT context. */
export function contextualConversationAnchor(
 prompt:string,history:readonly AIConversationTurn[],topicHint?:unknown
):AIConversationAnchor|null {
 if(history.length<2 || prompt.length>200 || unrelatedSubject.test(prompt))return null;
 const recent=prompt.toLowerCase().replace(/\bmans\b/g,'mana').replace(/\byg\b/g,'yang');
 if(!followUpWords.test(recent))return null;
 const current=chatTopics.find(item=>item.pattern.test(prompt));
 // Do not permit a client hint to override an explicit topic switch in this prompt.
 // The hint is a finite category, not narrative instructions or authorization.
 const oldTopic=activeChatTopic(history)||parseConversationTopicHint(topicHint);
 if(!oldTopic || (current && current.id!==oldTopic))return null;
 const entry=chatTopics.find(x=>x.id===oldTopic)!;
 const comparison=comparisonWords.test(recent);
 const transcript=history.slice(-8).map(t=>t.content).join(' ');
 const methods=oldTopic==='vapt'
  ? [
   [/black[\s-]?box/i,'Black Box'],
   [/gr[ae]y[\s-]?box/i,'Gray Box'],
   [/white[\s-]?box/i,'White Box'],
   ].filter(([pattern])=>(pattern as RegExp).test(transcript))
    .map(([,label])=>label as string)
  : [];
 const guidance=[
  'Konteks lanjutan teridentifikasi: '+entry.label+'.',
  'Pertahankan topik ini untuk rujukan singkat dan typo; jangan memulai percakapan baru.',
  ...(comparison ? ['Pertanyaan pengguna merupakan kemungkinan perbandingan harga/biaya dari pembahasan sebelumnya. Jangan mengalihkannya menjadi pembahasan barang konsumsi.'] : []),
  ...(methods.length>1 ? ['Metode yang sudah disebut: '+methods.join(', ')+'. Jika sesuai pertanyaan, bandingkan metode-metode ini. Biaya tergantung scope, kerumitan, akses dan person-days; jangan mengarang angka.'] : []),
  'Bila objek perbandingan masih ambigu, tanyakan satu klarifikasi spesifik dalam topik '+entry.label+'.',
  'Permintaan baru yang jelas berbeda topik tetap harus diikuti.',
 ].join(' ');
 return {topic:oldTopic,label:entry.label,comparison,methods,guidance};
}

/** Deliberately narrow rejection: unrelated consumer-goods clarification during VAPT costing. */
export function isClearlyOffTopicChatAnswer(anchor:AIConversationAnchor|null,answer:string):boolean {
 if(anchor?.topic!=='vapt'||!anchor.comparison)return false;
 const consumerExamples=/\b(?:pakaian|kendaraan|baju|sepatu|mobil|motor|perabot|produk tertentu|elektronik rumah tangga)\b/i;
 const cybersecurity=/\b(?:vapt|penetration testing|pentest|pentester|pengujian keamanan|black[\s-]?box|gr[ae]y[\s-]?box|white[\s-]?box|kerentanan|audit keamanan)\b/i;
 return consumerExamples.test(answer)&&!cybersecurity.test(answer);
}

export function topicalClarification(anchor:AIConversationAnchor):string {
 if(anchor.topic==='vapt'&&anchor.methods.length>=2)
  return 'Kita masih membahas VAPT/penetration testing. Apakah yang ingin Anda bandingkan adalah biaya '+anchor.methods.join(', ')+'? Perbandingan bergantung pada cakupan, akses, kompleksitas, dan person-days.';
 return 'Kita masih membahas '+anchor.label+'. Pilihan atau metode mana dari pembahasan tadi yang ingin Anda bandingkan?';
}
