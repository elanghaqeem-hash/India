/**
 * Render the subset of Markdown emphasis emitted by AI providers in the chat.
 * Keep text as React text nodes (never use innerHTML) so arbitrary model output
 * cannot inject markup. Preserve literal multiplication and wildcard asterisks.
 */
export type AIChatSegment = {
  text: string;
  format: 'plain' | 'bold' | 'italic';
};

export function formatAIChatMessage(message: string): AIChatSegment[] {
  // Only a leading "* " denotes a Markdown bullet, not arithmetic or a glob.
  const normalized = message.replace(/(^|\n)([ \t]*)\*[ \t]+(?=\S)/g, '$1$2• ');
  const segments: AIChatSegment[] = [];
  const emphasis = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let cursor = 0;

  for (const match of normalized.matchAll(emphasis)) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ text: normalized.slice(cursor, start), format: 'plain' });
    }

    const content = match[1] ?? match[2];
    // Avoid interpreting "* 5 *" (arithmetic) as emphasis.
    if (!content || content.trim() !== content) {
      segments.push({ text: match[0], format: 'plain' });
    } else {
      segments.push({
        text: content,
        format: match[1] === undefined ? 'italic' : 'bold',
      });
    }

    cursor = start + match[0].length;
  }

  if (cursor < normalized.length) {
    segments.push({ text: normalized.slice(cursor), format: 'plain' });
  }
  return segments.length ? segments : [{ text: normalized, format: 'plain' }];
}
