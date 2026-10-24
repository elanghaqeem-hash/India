/** No secrets or raw ciphertext are loaded into the read-only release gate. */
export const REQUIRED_PROVIDERS=Object.freeze([
 'openai','gemini','anthropic','groq','openrouter','deepseek','mistral'
]);
export function validateProviderCatalog(rows) {
 const fail=(message)=>{throw new Error('AI provider catalog: '+message);};
 if(!Array.isArray(rows)||rows.length!==REQUIRED_PROVIDERS.length)fail('seven stored provider records required');
 const ids=rows.map(row=>row.provider_id);
 if(new Set(ids).size!==REQUIRED_PROVIDERS.length ||
    REQUIRED_PROVIDERS.some(id=>!ids.includes(id)))fail('missing or unexpected provider ID');
 const priorities=rows.map(row=>Number(row.priority));
 if(priorities.some(x=>!Number.isInteger(x)) ||
    priorities.slice().sort((a,b)=>a-b).some((x,i)=>x!==i+1))
    fail('priorities must be unique and contiguous 1 through 7');
 for(const p of rows) {
  if(typeof p.model!=='string'||!p.model.trim())fail('blank model');
  if(Number(p.enabled)!==0 && Number(p.enabled)!==1)fail('invalid enabled state');
  if(Number(p.enabled)===1 && (Number(p.has_key)!==1 || Number(p.tested_ok)!==1))
    fail('enabled provider lacks encrypted key or successful real connection test');
 }
 return {providers:rows.length,enabled:rows.filter(p=>Number(p.enabled)===1).length};
}
