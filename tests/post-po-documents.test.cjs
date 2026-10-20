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

async function dummyFixtures(){
 return import(pathToFileURL(join(__dirname,'../src/lib/post-po-dummy.ts')).href);
}
test('initial dummy VAPT pack fills all requested form fields and keeps proof checks false',async()=>{
 const api=await load(),demo=await dummyFixtures();
 const original=api.newPostPoPacket(),packet=demo.createDemoPostPoPacket(original,'VAPT');
 assert.equal(original.registration.customerName,'');
 assert.equal(packet.isDemo,true);
 assert.match(packet.registration.customerName,/DUMMY|SIMULASI/);
 assert.match(packet.registration.primary.email,/@example\.com$/);
 assert.match(packet.project.poNumber,/DEMO/);
 assert.equal(packet.registration.npwpAttachmentConfirmed,false);
 assert.equal(packet.registration.ktpAttachmentConfirmed,false);
 assert.equal(packet.project.poVerified,false);
 assert.equal(packet.project.quotationReconciled,false);
 assert.deepEqual(api.validatePostPoDemoPacket(packet),[]);
 assert.equal(api.isReadyForKickoff(packet),false);
 assert.ok(api.validatePostPoPacket(packet).some(x=>x.field==='poVerified'));
});
test('autofill respects pre-existing Sales and PO values and uses missing budget',async()=>{
 const api=await load(),demo=await dummyFixtures(),packet=api.newPostPoPacket();
 packet.registration.customerName='PT Existing Test';
 packet.registration.primary.name='Original PIC';
 packet.registration.primary.email='original@example.com';
 packet.project.serviceFamily='SOC/MDR';
 packet.project.poNumber='PO-MANUAL-77';
 packet.project.projectFeeBeforeVat=2000000;
 packet.project.milestones=[{label:'Uang Muka',amount:500000,trigger:'Saat PO'},{label:'Termin kedua',amount:0,trigger:''}];
 const filled=demo.fillEmptyPostPoWithDummy(packet);
 assert.equal(filled.registration.customerName,'PT Existing Test');
 assert.equal(filled.registration.primary.name,'Original PIC');
 assert.equal(filled.registration.primary.email,'original@example.com');
 assert.equal(filled.project.poNumber,'PO-MANUAL-77');
 assert.equal(filled.project.quotationAmountBeforeVat,2000000);
 assert.equal(filled.project.milestones[0].amount,500000);
 assert.equal(filled.project.milestones[1].amount,1500000);
 assert.equal(filled.project.milestones[0].trigger,'Saat PO');
 assert.match(filled.project.technicalSpecifications,/FortiSIEM/);
 assert.equal(packet.registration.primary.mobile,'');
 assert.equal(packet.project.milestones[1].amount,0);
 assert.deepEqual(api.validatePostPoDemoPacket(filled),[]);
});
test('all DefendIT360 demo service scenarios generate unambiguous demo-labeled Word forms',async()=>{
 const api=await load(),dummy=await dummyFixtures();
 for(const service of ['VAPT','SOC/MDR','CTI','Cybersecurity Governance','Incident Response/DFIR','Cybersecurity Technology','Other']){
  const data=dummy.createDemoPostPoPacket(api.newPostPoPacket(),service);
  assert.equal(data.project.serviceFamily,service);
  assert.deepEqual(api.validatePostPoDemoPacket(data),[],service);
  assert.equal(api.isReadyForKickoff(data),false);
  for(const kind of ['registration','project']){
   const xml=xmlFromDocx(api.createPostPoDocx(data,kind));
   assert.match(xml,/DATA DUMMY/);
   assert.match(xml,/DILARANG DIGUNAKAN/);
   assert.match(xml,/SIMULASI/);
   assert.match(xml,/DEMO-CUST-0001/);
  }
 }
});
test('demo cannot bypass real commercial inconsistencies or blank mandatory fields',async()=>{
 const api=await load(),dummy=await dummyFixtures();
 const data=dummy.createDemoPostPoPacket(api.newPostPoPacket());
 data.project.projectFeeBeforeVat+=7000;
 const issues=api.validatePostPoDemoPacket(data);
 assert.ok(issues.some(x=>x.message.includes('tidak konsisten')));
 assert.throws(()=>api.createPostPoDocx(data,'project'),/belum dapat diterbitkan/);
 data.project.projectFeeBeforeVat-=7000;
 data.project.projectPic.email='';
 assert.ok(api.validatePostPoDemoPacket(data).some(x=>x.field==='projectPic.email'));
});
test('complete real data still exports without any dummy watermark',async()=>{
 const api=await load(),data=fill(api);
 const doc=xmlFromDocx(api.createPostPoDocx(data,'registration'));
 assert.doesNotMatch(doc,/DATA DUMMY/);
 assert.equal(api.isReadyForKickoff(data),true);
});
