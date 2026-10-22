const {spawn}=require('node:child_process');
async function main(){
 const port=await new Promise((resolve,reject)=>{const s=require('node:net').createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p',String(port)],{stdio:['ignore','pipe','pipe']});
 let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 try{
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch(base+'/sales/forecast',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  if(!ready)throw Error('Local production server not ready: '+logs);
  const test=spawn(process.execPath,['--test','tests/modules-13-15-browser.cjs'],{stdio:'inherit',env:{...process.env,INDIA_UAT_URL:base}});
  process.exitCode=await new Promise(resolve=>test.on('exit',code=>resolve(code??1)));
 }finally{server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
