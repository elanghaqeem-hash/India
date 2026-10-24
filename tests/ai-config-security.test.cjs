const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const text=path=>readFileSync(join(root,path),'utf8');

test('all six providers are allowlisted and client cannot invent outbound endpoint',()=>{
 const registry=text('src/lib/ai-provider-registry.ts');
 for(const id of ['openai','gemini','anthropic','groq','openrouter','deepseek'])
  assert.match(registry,new RegExp("id:'"+id+"'"));
 assert.match(registry,/isProviderId/);
 assert.match(registry,/safeModel/);
 const vault=text('src/lib/ai-credential-vault.ts');
 assert.doesNotMatch(vault,/fetch\(.*userProvidedUrl/);
 for(const host of ['api.openai.com','generativelanguage.googleapis.com','api.anthropic.com','api.groq.com','openrouter.ai','api.deepseek.com'])
  assert.ok(vault.includes(host),host);
});
test('only server stores ciphertext; GET response cannot leak key, admin JWT protects requests',()=>{
 const route=text('src/app/api/ai/config/route.ts');
 const auth=text('src/lib/boq-auth.ts');
 const vault=text('src/lib/ai-credential-vault.ts');
 assert.match(route,/authorizeBoQ\(req\)/);
 assert.match(route,/auth\.identity\.role!=='admin'/);
 assert.match(auth,/jwtVerify/);
 assert.match(auth,/india_members/);
 assert.match(route,/listProviders/);
 assert.doesNotMatch(route,/config:\s*updated|configs:\s*appStore\.getAIConfigs/);
 assert.match(vault,/AES-GCM/);
 assert.match(vault,/crypto\.getRandomValues/);
 assert.match(vault,/INDIA_AI_ENCRYPTION_KEY/);
 assert.match(vault,/additionalData:utf8\.encode/);
 assert.match(vault,/INDIA-AI:/);
 const sql=text('migrations/0002_ai_connections.sql');
 assert.match(sql,/key_ciphertext TEXT/);
 assert.match(sql,/india_ai_config_audit/);
 assert.doesNotMatch(sql,/api_key_plaintext/);
});
test('AI generation is admin-gated and demo API stays blocked',()=>{
 const middleware=text('src/middleware.ts');
 assert.match(middleware, /'\/api\/ai\/config'/);
 assert.match(middleware, /'\/api\/ai\/generate'/);
 assert.match(middleware,/API demo nonpersisten dinonaktifkan/);
 const route=text('src/app/api/ai/generate/route.ts');
 assert.match(route,/auth\.identity\.role!=='admin'/);
 assert.match(route,/runPriorityChain/);
 assert.doesNotMatch(route,/appStore/);
 assert.doesNotMatch(route,/generateLocalExpertResponse/);
});
test('mobile link is reachable, browser does not show saved key values',()=>{
 const ui=text('src/app/settings/ai/page.tsx');
 const nav=text('src/components/layout/MobileNav.tsx');
 const sidebar=text('src/components/layout/Sidebar.tsx');
 const menu=text('src/lib/enterprise-navigation.ts');
 assert.match(ui,/type="password"/);
 assert.match(ui,/p\.hasKey/);
 assert.doesNotMatch(ui,/type={showKey/);
 assert.match(ui,/x-india-ai-admin/);
 assert.match(menu,/AI Connections & API Keys/);
 assert.match(nav,/navigationForRole/);
 assert.match(sidebar,/navigationForRole/);
});
