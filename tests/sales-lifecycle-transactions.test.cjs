const test=require('node:test'),assert=require('node:assert/strict');
const {Harness,fields,users,expect}=require('./helpers/sales-flow-harness.cjs');
const h=()=>new Harness().seed();
test('actual APIs connect Presales → approved Proposal → verified Submission → accepted Negotiation → dual-reviewed PO → Won',async()=>{const d=h();try{await d.awarded();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);await expect(d.stage('closed_won'),200);assert.equal(d.deal().stage,'closed_won');assert.ok(d.sql.prepare("SELECT * FROM india_sales_audit WHERE action='VERIFY_PO'").get());assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_tx_guards').get().n,0);}finally{d.close();}});
test('Proposal API alias uses authenticated lifecycle and denies legacy arbitrary status changes',async()=>{const d=h();try{await expect(d.call('proposals','GET','none',null,'?opportunity_id=opp-qa'),401);await expect(d.call('proposals','PATCH','sales',{id:'demo',status:'accepted'}),422);await expect(d.call('sales/lifecycle','GET','other',null,'?opportunity_id=opp-qa'),403);}finally{d.close();}});
test('scope and proposal approvals cannot be skipped or self-approved',async()=>{const d=h();try{await expect(d.flow('scope','sales'),403);await expect(d.stage('solution_design'),200);await expect(d.stage('commercial_review'),409);await expect(d.flow('propose'),409);await expect(d.flow('scope','presales'),201);await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal')}),200);await expect(d.flow('approve','sales'),403);await expect(d.flow('approve','admin'),200);}finally{d.close();}});
test('material scope edits supersede proposal and submission, preserve history and reopen Solution Design',async()=>{const d=h();try{await d.accepted();const old=d.release().id;await expect(d.edit({technical_scope:'Changed scope requires a fresh technical and commercial review'}),200);assert.equal(d.release(),undefined);assert.equal(d.deal().stage,'solution_design');assert.equal(d.sql.prepare('SELECT status FROM india_sales_releases WHERE id=?').get(old).status,'superseded');assert.equal(d.sql.prepare('SELECT status FROM india_sales_submissions').get().status,'superseded');assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_negotiations').get().n,1);await expect(d.stage('commercial_review'),409);await expect(d.flow('scope','presales'),201);await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal/new')}),409);}finally{d.close();}});
test('follow-up edits keep approved packet; changing PO fields invalidates exact PO verification',async()=>{const d=h();try{await d.awarded();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);const id=d.release().id;await expect(d.edit({next_action:'Call customer tomorrow'}),200);assert.equal(d.release().id,id);assert.ok(d.sql.prepare('SELECT * FROM india_sales_po_checks').get());await expect(d.edit({po_reference:'archive/changed-original'}),200);assert.equal(d.sql.prepare('SELECT * FROM india_sales_po_checks').get(),undefined);await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),409);}finally{d.close();}});
test('negotiation must use current verified submission; typed customer approval cannot bypass evidence',async()=>{const d=h();try{await d.submitted();await expect(d.edit({customer_decision:'approved'}),200);await expect(d.stage('pending_po'),409);await expect(d.flow('negotiate','sales',{decision:'approved',amount_before_vat:900000,...await d.proof('negotiation','archive/decision')}),409);await expect(d.flow('negotiate','sales',{decision:'revision_required',amount_before_vat:900000,...await d.proof('negotiation','archive/decision')}),201);assert.equal(d.deal().stage,'solution_design');assert.equal(d.release(),undefined);}finally{d.close();}});
test('latest negotiation supersedes an earlier customer approval and cancels PO check',async()=>{const d=h();try{await d.awarded();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);await expect(d.flow('negotiate','sales',{decision:'pending',amount_before_vat:1000000,...await d.proof('negotiation','archive/new-decision')}),201);assert.equal(d.sql.prepare('SELECT * FROM india_sales_po_checks').get(),undefined);await expect(d.stage('closed_won'),409);await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),409);}finally{d.close();}});
test('late audit failure rolls back deal update and evidence invalidation together',async()=>{const d=h();try{await d.submitted();const before=d.deal();d.sql.exec("CREATE TRIGGER inject_failure BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");await expect(d.edit({technical_scope:'Should not persist'}),503);assert.equal(d.deal().data_json,before.data_json);assert.equal(d.deal().flow_version,before.flow_version);assert.equal(d.release().status,'approved');assert.equal(d.sql.prepare('SELECT status FROM india_sales_submissions').get().status,'verified');}finally{d.close();}});
test('stale concurrent decision cannot commit a proposal or an orphan audit',async()=>{const d=h();try{await expect(d.flow('scope','presales'),201);await d.proof('proposal','archive/proposal');d.beforeBatch=()=>d.sql.prepare("UPDATE india_sales_opportunities SET data_json=json_set(data_json,'$.technical_scope','Concurrent scope') WHERE id='opp-qa'").run();await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal')}),409);assert.equal(d.release(),undefined);assert.equal(d.sql.prepare("SELECT count(*) n FROM india_sales_audit WHERE action='PROPOSAL_SUBMITTED'").get().n,0);}finally{d.close();}});
test('PO maker, missing Legal approval and old award evidence cannot pass verifications',async()=>{const d=h();try{await d.accepted();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),409);const x=await expect(d.call('sales/award','POST','sales',{opportunity_id:'opp-qa',document_kind:'po',document_number:fields.po_number,...await d.proof('po','archive/po/QA-01')}),201);await expect(d.call('sales/award','PATCH','finance',{document_id:x.body.id,review_kind:'finance',review_notes:'Original independently checked by Finance'}),200);await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),409);await expect(d.edit({quotation_terms:'Changed contract clauses'}),200);await expect(d.call('sales/award','PATCH','legal',{document_id:x.body.id,review_kind:'legal',review_notes:'Review of stale document should be refused'}),409);}finally{d.close();}});
test('Customer changes invalidate active proposal and quotation submissions in the same transaction',async()=>{const d=h();try{await d.accepted();await expect(d.call('sales','PATCH','sales',{entity:'account',id:'account-qa',fields:{hq_address:'Changed customer address'}}),200);assert.equal(d.release(),undefined);assert.equal(d.deal().stage,'solution_design');assert.equal(d.sql.prepare('SELECT status FROM india_sales_submissions').get().status,'superseded');}finally{d.close();}});
test('cross-origin, viewer and other Sales cannot mutate lifecycle',async()=>{const d=h();try{await expect(d.flow('scope','viewer'),403);await expect(d.flow('scope','other'),403);await expect(d.call('sales/lifecycle','POST','presales',{opportunity_id:'opp-qa',action:'scope',flow_version:1,notes:'QA sufficient validation notes'},'',{Origin:'https://evil.invalid'}),403);}finally{d.close();}});

test('scope can precede commercial preparation; new BoQ revision and full reapproval reconnect the cycle',async()=>{const d=h();try{
 await d.accepted();await expect(d.flow('revise','sales'),200);await expect(d.flow('scope','presales'),201);
 const scopeId=d.release().id;
 const revised=await expect(d.call('boq/'+fields.boq_id,'PATCH','finance',{action:'revise'}),200),newId=revised.body.id;
 const payload={line_items:[{description:'Revised UAT scope',quantity:1,unit:'Application',unit_price:1200000,service_type:'VAPT'}]};
 await expect(d.call('boq/'+newId,'PATCH','finance',{action:'update',payload}),200);
 await expect(d.call('boq/'+newId,'PATCH','finance',{action:'submit'}),200);
 await expect(d.call('boq/'+newId,'PATCH','approver',{action:'approve'}),200);
 await expect(d.edit({boq_id:newId}),200);assert.equal(d.release().id,scopeId,'BoQ selection before proposal must retain technical validation');
 await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal/revision-2')}),200);
 await expect(d.flow('approve','approver'),200);
 for(const s of ['commercial_review','quotation_sent'])await expect(d.stage(s),200);
 const proof=await expect(d.call('sales/submission','POST','sales',{opportunity_id:'opp-qa',channel:'email',recipient_email:'pic@flow.invalid',sent_at:new Date().toISOString(),...await d.proof('submission','archive/mail/revision-2')}),201);
 await expect(d.call('sales/submission','PATCH','finance',{submission_id:proof.body.id,action:'verified',review_notes:'Revised original receipt checked independently'}),200);
 await expect(d.stage('negotiation'),200);
 await expect(d.flow('negotiate','sales',{decision:'approved',amount_before_vat:1200000,...await d.proof('negotiation','archive/customer/revision-2')}),201);
 await expect(d.stage('pending_po'),200);assert.equal(d.release().version,2);assert.equal(d.release().boq_version,2);
 assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_releases').get().n,2);assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
}finally{d.close();}});
test('BoQ revise and submit roll back if their mandatory audit fails',async()=>{const d=h();try{
 d.sql.exec("CREATE TRIGGER fail_boq_audit BEFORE INSERT ON india_audit_log BEGIN SELECT RAISE(ABORT,'injected BoQ audit failure'); END");
 const result=await d.call('boq/'+fields.boq_id,'PATCH','finance',{action:'revise'});assert.ok(result.status>=400);
 assert.equal(d.sql.prepare('SELECT count(*) n FROM india_boq').get().n,1);
 d.sql.exec('DROP TRIGGER fail_boq_audit');const x=await expect(d.call('boq/'+fields.boq_id,'PATCH','finance',{action:'revise'}),200);
 d.sql.exec("CREATE TRIGGER fail_boq_audit BEFORE INSERT ON india_audit_log BEGIN SELECT RAISE(ABORT,'injected BoQ audit failure'); END");
 assert.ok((await d.call('boq/'+x.body.id,'PATCH','finance',{action:'submit'})).status>=400);
 assert.equal(d.sql.prepare('SELECT status FROM india_boq WHERE id=?').get(x.body.id).status,'draft');
}finally{d.close();}});
for(const action of ['scope','propose','approve'])test(action+' and its audit commit or roll back together',async()=>{const d=h();try{
 if(action!=='scope')await expect(d.flow('scope','presales'),201);
 if(action==='approve')await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal/QA-01')}),200);
 const old=d.release()?.status;
 if(action==='propose')await d.proof('proposal','archive/proposal/QA-01');
 d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.flow(action,action==='scope'?'presales':action==='approve'?'approver':'sales',{...(action==='scope'?{}:await d.proof('proposal','archive/proposal/QA-01'))}),503);
 assert.equal(d.release()?.status,old);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_tx_guards').get().n,0);
}finally{d.close();}});
test('submission review audit failure leaves evidence Reported and blocks Negotiation',async()=>{const d=h();try{
 await d.approved();for(const s of ['solution_design','commercial_review','quotation_sent'])await expect(d.stage(s),200);
 const x=await expect(d.call('sales/submission','POST','sales',{opportunity_id:'opp-qa',channel:'email',recipient_email:'pic@flow.invalid',sent_at:new Date().toISOString(),...await d.proof('submission','archive/mail/QA-01')}),201);
 d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.call('sales/submission','PATCH','finance',{submission_id:x.body.id,action:'verified',review_notes:'Original evidence independently checked'}),503);
 assert.equal(d.sql.prepare('SELECT status FROM india_sales_submissions').get().status,'reported');await expect(d.stage('negotiation'),409);
}finally{d.close();}});
test('award review audit failure leaves Legal review unset; verifier cannot bypass it',async()=>{const d=h();try{
 await d.accepted();const x=await expect(d.call('sales/award','POST','sales',{opportunity_id:'opp-qa',document_kind:'po',document_number:fields.po_number,...await d.proof('po','archive/po/QA-01')}),201);
 await expect(d.call('sales/award','PATCH','finance',{document_id:x.body.id,review_kind:'finance',review_notes:'PO originals independently checked by Finance'}),200);
 d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.call('sales/award','PATCH','legal',{document_id:x.body.id,review_kind:'legal',review_notes:'PO originals independently checked by Legal'}),503);
 assert.equal(d.sql.prepare('SELECT legal_reviewed_by FROM india_sales_award_documents').get().legal_reviewed_by,null);
 await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),409);
}finally{d.close();}});
test('PO verification and final Won stage roll back when their audit fails',async()=>{const d=h();try{
 await d.awarded();d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),503);assert.equal(d.sql.prepare('SELECT * FROM india_sales_po_checks').get(),undefined);
 d.sql.exec('DROP TRIGGER fail_audit');await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);
 d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");
 await expect(d.stage('closed_won'),503);assert.equal(d.deal().stage,'pending_po');assert.ok(d.sql.prepare('SELECT * FROM india_sales_po_checks').get());
}finally{d.close();}});
test('actual approved quotation preview uses canonical D1 scope and keeps three-page renderer data',async()=>{const d=h();try{
 await d.approved();const x=await expect(d.call('sales/quotation','GET','sales',null,'?opportunity_id=opp-qa&output=preview'),200);
 assert.equal(x.body.proposal.quotation_number,fields.quotation_number);assert.equal(x.body.details.scope,fields.technical_scope);assert.equal(x.body.release_id,d.release().id);
 await expect(d.edit({technical_scope:'A revised scope requires approval before export'}),200);
 await expect(d.call('sales/quotation','GET','sales',null,'?opportunity_id=opp-qa&output=preview'),409);
}finally{d.close();}});
test('simultaneous Presales validations create only one active packet',async()=>{const d=h();try{const replies=await Promise.all([d.flow('scope','presales'),d.flow('scope','presales')]);assert.deepEqual(replies.map(x=>x.status).sort(),[201,409]);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_releases').get().n,1);}finally{d.close();}});
test('Closed Lost and Reopen preserve history but cannot reuse prior offer approval',async()=>{const d=h();try{await d.accepted();await expect(d.edit({lost_reason:'Budget cancelled',lost_notes:'Customer cancelled project in UAT'}),200);await expect(d.stage('closed_lost'),200);assert.equal(d.release(),undefined);await expect(d.stage('prospecting'),200);assert.equal(d.release(),undefined);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_releases').get().n,1);}finally{d.close();}});
test('migration preserves historical evidence and reopens legacy active offers for a reachable revalidation cycle',async()=>{const d=new Harness(false).seed();try{
 d.sql.prepare("UPDATE india_sales_opportunities SET stage='pending_po' WHERE id='opp-qa'").run();
 d.sql.prepare("INSERT INTO india_sales_submissions(id,tenant_id,opportunity_id,boq_id,quotation_number,boq_version,recipient_email,channel,sent_at,evidence_reference,evidence_sha256,status,created_by,verified_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run('legacy-receipt','defendit360','opp-qa',fields.boq_id,fields.quotation_number,1,'pic@flow.invalid','email',new Date().toISOString(),'archive/legacy','a'.repeat(64),'verified',users.sales,users.finance);
 const fs=require('node:fs'),path=require('node:path');d.sql.exec(fs.readFileSync(path.join(__dirname,'../migrations/0012_presales_po_transactions.sql'),'utf8'));
 assert.equal(d.deal().stage,'solution_design');assert.equal(d.sql.prepare('SELECT status FROM india_sales_submissions').get().status,'superseded');
 assert.ok(d.sql.prepare("SELECT * FROM india_sales_audit WHERE action='FLOW_REVALIDATION_REQUIRED'").get());assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_accounts').get().n,1);
 await expect(d.flow('scope','presales'),201);assert.deepEqual(d.sql.prepare('PRAGMA foreign_key_check').all(),[]);
}finally{d.close();}});
test('invalidated PO verification is retained in immutable history and rolls back with its parent edit',async()=>{const d=h();try{
 await d.awarded();await expect(d.call('sales','POST','finance',{entity:'verify_po',id:'opp-qa',confirmed_documents:true}),200);
 d.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON india_sales_audit BEGIN SELECT RAISE(ABORT,'injected audit failure'); END");await expect(d.edit({po_reference:'archive/new-original'}),503);assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_po_check_history').get().n,0);
 d.sql.exec('DROP TRIGGER fail_audit');await expect(d.edit({po_reference:'archive/new-original'}),200);
 const history=d.sql.prepare('SELECT * FROM india_sales_po_check_history').get();assert.equal(JSON.parse(history.snapshot_json).verified_by,users.finance);assert.equal(JSON.parse(history.snapshot_json).po_reference,fields.po_reference);
 assert.throws(()=>d.sql.exec('DELETE FROM india_sales_po_check_history'),/immutable/);
}finally{d.close();}});
test('expired quotation and malformed or future submission timestamps fail before any receipt is saved',async()=>{const d=h();try{
 await expect(d.flow('scope','presales'),201);await expect(d.edit({quotation_valid_until:'2026-01-01'}),200);await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal')}),422);
 await expect(d.edit({quotation_valid_until:'2026-11-21'}),200);await expect(d.flow('propose','sales',{...await d.proof('proposal','archive/proposal')}),200);await expect(d.flow('approve','approver'),200);for(const stage of ['solution_design','commercial_review','quotation_sent'])await expect(d.stage(stage),200);
 for(const sent_at of ['2026-02-31T01:00:00Z',new Date(Date.now()+86400000).toISOString(),'2020-01-01T01:00:00Z'])await expect(d.call('sales/submission','POST','sales',{opportunity_id:'opp-qa',channel:'email',recipient_email:'pic@flow.invalid',sent_at,...await d.proof('submission','archive/receipt')}),422);
 assert.equal(d.sql.prepare('SELECT count(*) n FROM india_sales_submissions').get().n,0);
}finally{d.close();}});
