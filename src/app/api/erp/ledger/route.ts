import {authorizeBoQ} from '@/lib/boq-auth';
import {readBoundedJSON} from '@/lib/bounded-json';
import {TENANT} from '@/lib/sales-workflow';
import {erpReply,erpError,ERPError,erpAssert,erpId,erpText,erpOrigin,erpGrant,erpAtom,erpPositiveCents,erpPeriod} from '@/lib/erp-core';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;
 try{
  const unit=new URL(req.url).searchParams.get('legal_entity_id');
  erpAssert(erpId(unit),'Legal entity wajib');
  await erpGrant(a.identity,'finance_gl',unit);
  const {db}=a.identity;
  const [accounts,periods,journals]=await Promise.all([
   db.prepare('SELECT id,code,name,category,active FROM india_gl_accounts WHERE tenant_id=? AND legal_entity_id=? ORDER BY code LIMIT 500').bind(TENANT,unit).all(),
   db.prepare('SELECT id,period,status FROM india_gl_periods WHERE tenant_id=? AND legal_entity_id=? ORDER BY period DESC LIMIT 80').bind(TENANT,unit).all(),
   db.prepare("SELECT j.id,j.period_id,j.memo,j.source_type,j.source_key,j.status,j.version,j.created_by,j.reviewed_by,j.posted_by,coalesce((SELECT sum(l.debit_cents) FROM india_gl_lines l WHERE l.tenant_id=j.tenant_id AND l.journal_id=j.id),0) AS debit_cents FROM india_gl_journals j WHERE j.tenant_id=? AND j.legal_entity_id=? ORDER BY j.created_at DESC LIMIT 250").bind(TENANT,unit).all()]);
  return erpReply({success:true,accounts:accounts.results,periods:periods.results,journals:journals.results,posting_mode:'manual_human_approved_only'});
 }catch(e){return erpError(e);}
}
export async function POST(req:Request){
 const a=await authorizeBoQ(req);if(!a.ok)return a.response;const {db,email,role}=a.identity;
 try{
  erpOrigin(req);
  const v=await readBoundedJSON(req,16000) as Record<string,unknown>,action=v.action;
  if(action==='account'){
   erpAssert(role==='finance','Chart of Accounts hanya Finance dengan grant',403);
   erpAssert(erpId(v.legal_entity_id)&&erpText(v.code,2,30)&&erpText(v.name,3,160)&&['asset','liability','equity','revenue','expense'].includes(String(v.category)),'Data akun tidak valid');
   await erpGrant(a.identity,'finance_gl',v.legal_entity_id as string);
   const id=crypto.randomUUID();
   await erpAtom(a.identity,'1=1',[],[db.prepare('INSERT INTO india_gl_accounts(id,tenant_id,legal_entity_id,code,name,category,created_by) VALUES(?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.code as string,v.name as string,v.category as string,email)],'gl',id,'ACCOUNT_CREATE',{code:v.code});
   return erpReply({success:true,id},201);
  }
  if(action==='period'){
   erpAssert(role==='finance','Periode hanya Finance dengan grant',403);
   erpAssert(erpId(v.legal_entity_id)&&erpPeriod(v.period),'Periode akuntansi tidak valid');
   await erpGrant(a.identity,'finance_gl',v.legal_entity_id as string);
   const id=crypto.randomUUID();
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_erp_org_units WHERE tenant_id=? AND id=? AND kind='legal_entity' AND active=1)",[TENANT,v.legal_entity_id as string],[db.prepare('INSERT INTO india_gl_periods(id,tenant_id,legal_entity_id,period,created_by) VALUES(?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.period as string,email)],'gl',id,'PERIOD_OPEN',{period:v.period});
   return erpReply({success:true,id},201);
  }
  if(action==='journal'){
   erpAssert(role==='finance','Draft jurnal hanya Finance',403);
   erpAssert(erpId(v.legal_entity_id)&&erpId(v.period_id)&&erpText(v.memo,12,500)&&erpText(v.source_key,3,160)&&['manual','ar','ap','expense','reversal'].includes(String(v.source_type)),'Header jurnal tidak valid');
   const raw=v.lines;
   erpAssert(Array.isArray(raw)&&raw.length>=2&&raw.length<=100,'Jurnal harus memiliki 2–100 baris');
   const lines=raw as Record<string,unknown>[];
   let debits=0n,credits=0n;
   for(const line of lines){
    erpAssert(erpId(line.account_id)&&Number.isSafeInteger(line.debit_cents)&&Number.isSafeInteger(line.credit_cents),'Akun dan nilai baris harus integer sen');
    const d=line.debit_cents as number,c=line.credit_cents as number;
    erpAssert(d>=0&&c>=0&&d<900000000000000&&c<900000000000000&&(d>0)!==(c>0),'Setiap baris hanya debit atau kredit');
    debits+=BigInt(d);credits+=BigInt(c);
   }
   erpAssert(debits>0n&&debits===credits&&debits<BigInt(Number.MAX_SAFE_INTEGER),'Jurnal tidak seimbang');
   await erpGrant(a.identity,'finance_gl',v.legal_entity_id as string);
   const id=crypto.randomUUID();
   const writes=[db.prepare('INSERT INTO india_gl_journals(id,tenant_id,legal_entity_id,period_id,source_type,source_key,memo,created_by) VALUES(?,?,?,?,?,?,?,?)').bind(id,TENANT,v.legal_entity_id as string,v.period_id as string,v.source_type as string,v.source_key as string,(v.memo as string).trim(),email)];
   for(const line of lines)writes.push(db.prepare('INSERT INTO india_gl_lines(id,tenant_id,journal_id,account_id,debit_cents,credit_cents) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),TENANT,id,line.account_id as string,line.debit_cents as number,line.credit_cents as number));
   await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_gl_periods WHERE tenant_id=? AND id=? AND legal_entity_id=? AND status='open')",[TENANT,v.period_id as string,v.legal_entity_id as string],writes,'gl',id,'JOURNAL_DRAFT',{source_type:v.source_type,source_key:v.source_key,lines:lines.length});
   return erpReply({success:true,id},201);
  }
  if(action==='review'||action==='post'){
   erpAssert(erpId(v.id)&&Number.isSafeInteger(v.version),'ID dan versi jurnal wajib');
   const row=await db.prepare('SELECT id,legal_entity_id,created_by,reviewed_by,status,version FROM india_gl_journals WHERE tenant_id=? AND id=?').bind(TENANT,v.id as string).first<{legal_entity_id:string;created_by:string;reviewed_by:string|null;status:string;version:number}>();
   erpAssert(row,'Jurnal tidak ditemukan',404);await erpGrant(a.identity,'finance_gl',row.legal_entity_id);
   erpAssert(row.version===v.version,'Versi jurnal telah berubah',409);
   if(action==='review'){
    erpAssert(role==='approver','Persetujuan jurnal hanya Approver',403);
    erpAssert(row.status==='draft'&&row.created_by.toLowerCase()!==email,'Maker dilarang mengesahkan jurnal sendiri',403);
    erpAssert(typeof v.approve==='boolean'&&erpText(v.notes,12,800),'Keputusan dan catatan wajib');
    await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_gl_journals WHERE tenant_id=? AND id=? AND status='draft' AND version=? AND lower(created_by)!=?)",[TENANT,v.id as string,v.version as number,email],[db.prepare('UPDATE india_gl_journals SET status=?,version=version+1,reviewed_by=?,review_notes=?,reviewed_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?').bind(v.approve?'approved':'rejected',email,v.notes as string,TENANT,v.id as string)],'gl',v.id as string,'JOURNAL_REVIEW',{approved:v.approve});
   }else{
    erpAssert(role==='finance'&&row.status==='approved'&&!!row.reviewed_by&&row.reviewed_by.toLowerCase()!==email,'Hanya Finance dapat posting jurnal yang disetujui secara independen',403);
    await erpAtom(a.identity,"EXISTS(SELECT 1 FROM india_gl_journals WHERE tenant_id=? AND id=? AND status='approved' AND version=?)",[TENANT,v.id as string,v.version as number],[db.prepare("UPDATE india_gl_journals SET status='posted',version=version+1,posted_by=?,posted_at=CURRENT_TIMESTAMP WHERE tenant_id=? AND id=?").bind(email,TENANT,v.id as string)],'gl',v.id as string,'JOURNAL_POST',{version:v.version});
   }
   return erpReply({success:true});
  }
  throw new ERPError('Aksi GL tidak tersedia');
 }catch(e){return erpError(e);}
}
