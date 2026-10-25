/**
 * Preserve the user's unmodified official Technotama V.042026 Word layout
 * by filling its OOXML tables in-place. No reflowed synthetic Word tables.
 *
 * This operates entirely in the browser: original templates and sensitive
 * customer fields are never uploaded to an API. The template is held only
 * in memory for the current tab.
 */
import JSZip from 'jszip';
import type { PostPoPacket, Pic, PostPoDocKind } from './post-po-documents';
import { validatePostPoPacket, validatePostPoDemoPacket } from './post-po-documents';

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML='http://www.w3.org/XML/1998/namespace';
function elements(parent: Element, name:string):Element[] {
  return Array.from(parent.children).filter(x=>x.namespaceURI===W && x.localName===name);
}
function desc(parent: Element, name:string):Element[] {
  return Array.from(parent.getElementsByTagNameNS(W,name));
}
function gridCell(tbl:Element,rowIndex:number,columnIndex:number):Element {
  const rows=elements(tbl,'tr');
  if(!rows[rowIndex])throw new Error('Baris '+rowIndex+' tidak ditemukan dalam template resmi.');
  let current=0;
  for(const tc of elements(rows[rowIndex],'tc')){
    const tcPr=elements(tc,'tcPr')[0];
    const gridSpan=tcPr?desc(tcPr,'gridSpan')[0]:undefined;
    const raw=gridSpan?.getAttributeNS(W,'val')||gridSpan?.getAttribute('w:val')||gridSpan?.getAttribute('val')||'1';
    const span=Math.max(1,Number(raw)||1);
    if(columnIndex>=current&&columnIndex<current+span)return tc;
    current+=span;
  }
  throw new Error('Kolom '+columnIndex+' tidak ditemukan dalam template resmi.');
}
function firstParagraph(xml:XMLDocument,cell:Element):Element {
  let p=elements(cell,'p')[0];
  if(!p){p=xml.createElementNS(W,'w:p');cell.appendChild(p);}
  return p;
}
function blankExistingText(container:Element){
  for(const t of desc(container,'t'))t.textContent='';
}
function fillParagraph(xml:XMLDocument,p:Element,value:string,sizePt=8):void {
  blankExistingText(p);
  let run=elements(p,'r')[0];
  if(!run){run=xml.createElementNS(W,'w:r');p.appendChild(run);}
  let rPr=elements(run,'rPr')[0];
  if(!rPr){rPr=xml.createElementNS(W,'w:rPr');run.insertBefore(rPr,run.firstChild);}
  let font=elements(rPr,'rFonts')[0];
  if(!font){font=xml.createElementNS(W,'w:rFonts');rPr.appendChild(font);}
  font.setAttributeNS(W,'w:ascii','Arial');font.setAttributeNS(W,'w:hAnsi','Arial');
  let sz=elements(rPr,'sz')[0];
  if(!sz){sz=xml.createElementNS(W,'w:sz');rPr.appendChild(sz);}
  sz.setAttributeNS(W,'w:val',String(Math.round(sizePt*2)));
  const pieces=String(value).split(/\r?\n/);
  let t=elements(run,'t')[0];
  if(!t){t=xml.createElementNS(W,'w:t');run.appendChild(t);}
  // Remove run children after primary t (except rPr) so original placeholder
  // text doesn't linger. Do not change the cell's grid, border or shading.
  for(const child of Array.from(run.children)){
    if(child!==rPr && child!==t)run.removeChild(child);
  }
  t.textContent=pieces[0]||' ';
  t.setAttributeNS(XML,'xml:space','preserve');
  for(const piece of pieces.slice(1)){
    run.appendChild(xml.createElementNS(W,'w:br'));
    const next=xml.createElementNS(W,'w:t');
    next.setAttributeNS(XML,'xml:space','preserve');
    next.textContent=piece||' ';
    run.appendChild(next);
  }
}
function fillCell(xml:XMLDocument,tbl:Element,row:number,column:number,value:string,pt=8):void{
  const cell=gridCell(tbl,row,column);
  const p=firstParagraph(xml,cell);
  fillParagraph(xml,p,value,pt);
  // The empty Word form includes extra table-cell paragraphs. They are
  // blanked, rather than removing rows/merged cells or changing layout.
  for(const extra of elements(cell,'p').slice(1))blankExistingText(extra);
}
function fillNumberedCell(xml:XMLDocument,tbl:Element,row:number,column:number,values:string[]):void{
  const cell=gridCell(tbl,row,column);
  const ps=elements(cell,'p');
  const n=Math.max(1,values.length);
  // Word's original "List Paragraph" style already supplies 1, 2, 3...
  for(let i=0;i<n;i++){
    let p=ps[i];
    if(!p){
      p=xml.createElementNS(W,'w:p');
      const first=ps[0];
      const pPr=first&&elements(first,'pPr')[0];
      if(pPr)p.appendChild(pPr.cloneNode(true));
      cell.appendChild(p);
    }
    fillParagraph(xml,p,values[i]||' ',7.4);
  }
  // Remove unused numbered paragraphs, avoiding stray empty 3./4.
  for(const p of ps.slice(n))cell.removeChild(p);
}
function readDocXml(xmlText:string):XMLDocument {
  const document=new DOMParser().parseFromString(xmlText,'application/xml');
  if(document.getElementsByTagName('parsererror').length)throw new Error('Template Word tidak memiliki XML valid.');
  return document;
}
function serialize(xml:XMLDocument):string{return new XMLSerializer().serializeToString(xml);}
function formatIDR(n:number):string{return 'Rp '+new Intl.NumberFormat('id-ID').format(n);}
function friendlyDate(value:string):string{
  if(!value)return 'sesuai PO';
  const date=new Date(value+'T12:00:00+07:00');
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(date);
}
function topLevelTables(xml:XMLDocument):Element[]{
  const body=desc(xml.documentElement,'body')[0];
  if(!body)throw new Error('Template Word tidak memiliki body.');
  return elements(body,'tbl');
}
function signatureName(s:string):string{return s.length>35?s.slice(0,35)+'…':s;}
function fillRegistration(xml:XMLDocument,p:PostPoPacket):void{
  const r=p.registration;
  const tables=topLevelTables(xml);
  if(tables.length<3)throw new Error('Template Registrasi bukan format resmi V.042026.');
  const t=tables[0],sign=tables[2];
  const values:Array<[number,number,string,number?]>=[
    [3,1,r.customerName],[4,1,r.businessType],
    [6,1,r.hqAddress],[7,3,r.hqProvince],[7,10,r.hqPostalCode],
    [10,1,r.npwp],[10,10,r.companyPhone],[11,1,r.primaryKtpNumber],[11,10,r.fax],
  ];
  if(r.employeeBand==='100-500')values.push([5,11,'100-500 — DIPILIH',7.4]);
  else if(r.employeeBand==='<100')values.push([4,11,'< 100 — DIPILIH',7.4]);
  else if(r.employeeBand==='>500')values.push([4,14,'>500 — DIPILIH',7.4]);
  if(r.billingSameAsHq)values.push([8,2,'Sama dengan Kantor Pusat — DIPILIH',7]);
  else {
    values.push([8,5,r.billingAddress],[9,7,r.billingProvince],[9,12,r.billingPostalCode]);
  }
  for(const [row,column,value,pt] of values)fillCell(xml,t,row,column,value,pt||8);
  const contacts:Array<Pic>=[r.primary,r.technical,r.billing,r.tax];
  contacts.forEach((person,i)=>{
    fillCell(xml,t,13+i*2,1,person.name);
    fillCell(xml,t,13+i*2,8,person.mobile);
    fillCell(xml,t,14+i*2,8,person.email);
  });
  fillCell(xml,sign,3,0,'NAMA : '+signatureName(r.customerSignatory),7);
  fillCell(xml,sign,4,0,'JABATAN : '+signatureName(r.customerSignatoryTitle),7);
  fillCell(xml,sign,3,3,signatureName(r.defenderSignatory),7);
  fillCell(xml,sign,4,3,signatureName(r.defenderSignatoryTitle),7);
  fillCell(xml,sign,3,5,r.maker,7);
  fillCell(xml,sign,3,6,r.reviewer,7);
  fillCell(xml,sign,3,7,r.executor,7);
  // Source V.042026 contains three otherwise empty body paragraphs after the
  // signature table, pushing an otherwise completed one-page form to page two.
  const body=desc(xml.documentElement,'body')[0];
  const tbls=elements(body,'tbl');
  const last=tbls[tbls.length-1];
  let found=false;
  for(const node of Array.from(body.children)){
    if(node===last){found=true;continue;}
    if(found && node.namespaceURI===W && node.localName==='p'){
      if(desc(node,'t').every(x=>!(x.textContent||'').trim()))body.removeChild(node);
    }
  }
}
function fillProject(xml:XMLDocument,p:PostPoPacket):void{
  const {registration:r,project:a}=p;
  const tables=topLevelTables(xml);
  if(tables.length<4)throw new Error('Template Project bukan format resmi V.042026.');
  const t=tables[0],sign=tables[2],internal=tables[3];
  const details=[
    a.serviceDescription,
    'Jenis layanan: '+a.serviceFamily,
    'Jumlah/satuan: '+a.quantityAndUnit,
    'Lingkup: '+a.scope,
    'Spesifikasi: '+a.technicalSpecifications,
    'Quotation: '+a.quotationNumber+' | Tanggal PO: '+a.poDate,
  ].filter(Boolean).join('\n');
  const rows:Array<[number,number,string,number?]>=[
    [3,1,r.customerId],[4,1,r.customerName],
    [6,1,a.poNumber],[7,1,details,7.6],
    [8,1,a.projectPic.name],[8,7,a.projectPic.mobile],[9,7,a.projectPic.email],
    [10,1,a.deliveryAddress],[11,4,a.deliveryProvince],[11,9,a.deliveryPostalCode],
    [14,1,formatIDR(a.projectFeeBeforeVat)],
    [17,1,p.isDemo?'DATA DUMMY / SIMULASI — tidak berlaku sebagai kontrak atau dasar Kick Off.':a.notes,7.8],
    [19,2,'selama '+a.durationValue+' '+a.durationUnit+', atau paling lambat selesai pada '+friendlyDate(a.completionDeadline)],
    [20,2,a.timeline||'Mengikuti timeline terlampir pada PO/SOW.'],
  ];
  if(a.paymentVA==='BCA')rows.push([13,3,'Bank Central Asia (BCA) — DIPILIH',7.7]);
  if(a.paymentVA==='OCBC NISP')rows.push([13,8,'OCBC NISP — DIPILIH',7.7]);
  for(const [row,column,value,pt] of rows)fillCell(xml,t,row,column,value,pt||8);
  fillNumberedCell(xml,t,16,1,a.milestones.map((m,i)=>m.label+': '+formatIDR(m.amount)));
  fillNumberedCell(xml,t,16,6,a.milestones.map(m=>m.trigger));
  fillCell(xml,sign,4,0,'NAMA : '+signatureName(r.customerSignatory),7);
  fillCell(xml,sign,5,0,'JABATAN : '+signatureName(r.customerSignatoryTitle),7);
  fillCell(xml,sign,4,4,signatureName(r.defenderSignatory),7);
  fillCell(xml,sign,5,4,signatureName(r.defenderSignatoryTitle),7);
  fillCell(xml,internal,1,1,r.customerId,7.5);
  fillCell(xml,internal,1,5,p.isDemo?'SIMULASI':'Diisi tim Project',7.2);
  fillCell(xml,internal,2,0,'Pembuat,\n\n'+r.maker,7.4);
  fillCell(xml,internal,2,2,'Pemeriksa,\n\n'+r.reviewer,7.4);
  fillCell(xml,internal,2,4,'Pelaksana,\n\n'+r.executor,7.4);
}
function headerFormNumber(xml:XMLDocument,packet:PostPoPacket,kind:PostPoDocKind){
  const tbl=desc(xml.documentElement,'tbl')[0];
  if(!tbl)return;
  const prefix=packet.isDemo?'DEMO-':'DRAFT-';
  const no=(kind==='registration'?packet.registration.customerId:packet.project.poNumber).replace(/[^\w-]/g,'-').slice(0,34);
  fillCell(xml,tbl,1,1,prefix+no,7.8);
}
export async function createOfficialPostPoDocxFromTemplate(
  packet:PostPoPacket,kind:PostPoDocKind,template:File
):Promise<Uint8Array>{
  const issues=packet.isDemo?validatePostPoDemoPacket(packet):validatePostPoPacket(packet);
  if(issues.length)throw new Error('Masih ada '+issues.length+' isian wajib yang perlu dilengkapi sebelum ekspor.');
  if(!/\.docx$/i.test(template.name)||template.size>8*1024*1024){
    throw new Error('Unggah template Word .docx asli (maksimal 8 MB).');
  }
  // Only the exact blank V.042026 source files are accepted. This prevents
  // accidentally reusing another customer's prefilled NDA/PO identifiers,
  // BSI-specific data, or tampered legal terms.
  const templateBytes=await template.arrayBuffer();
  const digested=await crypto.subtle.digest('SHA-256',templateBytes);
  const sha256=Array.from(new Uint8Array(digested),b=>b.toString(16).padStart(2,'0')).join('');
  const approvedHashes:Record<PostPoDocKind,string>={
    registration:'abaf82e66e0cf854aa68397aa7ce299d5898fdaa137bd346d3a8663e84aa0e5c',
    project:'d3b60f3debe5c2d952cd88a922fb6685f5dd2f5eedf53f5cdfe758e9cab056e3'
  };
  if(sha256!==approvedHashes[kind]){
    throw new Error('Template berbeda dari dokumen kosong Technotama V.042026 yang disetujui. Unduh dan gunakan template kosong asli, bukan dokumen pelanggan yang sudah diisi.');
  }
  const zip=await JSZip.loadAsync(templateBytes);
  const file=zip.file('word/document.xml');
  if(!file)throw new Error('Template Word tidak memiliki document.xml.');
  const xml=readDocXml(await file.async('string'));
  const text=xml.documentElement.textContent||'';
  const expected=kind==='registration'?'FORMULIR REGISTRASI PELANGGAN':'FORMULIR PROYEK';
  if(!text.toUpperCase().includes(expected))throw new Error('Jenis template salah. Diperlukan '+expected+'.');
  if(kind==='registration')fillRegistration(xml,packet);else fillProject(xml,packet);
  zip.file('word/document.xml',serialize(xml));
  const headers=Object.keys(zip.files).filter(p=>/^word\/header\d+\.xml$/.test(p));
  for(const path of headers){
    const entry=zip.file(path);
    if(!entry)continue;
    const head=readDocXml(await entry.async('string'));
    headerFormNumber(head,packet,kind);
    zip.file(path,serialize(head));
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
}
export async function downloadOfficialPostPoDocx(
  packet:PostPoPacket,kind:PostPoDocKind,template:File
):Promise<void>{
  const bytes=await createOfficialPostPoDocxFromTemplate(packet,kind,template);
  const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);
  const url=URL.createObjectURL(new Blob([copy.buffer],{
    type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }));
  const a=document.createElement('a');
  const safe=(kind==='registration'?packet.registration.customerId:packet.project.poNumber)
    .replace(/[^a-z0-9_-]/gi,'-').slice(0,45);
  a.href=url;
  a.download='INDIA_Technotama_'+(packet.isDemo?'DEMO_':'')+
    (kind==='registration'?'Registrasi_Resmi_Layout_':'Project_Resmi_Layout_')+safe+'.docx';
  document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
