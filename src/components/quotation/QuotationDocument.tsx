import React from 'react';
import type { Proposal } from '@/lib/types';
import {
  QuotationDetails, QuotationFormat, quotationPillar, resolveQuotationFormat,
} from '@/lib/quotation-docx';

type Props = {
  proposal: Proposal;
  format: QuotationFormat;
  details: QuotationDetails;
};

const fmtMoney = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(n);
const fmtDate = (value: string) => {
  const d = new Date(value && value.length === 10 ? value + 'T12:00:00Z' : value);
  return Number.isNaN(d.getTime()) ? 'Perlu dilengkapi' :
    new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(d);
};
const lines = (s?: string) => (s || '').split(/\r?\n/).map(v => v.replace(/^\s*[•*-]\s*/, '').trim()).filter(Boolean);
const UNKNOWN = 'Belum diisi - perlu konfirmasi Sales/Pre-Sales dan persetujuan klien';

function Brand() {
  return <div className="quote-brand">
    <div className="quote-brand-logo" aria-label="Technotama">
      <div><div className="quote-logo-text">TECHNOTAMA</div>
      <div className="quote-logo-member">INDIA Business Management Platform</div></div>
    </div>
    <div className="quote-brand-address"><b>TECHNOTAMA</b><br/>
      [Alamat dan kontak resmi — wajib dikonfirmasi sebelum penerbitan]
    </div>
  </div>;
}

function Paper({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <section className={'quotation-sheet ' + className}>
    <div className="quote-watermark" aria-hidden="true">
      <svg viewBox="0 0 440 510" preserveAspectRatio="xMidYMid meet">
        <path d="M220 14 418 110v155c0 119-70 183-198 236C92 448 22 384 22 265V110Z" fill="#704b9c" opacity=".055"/>
        <path d="M220 67 359 135v125c0 79-37 132-139 181C118 392 81 339 81 260V135Z" fill="white" opacity=".55"/>
        <path d="m220 180 116 199H104Z" fill="#fff" opacity=".83" stroke="#c0aed2" strokeOpacity=".13" strokeWidth="8"/>
      </svg>
    </div>
    <div className="quote-paper-content"><Brand/>{children}</div>
    <div className="quote-corner" aria-hidden="true" />
  </section>;
}
function ListText({ title, value, placeholder = UNKNOWN }: { title: string; value?: string; placeholder?: string }) {
  const parts = lines(value);
  return <section className="quote-section">
    <h3>{title}</h3>
    {parts.length ? <ul>{parts.map((x, i) => <li key={i}>{x}</li>)}</ul> :
      <p className="quote-unset">{placeholder}</p>}
  </section>;
}

export default function QuotationDocument({ proposal: p, format, details: d }: Props) {
  const variant = resolveQuotationFormat(p, format);
  const vatPct = p.subtotal ? (100 * p.vat_amount / p.subtotal).toFixed(2).replace(/\.00$/, '') : '-';
  const title = variant === 'soc' ? 'Managed Security Operation Center (SOC) Service' :
    variant === 'mobile' ? 'Penetration Testing Mobile Application' : p.opportunity_name;
  const product = quotationPillar(p);
  const sumLines = p.line_items.reduce((n, item) => n + item.line_total, 0);
  const mismatch = Math.abs(sumLines - p.subtotal) > 1 || Math.abs(p.subtotal + p.vat_amount - p.grand_total) > 1;
  const isSOCTemplate = variant === 'soc';
  const totalPrice = fmtMoney(p.subtotal);
  const payment = p.payment_terms === '100' ? '100% dalam satu termin' :
    p.payment_terms.split('-').map((v, i) => 'Termin ' + (i + 1) + ': ' + v + '%').join('; ');
  const sow = lines(d.scope);
  const displaySow = sow.length ? sow : p.line_items.map(it => it.description + ' (' + it.quantity + ' ' + it.unit + ')');

  return <div className="quotation-reference-document" aria-label={'Quotation tiga halaman - ' + variant}>
    <Paper className="quote-letter-page">
      <div className="quote-meta">
        {[
          ['No', p.quotation_number], ['Lamp', 'Lampiran rincian penawaran'],
          ['Date', fmtDate(p.created_at)], ['Subject', 'Quotation - ' + title],
          ['To', p.company_name], ['End User', d.endUser || p.company_name],
        ].map(([label, value]) => <div className="quote-meta-row" key={label}>
          <span>{label}</span><span>:</span><strong>{value}</strong>
        </div>)}
      </div>
      <div className="quote-recipient">
        Kepada Yth.<br/><b>Bapak/Ibu Pimpinan</b><br/><b>{p.company_name}</b><br/>Di tempat
      </div>
      <div className="quote-subject"><b>Perihal</b><span>:</span><b>Penawaran Harga Pengadaan {p.opportunity_name}</b></div>
      <div className="quote-letter-body">
        <p>Terima kasih atas kesempatan yang diberikan kepada Technotama
          (Technotama) untuk menyampaikan penawaran harga pengadaan layanan <b>{p.opportunity_name}</b> bagi
          {' '}{d.endUser || p.company_name}. Sehubungan dengan rencana pekerjaan tersebut, kami
          menyampaikan penawaran sebesar <b>{totalPrice}</b> belum termasuk PPN sesuai rincian harga terlampir.</p>
        <p>Penawaran ini berlaku selama <b>{p.valid_days} hari kalender</b> sejak tanggal surat
          penawaran, sampai dengan <b>{fmtDate(p.valid_until)}</b>. Rincian ruang lingkup,
          metode pelaksanaan, serta syarat dan ketentuan komersial tercantum pada halaman berikutnya.</p>
        <p>Demikian Surat Penawaran ini kami sampaikan. Atas perhatian dan kerja samanya,
          kami ucapkan terima kasih.</p>
      </div>
      <div className="quote-signature">
        <p>Salam Hormat,</p>
        <div className="quote-signature-space"/>
        <b>Maria Hayu Utaminingtyas</b>
        <span>Account Manager</span>
      </div>
    </Paper>
    <Paper className="quote-details-page">
      <div className="quote-document-title">
        <b>RINCIAN HARGA PENAWARAN</b>
        <span>{product} - {title}</span>
        <u>Quotation</u>
      </div>
      <table className="quote-table quote-price-table">
        <colgroup><col style={{ width: '25%' }}/><col style={{ width: '41%' }}/><col style={{ width: '14%' }}/><col style={{ width: '20%' }}/></colgroup>
        <thead><tr><th>Product</th><th>Layanan</th><th>Qty</th><th>Price</th></tr></thead>
        <tbody>
          {p.line_items.map((item, i) => <tr key={item.line_number}>
            {i === 0 && <td rowSpan={p.line_items.length} className="quote-product">{product}<br/>{title}</td>}
            <td>{item.description}</td><td className="quote-center">{item.quantity} {item.unit}</td>
            <td className="quote-price">{fmtMoney(item.line_total)}</td>
          </tr>)}
          <tr><td colSpan={3} className="quote-total-label">TOTAL</td><td className="quote-price quote-total-label">{totalPrice}</td></tr>
        </tbody>
      </table>
      <div className="quote-summary">
        <div><b>Subtotal Harga</b><b>: {totalPrice}</b></div>
        <div><b>PPN ({vatPct}%)</b><b>: {fmtMoney(p.vat_amount)}</b></div>
        <div><b>Total</b><b>: {fmtMoney(p.grand_total)}</b></div>
      </div>
      {mismatch && <p className="quote-warning">PERLU REKONSILIASI: nilai baris penawaran, subtotal, PPN dan total belum konsisten.</p>}
      <section className="quote-section"><h3>Scope Of Work</h3>
        <ul>{displaySow.map((v, i) => <li key={i}>{v}</li>)}</ul>
      </section>
      <ListText title={isSOCTemplate ? 'Platform & Integrasi' : 'Metode & Acuan Pengujian'}
        value={d.technicalPlatform || d.methodology}
        placeholder={isSOCTemplate ? 'Platform SIEM, lisensi dan integrasi perlu dikonfirmasi pada SOW.' :
          'Metode blackbox/greybox/whitebox serta standar pengujian perlu dikonfirmasi pada SOW.'}/>
      <ListText title={isSOCTemplate ? 'Log Source Dalam Lingkup' : 'Daftar Aset Dalam Lingkup'}
        value={isSOCTemplate ? d.logSources : d.assets}/>
      <ListText title="Deliverables" value={d.deliverables}
        placeholder="Bentuk laporan, periode retest (jika berlaku), dan hasil pekerjaan perlu dikonfirmasi."/>
    </Paper>
    <Paper className="quote-terms-page">
      {isSOCTemplate ?
        <ListText title="Service Level Objective (SLO)" value={d.serviceLevels}
          placeholder="Target acknowledge, eskalasi, severity, jam layanan dan SLA masih memerlukan persetujuan."/> :
        <ListText title="Rules Of Engagement" value={d.rules}
          placeholder="Kebijakan pengujian, izin pada sistem produksi, non-destruktif, dan eskalasi temuan harus disetujui tertulis."/>}
      <ListText title="Structure Team" value={d.team}
        placeholder="Project Manager, Lead/Specialist, dan QA/Technical Writer: susunan aktual dikonfirmasi Pre-Sales."/>
      <ListText title="General Term & Conditions" value={d.terms}
        placeholder="Ketentuan PO, pajak, batas lingkup, perubahan pekerjaan dan penalti disepakati melalui PO/kontrak."/>
      <section className="quote-section"><h3>Term Of Payments</h3>
        <ul><li>{payment}.</li>
          {lines(d.paymentNotes).map((v, i) => <li key={i}>{v}</li>)}
          {!lines(d.paymentNotes).length && <li className="quote-unset">Pemicu penagihan, BAST dan TOP belum dikonfirmasi.</li>}</ul>
      </section>
      <ListText title="Exclusions" value={d.exclusions}
        placeholder="Kegiatan dan lisensi di luar Scope of Work tidak termasuk tanpa persetujuan tertulis."/>
      <section className="quote-section"><h3>Document Required</h3>
        <ul><li>Formulir registrasi pelanggan apabila disyaratkan</li>
          <li>Dokumen administrasi dan perpajakan perusahaan sesuai ketentuan</li>
          <li>Surat Pesanan (Purchase Order) dan NDA jika dipersyaratkan</li></ul>
      </section>
      <p className="quote-end-note">Terima kasih atas perhatian Anda. Jika memiliki pertanyaan,
        silakan menghubungi <i>[Kontak resmi Technotama]</i>.</p>
      <p className="quote-draft-label">DRAFT - Seluruh lingkup dan ketentuan yang belum diisi harus disetujui sebelum quotation diterbitkan.</p>
    </Paper>
  </div>;
}
