import JSZip from 'jszip';
import { extractText, getDocumentProxy } from 'unpdf';

export const MAX_SCOPING_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_SCOPING_TEXT_CHARS = 60_000;
const MAX_DOCX_XML_BYTES = 4 * 1024 * 1024;
const MAX_PDF_PAGES = 50;

export type ScopingDocumentFormat = 'PDF' | 'DOCX' | 'TXT';
export type ScopingDocumentResult = {
  text: string;
  format: ScopingDocumentFormat;
  pages?: number;
  truncated: boolean;
};

/** Deliberately no document persistence. All parsing happens in a single request. */
export async function extractScopingDocument(file: File): Promise<ScopingDocumentResult> {
  const filename = file.name.toLowerCase();
  const extension = filename.slice(filename.lastIndexOf('.') + 1);
  if (!['pdf', 'docx', 'txt'].includes(extension)) {
    throw new Error('Format tidak didukung. Gunakan PDF, DOCX, atau TXT.');
  }
  if (file.size === 0) throw new Error('File kosong.');
  if (file.size > MAX_SCOPING_FILE_BYTES) throw new Error('Maksimum ukuran file 8 MB.');

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = '';
  let pages: number | undefined;
  let format: ScopingDocumentFormat;

  if (extension === 'pdf') {
    format = 'PDF';
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
      throw new Error('Isi file tidak sesuai format PDF.');
    }
    const pdf = await getDocumentProxy(bytes, { maxImageSize: 16_777_216 });
    try {
      if (pdf.numPages > MAX_PDF_PAGES) throw new Error('PDF melebihi 50 halaman. Pisahkan dokumen sebelum diunggah.');
      pages = pdf.numPages;
      const parsed = await extractText(pdf, { mergePages: true });
      text = parsed.text;
    } finally {
      await (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
    }
  } else if (extension === 'docx') {
    format = 'DOCX';
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new Error('Isi file tidak sesuai format DOCX.');
    }
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('File DOCX tidak berisi dokumen Word yang valid.');
    const declaredSize = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (declaredSize !== undefined && declaredSize > MAX_DOCX_XML_BYTES) {
      throw new Error('Isi DOCX terlalu besar untuk diproses.');
    }
    const xml = await entry.async('string');
    if (xml.length > MAX_DOCX_XML_BYTES) throw new Error('Isi DOCX terlalu besar untuk diproses.');
    text = extractWordXmlText(xml);
  } else {
    format = 'TXT';
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw new Error('TXT harus berupa teks UTF-8, bukan file biner.');
  }

  text = text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  if (!text) throw new Error('Tidak ditemukan teks. Untuk PDF hasil scan, gunakan dokumen dengan teks atau OCR terlebih dahulu.');
  const truncated = text.length > MAX_SCOPING_TEXT_CHARS;
  return { text: text.slice(0, MAX_SCOPING_TEXT_CHARS), format, pages, truncated };
}

function unescapeXml(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : '';
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[entity] || match;
  });
}

export function extractWordXmlText(xml: string): string {
  const paragraphs = xml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  return paragraphs.map(paragraph => {
    // Keep explicit Word line breaks and tabs in reading order.
    return unescapeXml(paragraph
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g, '$1')
      .replace(/<[^>]+>/g, ''));
  }).join('\n').trim();
}
