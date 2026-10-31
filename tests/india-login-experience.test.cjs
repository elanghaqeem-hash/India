const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

test('INDIA login is a complete branded entry with Access and logout',()=>{
 const page=read('src/app/login/page.tsx');
 assert.match(page,/Login INDIA/);
 assert.match(page,/TECHNOTAMA|Technotama/);
 assert.match(page,/Masuk dengan Cloudflare Access/);
 assert.match(page,/<a href="\/" /);
 assert.match(page,/href="\/cdn-cgi\/access\/logout"/);
 assert.match(page,/LoginSessionStatus/);
 assert.match(page,/min-h-\[100dvh\]/);
 assert.match(page,/lg:grid-cols/);
 assert.doesNotMatch(page,/type=['"]password['"]|input[^>]+name=['"]otp['"]|localStorage\.setItem/);
});
test('session panel reads server-verified identity and cannot accept a chosen user role',()=>{
 const panel=read('src/components/auth/LoginSessionStatus.tsx');
 const identity=read('src/app/api/sales/identity/route.ts');
 const auth=read('src/lib/boq-auth.ts');
 assert.match(panel,/fetch\('\/api\/sales\/identity'/);
 assert.match(panel,/credentials:'same-origin'/);
 assert.match(panel,/firstAccessibleHref\(role\)/);
 assert.match(panel,/status:response.status===401\?'signed-out':response.status===403\?'forbidden':'unavailable'/);
 assert.match(panel,/Buka workspace sesuai role/);
 assert.doesNotMatch(panel,/localStorage|document\.cookie|jwtVerify|setRole\(/);
 assert.match(identity,/authorizeBoQ\(req\)/);
 assert.match(auth,/jwtVerify\(token,keys/);
 assert.match(auth,/SELECT role,active FROM india_members WHERE email=\?/);
});
test('no malicious return URL or client role elevation is accepted',()=>{
 const page=read('src/app/login/page.tsx');
 const panel=read('src/components/auth/LoginSessionStatus.tsx');
 const root=read('src/app/page.tsx');
 assert.doesNotMatch(page,/searchParams|next=|redirectTo=|callbackUrl|window\.location/);
 assert.doesNotMatch(panel,/searchParams|next=|redirectTo=|callbackUrl|window\.location/);
 assert.match(root,/<Link href="\/login"/);
});
