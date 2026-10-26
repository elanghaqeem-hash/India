const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('INDIA menu renders on the left and reuses role-filtered canonical navigation',()=>{
  const shell=read('src/components/layout/AppShell.tsx');
  const side=read('src/components/layout/Sidebar.tsx');
  assert.match(shell,/<Sidebar role=\{role\}[\s\S]+<main className=/);
  assert.match(side,/navigationForRole\(role\)/);
  assert.match(side,/group\.items\.filter/);
  assert.match(side,/aria-current=\{active\?'page'/);
  assert.match(side,/india-left-sidebar-desktop/);
  assert.match(side,/india-left-sidebar-mobile/);
  assert.match(side,/desktopOpen\?'w-80 border-r':'w-0'/);
  assert.match(side,/inset-y-0 left-0/);
  assert.match(side,/border-r border-white\/20/);
  assert.doesNotMatch(side,/inset-y-0 right-0/);

  assert.doesNotMatch(side,/const\s+roles\s*=|hardcodedUsers|demoAdmin/i);
});

test('header button toggles mobile drawer and desktop panel with accessible labels',()=>{
  const shell=read('src/components/layout/AppShell.tsx');
  const header=read('src/components/layout/Navbar.tsx');
  const side=read('src/components/layout/Sidebar.tsx');
  assert.match(shell,/useState\(true\)/);
  assert.match(shell,/setDesktopMenuOpen\(value=>!value\)/);
  assert.match(shell,/setMobileMenuOpen\(value=>!value\)/);
  assert.match(shell,/onToggleMenu=\{onToggleMenu\}/);
  assert.match(header,/aria-controls="india-left-sidebar-desktop" aria-expanded=\{desktopMenuOpen\}/);
  assert.match(header,/aria-controls="india-left-sidebar-mobile" aria-expanded=\{mobileMenuOpen\}/);
  assert.match(header,/PanelLeftClose/);
  assert.match(header,/PanelLeftOpen/);
  assert.ok(header.indexOf('india-left-sidebar-desktop')<header.indexOf('<Link href="/"'));

  assert.match(side,/onClick=\{onClose\}/);
  assert.match(side,/event\.key==='Escape'/);
  assert.match(side,/aria-modal="true"/);
  assert.match(side,/document\.body\.style\.overflow='hidden'/);
});

test('sidebar offers keyword search, active route, compact groups, and saved desktop preference',()=>{
  const side=read('src/components/layout/Sidebar.tsx');
  const shell=read('src/components/layout/AppShell.tsx');
  assert.match(side,/type="search"/);
  assert.match(side,/group\.label\.toLocaleLowerCase/);
  assert.match(side,/item\.label\.toLocaleLowerCase/);
  assert.match(side,/<details key=/);
  assert.match(side,/pathname\.startsWith\(item\.href\+'\/'\)/);
  assert.match(side,/bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900/);
  assert.match(shell,/localStorage\.getItem\('india:left-navigation-open'\)/);
  assert.match(shell,/localStorage\.setItem\('india:left-navigation-open'/);
});
