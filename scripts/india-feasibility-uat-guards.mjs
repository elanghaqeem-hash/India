// Pure guards shared by the live runner and its offline safety tests.
export const SHARED_UAT_DB='eaed652e-7322-4950-a304-dd50baa5de02';
export const RESTORED_UAT_DB='5b9b58de-be29-48bb-9023-018c7f15f68b';
export const ACCESS_TEAM='green-heart-e2b0.cloudflareaccess.com';

export function validateTarget(mode,worker,origin,db,sha){
 if(!['--preflight','--transactions'].includes(mode))throw Error('Unsupported UAT mode');
 if(!/^(uat|staging)-[a-z0-9-]+$/.test(worker))throw Error('Worker must have a UAT-only name');
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.port||base.pathname!=='/'||base.username||base.password||
  base.search||base.hash||base.hostname!==worker+'.elang-haqeem.workers.dev')
  throw Error('HTTPS origin must match the isolated UAT Worker');
 if(![SHARED_UAT_DB,RESTORED_UAT_DB].includes(db))throw Error('D1 must be a pinned INDIA UAT target');
 if(mode==='--transactions'&&db!==RESTORED_UAT_DB)
  throw Error('Transactions require the restored isolated clone; shared UAT is read-only');
 if(!/^[0-9a-f]{40}$/.test(sha||''))throw Error('Exact intended release SHA is required');
 return {mode,worker,base,db};
}

export function isAccessChallenge(status,location,origin){
 if(status<300||status>=400)return false;
 try{
  const url=new URL(location,origin);
  return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
   (url.hostname===ACCESS_TEAM||url.origin===origin)&&url.pathname.startsWith('/cdn-cgi/access/');
 }catch{return false;}
}

export function accessCookieHeaders(token){
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token||''))
  throw Error('A signed application JWT is required');
 // The client authenticates to Access with its application cookie. The edge
 // adds Cf-Access-Jwt-Assertion for the origin; the client must not forge it.
 return {Cookie:'CF_Authorization='+token,Accept:'application/json'};
}

export function validateMemberRoles(people,rows){
 const expected=Object.values(people);
 const normalize=email=>String(email||'').trim().toLowerCase();
 if(expected.length!==6||new Set(expected.map(p=>normalize(p.email))).size!==6)
  throw Error('Six distinct signed role identities are required');
 for(const person of expected){
  const matches=rows.filter(row=>normalize(row.email)===normalize(person.email));
  if(matches.length!==1||matches[0].active!==1||matches[0].role!==person.role)
   throw Error('Active D1 role does not match signed identity: '+person.label);
 }
}
