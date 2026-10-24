#!/usr/bin/env node
/**
 * Fail-closed guard for deploying PR #30 to the existing isolated UAT Worker.
 * Generates only non-secret configuration. Never changes production bindings.
 */
import fs from 'node:fs';
const {env}=process;
const ACCOUNT='208155f241d4da84e1a6a9b44b7a8d28';
const WORKER='uat-india';
const DB='eaed652e-7322-4950-a304-dd50baa5de02';
const TEAM='green-heart-e2b0.cloudflareaccess.com';
const AUD='0ff25afa9e770fd7bff66b1395681cebcea32b309e5060a4ea8be858d658feb5';
const allowedSha=/^[0-9a-f]{40}$/;
function check(x,m){if(!x)throw Error('BLOCKED: '+m);}
function config(){
  check(env.INDIA_AI_UAT_DEPLOY_APPROVED==='YES_ISOLATED_UAT_ONLY','missing explicit UAT approval');
  check(allowedSha.test(env.GITHUB_SHA||''),'candidate SHA not pinned');
  check((env.INDIA_AI_UAT_WORKER||'')===WORKER,'Worker mismatch');
  check((env.INDIA_AI_UAT_DB||'')===DB,'D1 mismatch');
  check(!!env.CLOUDFLARE_API_TOKEN,'missing dedicated Cloudflare UAT deployment token');
}
async function run(){
  config();
  const endpoint='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+
    '/workers/scripts/'+WORKER+'/settings';
  const res=await fetch(endpoint,{headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN},
    redirect:'manual',signal:AbortSignal.timeout(15000)});
  check(res.status===200,'read-only Worker settings preflight failed');
  const result=await res.json();
  check(result.success===true,'Cloudflare settings not authenticated');
  const bindings=result.result?.bindings||[];
  function get(name){const v=bindings.filter(b=>b.name===name);check(v.length===1,name+' absent or duplicated');return v[0];}
  const db=get('INDIA_DB');
  check(['d1','d1_database'].includes(db.type) && (db.id||db.database_id)===DB,
    'UAT Worker is NOT bound to isolated UAT D1');
  check(get('INDIA_ACCESS_AUD').text===AUD,'UAT Access AUD does not match');
  check(get('INDIA_ACCESS_TEAM_DOMAIN').text===TEAM,'UAT Access team mismatch');
  const original=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));
  check(original.name==='india','unexpected source Wrangler config');
  const generated={...original,name:WORKER,
    d1_databases:[{binding:'INDIA_DB',database_name:'india-uat-users-db',database_id:DB}],
    vars:{INDIA_ACCESS_TEAM_DOMAIN:TEAM,INDIA_ACCESS_AUD:AUD,INDIA_RELEASE_SHA:env.GITHUB_SHA}
  };
  // No production database UUID may exist in generated configuration.
  check(!JSON.stringify(generated).includes('8395dd84-1b7d-4eaf-9990-1d8e75a42cb5'),
    'live D1 ID leaked into candidate config');
  fs.writeFileSync('wrangler.uat.ci.jsonc',JSON.stringify(generated,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({result:'PASS',task:'isolated UAT deployment preflight',
    worker:WORKER,d1:'isolated',source_sha:env.GITHUB_SHA,production:false}));
}
run().catch(e=>{
  console.error(JSON.stringify({result:'BLOCKED_OR_FAIL',task:'UAT deployment preflight',
    reason:String(e.message||e).slice(0,190),no_production_writes:true}));
  process.exitCode=2;
});
