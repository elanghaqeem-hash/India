const test = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const JSZip = require('jszip');
const { readFileSync } = require('node:fs');

const root = join(__dirname, '..');
const source = path => readFileSync(join(root, path), 'utf8');
async function scoping() {
  return import(pathToFileURL(join(root, 'src/lib/scoping-upload.ts')).href);
}

test('DOCX parser preserves paragraphs and decodes XML entities', async () => {
  const { extractWordXmlText } = await scoping();
  const xml = '<w:document><w:body><w:p><w:r><w:t>30 API &amp; 12 roles</w:t></w:r></w:p><w:p><w:r><w:t>Grey-Box</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(extractWordXmlText(xml), '30 API & 12 roles\nGrey-Box');
});

test('mobile file selection accepts real DOCX filenames independent of reported MIME', async () => {
  const { isSupportedScopingFileName } = await import(pathToFileURL(join(root, 'src/lib/scoping-file-types.ts')).href);
  for (const filename of ['RKS Klien.docx', 'KAK FINAL.DOCX', 'RKS.pdf', 'dokumen.TXT']) {
    assert.equal(isSupportedScopingFileName(filename), true, filename);
  }
  for (const filename of ['RKS.doc', 'KAK.docx.zip', 'file.exe', 'no-extension']) {
    assert.equal(isSupportedScopingFileName(filename), false, filename);
  }
  const page = source('src/app/scoping/page.tsx');
  assert.match(page, /isSupportedScopingFileName\(file\.name\)/);
  assert.match(page, /const api = numberFrom\(\/\(\\d\+\)\\s\*api/);
});

test('TXT upload returns real user text without storage', async () => {
  const { extractScopingDocument } = await scoping();
  const result = await extractScopingDocument(new File(['RKS VAPT\n30 API endpoints'], 'requirements.txt', { type: 'text/plain' }));
  assert.equal(result.format, 'TXT');
  assert.equal(result.text, 'RKS VAPT\n30 API endpoints');
  assert.equal(result.truncated, false);
});

test('DOCX upload extracts source paragraphs', async () => {
  const { extractScopingDocument } = await scoping();
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types />');
  zip.file('word/document.xml', '<w:document><w:body><w:p><w:r><w:t>25 servers</w:t></w:r></w:p></w:body></w:document>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const result = await extractScopingDocument(new File([bytes], 'KAK.docx'));
  assert.equal(result.format, 'DOCX');
  assert.equal(result.text, '25 servers');
  const mobileResult = await extractScopingDocument(new File([bytes], 'KAK FINAL.DOCX', { type: 'application/octet-stream' }));
  assert.equal(mobileResult.format, 'DOCX');
  assert.equal(mobileResult.text, '25 servers');
});

test('invalid extension, fake PDF and too-large uploads fail closed', async () => {
  const { extractScopingDocument, MAX_SCOPING_FILE_BYTES } = await scoping();
  await assert.rejects(extractScopingDocument(new File(['abc'], 'requirements.exe')), /Format tidak didukung/);
  await assert.rejects(extractScopingDocument(new File(['not a pdf'], 'RKS.pdf')), /Isi file tidak sesuai format PDF/);
  await assert.rejects(extractScopingDocument(new File(['x'.repeat(MAX_SCOPING_FILE_BYTES + 1)], 'KAK.txt')), /8 MB/);
});

test('upload and AI endpoints enforce access, origin and consent UI', () => {
  const route = source('src/app/api/scoping/upload/route.ts');
  const ai = source('src/app/api/ai/generate/route.ts');
  const page = source('src/app/scoping/page.tsx');
  const middleware = source('src/middleware.ts');
  assert.match(route, /authorizeBoQ\(req\)/);
  assert.match(route, /x-india-document-upload/);
  assert.match(middleware, /api\/scoping\/upload/);
  assert.match(ai, /auth\.identity\.role!=='admin'/);
  assert.match(ai, /maxChars/);
  assert.match(page, /aiConsent/);
  assert.match(page, /type="file"/);
  assert.match(page, /\.pdf,\.docx,\.txt/);
  assert.match(page, /x-india-ai-admin/);
});
