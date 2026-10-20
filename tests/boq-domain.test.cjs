const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const text=fs.readFileSync(path.join(__dirname,'../src/lib/boq-domain.ts'),'utf8');
const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const obj={};new Function('exports','module',js)(obj,{exports:obj});
const standard={customer_name:'Test Client',project_name:'Test VAPT',quotation_number:'QT-TEST-2026',
 service_type:'VAPT',vat_rate:.11,payment_terms:'30-50-20',
 line_items:[{description:'VAPT API',quantity:2,unit:'Endpoint',unit_price:1500000,service_type:'VAPT'}]};
test('validates commercial BoQ, calculates tax, does not infer HPP',()=>{
 const p=obj.validateBoQ(standard);const t=obj.boqTotals(p.line_items,undefined,p.vat_rate);
 assert.equal(t.subtotal,3000000);assert.equal(t.vat_amount,330000);assert.equal(t.grand_total,3330000);
 assert.equal(t.hpp,null);assert.equal(t.margin,null);assert.equal(t.complete,false);
});
test('margin requires all A-E cost buckets including explicit zero',()=>{
 const line=obj.validateBoQ(standard).line_items;
 const incomplete=obj.boqTotals(line,[{code:'A',amount:750000}],0.11);
 assert.equal(incomplete.hpp,null);
 const complete=obj.boqTotals(line,[{code:'A',amount:750000},{code:'B',amount:100000},{code:'C',amount:0},{code:'D',amount:100000},{code:'E',amount:50000}],.11);
 assert.equal(complete.hpp,1000000);assert.equal(complete.complete,true);assert.equal(complete.margin,66.67);
});
test('rejects invalid quantities and negative prices',()=>{
 assert.throws(()=>obj.validateBoQ({...standard,line_items:[{...standard.line_items[0],quantity:0}]}));
 assert.throws(()=>obj.validateBoQ({...standard,line_items:[{...standard.line_items[0],unit_price:-1}]}));
 assert.throws(()=>obj.validateBoQ({...standard,vat_rate:1.5}));
});
test('rejects duplicate or fake HPP components',()=>{
 assert.throws(()=>obj.validateBoQ({...standard,cost_items:[{code:'A',amount:5},{code:'A',amount:6}]}));
 assert.throws(()=>obj.validateBoQ({...standard,cost_items:[{code:'F',amount:5}]}));
});
test('RBAC denies Sales to see costs or approve, allows Finance cost and Approver approval',()=>{
 assert.equal(obj.can('sales','read_cost'),false);
 assert.equal(obj.can('presales','read_cost'),false);
 assert.equal(obj.can('approver','approve'),true);
 assert.equal(obj.can('finance','edit_cost'),true);
 assert.equal(obj.can('viewer','create'),false);
 assert.equal(obj.can('admin','manage_members'),true);
});
