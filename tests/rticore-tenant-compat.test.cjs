const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('src/lib/sales-workflow.ts','utf8');
const harness=fs.readFileSync('tests/helpers/sales-flow-harness.cjs','utf8');
test('persistent D1 tenant key remains the historical tenant even after UI rebranding',()=>{
  assert.match(source,/export const TENANT='defendit360';/);
  assert.match(harness,/tenant='defendit360'/);
  assert.doesNotMatch(source,/export const TENANT='RTI'/);
});
