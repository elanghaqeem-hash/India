// Test-only component harness. Never imported by src or deployed as an auth bypass.
// Uses the real client components and actual route handlers via the caller's SQLite fixture.
// Server authorization is tested separately against the unmodified built Next app.
const {build}=require('esbuild');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const bundles=new Map();
async function mountAdminComponent(page,base,url,component='SystemSettings',mode='parameters'){
 const key=component+':'+mode;
 if(!bundles.has(key)){
  const source=component==='SystemSettings'?'src/components/admin/SystemSettings.tsx':component==='Users'?'src/app/boq/users/page.tsx':'src/app/settings/ai/page.tsx';
  const result=await build({absWorkingDir:root,stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Component from './${source}';createRoot(document.getElementById('root')).render(<Component mode=${JSON.stringify(mode)}/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-next-navigation',setup(b){
   b.onResolve({filter:/^next\/(link|navigation)$/},a=>({path:a.path,namespace:'fixture-next'}));
   b.onLoad({filter:/.*/,namespace:'fixture-next'},a=>({contents:a.path==='next/link'?`import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children);}`:`export function usePathname(){return window.location.pathname;}`,resolveDir:root}));
  }}]});
  bundles.set(key,result.outputFiles[0].text);
 }
 // Reuse the production Tailwind CSS so mobile overflow checks remain meaningful.
 const files=fs.readdirSync(path.join(root,'.next/static/css')).filter(f=>f.endsWith('.css'));
 const styles=files.map(f=>`<link rel="stylesheet" href="/_next/static/css/${f}">`).join('');
 await page.route(base+url,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body class="bg-slate-50 p-3"><div id="root"></div><script>${bundles.get(key).replaceAll('</script','<\\/script')}</script></body></html>`}));
 await page.goto(base+url);
}
module.exports={mountAdminComponent};
