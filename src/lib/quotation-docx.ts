import type { Proposal, ProposalLineItem } from './types';

/**
 * Word quotation layouts based on the three approved reference document structures:
 * mobile-only pentest, multi-asset VAPT, and managed SOC.
 * Deliberately never treats the sample customers' SLAs, staffing, tax rate or pricing as defaults.
 */
export type QuotationFormat = 'auto' | 'mobile' | 'vapt' | 'soc';
export type QuotationDetails = {
  endUser?: string;
  methodology?: string;
  technicalPlatform?: string;
  scope?: string;
  assets?: string;
  logSources?: string;
  serviceLevels?: string;
  rules?: string;
  team?: string;
  deliverables?: string;
  terms?: string;
  paymentNotes?: string;
  exclusions?: string;
};

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const UNKNOWN = '[Belum diisi - memerlukan konfirmasi PIC/Pre-Sales]';

export function resolveQuotationFormat(proposal: Proposal, format: QuotationFormat = 'auto'): Exclude<QuotationFormat, 'auto'> {
  if (format !== 'auto') return format;
  const items = Array.isArray(proposal.line_items) ? proposal.line_items : [];
  const text = (proposal.opportunity_name + ' ' + items.map(item => item.description).join(' ')).toLowerCase();
  if (items.some(item => item.service_type === 'SOC') || /\b(soc|mdr|security monitoring|managed detection)\b/i.test(text)) return 'soc';
  const vaptItems = items.filter(item => item.service_type === 'VAPT');
  if (vaptItems.length === items.length && items.length > 0 &&
      /mobile|android|ios|apk|ipa/i.test(text) && !/\b(web|internet banking|website|api|network|domain)\b/i.test(text)) return 'mobile';
  return 'vapt';
}

export function quotationPillar(proposal: Proposal): string {
  const service = proposal.line_items[0]?.service_type;
  switch (service) {
    case 'VAPT': return 'Offensive Cybersecurity';
    case 'SOC':
    case 'CTI':
    case 'Hardening':
    case 'IR': return 'Defensive Cybersecurity';
    case 'PDP':
    case 'ISO': return 'Cybersecurity Governance';
    default: {
      const text = proposal.opportunity_name.toLowerCase();
      return /license|subscription|siem|edr|software|platform|technology/.test(text)
        ? 'Cybersecurity Technology' : 'Cybersecurity Professional Services';
    }
  }
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function clean(value: unknown): string {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}
function money(value: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
function date(value: string): string {
  const n = Date.parse(value && value.length === 10 ? value + 'T12:00:00Z' : value);
  return Number.isNaN(n) ? UNKNOWN : new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(new Date(n));
}

type POpts = { bold?: boolean; size?: number; color?: string; align?: 'left'|'right'|'center'; after?: number; before?: number; breakBefore?: boolean };
function p(value: unknown, opts: POpts = {}): string {
  const v = esc(clean(value));
  const pr = '<w:pPr>' + (opts.align ? '<w:jc w:val="' + opts.align + '"/>' : '') +
    (opts.breakBefore ? '<w:pageBreakBefore/>' : '') +
    '<w:spacing w:before="' + (opts.before ?? 0) + '" w:after="' + (opts.after ?? 105) + '" w:line="275" w:lineRule="auto"/></w:pPr>';
  const rp = '<w:rPr>' + (opts.bold ? '<w:b/>' : '') +
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri"/>' +
    '<w:sz w:val="' + (opts.size ?? 19) + '"/>' +
    (opts.color ? '<w:color w:val="' + opts.color + '"/>' : '') + '</w:rPr>';
  return '<w:p>' + pr + '<w:r>' + rp + '<w:t xml:space="preserve">' + (v || ' ') + '</w:t></w:r></w:p>';
}
function bulletLines(value: string | undefined, fallback: string): string {
  const lines = clean(value).split(/\r?\n/).map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  return lines.length ? lines.map(x => p('• ' + x, { after: 48 })).join('') : p(fallback, { color: '965100', after: 75 });
}
function heading(text: string): string {
  return p(text, { bold: true, size: 21, color: '452375', before: 210, after: 80 });
}
function cell(value: unknown, width: number, header = false, bold = false): string {
  const shade = header ? '<w:shd w:fill="63369B"/>' : '';
  const textColor = header ? 'FFFFFF' : '222222';
  return '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/><w:tcBorders><w:bottom w:val="single" w:sz="4" w:color="B8B8B8"/></w:tcBorders>' + shade + '</w:tcPr>' +
    p(value, { bold: header || bold, color: textColor, size: 17, after: 40 }) + '</w:tc>';
}
function table(rows: Array<Array<string | number>>, widths: number[], header = true): string {
  return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="5"/><w:bottom w:val="single" w:sz="5"/><w:left w:val="single" w:sz="5"/><w:right w:val="single" w:sz="5"/></w:tblBorders></w:tblPr><w:tblGrid>' +
    widths.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>' +
    rows.map((row, idx) => '<w:tr>' + row.map((v, i) => cell(v, widths[i], header && idx === 0, !header && idx === rows.length - 1)).join('') + '</w:tr>').join('') + '</w:tbl>';
}
function page(): string { return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }
function brand(): string {
  const left = p('DEFENDIT360', { bold: true, size: 33, color: '572A89', after: 15 }) +
    p('member of XLSMART', { bold: true, size: 16, color: '394A8C', after: 10 });
  const right = p('PT. DATA ENKRIPSI INFORMASI TEKNOLOGI', { bold: true, size: 14, align: 'right', after: 4 }) +
    p('Head Office', { bold: true, size: 13, align: 'right', after: 3 }) +
    p('Sudirman 7.8, Tower 1, Lt. 27', { size: 13, align: 'right', after: 3 }) +
    p('Jl. Jenderal Sudirman No. 10', { size: 13, align: 'right', after: 3 }) +
    p('Karet Tengsin, Jakarta - 10220', { size: 13, align: 'right', after: 3 }) +
    p('info@defendit360.co.id | www.defendit360.co.id', { size: 12, align: 'right', after: 0 });
  const block = (content: string, width: number) => '<w:tc><w:tcPr><w:tcW w:w="' + width +
    '" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>' + content + '</w:tc>';
  return '<w:tbl><w:tblPr><w:tblW w:w="10100" w:type="dxa"/>' +
    '<w:tblBorders><w:top w:val="nil"/><w:bottom w:val="nil"/>' +
    '<w:left w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="5000"/><w:gridCol w:w="5100"/></w:tblGrid>' +
    '<w:tr>' + block(left, 5000) + block(right, 5100) + '</w:tr></w:tbl>' + p(' ', { after: 120 });
}

function validate(proposal: Proposal): void {
  if (!proposal || !Array.isArray(proposal.line_items) || proposal.line_items.length === 0) {
    throw new Error('Quotation memerlukan minimal satu baris layanan.');
  }
  if (!clean(proposal.company_name) || !clean(proposal.opportunity_name)) {
    throw new Error('Nama klien dan nama proyek wajib diisi.');
  }
  const amounts = [proposal.subtotal, proposal.vat_amount, proposal.grand_total];
  if (amounts.some(x => !Number.isFinite(x) || x < 0)) throw new Error('Nominal proposal tidak valid.');
  if (proposal.line_items.some(x => !Number.isFinite(x.quantity) || x.quantity < 0 ||
      !Number.isFinite(x.line_total) || x.line_total < 0 || !Number.isFinite(x.unit_price) || x.unit_price < 0)) {
    throw new Error('Ada quantity atau harga detail yang tidak valid.');
  }
}
function productName(fmt: 'mobile'|'vapt'|'soc', proposal: Proposal): string {
  if (fmt === 'soc') return 'Managed SOC / Managed Cybersecurity Service';
  if (fmt === 'mobile') return 'Mobile Application Penetration Testing';
  return quotationPillar(proposal) + ' - ' + proposal.opportunity_name;
}
function lineTable(items: ProposalLineItem[]): string {
  const rows: Array<Array<string | number>> = [['Product / Layanan', 'Qty', 'Harga Satuan', 'Total Harga']];
  items.forEach(item => rows.push([clean(item.description), clean(item.quantity) + ' ' + clean(item.unit),
    money(item.unit_price), money(item.line_total)]));
  return table(rows, [4560, 1310, 2080, 2150]);
}
function amountTable(prop: Proposal): string {
  const rate = prop.subtotal > 0 ? (prop.vat_amount / prop.subtotal * 100).toFixed(2).replace(/\.00$/, '') : UNKNOWN;
  return table([['Keterangan', 'Nominal'],
    ['Subtotal sebelum pajak', money(prop.subtotal)],
    ['PPN (' + rate + '% - berdasarkan nominal proposal)', money(prop.vat_amount)],
    ['Total penawaran', money(prop.grand_total)]], [7050, 3050]);
}
function paymentText(terms: string): string {
  const values: Record<string,string> = {
    '50-50': 'Termin 1: 50%; Termin 2: 50%. Milestone penagihan dikonfirmasi di PO/kontrak.',
    '30-50-20': 'Termin 1: 30%; Termin 2: 50%; Termin 3: 20%. Milestone penagihan dikonfirmasi di PO/kontrak.',
    '30-60-10': 'Termin 1: 30%; Termin 2: 60%; Termin 3: 10%. Milestone penagihan dikonfirmasi di PO/kontrak.',
    '100': 'Satu termin: 100%. Milestone penagihan dikonfirmasi di PO/kontrak.',
  };
  return values[terms] || UNKNOWN;
}

function docXml(prop: Proposal, fmt: 'mobile'|'vapt'|'soc', details: QuotationDetails): string {
  const pillar = quotationPillar(prop);
  const notes = 'DRAFT UNTUK VERIFIKASI - bukan quotation yang telah ditandatangani / diotorisasi.';
  const amountMismatch = Math.abs(prop.line_items.reduce((a, x) => a + x.line_total, 0) - prop.subtotal) > 1;
  const totalMismatch = Math.abs((prop.subtotal + prop.vat_amount) - prop.grand_total) > 1;
  const subject = productName(fmt, prop);
  let body = brand() +
    p('No             : ' + (clean(prop.quotation_number) || UNKNOWN), { after: 15 }) +
    p('Tanggal     : ' + date(prop.created_at), { after: 15 }) +
    p('Perihal      : Quotation - ' + subject, { after: 15 }) +
    p('To              : ' + clean(prop.company_name), { after: 15 }) +
    p('End User   : ' + (clean(details.endUser) || clean(prop.company_name)), { after: 250 }) +
    p('Kepada Yth.', { after: 25 }) +
    p('Bapak/Ibu Pimpinan', { bold: true, after: 25 }) +
    p(prop.company_name, { bold: true, after: 25 }) +
    p('Di tempat', { after: 200 }) +
    p('Perihal: Penawaran Harga ' + prop.opportunity_name, { bold: true, after: 200 }) +
    p('Terima kasih atas kesempatan yang diberikan kepada PT Data Enkripsi Informasi Teknologi (DefendIT360) untuk menyampaikan penawaran atas pekerjaan ' +
      prop.opportunity_name + ' dalam kelompok layanan ' + pillar + '.', { after: 160 }) +
    p('Berdasarkan rincian komersial dalam proposal terpilih, nilai penawaran adalah ' + money(prop.subtotal) +
      ' sebelum PPN dengan total termasuk PPN sebesar ' + money(prop.grand_total) + '.', { after: 140 }) +
    p('Penawaran berlaku ' + prop.valid_days + ' hari kalender; tanggal berakhir: ' + date(prop.valid_until) + '.', { after: 160 }) +
    p('Ruang lingkup, hasil pekerjaan, ketentuan pembayaran, penggunaan platform pihak ketiga, dan pengecualian hanya mengikat setelah dikonfirmasi serta disetujui para pihak.', { after: 150 }) +
    p(notes, { bold: true, color: '9A5311', after: 270 }) +
    p('Salam Hormat,', { after: 240 }) +
    p('Maria Hayu Utaminingtyas', { bold: true, after: 20 }) +
    p('Account Manager | DefendIT360', { after: 0 });

  body += page() + brand() +
    p('RINCIAN HARGA PENAWARAN', { bold: true, size: 25, align: 'center', after: 80 }) +
    p(subject, { size: 19, bold: true, align: 'center', after: 110 }) +
    lineTable(prop.line_items) +
    amountTable(prop);
  if (amountMismatch) body += p('PERLU REKONSILIASI: jumlah line item tidak sama dengan subtotal proposal.', { bold: true, color: 'A00000' });
  if (totalMismatch) body += p('PERLU REKONSILIASI: subtotal + PPN tidak sama dengan grand total proposal.', { bold: true, color: 'A00000' });
  body += heading('Scope of Work') +
    bulletLines(details.scope, 'Berdasarkan line item di atas. Detail target, jumlah aset, lingkungan pengujian dan deliverable harus disetujui pada SOW.') +
    heading(fmt === 'soc' ? 'Platform & Integrasi' : 'Metode / Standar Teknis') +
    bulletLines(details.technicalPlatform || details.methodology,
      fmt === 'soc' ? 'Platform SIEM/EDR, lisensi, sumber log, retensi, dan tanggung jawab penyediaan belum dikonfirmasi.' :
        'Metode Blackbox/Grey Box/Whitebox, acuan pengujian, re-test, dan durasi belum dikonfirmasi.') +
    heading(fmt === 'soc' ? 'Log Source dalam Lingkup' : 'Daftar Aset dalam Lingkup') +
    bulletLines(fmt === 'soc' ? details.logSources : details.assets,
      'Identitas aset, jumlah, endpoint, volume, IP/domain, dan lingkungan pelaksanaan belum tersedia di proposal.') +
    heading('Deliverables') +
    bulletLines(details.deliverables, 'Hasil pekerjaan dan bentuk laporan perlu ditetapkan dalam SOW final.');

  body += page() + brand();
  if (fmt === 'soc') {
    body += heading('Service Level Objective / SLA') +
      bulletLines(details.serviceLevels, 'Severity, time-to-acknowledge, time-to-escalate, jam layanan, target ketersediaan dan batas kewajiban belum disepakati.');
  } else {
    body += heading('Rules of Engagement') +
      bulletLines(details.rules, 'Batas pengujian, persetujuan testing production, pengelolaan data, tindakan terlarang, serta eskalasi critical finding harus ditentukan sebelum eksekusi.');
  }
  body += heading('Struktur Tim Pelaksana') +
    bulletLines(details.team, 'Susunan dan jumlah personel termasuk PM, lead, specialist, serta QA/Technical Writer dikonfirmasi berdasarkan kapasitas proyek.') +
    heading('General Terms & Conditions') +
    bulletLines(details.terms, 'Ketentuan kontrak, pajak, masa berlaku, TOP, penalti, dan perubahan lingkup perlu ditinjau Legal/Finance sebelum diterbitkan.') +
    heading('Term of Payments') +
    p(paymentText(prop.payment_terms), { after: 65 }) +
    bulletLines(details.paymentNotes, 'Trigger invoice, BAST, dan jadwal penagihan belum dicantumkan secara spesifik.') +
    heading('Exclusions / Asumsi') +
    bulletLines(details.exclusions, 'Pekerjaan dan lisensi di luar line item serta rincian Scope of Work belum termasuk sampai disetujui tertulis.') +
    heading('Dokumen yang Diperlukan') +
    bulletLines(undefined, 'Dokumen administrasi dan NDA disepakati dengan Procurement/Legal pelanggan sesuai kebutuhan.') +
    p('Untuk klarifikasi dan konfirmasi, silakan hubungi info@defendit360.co.id.', { after: 200 }) +
    p(notes, { bold: true, color: '9A5311' });

  const section = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="700" w:right="900" w:bottom="700" w:left="900" w:header="350" w:footer="350"/></w:sectPr>';
  return XML + '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + section + '</w:body></w:document>';
}

function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let j = 0; j < bytes.length; j++) {
    c ^= bytes[j];
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xEDB88320 : 0);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function zip(entries: Array<[string, string]>): Uint8Array {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const n = encoder.encode(name), data = encoder.encode(text), crc = crc32(data);
    const l = new Uint8Array(30 + n.length + data.length), ld = new DataView(l.buffer);
    ld.setUint32(0, 0x04034B50, true);
    ld.setUint16(4, 20, true);
    ld.setUint32(14, crc, true);
    ld.setUint32(18, data.length, true);
    ld.setUint32(22, data.length, true);
    ld.setUint16(26, n.length, true);
    l.set(n, 30); l.set(data, 30 + n.length);
    const c = new Uint8Array(46 + n.length), cd = new DataView(c.buffer);
    cd.setUint32(0, 0x02014B50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, n.length, true);
    cd.setUint32(42, offset, true);
    c.set(n, 46);
    local.push(l); central.push(c); offset += l.length;
  }
  const directorySize = central.reduce((a, b) => a + b.length, 0);
  const e = new Uint8Array(22), ed = new DataView(e.buffer);
  ed.setUint32(0, 0x06054B50, true);
  ed.setUint16(8, central.length, true);
  ed.setUint16(10, central.length, true);
  ed.setUint32(12, directorySize, true);
  ed.setUint32(16, offset, true);
  const output = new Uint8Array(offset + directorySize + 22);
  let pos = 0;
  for (const chunk of [...local, ...central, e]) { output.set(chunk, pos); pos += chunk.length; }
  return output;
}

export function createQuotationDocx(proposal: Proposal, selected: QuotationFormat = 'auto', details: QuotationDetails = {}): Uint8Array {
  validate(proposal);
  const fmt = resolveQuotationFormat(proposal, selected);
  const contents = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';
  const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  return zip([
    ['[Content_Types].xml', XML + contents],
    ['_rels/.rels', XML + rels],
    ['word/document.xml', docXml(proposal, fmt, details)],
  ]);
}

export function downloadQuotationDocx(proposal: Proposal, selected: QuotationFormat = 'auto', details: QuotationDetails = {}): void {
  const bytes = createQuotationDocx(proposal, selected, details);
  const safeName = (proposal.quotation_number || 'draft').replace(/[^a-z0-9_-]/gi, '-').slice(0, 60);
  const format = resolveQuotationFormat(proposal, selected).toUpperCase();
  const view = new Uint8Array(bytes.length);
  view.set(bytes);
  const url = URL.createObjectURL(new Blob([view.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'INDIA_DefendIT360_Quotation_' + format + '_' + safeName + '.docx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
