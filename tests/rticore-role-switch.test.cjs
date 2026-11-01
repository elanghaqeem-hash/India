const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
const roles=['admin','marketing','finance','presales','sales','approver','legal','viewer'];

function loadTS(path,mocks={}){
  const module={exports:{}};
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
  }).outputText;
  new Function('require','module','exports','crypto',js)(
    name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),module,module.exports,{randomUUID}
  );
  return module.exports;
}
const preview=loadTS('src/lib/role-preview.ts',{'./boq-domain':{roles}});
const cookie=(role,email='admin@example.test',now=1730000000000)=>
  preview.ROLE_PREVIEW_COOKIE+'='+encodeURIComponent(preview.encodeRolePreview(email,role,now));

test('Role preview is bound to verified Admin email, role allowlist and one-hour expiry',()=>{
  const now=1730000000000;
  for(const role of roles.filter(x=>x!=='admin'))
    assert.equal(preview.rolePreviewFromCookie(cookie(role),'admin@example.test','admin',now+1000),role);
  assert.equal(preview.rolePreviewFromCookie(cookie('sales'),'admin@example.test','sales',now+1000),null);
  assert.equal(preview.rolePreviewFromCookie(cookie('finance'),'another@example.test','admin',now+1000),null);
  assert.equal(preview.rolePreviewFromCookie(cookie('sales'),'admin@example.test','admin',now+3600000),null);
  assert.equal(preview.rolePreviewFromCookie(cookie('admin'),'admin@example.test','admin',now+1000),null);
  assert.equal(preview.rolePreviewFromCookie(cookie('superadmin'),'admin@example.test','admin',now+1000),null);
  assert.equal(preview.rolePreviewFromCookie(cookie('finance','admin@example.test',now+86400000),'admin@example.test','admin',now),null);
  assert.equal(preview.rolePreviewFromCookie('rticore_role_preview=garbage','admin@example.test','admin',now),null);
});

function makeRoleRoute(role='admin',failAudit=false){
  const audit=[],writes=[];
  const db={prepare(sql){
    assert.match(sql,/INSERT INTO india_audit_log/);
    return {bind(...args){writes.push(args);return{async run(){if(failAudit)throw Error('Audit unavailable');audit.push(args);return {success:true};}};}};
  }};
  let observedOpts;
  const auth={authorizeBoQ:async(_req,options)=>{
    observedOpts=options;
    return {ok:true,identity:{email:'admin@example.test',role,assignedRole:role,rolePreview:false,db}};
  },privateHeaders:{'Cache-Control':'private, no-store'}};
  const NextResponse={json(body,options={}){
    const result=Response.json(body,{status:options.status||200,headers:options.headers||{}});
    result.cookies={set:(...args)=>{result.cookieValue=args;}};
    return result;
  }};
  const mod=loadTS('src/app/api/sales/role-switch/route.ts',{
    'next/server':{NextResponse},
    '@/lib/boq-auth':auth,
    '@/lib/boq-domain':{roles},
    '@/lib/enterprise-navigation':{firstAccessibleHref:r=>'/'+r},
    '@/lib/role-preview':preview,
    '@/lib/sales-workflow':{TENANT:'test'},
    '@/lib/bounded-json':{readBoundedJSON:req=>req.json(),RequestBodyError:class extends Error{}},
  });
  return {mod,audit,writes,options:()=>observedOpts};
}
function request(body,headers={}){
  return new Request('https://rticore.example.test/api/sales/role-switch',{
    method:'POST',headers:{Origin:'https://rticore.example.test','Content-Type':'application/json',...headers},
    body:JSON.stringify(body),
  });
}

test('Admin can switch to Sales and back; cookie is HttpOnly and audit is written',async()=>{
  const x=makeRoleRoute('admin');
  const changed=await x.mod.POST(request({role:'sales'}));
  assert.equal(changed.status,200);
  assert.deepEqual(x.options(),{ignoreRolePreview:true});
  assert.equal((await changed.json()).identity.role,'sales');
  assert.equal(changed.cookieValue[0],preview.ROLE_PREVIEW_COOKIE);
  assert.equal(changed.cookieValue[2].httpOnly,true);
  assert.equal(changed.cookieValue[2].sameSite,'strict');
  assert.equal(changed.cookieValue[2].maxAge,3600);
  assert.equal(x.audit.length,1);
  assert.match(x.audit[0][4],/admin -> sales/);
  const restored=await x.mod.POST(request({role:'admin'}));
  assert.equal(restored.status,200);
  assert.equal(restored.cookieValue[2].maxAge,0);
  assert.equal(x.audit.length,2);
});

test('Non-Admin, unsafe origins, invalid roles and failed audit cannot switch',async()=>{
  const nonAdmin=makeRoleRoute('sales');
  assert.equal((await nonAdmin.mod.POST(request({role:'admin'}))).status,403);
  assert.equal(nonAdmin.audit.length,0);
  const admin=makeRoleRoute('admin');
  assert.equal((await admin.mod.POST(request({role:'finance'},{Origin:'https://evil.invalid'}))).status,403);
  assert.equal((await admin.mod.POST(request({role:'finance'},{'sec-fetch-site':'cross-site'}))).status,403);
  assert.equal((await admin.mod.POST(request({role:'owner'}))).status,422);
  assert.equal(admin.audit.length,0);
  const failed=makeRoleRoute('admin',true);
  assert.equal((await failed.mod.POST(request({role:'viewer'}))).status,503);
});

test('Role switch is enforced at server authorizer, not merely client navigation',()=>{
  const auth=fs.readFileSync('src/lib/boq-auth.ts','utf8');
  const route=fs.readFileSync('src/app/api/sales/identity/route.ts','utf8');
  const nav=fs.readFileSync('src/components/layout/Navbar.tsx','utf8');
  assert.match(auth,/rolePreviewFromCookie\(request.headers.get\('cookie'\),email,member.role\)/);
  assert.match(auth,/accessRestricted\(db,path,role\)/);
  assert.match(auth,/path!=='\/api\/sales\/identity'/);
  assert.match(route,/assignedRole:auth.identity.assignedRole/);
  assert.match(nav,/assignedRole==='admin'/);
  assert.match(nav,/Ganti Role \/ Mode Uji/);
  assert.match(nav,/handleRoleSwitch\('admin'\)/);
  assert.match(nav,/fetch\('\/api\/sales\/role-switch'/);
  assert.doesNotMatch(nav,/document\.cookie\s*=/);
});
