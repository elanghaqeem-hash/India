// Minimal TypeScript loader for pure src/lib modules (no Next/Cloudflare runtime).
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'../..');const cache={};
function load(file){
 const abs=path.isAbsolute(file)?file:path.join(root,file);
 const f=fs.existsSync(abs)?abs:abs+'.ts';
 if(cache[f])return cache[f].exports;
 const mod={exports:{}};cache[f]=mod;
 const js=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(p=>p.startsWith('.')?load(path.join(path.dirname(f),p)):p.startsWith('@/')?load(path.join(root,'src',p.slice(2))):require(p),mod,mod.exports);
 return mod.exports;
}
module.exports={load,root};
