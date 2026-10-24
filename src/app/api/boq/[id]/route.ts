import {enforceBoQApprovalPolicy} from '@/lib/system-settings';
import { NextResponse } from 'next/server';
import { authorizeBoQ, privateHeaders } from '@/lib/boq-auth';
import { validateBoQ,can } from '@/lib/boq-domain';
import { checkTransition } from '@/lib/boq-workflow';
import { checkBoqLink } from '@/lib/sales-boq-link';
import {atomicSales,transactionError} from '@/lib/sales-transactions';
import type {D1Prepared} from '@/lib/boq-auth';
export const dynamic='force-dynamic';
type Stored={id:string;tenant_id:string;status:string;version:number;quotation_number:string;line_items_json:string;cost_items_json:string;vat_rate:number;project_name:string;customer_name:string;service_type:string;opportunity_id:string|null;payment_terms:string;notes:string|null;created_by:string;updated_at:string;edit_seq:number};
const answer=(x:unknown,s=200)=>NextResponse.json(x,{status:s,headers:privateHeaders});
const err=(m:string,s=400)=>answer({success:false,message:m},s);
export async function PATCH(req:Request,ctx:{params:Promise<{id:string}>}){
 const auth=await authorizeBoQ(req);if(!auth.ok)return auth.response;
 const i=auth.identity;
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return err('Origin ditolak',403);
 try{
  const {id}=await ctx.params;
  if(!/^[a-f0-9-]{36}$/i.test(id))return err('ID tidak valid');
  const raw=await req.text();if(raw.length>140000)return err('Payload terlalu besar',413);
  const p=JSON.parse(raw),action=p.action;
  const row=await i.db.prepare('SELECT * FROM india_boq WHERE id=? AND tenant_id=?').bind(id,'defendit360').first<Stored>();
  if(!row)return err('BoQ tidak ditemukan',404);
  const owner=await i.db.prepare('SELECT id,company_id,title,stage,created_by,data_json FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind('defendit360',row.opportunity_id||'').first<{id:string;company_id:string;title:string;stage:string;created_by:string;data_json:string}>();
  const customer=owner?await i.db.prepare('SELECT id,legal_name FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind('defendit360',owner.company_id).first<{id:string;legal_name:string}>():null;
  const denied=checkBoqLink({...row,line_items:JSON.parse(row.line_items_json)},owner,customer,i.role,i.email);
  if(denied)return err(denied,403);
  let target=id;
  const writes:D1Prepared[]=[];
  if(action==='update'){
   if(row.status!=='draft'||!can(i.role,'edit_draft'))return err('Hanya draft yang boleh diperbarui',403);
   const previous={...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)};
   if(p.payload?.cost_items!==undefined&&!can(i.role,'edit_cost'))return err('Tidak memiliki izin mengubah HPP',403);
   const v=validateBoQ({...previous,...p.payload});
   if(!v.opportunity_id||v.opportunity_id!==row.opportunity_id)
    return err('Opportunity ID yang sudah ditautkan ke BoQ tidak boleh diubah. Buat BoQ baru untuk proyek lain.',409);
   const deal=await i.db.prepare('SELECT id,company_id,title,stage,created_by,data_json FROM india_sales_opportunities WHERE tenant_id=? AND id=?').bind('defendit360',v.opportunity_id).first<{id:string;company_id:string;title:string;stage:string;created_by:string;data_json:string}>();
   const account=deal?await i.db.prepare('SELECT id,legal_name FROM india_sales_accounts WHERE tenant_id=? AND id=?').bind('defendit360',deal.company_id).first<{id:string;legal_name:string}>():null;
   const linkError=checkBoqLink(v,deal,account,i.role,i.email);
   if(linkError)return err(linkError,409);
   writes.push(i.db.prepare("UPDATE india_boq SET project_name=?,customer_name=?,quotation_number=?,service_type=?,opportunity_id=?,vat_rate=?,payment_terms=?,line_items_json=?,cost_items_json=?,notes=?,updated_by=?,updated_at=?,edit_seq=edit_seq+1 WHERE id=? AND tenant_id=? AND status='draft' AND edit_seq=?")
   .bind(v.project_name,v.customer_name,v.quotation_number,v.service_type,v.opportunity_id||null,v.vat_rate,
    v.payment_terms,JSON.stringify(v.line_items),JSON.stringify(v.cost_items||[]),v.notes||null,
    i.email,new Date().toISOString(),id,'defendit360',row.edit_seq));
  }else if(action==='submit'){
   checkTransition('submit',{...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)},i);
   writes.push(i.db.prepare("UPDATE india_boq SET status='submitted',updated_by=?,updated_at=?,edit_seq=edit_seq+1 WHERE id=? AND tenant_id=? AND status='draft' AND edit_seq=?")
    .bind(i.email,new Date().toISOString(),id,'defendit360',row.edit_seq));
  }else if(action==='approve'){
   checkTransition('approve',{...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)},i,String(p.reason||''));
   await enforceBoQApprovalPolicy(i.db,row,i.role,String(p.reason||''));
   writes.push(i.db.prepare("UPDATE india_boq SET status='approved',approved_by=?,updated_by=?,updated_at=?,edit_seq=edit_seq+1 WHERE id=? AND tenant_id=? AND status='submitted' AND edit_seq=?")
    .bind(i.email,i.email,new Date().toISOString(),id,'defendit360',row.edit_seq));
  }else if(action==='reject'){
   checkTransition('reject',{...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)},i,String(p.reason||''));
   writes.push(i.db.prepare("UPDATE india_boq SET status='rejected',updated_by=?,updated_at=?,edit_seq=edit_seq+1 WHERE id=? AND tenant_id=? AND status='submitted' AND edit_seq=?")
    .bind(i.email,new Date().toISOString(),id,'defendit360',row.edit_seq));
  }else if(action==='revise'){
   checkTransition('revise',{...row,line_items:JSON.parse(row.line_items_json),cost_items:JSON.parse(row.cost_items_json)},i);
   target=crypto.randomUUID();
   writes.push(i.db.prepare("INSERT INTO india_boq(id,tenant_id,project_name,customer_name,quotation_number,service_type,opportunity_id,version,status,vat_rate,payment_terms,line_items_json,cost_items_json,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(target,'defendit360',row.project_name,row.customer_name,row.quotation_number,row.service_type,row.opportunity_id,
     row.version+1,'draft',row.vat_rate,row.payment_terms,row.line_items_json,row.cost_items_json,row.notes,i.email,i.email));
  }else return err('Aksi tidak dikenal');
  writes.push(i.db.prepare('INSERT INTO india_audit_log(id,tenant_id,boq_id,action,actor_email,summary) VALUES (?,?,?,?,?,?)')
    .bind(crypto.randomUUID(),'defendit360',target,action.toUpperCase(),i.email,String(p.reason||'').slice(0,500)));
  await atomicSales(i.db,"EXISTS(SELECT 1 FROM india_boq WHERE id=? AND tenant_id=? AND edit_seq=? AND status=?) AND EXISTS(SELECT 1 FROM india_sales_opportunities WHERE id=? AND tenant_id=? AND stage=? AND data_json=?)",[id,'defendit360',row.edit_seq,row.status,owner!.id,'defendit360',owner!.stage,owner!.data_json],writes);
  return answer({success:true,id:target});
 }catch(e){if(/FLOW_CONFLICT|CHECK constraint/.test(String(e))){const t=transactionError(e);return err(t.message,t.status);}const message=e instanceof Error?e.message:'Gagal memproses perubahan';return err(message,message.includes('UNIQUE constraint')?409:message.includes('Segregation of Duties')?403:message.includes('Approval Matrix')||message.includes('tidak boleh')||message.includes('Approver')||message.includes('diizinkan')?403:400);}
}
