import JSZip from 'jszip';
import type { SalesDeal, SalesAccount } from './sales-workflow';

const escapeXml=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
} as Record<string,string>)[c]);
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const paragraph=(value:unknown,heading=false)=>{
 const txt=escapeXml(value);
 return '<w:p><w:pPr><w:spacing w:after="'+(heading?'150':'110')+'"/>'+
 (heading?'<w:keepNext/>':'')+'</w:pPr><w:r><w:rPr>'+
 (heading?'<w:b/><w:color w:val="263B58"/><w:sz w:val="23"/>':'<w:color w:val="283449"/><w:sz w:val="19"/>')+
 '</w:rPr><w:t xml:space="preserve">'+txt+'</w:t></w:r></w:p>';
};
/** Internal, unsigned loss analysis. Do not invent lost causes or customer approval. */
export async function createLossReportDocx(deal:SalesDeal,account:SalesAccount,closedAt:string):Promise<Uint8Array>{
 if(deal.stage!=='closed_lost'||!deal.fields.lost_reason?.trim()||!deal.fields.lost_notes?.trim())
  throw Error('Laporan Lost hanya dapat dibuat dari kesempatan Closed Lost dengan alasan dan uraian.');
 const f=deal.fields;
 const body=[
  paragraph('TECHNOTAMA | INDIA — SALES & CRM',true),
  paragraph('CLOSED LOST — EVALUASI PELUANG PENJUALAN',true),
  paragraph('INTERNAL DRAFT — BELUM DISETUJUI / TIDAK UNTUK PELANGGAN'),
  paragraph('ID Opportunity: '+deal.id),
  paragraph('Tanggal pencatatan Closed Lost: '+(closedAt||'[tanggal dari audit belum tersedia]')),
  paragraph('A. INFORMASI PELUANG',true),
  paragraph('Nama pelanggan: '+account.legal_name),
  paragraph('Nama proyek: '+deal.title),
  paragraph('Produk / layanan: '+(f.service_family||'[belum diisi]')),
  paragraph('Estimasi nilai peluang (bukan revenue): '+money(deal.estimated_value)),
  paragraph('PIC Sales: '+(f.sales_owner||'[belum diisi]')),
  paragraph('B. ANALISIS KEKALAHAN',true),
  paragraph('Kategori alasan: '+f.lost_reason),
  paragraph('Penjelasan dan bukti keputusan: '+f.lost_notes),
  paragraph('Kompetitor (bila dikonfirmasi): '+(f.competitor||'Tidak diinformasikan')),
  paragraph('Keputusan pelanggan: '+(f.customer_decision||'Belum dicatat')),
  paragraph('C. PERBAIKAN DAN FOLLOW-UP',true),
  paragraph('Langkah perbaikan: '+(f.next_action||'[harus dilengkapi Sales Manager]')),
  paragraph('Catatan hasil negosiasi: '+(f.negotiation_notes||'[belum ada]')),
  paragraph('D. REVIEW INTERNAL',true),
  paragraph('Dibuat dari histori Sales INDIA. Dokumen ini adalah draft yang memerlukan review Head Sales/Management.'),
  paragraph('Persetujuan: [BELUM DIBERIKAN]'),
 ].join('');
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+
 '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>'+
 '</w:body></w:document>';
 const zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
 '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'+
 '<Default Extension="xml" ContentType="application/xml"/>'+
 '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'+
 '</Relationships>');
 zip.file('word/document.xml',xml);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
