import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { extractScopingDocument, MAX_SCOPING_FILE_BYTES } from '@/lib/scoping-upload';

export const runtime = 'edge';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders });

export async function POST(req: Request) {
  const auth = await authorizeBoQ(req);
  if (!auth.ok) return auth.response;
  if (!['admin', 'sales', 'presales'].includes(auth.identity.role)) {
    return json({ success: false, message: 'Hanya Admin, Sales, dan Pre-Sales yang dapat mengunggah dokumen.' }, 403);
  }
  const origin = req.headers.get('origin');
  if ((origin && origin !== new URL(req.url).origin) ||
      req.headers.get('x-india-document-upload') !== '1') {
    return json({ success: false, message: 'Asal permintaan upload tidak diizinkan.' }, 403);
  }
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    return json({ success: false, message: 'Kirim dokumen menggunakan multipart/form-data.' }, 415);
  }
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_SCOPING_FILE_BYTES + 4096) {
    return json({ success: false, message: 'Maksimum ukuran file 8 MB.' }, 413);
  }
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return json({ success: false, message: 'Pilih file RKS/KAK terlebih dahulu.' }, 400);
    const result = await extractScopingDocument(file);
    return json({
      success: true,
      filename: file.name.slice(0, 160),
      bytes: file.size,
      ...result,
      message: result.truncated
        ? 'Teks melebihi 60.000 karakter. Periksa kelengkapannya sebelum dianalisis.'
        : 'Teks berhasil dibaca. Tinjau dahulu sebelum menggunakan AI.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dokumen gagal dibaca.';
    if (/8 MB|ukuran file/i.test(message)) return json({ success: false, message }, 413);
    if (/Format tidak didukung/i.test(message)) return json({ success: false, message }, 415);
    if (/PDF melebihi|DOCX terlalu besar/i.test(message)) return json({ success: false, message }, 422);
    if (/File kosong|PDF|DOCX|TXT|OCR|teks|format/i.test(message)) return json({ success: false, message }, 422);
    return json({ success: false, message: 'Dokumen tidak dapat diproses. Periksa bahwa file tidak rusak atau terkunci.' }, 422);
  }
}
