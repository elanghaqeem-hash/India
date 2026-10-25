const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const middleware=fs.readFileSync('src/middleware.ts','utf8');
const source=fs.readFileSync('src/app/api/reference/postal/route.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const area={
 region_code:'32.73.19.1001',postal_code:'40111',province_code:'32',province_name:'Jawa Barat',
 regency_code:'32.73',regency_name:'Kota Bandung',district_code:'32.73.19',
 district_name:'Sumur Bandung',village_name:'Braga',village_kind:'Kelurahan'
};
function route(role='sales',options={}){
 const calls=[];
 const auth={
  authorizeBoQ:async()=>options.unauthenticated?
   {ok:false,response:Response.json({success:false},{status:401})}:
   {ok:true,identity:{role,email:'test@uat.invalid',db:{}}},
  privateHeaders:{'Cache-Control':'private, no-store'}
 };
 const postal={
  postalRegex:/^[0-9]{5}$/,
  validPostalSearchQuery:q=>/^[0-9]{2,5}$/.test(q)||/^[a-zA-Z ]{3,50}$/.test(q),
  searchPostalSuggestions:async (_db,q)=>{
   if(options.ready===false)throw Error('Not ready');
   calls.push('q:'+q);
   return options.match===false?[]:[{postal_code:'40111',description:'Braga · Sumur Bandung · Kota Bandung'}];
  },
  findPostalAreasByCode:async (_db,code)=>{
   if(options.ready===false)throw Error('Not ready');
   calls.push(code);
   if(options.match===false)return [];
   if(options.overLimit)return Array.from({length:501},(_,i)=>({...area,region_code:'X'+i}));
   return [area];
  }
 };
 const mod={exports:{}};
 new Function('require','module','exports',js)(name=>{
  if(name==='@/lib/boq-auth')return auth;
  if(name==='@/lib/indonesia-postal')return postal;
  throw Error('Unexpected route import '+name);
 },mod,mod.exports);
 return {GET:mod.exports.GET,calls};
}
const request=postal=>new Request('https://india-uat.invalid/api/reference/postal?postal='+postal);
test('middleware allows only the authenticated reference endpoint',()=>{
 assert.ok(middleware.includes("'/api/reference/postal'"));
});
test('must authenticate before reading any postal record',async()=>{
 const r=route('sales',{unauthenticated:true});
 assert.equal((await r.GET(request('40111'))).status,401);
 assert.deepEqual(r.calls,[]);
});
test('viewer denied',async()=>{
 const r=route('viewer');
 assert.equal((await r.GET(request('40111'))).status,403);
 assert.deepEqual(r.calls,[]);
});
test('invalid 5-digit postal rejected before D1',async()=>{
 for(const p of ['123','abcde','123456']){
  const r=route('sales');assert.equal((await r.GET(request(p))).status,422);assert.deepEqual(r.calls,[]);
 }
});
test('unverified reference returns 503',async()=>{
 const r=route('admin',{ready:false});const out=await r.GET(request('40111'));
 assert.equal(out.status,503);assert.match((await out.json()).message,/belum tersedia/);
 assert.deepEqual(r.calls,[]);
});
test('verified result served through authorized postal helper',async()=>{
 const r=route('sales'),out=await r.GET(request('40111'));const data=await out.json();
 assert.equal(out.status,200);assert.equal(data.success,true);assert.deepEqual(r.calls,['40111']);
 assert.equal(data.areas[0].village_name,'Braga');
});
test('unknown postcode returns empty array',async()=>{
 const r=route('sales',{match:false}),out=await r.GET(request('12345'));assert.equal(out.status,200);
 assert.deepEqual((await out.json()).areas,[]);
});
test('over-limit postcode is not returned',async()=>{
 const r=route('sales',{overLimit:true}),out=await r.GET(request('40111'));assert.equal(out.status,409);
});

const suggest=q=>new Request('https://india-uat.invalid/api/reference/postal?q='+encodeURIComponent(q));
test('postcode search is authenticated and restricted to permitted roles',async()=>{
 const unauth=route('sales',{unauthenticated:true});
 assert.equal((await unauth.GET(suggest('Braga'))).status,401);assert.deepEqual(unauth.calls,[]);
 const denied=route('viewer');
 assert.equal((await denied.GET(suggest('Braga'))).status,403);assert.deepEqual(denied.calls,[]);
});
test('autocomplete validates search terms before accessing D1',async()=>{
 for(const q of ['J','1','%']){
  const r=route('sales');
  assert.equal((await r.GET(suggest(q))).status,422);
  assert.deepEqual(r.calls,[]);
 }
});
test('autocomplete suggests only authenticated codes from master data',async()=>{
 const r=route('sales'),resp=await r.GET(suggest('Braga'));
 assert.equal(resp.status,200);
 const data=await resp.json();assert.equal(data.success,true);
 assert.deepEqual(data.suggestions,[{postal_code:'40111',description:'Braga · Sumur Bandung · Kota Bandung'}]);
 assert.deepEqual(r.calls,['q:Braga']);
});
test('autocomplete does not claim ready when national reference is unavailable',async()=>{
 const r=route('sales',{ready:false});
 assert.equal((await r.GET(suggest('Braga'))).status,503);
});
