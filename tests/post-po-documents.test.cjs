const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {join}=require('node:path');
const load=()=>import(pathToFileURL(join(__dirname,'../src/lib/post-po-documents.ts')).href);
function fill(api){
 const packet=api.newPostPoPacket(),r=packet.registration,p=packet.project;
 Object.assign(r,{customerId:'DEIT-TEST-001',customerName:'PT Contoh & Anak <Usaha>',
  businessType:'Jasa Teknologi Informasi',employeeBand:'100-500',
  hqAddress:'Jl. Contoh No. 1',hqProvince:'DKI Jakarta',hqPostalCode:'13210',
  billingSameAsHq:true,npwp:'00.111.222.3-444.000',companyPhone:'+62 21 555 1234',
  primaryKtpNumber:'1111222233334444',fax:'N/A - confirmed',
  npwpAttachmentConfirmed:true,ktpAttachmentConfirmed:true,
  customerSignatory:'Direktur Contoh',customerSignatoryTitle:'Direktur Utama',
  defenderSignatory:'Pemberi Tanda Tangan',defenderSignatoryTitle:'Direktur',
  maker:'Maker QA',reviewer:'Reviewer QA',executor:'Pelaksana QA'});
 const person={name:'PIC QA',mobile:'+62 812-1234-5678',email:'qa@example.com'};
 for(const key of ['primary','technical','billing','tax'])r[key]={...person};
 Object.assign(p,{poNumber:'PO-TEST-123',poDate:'2026-10-20',
  poVerified:true,quotationNumber:'QUOTE-TEST-12',quotationAmountBeforeVat:1_000_000,
  serviceFamily:'VAPT',serviceDescription:'Penetration Testing Web',
  quantityAndUnit:'2 web applications',scope:'Uji aplikasi customer sesuai SOW',
  technicalSpecifications:'OWASP WSTG; grey-box',projectPic:{...person},
  deliveryAddress:'Jl. Contoh No. 1',deliveryProvince:'DKI Jakarta',deliveryPostalCode:'13210',
  paymentVA:'BCA',projectFeeBeforeVat:1_000_000,
  milestones:[{label:'Tahap 1',amount:500_000,trigger:'Setelah PO'},
   {label:'Tahap 2',amount:500_000,trigger:'Setelah BAST'}],
  durationValue:'30',durationUnit:'hari',completionDeadline:'2026-11-20',
  quotationReconciled:true});
 return packet;
}
function xmlFromDocx(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const decoder=new TextDecoder();let pos=0;
 while(pos+30<bytes.length&&view.getUint32(pos,true)===0x04034b50){
  const n=view.getUint16(pos+26,true),ex=view.getUint16(pos+28,true),size=view.getUint32(pos+18,true);
  const file=decoder.decode(bytes.subarray(pos+30,pos+30+n)),start=pos+30+n+ex;
  if(file==='word/document.xml')return decoder.decode(bytes.subarray(start,start+size));
  pos=start+size;
 }
 throw new Error('Missing document.xml');
}
test('blank Sales and PO master must never permit Word export',async()=>{
 const api=await load(),packet=api.newPostPoPacket();
 const issues=api.validatePostPoPacket(packet);
 assert.ok(issues.length>20);assert.equal(api.isReadyForKickoff(packet),false);
 assert.ok(issues.some(x=>x.field==='primaryKtpNumber'));
 assert.ok(issues.some(x=>x.field==='poNumber'));
 assert.ok(issues.some(x=>x.field==='technicalSpecifications'));
 assert.throws(()=>api.createPostPoDocx(packet,'registration'),/belum dapat diterbitkan/);
 assert.throws(()=>api.createPostPoDocx(packet,'project'),/belum dapat diterbitkan/);
});
test('complete registration and VAPT project generate separate valid editable Word documents',async()=>{
 const api=await load(),packet=fill(api);
 assert.deepEqual(api.validatePostPoPacket(packet),[]);
 for(const kind of ['registration','project']){
  const bytes=api.createPostPoDocx(packet,kind);
  assert.equal(bytes[0],0x50);assert.equal(bytes[1],0x4b);
  const doc=xmlFromDocx(bytes);
  assert.match(doc,/FORMULIR/);
  assert.match(doc,/PO-TEST-123|CUSTOMER REGISTRATION/);
  assert.match(doc,/PT Contoh &amp; Anak &lt;Usaha&gt;/);
  if(kind==='project'){
   assert.match(doc,/VAPT/);assert.match(doc,/500.000/);
   assert.match(doc,/Penetration Testing Web/);
  }else{
   assert.match(doc,/NPWP/);assert.match(doc,/PIC Utama/);
   assert.match(doc,/100-500/);
  }
 }
});
test('PO-quotation mismatch and payment mismatch block both exports',async()=>{
 const api=await load(),packet=fill(api);
 packet.project.projectFeeBeforeVat=999_000;
 assert.ok(api.validatePostPoPacket(packet).some(x=>x.message.includes('tidak konsisten')));
 assert.ok(api.validatePostPoPacket(packet).some(x=>x.message.includes('Jumlah seluruh termin')));
 assert.throws(()=>api.createPostPoDocx(packet,'project'));
});
test('reconcile financial amounts, duration, PIC and supporting document checks',async()=>{
 const api=await load(),packet=fill(api);
 packet.registration.ktpAttachmentConfirmed=false;
 packet.registration.technical.email='invalid';
 packet.project.durationValue='';packet.project.completionDeadline='';
 packet.project.paymentVA='';
 const issues=api.validatePostPoPacket(packet);
 for(const field of ['ktpAttachmentConfirmed','technical.email','durationValue','paymentVA']){
  assert.ok(issues.some(x=>x.field===field),'Expected '+field);
 }
 packet.registration.billingSameAsHq=false;
 assert.ok(api.validatePostPoPacket(packet).some(x=>x.field==='billingAddress'));
});
test('all service families preserve explicit SOW rather than choosing fictional client scope',async()=>{
 const api=await load();
 for(const family of ['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other']){
  const packet=fill(api);packet.project.serviceFamily=family;packet.project.scope='Scope negotiated for '+family;
  assert.deepEqual(api.validatePostPoPacket(packet),[]);
  assert.match(xmlFromDocx(api.createPostPoDocx(packet,'project')),/Scope negotiated/);
 }
});
