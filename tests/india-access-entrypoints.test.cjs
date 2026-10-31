const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('INDIA account dropdown exposes Cloudflare Access logout on mobile and desktop',()=>{
  const navbar=read('src/components/layout/Navbar.tsx');
  const sidebar=read('src/components/layout/Sidebar.tsx');
  assert.match(navbar, /<details className="group relative min-w-0">/);
  assert.match(navbar, /aria-label="Menu akun dan logout"/);
  assert.match(navbar, /Keluar \/ Logout/);
  assert.match(navbar, /href="\/cdn-cgi\/access\/logout"/);
  assert.match(sidebar, /Keluar akun \/ Logout/);
  assert.match(sidebar, /href="\/cdn-cgi\/access\/logout"/);
  assert.doesNotMatch(navbar, /document\.cookie\s*=/);
});

test('INDIA login page uses Cloudflare Access instead of a second insecure password mechanism',()=>{
  const page=read('src/app/login/page.tsx');
  const shell=read('src/components/layout/AppShell.tsx');
  assert.match(page, /Login INDIA/);
  assert.match(page, /Masuk dengan Cloudflare Access/);
  assert.match(page, /<a href="\/" /);
  assert.match(page, /href="\/cdn-cgi\/access\/logout"/);
  assert.doesNotMatch(page, /type=["']password["']|localStorage\.setItem|jwtVerify\(/);
  assert.match(shell, /const isLoginPage=pathname==='\/login'/);
  assert.match(shell, /if\(isLoginPage\)return <>{children}<\/>/);
  assert.match(shell, /if\(isLoginPage\)return; \/\/ Public-facing login UI/);
  assert.match(shell, /Buka halaman login INDIA/);
});

test('real transactional identity remains JWT and D1 backed',()=>{
  const identity=read('src/app/api/sales/identity/route.ts');
  const auth=read('src/lib/boq-auth.ts');
  assert.match(identity, /authorizeBoQ\(req\)/);
  assert.match(auth, /jwtVerify\(token,keys/);
  assert.match(auth, /SELECT role,active FROM india_members WHERE email=\?/);
});
