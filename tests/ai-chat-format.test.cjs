const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { formatAIChatMessage } = require('../src/lib/ai-chat-format.ts');

const asText = parts => parts.map(part => part.text).join('');

test('AI bold section headings are readable without literal double stars', () => {
  const original = '1. **Perencanaan dan Persiapan**: Menentukan tujuan.\n2. **Pengumpulan Informasi**: Mengumpulkan data.';
  const formatted = formatAIChatMessage(original);
  assert.equal(asText(formatted), '1. Perencanaan dan Persiapan: Menentukan tujuan.\n2. Pengumpulan Informasi: Mengumpulkan data.');
  assert.deepEqual(formatted.filter(s => s.format === 'bold').map(s => s.text), [
    'Perencanaan dan Persiapan', 'Pengumpulan Informasi',
  ]);
});

test('asterisk Markdown bullets and italic emphasis display cleanly', () => {
  const formatted = formatAIChatMessage('* **VAPT**\n  * *Pengujian jaringan*\n- SOC/MDR');
  assert.equal(asText(formatted), '• VAPT\n  • Pengujian jaringan\n- SOC/MDR');
  assert.deepEqual(formatted.filter(s => s.format === 'italic').map(s => s.text), ['Pengujian jaringan']);
});

test('literal multiplication and technical wildcards remain unchanged', () => {
  const text = 'Margin = 2 * 3; glob: src/*/route.ts; 100 * 2 * 3.';
  assert.equal(asText(formatAIChatMessage(text)), text);
  assert.equal(asText(formatAIChatMessage('')), '');
});

test('unbalanced Markdown is not blindly deleted and model HTML remains plain text', () => {
  assert.equal(asText(formatAIChatMessage('**Judul belum selesai')), '**Judul belum selesai');
  assert.equal(asText(formatAIChatMessage('<script>alert("x")</script>')), '<script>alert("x")</script>');
  const component = fs.readFileSync(path.join(__dirname, '../src/components/layout/Navbar.tsx'), 'utf8');
  assert.match(component, /formatAIChatMessage\(msg\.text\)/);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
});
