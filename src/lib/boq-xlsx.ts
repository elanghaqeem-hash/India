/**
 * DefendIT360 BoQ exports: three XLSX workbooks (internal, onsite, customer).
 * Self-contained Office Open XML writer, no additional dependencies.
 *
 * Important: Internal costs are only read from a PricingSession linked to the
 * same opportunity. Missing costs are left blank, NEVER synthesized.
 * Do not expose internal workbooks without an authenticated finance/RBAC gate
 * when the application has real customer/financial data.
 */
import type { Proposal, PricingSession } from './types';

export type BoQExportFormat = 'standard' | 'onsite' | 'customer';
type Cell = string | number | null | { formula: string };
type Sheet = { name: string; rows: Cell[][]; headers?: number[]; freeze?: number };

const f = (formula: string): Cell => ({ formula });
const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const safeText = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, 2400);
const col = (n: number): string => {
  let result = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) result = String.fromCharCode(65 + ((x - 1) % 26)) + result;
  return result;
};
const money = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null);
const pad = (rows: Cell[][], targetRow: number) => { while (rows.length < targetRow) rows.push([]); };
const push = (rows: Cell[][], cells: Cell[]) => { rows.push(cells); return rows.length; };

const PRODUCT_CATALOG: ReadonlyArray<readonly [string, string, string]> = [
  ['VAPT', 'Web Application Penetration Testing', 'Aplikasi'],
  ['VAPT', 'Mobile Application Penetration Testing (Android)', 'Aplikasi'],
  ['VAPT', 'Mobile Application Penetration Testing (iOS)', 'Aplikasi'],
  ['VAPT', 'API Security Testing', 'Endpoint'],
  ['VAPT', 'Network / Infrastructure VAPT', 'IP/Host'],
  ['VAPT', 'Cloud Security Assessment', 'Lot'],
  ['VAPT', 'Red Team / Source Code Review', 'Lot'],
  ['SOC', 'Managed SOC / MDR Subscription', 'Bulan'],
  ['SOC', 'SOC Onboarding / FortiSIEM Integration', 'Lot'],
  ['SOC', 'SIEM Rules / Use Case Engineering', 'Use Case'],
  ['SOC', 'Threat Hunting & Incident Monitoring', 'Bulan'],
  ['SOC', 'ACT Pro Platform Services (SKU konfirmasi)', 'Lisensi'],
  ['SOC', 'FortiSIEM License / Subscription (SKU konfirmasi)', 'Lisensi'],
  ['SOC', 'EDR / XDR Technology (Brand/SKU konfirmasi)', 'Endpoint'],
  ['CTI', 'Cyber Threat Intelligence Feed', 'Bulan'],
  ['CTI', 'Attack Surface / Domain Risk Scorecard', 'Domain'],
  ['ISO', 'ISO 27001 Gap Assessment / Implementation', 'Lot'],
  ['PDP', 'UU PDP Readiness / ROPA / DPIA / DPO', 'Lot'],
  ['Hardening', 'System / Server / Network Hardening', 'Aset'],
  ['IR', 'Incident Response Retainer / DFIR', 'Case'],
  ['Lainnya', 'BCM / BCP / DRP / IT Audit', 'Lot'],
  ['Lainnya', 'Cybersecurity Awareness / Training', 'Sesi'],
  ['Lainnya', 'Project Manager', 'MD'],
  ['Lainnya', 'Lead Specialist / Pentester', 'MD'],
  ['Lainnya', 'Senior Specialist / Pentester', 'MD'],
  ['Lainnya', 'SOC Analyst L1 / L2', 'MD'],
  ['Lainnya', 'CTI / GRC Consultant', 'MD'],
  ['Lainnya', 'QA / Technical Writer / Reporting', 'MD'],
];

function makeInternal(proposal: Proposal, pricing: PricingSession | undefined, onsite: boolean): Sheet[] {
  const b: Cell[][] = [
    ['DEFENDIT360 | BoQ INTERNAL - ' + (onsite ? 'ONSITE' : 'STANDARD')],
    ['RAHASIA INTERNAL - tidak untuk pelanggan. HPP tanpa bukti pricing tidak diisi.'],
    ['Klien: ' + safeText(proposal.company_name) + ' | ' + safeText(proposal.opportunity_name)],
    ['No Quotation: ' + safeText(proposal.quotation_number) + ' | Versi ' + proposal.version],
    ['Volume dan harga jual dari proposal terpilih. Semua tambahan katalog = 0 (belum dipesan).'],
    [],
    [],
    ['No', 'Uraian Produk / Layanan', 'Unit', 'Volume', 'Harga Jual/Sat', 'HPP/Sat', 'Harga Jual', 'HPP', 'GP', 'GP %', 'Jenis'],
  ];
  for (const item of proposal.line_items.slice(0, 100)) {
    const r = b.length + 1;
    push(b, [
      item.line_number, safeText(item.description), safeText(item.unit), money(item.quantity),
      money(item.unit_price), null, f('D' + r + '*E' + r),
      f('IF(F' + r + '="","",D' + r + '*F' + r + ')'),
      f('IF(OR(G' + r + '="",H' + r + '=""),"",G' + r + '-H' + r + ')'),
      f('IFERROR(I' + r + '/G' + r + ',"")'), item.service_type,
    ]);
  }
  for (const [type, label, unit] of PRODUCT_CATALOG) {
    const r = b.length + 1;
    push(b, [type, label, unit, 0, null, null,
      f('IF(OR(D' + r + '=0,E' + r + '=""),"",D' + r + '*E' + r + ')'),
      f('IF(OR(D' + r + '=0,F' + r + '=""),"",D' + r + '*F' + r + ')'),
      f('IF(OR(G' + r + '="",H' + r + '=""),"",G' + r + '-H' + r + ')'),
      f('IFERROR(I' + r + '/G' + r + ',"")'), 'Katalog - tidak aktif']);
  }
  const costBegin = b.length + 3;
  pad(b, costBegin - 1);
  push(b, ['BIAYA', 'Komponen HPP dari Pricing Session terkait', null, null, null, null, null, null, null, null, 'INTERNAL']);
  const costs: Array<readonly [string, number | undefined]> = [
    ['A - HR / Specialist & Technical Writer', pricing?.boq.component_a_total],
    ['B - Sales / Partner Commission', pricing?.boq.component_b_total],
    ['C - Deliverables / Documentation', pricing?.boq.component_c_total],
    ['D - Tools / Vendor / Subcontractor', pricing?.boq.component_d_total],
    ['E - Travel & Accommodation', pricing?.boq.component_e_total],
  ];
  for (const [name, value] of costs) {
    push(b, ['', name, 'Lot', 1, null, money(value), null, money(value), null, null, 'HPP aggregate; belum dialokasikan ke SKU']);
  }
  const total = b.length + 2;
  pad(b, total - 1);
  push(b, ['', 'TOTAL PROYEK (sebelum PPN)', null,
    f('SUMIF(C9:C' + (costBegin - 1) + ',"MD",D9:D' + (costBegin - 1) + ')'),
    null, null,
    f('SUM(G9:G' + (total - 1) + ')'),
    f('IF(COUNT(H' + (costBegin + 1) + ':H' + (costBegin + 5) + ')>0,SUM(H' + (costBegin + 1) + ':H' + (costBegin + 5) + '),IF(COUNT(H9:H' + (costBegin - 1) + ')>0,SUM(H9:H' + (costBegin - 1) + '),""))'),
    f('IF(H' + total + '="","",G' + total + '-H' + total + ')'),
    f('IFERROR(I' + total + '/G' + total + ',"")'),
    pricing ? 'HPP agregat terhubung' : 'BELUM ADA HPP TERVERIFIKASI']);
  push(b, ['', 'PPN', null, null, null, null, f('G' + total + '*Parameter!C9')]);
  push(b, ['', 'TOTAL TERMASUK PPN', null, null, null, null, f('G' + total + '+G' + (total + 1))]);
  push(b, ['', 'VALIDASI: Harga/HPP/lingkup/otorisasi harus diperiksa sebelum dokumen digunakan.']);

  const gross = f('IF(\'BoQ Internal\'!I' + total + '="","",\'BoQ Internal\'!I' + total + ')');
  const summary: Cell[][] = [
    ['DEFENDIT360 | RINGKASAN PROFITABILITAS'],
    ['DOKUMEN INTERNAL - RAHASIA'],
    ['Klien: ' + safeText(proposal.company_name)],
    [],
    [],
    [],
    ['Indikator', 'Nilai', 'Catatan'],
    [],
    ['Revenue Excl. PPN', f("'BoQ Internal'!G" + total), 'Mengikuti proposal'],
    ['HPP total', f('IF(\'BoQ Internal\'!H' + total + '="","",\'BoQ Internal\'!H' + total + ')'), 'Kosong jika belum diisi'],
    ['Gross Profit', gross, 'Belum final sebelum approval'],
    ['Gross Profit %', f('IFERROR(B11/B9,"")'), 'Guardrail margin'],
    ['Mandays', f("'BoQ Internal'!D" + total), 'MD yang tercantum dalam proposal'],
    ['Floor (HPP/0,8)', pricing ? f('IFERROR(B10/Parameter!C11,0)') : null],
    ['Standard price', pricing ? f('B14*Parameter!C12') : null],
    ['Premium price', pricing ? f('B15*Parameter!C13') : null],
    ['PPN', f("'BoQ Internal'!G" + (total + 1))],
    ['Grand Total', f("'BoQ Internal'!G" + (total + 2))],
    [],
    ['Status', pricing ? 'DRAFT - Periksa HPP dan approval' : 'DRAFT - HPP belum tersedia'],
  ];
  const tax = proposal.subtotal > 0 ? proposal.vat_amount / proposal.subtotal : 0;
  const terms = proposal.payment_terms === '50-50' ? [0.5, 0.5, 0] :
    proposal.payment_terms === '100' ? [1, 0, 0] :
    proposal.payment_terms === '30-60-10' ? [0.3, 0.6, 0.1] : [0.3, 0.5, 0.2];
  const params: Cell[][] = [
    ['DEFENDIT360 | PARAMETER & HARGA INTERNAL'],
    ['Nilai HPP berasal dari linked pricing session jika tersedia; parameter editable di Excel.'],
    [], [], [], [],
    ['Kode', 'Parameter', 'Nilai', 'Catatan'],
    ['PPN', 'Tarif PPN Proposal', tax, 'Diekstrak dari proposal, konfirmasi Finance'],
    ['PPN_REF', 'PPN untuk rumus BoQ', tax, 'Edit bila perlu'],
    ['PPH', 'PPh 23 (asumsi editable)', 0.02, 'Pastikan sesuai ketentuan pajak'],
    ['FLOOR', 'Pembagi harga floor', 0.8, 'Guardrail pemodelan'],
    ['TIER', 'Tier multiplier', 1, 'Pemodelan; validasi pricing'],
    ['PREMIUM', 'Multiplier premium', 1.25, 'Pemodelan; validasi pricing'],
    ['TOP', 'Jeda pembayaran (minggu)', 2, 'Asumsi dari contoh sumber'],
    ['T1', 'Termin 1', terms[0], 'Minggu invoice 1'],
    ['T2', 'Termin 2', terms[1], 'Minggu invoice 5'],
    ['T3', 'Termin 3', terms[2], 'Minggu invoice 7'],
    [],
    ['T1-WEEK', 'Minggu invoice 1', 1],
    ['T2-WEEK', 'Minggu invoice 2', 5],
    ['T3-WEEK', 'Minggu invoice 3', 7],
    [],
    ['LINKED', 'Pricing session', pricing ? pricing.id : 'BELUM ADA'],
    ['SOURCE', 'Quotation', proposal.quotation_number],
    ['COSTS', 'HPP total', pricing ? money(pricing.boq.total_internal_cost) : null],
  ];
  const scope: Cell[][] = onsite ?
    [
      ['DEFENDIT360 | RINCIAN BIAYA ONSITE'], ['Masukkan biaya aktual; biaya ini belum otomatis dibebankan tanpa approval.'],
      [], [], [], [], ['Trip', 'Kegiatan', 'Orang', 'Hari', 'Malam', 'Tiket PP/org', 'Hotel/malam', 'Perdiem/hari', 'Transport/hari', 'HPP'],
      [], [1, 'Kick-off', 0, 0, 0, null, null, null, null, f('C9*(N(F9)+E9*N(G9)+D9*(N(H9)+N(I9)))')],
      [2, 'Pelaksanaan / testing onsite', 0, 0, 0, null, null, null, null, f('C10*(N(F10)+E10*N(G10)+D10*(N(H10)+N(I10)))')],
      [3, 'UAT / re-test', 0, 0, 0, null, null, null, null, f('C11*(N(F11)+E11*N(G11)+D11*(N(H11)+N(I11)))')],
      [], ['', 'Subtotal perjalanan berdasarkan rincian trip', null, null, null, null, null, null, null, f('SUM(J9:J11)')],
      ['', 'Biaya travel dari Pricing Session (jika ada)', null, null, null, null, null, null, null, money(pricing?.boq.component_e_total)],
      ['', 'PERHATIAN: rekonsiliasi biaya perjalanan dengan HPP komponen E; jangan dihitung dua kali.'],
    ] :
    [
      ['DEFENDIT360 | LINGKUP & SIZING'], ['Lingkup aktual dari proposal, tanpa penambahan jumlah aset/endpoint yang tidak tersedia.'],
      [], [], [], [], ['No', 'Jenis Layanan', 'Uraian', 'Volume', 'Satuan'],
      ...proposal.line_items.slice(0, 100).map((x, i) => [i + 1, x.service_type, safeText(x.description), money(x.quantity), safeText(x.unit)] as Cell[]),
      [], ['Validasi', 'Jumlah EPS, endpoint, kontrak SLA, peran teknis & deliverables harus dicocokkan SOW.'],
    ];
  const allocation: Cell[][] = [
    ['DEFENDIT360 | JADWAL & ALOKASI BIAYA'], ['Isi alokasi biaya setiap komponen selama 8 minggu. Total harus 100% untuk HPP aktif.'],
    [], [], [], [], ['Komponen', 'HPP', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'Total'],
  ];
  for (let i = 0; i < costs.length; i++) {
    const row = 8 + i;
    push(allocation, [costs[i][0], money(costs[i][1]), 0, 0, 0, 0, 0, 0, 0, 0, f('SUM(C' + row + ':J' + row + ')')]);
  }
  push(allocation, ['Cek alokasi', pricing ? 'INPUT WAJIB' : 'HPP BELUM TERSEDIA']);

  const flow: Cell[][] = [
    ['DEFENDIT360 | CASH FLOW PROJECT'], ['Estimasi 8 minggu. Kas bersih belum dapat digunakan bila jadwal HPP belum diisi.'],
    [], [], [], [], ['Keterangan', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'Total'],
    [], ['Cash-in bruto (excl PPN)'], ['PPh dipotong'], ['HPP mingguan'], ['Kas bersih'], ['Kas kumulatif'],
  ];
  for (let i = 0; i < 8; i++) {
    const c = col(i + 2);
    const a = col(i + 3);
    const week = i + 1;
    const incoming = [1, 2, 3].map((idx) => 'IF(' + week + '=Parameter!C' + (18 + idx) + '+Parameter!C14,'
      + "'BoQ Internal'!G" + total + '*Parameter!C' + (14 + idx) + ',0)').join('+');
    flow[8][i + 1] = f(incoming);
    flow[9][i + 1] = f(c + '9*Parameter!C10');
    flow[10][i + 1] = pricing ? f('SUMPRODUCT(\'Jadwal & Alokasi\'!$B$8:$B$12,\'Jadwal & Alokasi\'!' + a + '8:' + a + '12)') : null;
    flow[11][i + 1] = pricing ? f(c + '9-' + c + '10-' + c + '11') : null;
    flow[12][i + 1] = pricing ? f((i === 0 ? '0' : col(i + 1) + '13') + '+' + c + '12') : null;
  }
  for (let r = 9; r <= 12; r++) flow[r - 1][9] = f('SUM(B' + r + ':I' + r + ')');

  const assumptions: Cell[][] = [
    ['DEFENDIT360 | CATATAN & KONTROL'], [],
    [], [], [], [], ['Kontrol', 'Isi'],
    ['Sumber utama', 'Data proposal terpilih di India: ' + safeText(proposal.quotation_number)],
    ['HPP', pricing ? 'Dari pricing session dengan opportunity_id yang sama.' : 'Belum ada pricing session terkait; kolom HPP sengaja kosong.'],
    ['Layanan / Katalog', 'Katalog referensi, bukan verifikasi kepemilikan lisensi/distribusi vendor.'],
    ['Vendor SKU', 'FortiSIEM, ACT Pro, EDR/XDR wajib verifikasi SKU, partner, hak jual, harga dan termin.'],
    ['Security', 'BoQ Internal hanya boleh diakses role finance/presales setelah RBAC server diterapkan.'],
    ['Pajak', 'Terapkan PPN/PPh sesuai transaksi dan yurisdiksi; angka parameter tidak menjamin kepatuhan.'],
    ['Cash Flow', 'Isi jadwal alokasi HPP agar proyeksi modal kerja benar.'],
    ['Status', 'DRAFT / REQUIRES REVIEW'],
  ];
  return [
    { name: 'Ringkasan P&L', rows: summary, headers: [7], freeze: 7 },
    { name: 'BoQ Internal', rows: b, headers: [8, total], freeze: 8 },
    { name: 'Parameter', rows: params, headers: [7], freeze: 7 },
    { name: onsite ? 'Biaya Onsite' : 'Lingkup & Sizing', rows: scope, headers: [7], freeze: 7 },
    { name: 'Jadwal & Alokasi', rows: allocation, headers: [7], freeze: 7 },
    { name: 'Cash Flow', rows: flow, headers: [7], freeze: 7 },
    { name: 'Asumsi', rows: assumptions, headers: [7], freeze: 7 },
  ];
}

function makeCustomer(proposal: Proposal): Sheet[] {
  const items = proposal.line_items.slice(0, 100);
  const tax = proposal.subtotal > 0 ? proposal.vat_amount / proposal.subtotal : 0;
  const terms = proposal.payment_terms === '50-50' ? [0.5, 0.5, 0] :
    proposal.payment_terms === '100' ? [1, 0, 0] :
    proposal.payment_terms === '30-60-10' ? [0.3, 0.6, 0.1] : [0.3, 0.5, 0.2];
  const catalogue = [...items.map(x => [x.service_type, safeText(x.description), safeText(x.unit), money(x.unit_price), money(x.quantity)] as const),
    ...PRODUCT_CATALOG.map(x => [x[0], x[1], x[2], null, 0] as const)];
  const n = catalogue.length;
  const final = 9 + n + 1;
  const optionRow = 9 + n + 8;
  const p: Cell[][] = [
    ['DEFENDIT360 | CUSTOMER PARAMETERS'], ['Only selling prices and option quantities. No HPP/margin information.'],
    [], [], [], ['Kode', 'Produk / Layanan', 'Harga per unit', 'Option 1', 'Option 2', 'Option 3', 'Satuan'],
  ];
  for (const [type, description, unit, unitPrice, quantity] of catalogue) {
    push(p, [type, description, unitPrice, 0, quantity, 0, unit]);
  }
  pad(p, optionRow - 1);
  push(p, ['Option', 'Nama Paket', null, 'Essential', 'Recommended', 'Comprehensive']);
  push(p, ['Scope', 'Pengaturan paket', null, 'Konfigurasi kosong', 'Sesuai proposal', 'Konfigurasi kosong']);
  push(p, ['PPN', 'Tarif PPN dari proposal', tax]);
  push(p, ['Status', 'Option 1/3 belum diisi; edit harga & qty dengan kewenangan yang tepat.']);
  const b: Cell[][] = [
    ['DEFENDIT360 | BILL OF QUANTITIES - CUSTOMER'],
    ['Draft Quotation; tidak memuat HPP, margin dan tarif tenaga ahli internal.'],
    ['Klien: ' + safeText(proposal.company_name) + ' | No: ' + safeText(proposal.quotation_number)],
    [], ['Paket:', f('Summary!D8')], [], [],
    ['Kode', 'Uraian Produk / Layanan', 'Qty', 'Unit', 'Unit Price (Rp)', 'Amount (Rp)', 'Kategori'],
  ];
  for (let i = 0; i < catalogue.length; i++) {
    const r = b.length + 1;
    const pr = i + 7;
    const [type, label, unit] = catalogue[i];
    push(b, [type, label, f('INDEX(Parameters!D' + pr + ':F' + pr + ',1,Summary!$C$7)'),
      unit, f('IF(Parameters!C' + pr + '="","",Parameters!C' + pr + ')'),
      f('IF(OR(C' + r + '=0,E' + r + '=""),"",C' + r + '*E' + r + ')'), type]);
  }
  pad(b, final - 1);
  push(b, ['', 'TOTAL SEBELUM PPN', null, null, null, f('SUM(F9:F' + (final - 1) + ')')]);
  push(b, ['', 'PPN', null, null, null, f('F' + final + '*Parameters!C' + (optionRow + 2))]);
  push(b, ['', 'GRAND TOTAL', null, null, null, f('F' + final + '+F' + (final + 1))]);
  push(b, ['', 'Catatan: Option 1 / Option 3 belum dikonfigurasi. Jangan terbitkan quotation Rp0.']);
  const s: Cell[][] = [
    ['DEFENDIT360 | QUOTATION & BILL OF QUANTITIES'],
    ['Draft quotation - validasi harga, pajak, scope dan approval sebelum diterbitkan.'],
    ['Provider: PT Data Enkripsi Informasi Teknologi (DefendIT360)'],
    ['Client: ' + safeText(proposal.company_name) + ' | Proyek: ' + safeText(proposal.opportunity_name)],
    ['No: ' + safeText(proposal.quotation_number) + ' | Versi ' + proposal.version],
    [],
    ['Pilihan Paket', 'Service', 'Option (1-3)', 'Nama Paket'],
    [1, 'Cybersecurity Products & Services', 2, f('INDEX(Parameters!D' + optionRow + ':F' + optionRow + ',1,C8)')],
    [],
    ['RINGKASAN', 'Nilai (Rp)', 'Catatan'],
    ['Subtotal', f("'BoQ Quotation'!F" + final), 'Sebelum PPN'],
    ['PPN', f("'BoQ Quotation'!F" + (final + 1)), 'Sesuai nilai proposal'],
    ['Grand Total', f("'BoQ Quotation'!F" + (final + 2)), 'Tidak termasuk biaya di luar scope'],
    [],
    ['TERMIN', 'Milestone', 'Portion', 'Amount (Rp)'],
    ['T1', 'Setelah PO efektif', terms[0], f('C16*B11')],
    ['T2', 'Initial delivery / report', terms[1], f('C17*B11')],
    ['T3', 'Final report / BAST', terms[2], f('C18*B11')],
    ['Kontrol', 'Total termin', f('SUM(C16:C18)'), 'Harus 100%'],
    [],
    ['SYARAT', 'SKU/kuantitas berdasarkan proposal dan SOW final; ketersediaan vendor harus dikonfirmasi.'],
    ['PERHATIAN', 'Option 1 dan 3 default kosong. Hanya Option 2 memuat kuantitas proposal terpilih.'],
    ['SECURITY', 'Dokumen ini tidak memuat informasi HPP dan margin internal.'],
  ];
  return [
    { name: 'Summary', rows: s, headers: [7, 10, 15], freeze: 7 },
    { name: 'BoQ Quotation', rows: b, headers: [8, final], freeze: 8 },
    { name: 'Parameters', rows: p, headers: [6, optionRow], freeze: 6 },
  ];
}

const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0;[Red](#,##0);-"/>'
  + '<numFmt numFmtId="165" formatCode="0.0%"/></numFmts>'
  + '<fonts count="3"><font><sz val="10"/><name val="Aptos"/></font>'
  + '<font><b/><color rgb="FFFFFFFF"/><sz val="13"/><name val="Aptos"/></font>'
  + '<font><b/><color rgb="FF15223B"/><sz val="10"/><name val="Aptos"/></font></fonts>'
  + '<fills count="4"><fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FF172554"/><bgColor indexed="64"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  + '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/>'
  + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

function sheetXml(sheet: Sheet): string {
  const headers = new Set(sheet.headers || []);
  const rows = sheet.rows.map((cells, ri) => {
    if (!cells.length) return '';
    const row = ri + 1;
    const xml = cells.map((cell, ci) => {
      if (cell === null || cell === undefined) return '';
      const ref = col(ci + 1) + row;
      const fmt = row === 1 ? 1 : headers.has(row) ? 2 : (typeof cell === 'number' || (typeof cell === 'object' && cell !== null)) ? 3 : 0;
      if (typeof cell === 'object') return '<c r="' + ref + '" s="' + fmt + '"><f>' + esc(cell.formula.replace(/^=/, '')) + '</f><v/></c>';
      if (typeof cell === 'number') return '<c r="' + ref + '" s="' + fmt + '"><v>' + (Number.isFinite(cell) ? cell : 0) + '</v></c>';
      return '<c r="' + ref + '" s="' + fmt + '" t="inlineStr"><is><t>' + esc(safeText(cell)) + '</t></is></c>';
    }).join('');
    return xml ? '<row r="' + row + '" ht="' + (row === 1 ? 34 : headers.has(row) ? 32 : 24) + '" customHeight="1">' + xml + '</row>' : '';
  }).join('');
  const maxCol = Math.max(7, ...sheet.rows.map(r => r.length));
  const widths = Array.from({ length: Math.min(maxCol, 17) }, (_, i) =>
    '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (i === 1 ? 64 : i === 0 ? 16 : 21) + '" customWidth="1"/>').join('');
  const freeze = sheet.freeze ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + sheet.freeze
    + '" topLeftCell="A' + (sheet.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + freeze + '<cols>' + widths + '</cols><sheetData>' + rows + '</sheetData></worksheet>';
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let j = 0; j < bytes.length; j++) {
    const byte = bytes[j];
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function set16(view: DataView, index: number, value: number) { view.setUint16(index, value, true); }
function set32(view: DataView, index: number, value: number) { view.setUint32(index, value >>> 0, true); }
function zip(entries: Array<[string, string]>): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const n = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const local = new Uint8Array(30 + n.length + data.length);
    const l = new DataView(local.buffer);
    set32(l, 0, 0x04034B50); set16(l, 4, 20); set16(l, 8, 0);
    set32(l, 14, crc); set32(l, 18, data.length); set32(l, 22, data.length);
    set16(l, 26, n.length); local.set(n, 30); local.set(data, 30 + n.length);
    const central = new Uint8Array(46 + n.length), c = new DataView(central.buffer);
    set32(c, 0, 0x02014B50); set16(c, 4, 20); set16(c, 6, 20);
    set32(c, 16, crc); set32(c, 20, data.length); set32(c, 24, data.length);
    set16(c, 28, n.length); set32(c, 42, offset); central.set(n, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const centralSize = centrals.reduce((sum, x) => sum + x.length, 0);
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  set32(e, 0, 0x06054B50); set16(e, 8, centrals.length); set16(e, 10, centrals.length);
  set32(e, 12, centralSize); set32(e, 16, offset);
  const all = [...locals, ...centrals, end], out = new Uint8Array(offset + centralSize + end.length);
  let pos = 0;
  for (const chunk of all) { out.set(chunk, pos); pos += chunk.length; }
  return out;
}

export function createProposalBoQ(proposal: Proposal, format: BoQExportFormat, pricing?: PricingSession): Uint8Array {
  if (!proposal || !Array.isArray(proposal.line_items)) throw new Error('Proposal tidak valid');
  const connected = pricing?.opportunity_id === proposal.opportunity_id ? pricing : undefined;
  const sheets = format === 'customer' ? makeCustomer(proposal) : makeInternal(proposal, connected, format === 'onsite');
  const workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    + ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<sheets>' + sheets.map((sheet, i) => '<sheet name="' + esc(sheet.name)
    + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('')
    + '</sheets><calcPr fullCalcOnLoad="1"/></workbook>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + sheets.map((_, i) => '<Relationship Id="rId' + (i + 1)
    + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"'
    + ' Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('')
    + '<Relationship Id="rId' + (sheets.length + 1)
    + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"'
    + ' Target="styles.xml"/></Relationships>';
  const types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1)
    + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')
    + '</Types>';
  const packageRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
    + ' Target="xl/workbook.xml"/></Relationships>';
  return zip([
    ['[Content_Types].xml', types], ['_rels/.rels', packageRels],
    ['xl/workbook.xml', workbook], ['xl/_rels/workbook.xml.rels', rels], ['xl/styles.xml', stylesXml],
    ...sheets.map((sheet, i) => ['xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sheet)] as [string, string]),
  ]);
}

export function downloadProposalBoQ(proposal: Proposal, format: BoQExportFormat, pricing?: PricingSession): void {
  const bytes = createProposalBoQ(proposal, format, pricing);
  const safe = proposal.quotation_number.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50) || 'draft';
  const file = 'India_DefendIT360_BoQ_' + format + '_' + safe + '.xlsx';
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  const url = URL.createObjectURL(new Blob([out.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const a = document.createElement('a');
  a.href = url; a.download = file;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
