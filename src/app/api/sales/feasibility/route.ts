import {authorizeBoQ,privateHeaders,type D1DB} from '@/lib/boq-auth';
import {TENANT,safeID} from '@/lib/sales-workflow';
import {canReadDeal} from '@/lib/sales-access';
import {readBoundedJSON,RequestBodyError} from '@/lib/bounded-json';
import {atomicSales,dealGuard,salesAudit,transactionError,type FlowDeal} from '@/lib/sales-transactions';
import {costTypes,evaluateFeasibility,validMonth,validatePlan,isoDate,type Allocation,type Cost,type FeasibilityPlan} from '@/lib/solution-feasibility';
export const dynamic='force-dynamic';
const roles=['admin','sales','presales','finance','approver'];
const reply=(x:unknown,status=200)=>Response.json(x,{status,headers:privateHeaders});
const fail=(message:string,status=400)=>reply({success:false,message},status);
const str=(x:unknown,n=400)=>typeof x==='string'&&x.trim().length<=n?x.trim():'';
const money=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<1e13&&Math.round(x*100)/100===x;
const positive=(x:unknown,n=1e6)=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=n;
const actorRoles={plan:['admin','presales'],resource:['admin','finance'],allocation:['admin','presales'],cost:['admin','finance'],review:['admin','finance','approver']} as const;
type Person={id:string;display_name:string;email:string;skills:string;capacity_pd_month:number;daily_cost_idr:number;active:number;version:number};
type Offer={id:string;vendor_id:string;scope:string;quantity:number;unit:string;unit_price_idr:number;capacity_confirmed:number;
 valid_until:string;status:string;vendor_status:string;vendor_valid_until:string;vendor_capacity:number;vendor_name:string};
const editable=['prospecting','qualified','discovery','solution_design'];
async function records(db:D1DB,id:string){
 const [plan,people,allocs,costs,offers]=await Promise.all([
  db.prepare('SELECT * FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,id).first<FeasibilityPlan>(),
  db.prepare('SELECT * FROM india_resource_people WHERE tenant_id=? ORDER BY display_name LIMIT 250').bind(TENANT).all<Person>(),
  db.prepare(`SELECT a.*,p.display_name,p.email,p.capacity_pd_month,p.active,
   (SELECT coalesce(sum(x.person_days),0) FROM india_resource_allocations x WHERE x.tenant_id=a.tenant_id AND x.person_id=a.person_id AND x.allocation_month=a.allocation_month AND x.status='active') total_pd_month
   FROM india_resource_allocations a JOIN india_resource_people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id
   WHERE a.tenant_id=? AND a.opportunity_id=? ORDER BY a.allocation_month,p.display_name LIMIT 500`).bind(TENANT,id).all<Allocation>(),
  db.prepare(`SELECT c.*,o.status offer_status,v.status vendor_status,o.unit offer_unit,o.quantity offer_qty,
   o.capacity_confirmed offer_capacity,o.unit_price_idr offer_unit_price,o.valid_until offer_expires,
   v.valid_until vendor_expires,v.capacity_units vendor_capacity,v.legal_name vendor_name
   FROM india_feasibility_costs c LEFT JOIN india_vendor_offers o ON o.id=c.supplier_offer_id AND o.tenant_id=c.tenant_id AND o.opportunity_id=c.opportunity_id
   LEFT JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id
   WHERE c.tenant_id=? AND c.opportunity_id=? ORDER BY c.created_at LIMIT 300`).bind(TENANT,id).all<Cost>(),
  db.prepare(`SELECT o.id,o.vendor_id,o.scope,o.quantity,o.unit,o.unit_price_idr,o.capacity_confirmed,o.valid_until,o.status,
   v.status vendor_status,v.valid_until vendor_valid_until,v.capacity_units vendor_capacity,v.legal_name vendor_name
   FROM india_vendor_offers o JOIN india_vendors v ON v.id=o.vendor_id AND v.tenant_id=o.tenant_id
   WHERE o.tenant_id=? AND o.opportunity_id=? ORDER BY o.created_at DESC LIMIT 150`).bind(TENANT,id).all<Offer>()
 ]);
 return {plan,people:people.results,allocations:allocs.results,costs:costs.results,offers:offers.results};
}
async function context(db:D1DB,id:string,role:string,email:string){
 const d=await db.prepare('SELECT * FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind(TENANT,id).first<FlowDeal>();
 if(!d)return {error:fail('Opportunity tidak ditemukan',404)};
 if(!canReadDeal(role as import('@/lib/sales-access').SalesRole,email,d.created_by))return {error:fail('Opportunity tidak boleh dibaca Sales ini',403)};
 return {d};
}
async function readReport(db:D1DB,d:FlowDeal){
 const data=await records(db,d.id);
 const report=evaluateFeasibility(data.plan,data.allocations,data.costs,d);
 const gate=data.plan?await db.prepare('SELECT is_gap FROM india_solution_feasibility_gaps WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{is_gap:number}>():null;
 return {data,report:{...report,ready:report.ready&&gate?.is_gap===0,sql_gate:gate?.is_gap===0}};
}
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Akses Feasibility ditolak',403);
 const id=new URL(req.url).searchParams.get('opportunity_id')||'';
 if(!safeID(id))return fail('Opportunity ID tidak valid',422);
 try{
  const c=await context(db,id,role,email);if(c.error)return c.error;
  const d=c.d!;
  const {data,report}=await readReport(db,d);
  const finance=['admin','finance','approver'].includes(role);
  const displayReport=finance?report:{...report,internal_cost_idr:null,external_cost_idr:null,total_cost_idr:null,revenue_idr:null,margin_pct:null};
  const publicPeople=data.people.map(x=>finance?x:{id:x.id,display_name:x.display_name,email:x.email,skills:x.skills,capacity_pd_month:x.capacity_pd_month,active:x.active,version:x.version});
  const publicCosts=finance?data.costs:data.costs.map(x=>({id:x.id,cost_type:x.cost_type,description:x.description,sku:x.sku,unit:x.unit,quantity:x.quantity,periods:x.periods,supplier_offer_id:x.supplier_offer_id}));
  const publicOffers=finance?data.offers:data.offers.map(x=>({id:x.id,vendor_name:x.vendor_name,scope:x.scope,unit:x.unit,valid_until:x.valid_until,status:x.status}));
  const publicAllocations=finance?data.allocations:data.allocations.map(({daily_cost_snapshot,...x})=>x);
  return reply({success:true,role,identityEmail:email,deal:{id,title:d.title,stage:d.stage,flow_version:d.flow_version},plan:data.plan,
   people:publicPeople,allocations:publicAllocations,costs:publicCosts,offers:publicOffers,report:displayReport});
 }catch{return fail('Modul Feasibility belum siap: pastikan migrasi D1 0016, 0021, 0022.',503);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 const {db,role,email}=a.identity;if(!roles.includes(role))return fail('Akses Feasibility ditolak',403);
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return fail('Origin ditolak',403);
 let p:Record<string,unknown>;
 try{p=await readBoundedJSON(req,18000);}catch(e){return fail(e instanceof Error?e.message:'JSON invalid',e instanceof RequestBodyError?e.status:400);}
 if(!safeID(p.opportunity_id)||!Number.isSafeInteger(p.flow_version))return fail('Opportunity dan flow_version wajib',422);
 try{
  const c=await context(db,p.opportunity_id as string,role,email);if(c.error)return c.error;
  const d=c.d!;
  if(d.flow_version!==p.flow_version)return fail('Data Opportunity berubah; muat ulang',409);
  if(!editable.includes(d.stage))return fail('Rencana Feasibility terkunci setelah Solution Design. Gunakan workflow revisi.',409);
  const action=str(p.action,40),id=crypto.randomUUID(),g=dealGuard(d);
  const writes:import('@/lib/boq-auth').D1Prepared[]=[];
  if(action==='plan'){
   if(!actorRoles.plan.includes(role as 'admin'|'presales'))return fail('Plan hanya untuk Presales/Admin',403);
   let x:ReturnType<typeof validatePlan>;
   try{x=validatePlan(p);}catch(e){return fail((e as Error).message,422);}
   const current=await db.prepare('SELECT id,version FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{id:string;version:number}>();
   if(current){
    if(p.version!==current.version)return fail('Versi plan sudah berubah',409);
    g.condition+=' AND EXISTS(SELECT 1 FROM india_feasibility_plans WHERE id=? AND version=?)';g.args.push(current.id,current.version);
    writes.push(db.prepare(`UPDATE india_feasibility_plans SET service_line=?,start_date=?,end_date=?,months=?,asset_count=?,pd_per_asset=?,retest_pct=?,coordination_pd=?,base_pd=?,coverage_hours=?,staffing=?,coverage_days=?,required_pd=?,target_margin_pct=?,status='draft',created_by=?,reviewed_by=NULL,review_notes=NULL,reviewed_at=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
     .bind(x.service_line,x.start_date,x.end_date,x.months,x.asset_count,x.pd_per_asset,x.retest_pct,x.coordination_pd,x.base_pd,x.coverage_hours,x.staffing,x.coverage_days,x.required_pd,x.target_margin_pct,email,current.id));
   }else{
    writes.push(db.prepare(`INSERT INTO india_feasibility_plans(id,tenant_id,opportunity_id,service_line,start_date,end_date,months,asset_count,pd_per_asset,retest_pct,coordination_pd,base_pd,coverage_hours,staffing,coverage_days,required_pd,target_margin_pct,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,TENANT,d.id,x.service_line,x.start_date,x.end_date,x.months,x.asset_count,x.pd_per_asset,x.retest_pct,x.coordination_pd,x.base_pd,x.coverage_hours,x.staffing,x.coverage_days,x.required_pd,x.target_margin_pct,email));
   }
  }else if(action==='resource'){
   if(!actorRoles.resource.includes(role as 'admin'|'finance'))return fail('Profil engineer dan HPP hanya Admin/Finance',403);
   const name=str(p.display_name,150),mail=str(p.email,200).toLowerCase(),skills=str(p.skills,600);
   if(name.length<3||!/^\S+@\S+\.\S+$/.test(mail)||skills.length<3||!positive(p.capacity_pd_month,31)||!money(p.daily_cost_idr))return fail('Engineer, skills, kapasitas PD/bulan dan HPP harus valid',422);
   writes.push(db.prepare('INSERT INTO india_resource_people(id,tenant_id,email,display_name,skills,capacity_pd_month,daily_cost_idr,created_by) VALUES (?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,mail,name,skills,p.capacity_pd_month as number,p.daily_cost_idr as number,email));
  }else if(action==='allocate'){
   if(!actorRoles.allocation.includes(role as 'admin'|'presales'))return fail('Alokasi engineer hanya Presales/Admin',403);
   if(!safeID(p.person_id)||!validMonth(p.allocation_month)||!positive(p.person_days,31)||!str(p.work_role,100))return fail('Engineer, bulan, role dan person-days wajib',422);
   const plan=await db.prepare('SELECT * FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<FeasibilityPlan>();
   if(!plan)return fail('Buat Feasibility Plan lebih dulu',409);
   if((p.allocation_month as string)<plan.start_date.slice(0,7)||(p.allocation_month as string)>plan.end_date.slice(0,7))return fail('Bulan di luar rentang delivery',422);
   const person=await db.prepare('SELECT * FROM india_resource_people WHERE tenant_id=? AND id=? AND active=1').bind(TENANT,p.person_id as string).first<Person>();
   if(!person)return fail('Engineer aktif tidak tersedia',409);
   g.condition+=' AND EXISTS(SELECT 1 FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=? AND version=?) AND EXISTS(SELECT 1 FROM india_resource_people WHERE tenant_id=? AND id=? AND active=1 AND capacity_pd_month>=?+coalesce((SELECT sum(person_days) FROM india_resource_allocations WHERE tenant_id=? AND person_id=? AND allocation_month=? AND status=\'active\'),0))';
   g.args.push(TENANT,d.id,plan.version,TENANT,person.id,p.person_days as number,TENANT,person.id,p.allocation_month as string);
   writes.push(db.prepare('INSERT INTO india_resource_allocations(id,tenant_id,opportunity_id,person_id,allocation_month,work_role,person_days,daily_cost_snapshot,created_by) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,d.id,person.id,p.allocation_month as string,str(p.work_role,100),p.person_days as number,person.daily_cost_idr,email));
  }else if(action==='cancel_allocation'){
   if(!actorRoles.allocation.includes(role as 'admin'|'presales'))return fail('Pembatalan alokasi hanya Presales/Admin',403);
   if(!safeID(p.id))return fail('ID alokasi tidak valid',422);
   const row=await db.prepare("SELECT id FROM india_resource_allocations WHERE tenant_id=? AND opportunity_id=? AND id=? AND status='active'").bind(TENANT,d.id,p.id as string).first();
   if(!row)return fail('Alokasi aktif tidak ditemukan',404);
   g.condition+=" AND EXISTS(SELECT 1 FROM india_resource_allocations WHERE id=? AND tenant_id=? AND opportunity_id=? AND status='active')";g.args.push(p.id as string,TENANT,d.id);
   writes.push(db.prepare("UPDATE india_resource_allocations SET status='cancelled' WHERE id=? AND tenant_id=? AND opportunity_id=? AND status='active'").bind(p.id as string,TENANT,d.id));
  }else if(action==='cost'){
   if(!actorRoles.cost.includes(role as 'admin'|'finance'))return fail('Costing hanya Finance/Admin',403);
   const kind=str(p.cost_type,30),description=str(p.description,300),sku=str(p.sku,100),unit=str(p.unit,60);
   const q=p.quantity,periods=p.periods,price=p.unit_price_idr,offerId=str(p.supplier_offer_id,100);
   if(!costTypes.includes(kind as typeof costTypes[number])||description.length<5||unit.length<1||!positive(q)||!Number.isInteger(periods)||Number(periods)<1||Number(periods)>60||!money(price)||
    (kind==='license'&&sku.length<2)||Number(q)*Number(periods)*Number(price)>=1e14||
    (offerId&&!safeID(offerId)))return fail('Jenis biaya, SKU lisensi, kuantitas, periode dan harga tidak valid',422);
   if(offerId){
    const o=await db.prepare(`SELECT o.*,v.status vendor_status,v.valid_until vendor_valid_until,v.capacity_units vendor_capacity FROM india_vendor_offers o
     JOIN india_vendors v ON v.tenant_id=o.tenant_id AND v.id=o.vendor_id WHERE o.tenant_id=? AND o.opportunity_id=? AND o.id=?`).bind(TENANT,d.id,offerId).first<Offer>();
    const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
    const f=JSON.parse(d.data_json||'{}') as Record<string,string>,until=isoDate(f.quotation_valid_until)?f.quotation_valid_until:today;
    if(!o||o.status!=='validated'||o.vendor_status!=='validated'||o.valid_until<today||o.valid_until<until||o.vendor_valid_until<today||o.vendor_valid_until<((await db.prepare('SELECT start_date FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=?').bind(TENANT,d.id).first<{start_date:string}>())?.start_date||today)
     ||o.unit!==unit||o.unit_price_idr!==price||o.quantity<Number(q)*Number(periods)||o.capacity_confirmed<Number(q)*Number(periods)||o.vendor_capacity<o.capacity_confirmed)
     return fail('Supplier quotation belum valid atau harga/unit/kapasitas/expiry tidak sesuai',409);
    g.condition+=" AND EXISTS(SELECT 1 FROM india_vendor_offers WHERE id=? AND tenant_id=? AND opportunity_id=? AND status='validated' AND unit_price_idr=? AND quantity>=?)";
    g.args.push(offerId,TENANT,d.id,price as number,Number(q)*Number(periods));
   }
   writes.push(db.prepare('INSERT INTO india_feasibility_costs(id,tenant_id,opportunity_id,cost_type,description,sku,unit,quantity,periods,unit_price_idr,supplier_offer_id,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,TENANT,d.id,kind,description,sku,unit,q as number,periods as number,price as number,offerId||null,email));
  }else if(action==='delete_cost'){
   if(!actorRoles.cost.includes(role as 'admin'|'finance'))return fail('Hanya Finance/Admin dapat menghapus cost line',403);
   if(!safeID(p.id))return fail('ID biaya tidak valid',422);
   g.condition+=' AND EXISTS(SELECT 1 FROM india_feasibility_costs WHERE tenant_id=? AND opportunity_id=? AND id=?)';g.args.push(TENANT,d.id,p.id as string);
   writes.push(db.prepare('DELETE FROM india_feasibility_costs WHERE tenant_id=? AND opportunity_id=? AND id=?').bind(TENANT,d.id,p.id as string));
  }else if(action==='review'){
   if(!actorRoles.review.includes(role as 'admin'|'finance'|'approver'))return fail('Reviewer feasibility harus Finance/Approver/Admin',403);
   if(!Number.isInteger(p.version)||!['approved','rejected'].includes(str(p.decision,20))||str(p.review_notes,1200).length<12)return fail('Versi, keputusan, dan catatan review minimal 12 karakter',422);
   const {data,report}=await readReport(db,d);
   if(!data.plan||data.plan.version!==p.version||data.plan.status!=='draft')return fail('Plan draft berubah atau belum tersedia',409);
   if(data.plan.created_by.toLowerCase()===email)return fail('Maker tidak boleh menyetujui rencananya sendiri',403);
   if(p.decision==='approved'&&!report.approval_ready)return fail('Feasibility belum siap: '+report.gaps.join('; '),409);
   g.condition+=' AND EXISTS(SELECT 1 FROM india_feasibility_plans WHERE tenant_id=? AND opportunity_id=? AND id=? AND version=? AND status=\'draft\')';
   g.args.push(TENANT,d.id,data.plan.id,data.plan.version);
   writes.push(db.prepare('UPDATE india_feasibility_plans SET status=?,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND opportunity_id=? AND id=? AND version=?')
    .bind(p.decision as string,email,str(p.review_notes,1200),TENANT,d.id,data.plan.id,data.plan.version));
  }else return fail('Aksi feasibility tidak terdaftar',422);
  writes.push(salesAudit(db,d.id,'FEASIBILITY_'+action.toUpperCase(),email,'Transaction '+(action==='review'?str(p.decision,20):id)));
  await atomicSales(db,g.condition,g.args,writes);
  return reply({success:true,id,action},201);
 }catch(e){
  const x=transactionError(e);
  if(/RESOURCE_CAPACITY_CONFLICT|FEASIBILITY_CONFLICT|constraint/i.test(String(e)))return fail('Konflik kapasitas, supplier, duplikasi atau versi. Muat ulang perencanaan.',409);
  return fail(x.message,x.status);
 }
}
