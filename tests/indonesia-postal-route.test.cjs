const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');

const middleware=fs.readFileSync('src/middleware.ts','utf8');
const source=fs.readFileSync('src/app/api/reference/postal/route.ts','utf8');
const code=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

const area={
 region_code:'32.73.19.1001',postal_code:'40111',province_code:'32',province_name:'Jawa Barat',
 regency_code:'32.73',regency_name:'Kota Bandung',district_code:'32.73.19',
 district_name:'Sumur Bandung',village_name:'Braga',village_kind:'Kelurahan'
};

function route(role='sales', options={}){
 const called=[];
 const db={prepare(sql){
  called.push(sql);
  if(sql.includes('india_postal_areas')){
   return {bind(postal){
    return {all:async()=>{
     assert.equal(postal,options.postal||'40111');
     return {results:options.match===false?[]:[area]};
    }};
   }};
  }
  throw Error('unexpected D1 query');
 }};
 const auth={
  authorizeBoQ:async()=>options.unauthenticated?
   {ok:false,response:Response.json({success:false,message:'Login diperlukan'},{status:401})}:
   {ok:true,identity:{role,email:'test@uat.invalid',db}},
  privateHeaders:{'Cache-Control':'private, no-store'}
 };
 const mod={exports:{}};
 new Function('require','module','exports',code)(key=>{
  if(key==='@/lib/boq-auth')return auth;
  if(key==='@/lib/indonesia-postal')return {
   postalRegex:/^[0-9]{5}$/,
   assertPostalReferenceReady:async()=>{if(options.ready===false)throw Error('Master belum siap');return 'UAT';}
  };
  throw Error('Unexpected import '+key);
 },mod,mod.exports);
 return {GET:mod.exports.GET,called};
}

test('middleware routes reference endpoint to authenticated handler',()=>{
 assert.match(middleware,/path==='\\/api\\/reference\\/postal'/);
});
test('postcode lookup requires Cloudflare Access before D1',async()=>{
 const r=route('sales',{unauthenticated:true});
 const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal=40111'));
 assert.equal(out.status,401);assert.equal(r.called.length,0);
});
test('viewer cannot enumerate postal reference',async()=>{
 const r=route('viewer');
 const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal=40111'));
 assert.equal(out.status,403);assert.equal(r.called.length,0);
});
test('non-five-digit postal rejected before D1',async()=>{
 for(const postal of ['123','abcde','123456']){
  const r=route('sales');
  const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal='+postal));
  assert.equal(out.status,422);assert.equal(r.called.length,0);
 }
});
test('unverified reference fails closed with actionable 503',async()=>{
 const r=route('admin',{ready:false});
 const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal=40111'));
 assert.equal(out.status,503);assert.match((await out.json()).message,/belum selesai/);assert.equal(r.called.length,0);
});
test('ready reference returns real matches, bound by postal code',async()=>{
 const r=route('sales');
 const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal=40111'));
 assert.equal(out.status,200);
 const body=await out.json();
 assert.equal(body.success,true);assert.equal(body.areas.length,1);
 assert.equal(body.areas[0].village_name,'Braga');
 assert.ok(r.called[0].includes('WHERE postal_code=?'));
});
test('not found postal remains empty, never fabricated',async()=>{
 const r=route('sales',{postal:'12345',match:false});
 const out=await r.GET(new Request('https://india-uat.invalid/api/reference/postal?postal=12345'));
 assert.equal(out.status,200);
 const body=await out.json();
 assert.deepEqual(body.areas,[]);
});
