const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('src/app/post-po/page.tsx','utf8');
test('official PostPO forms reuse D1 Customer, Opportunity, dual PO review and genuine DOCX template',()=>{
 assert.match(s,/\/api\/sales\?entity=details&id=/);
 assert.match(s,/\/api\/sales\/award\?opportunity_id=/);
 assert.match(s,/hasDualVerifiedPO/);
 assert.match(s,/closed_won/);
 assert.match(s,/prefillFromSales/);
 assert.match(s,/downloadOfficialPostPoDocx/);
 assert.match(s,/validatePostPoPacket/);
 assert.doesNotMatch(s,/appStore|fillEmptyPostPoWithDummy|createDemoPostPoPacket|isDemo/);
});
test('official document is locked when canonical PO, amount, scope or signed approval diverges',()=>{
 assert.match(s,/const unchanged=/);
 assert.match(s,/data\.project\.poNumber===sourcePacket\.project\.poNumber/);
 assert.match(s,/JSON\.stringify\(data\.project\.milestones\)/);
 assert.match(s,/const ready=findings\.length===0&&!!linkedOpportunity&&awardValid&&unchanged/);
});
